from datetime import datetime, timezone
import re
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from app.models.models import EmergencyEvent, Hazard, AuditLog
from app.graph.graph_engine import graph_engine
from app.api.ws_manager import ws_manager
from app.notifications.push_service import push_service

class EmergencyService:
    def get_active_emergency(self, db: Session) -> Optional[EmergencyEvent]:
        return db.query(EmergencyEvent).filter(
            EmergencyEvent.status.in_(["active", "under_verification"])
        ).order_by(EmergencyEvent.activated_at.desc()).first()

    def get_emergency_history(self, db: Session, limit: int = 50) -> List[EmergencyEvent]:
        return db.query(EmergencyEvent).order_by(EmergencyEvent.reported_at.desc()).limit(limit).all()

    async def activate_emergency(
        self,
        db: Session,
        emergency_type: str,
        building_name: str,
        floor: str,
        location: str,
        node_id: Optional[str] = None,
        severity: str = "high",
        description: str = "",
        is_simulation: bool = False,
        activated_by: str = "Safety Command"
    ) -> EmergencyEvent:
        now_utc = datetime.now(timezone.utc)
        # Strip prefixes like "F2-", "F1-", "GF-" from display location so no "F2" appears in front of room number
        clean_location = location
        if clean_location:
            clean_location = re.sub(r'^(F\d+|GF)[-_ ]+', '', clean_location, flags=re.I).strip()
            if re.match(r'^\d+[A-Za-z]?$', clean_location):
                clean_location = f"Room {clean_location}"

        # If an active emergency already exists, archive/resolve it before activating the new protocol
        active = self.get_active_emergency(db)
        if active and active.status == "active":
            active.status = "resolved"
            active.resolved_at = now_utc
            active.resolution_notes = f"Superseded by new emergency: {emergency_type.upper()} at {clean_location}"
            for h in active.hazards:
                h.is_active = False

        event = EmergencyEvent(
            emergency_type=emergency_type,
            building_name=building_name,
            floor=floor,
            location=clean_location,
            node_id=node_id,
            severity=severity,
            description=description,
            status="active",
            is_simulation=is_simulation,
            activated_by=activated_by,
            reported_by=activated_by,
            reported_at=now_utc,
            activated_at=now_utc
        )
        db.add(event)
        db.flush()

        # If location corresponds to a node, create an initial hazard
        target_node = node_id
        if not target_node:
            # Try to resolve node by location or label
            for n in graph_engine.nodes_dict.values():
                if location.lower() in n.get("label", "").lower() or location.lower() in n.get("id", "").lower():
                    target_node = n["id"]
                    break

        if target_node:
            initial_hazard = Hazard(
                emergency_id=event.id,
                hazard_type=emergency_type.lower(),
                floor=floor,
                node_id=target_node,
                severity=severity,
                description=f"Primary source of {emergency_type} at {location}",
                is_active=True
            )
            db.add(initial_hazard)

        # Audit log
        audit = AuditLog(
            action="EMERGENCY_ACTIVATED",
            user_email=activated_by,
            details=f"Activated {emergency_type} ({severity}) on {floor}, {location}. Simulation={is_simulation}."
        )
        db.add(audit)
        db.commit()
        db.refresh(event)

        # Broadcast push notification
        push_stats = push_service.broadcast_emergency_alert(
            db=db,
            emergency_id=event.id,
            emergency_type=event.emergency_type,
            floor=event.floor,
            location=event.location,
            is_simulation=event.is_simulation
        )

        # Broadcast via WebSockets
        event_dict = {
            "id": event.id,
            "emergency_type": event.emergency_type,
            "building_name": event.building_name,
            "floor": event.floor,
            "location": event.location,
            "node_id": target_node,
            "severity": event.severity,
            "description": event.description,
            "status": event.status,
            "is_simulation": event.is_simulation,
            "activated_at": event.activated_at.isoformat() if event.activated_at else None,
            "push_stats": push_stats
        }
        await ws_manager.broadcast("EMERGENCY_ACTIVATED", event_dict)
        return event

    async def add_hazard(
        self,
        db: Session,
        emergency_id: int,
        hazard_type: str,
        floor: str,
        node_id: Optional[str] = None,
        edge_source: Optional[str] = None,
        edge_target: Optional[str] = None,
        severity: str = "high",
        description: str = ""
    ) -> Hazard:
        hazard = Hazard(
            emergency_id=emergency_id,
            hazard_type=hazard_type.lower(),
            floor=floor,
            node_id=node_id,
            edge_source=edge_source,
            edge_target=edge_target,
            severity=severity,
            description=description,
            is_active=True
        )
        db.add(hazard)
        db.commit()
        db.refresh(hazard)

        # Broadcast hazard update and route recalculation
        h_data = {
            "id": hazard.id,
            "emergency_id": emergency_id,
            "hazard_type": hazard.hazard_type,
            "floor": hazard.floor,
            "node_id": hazard.node_id,
            "edge_source": hazard.edge_source,
            "edge_target": hazard.edge_target,
            "severity": hazard.severity,
            "description": hazard.description
        }
        await ws_manager.broadcast("HAZARD_UPDATED", h_data)
        await ws_manager.broadcast("ROUTE_RECALCULATION_NEEDED", {"reason": "hazard_added", "hazard": h_data})
        return hazard

    async def clear_hazard(self, db: Session, hazard_id: int) -> bool:
        h = db.query(Hazard).filter(Hazard.id == hazard_id).first()
        if not h:
            return False
        h.is_active = False
        db.commit()
        await ws_manager.broadcast("HAZARD_REMOVED", {"hazard_id": hazard_id})
        await ws_manager.broadcast("ROUTE_RECALCULATION_NEEDED", {"reason": "hazard_removed", "hazard_id": hazard_id})
        return True

    async def resolve_emergency(
        self,
        db: Session,
        emergency_id: int,
        resolution_notes: str,
        resolved_by: str
    ) -> Optional[EmergencyEvent]:
        event = db.query(EmergencyEvent).filter(EmergencyEvent.id == emergency_id).first()
        if not event:
            return None

        event.status = "resolved"
        event.resolved_at = datetime.now(timezone.utc)
        event.resolution_notes = resolution_notes
        
        # Deactivate all active hazards for this emergency
        for h in event.hazards:
            h.is_active = False

        audit = AuditLog(
            action="EMERGENCY_RESOLVED",
            user_email=resolved_by,
            details=f"Resolved emergency #{emergency_id}. Notes: {resolution_notes}"
        )
        db.add(audit)
        db.commit()
        db.refresh(event)

        # Send push & WebSockets all-clear
        push_service.broadcast_resolution_alert(db, emergency_id, resolution_notes)
        await ws_manager.broadcast("EMERGENCY_RESOLVED", {
            "id": event.id,
            "status": "resolved",
            "resolution_notes": resolution_notes,
            "resolved_at": event.resolved_at.isoformat()
        })
        return event

emergency_service = EmergencyService()
