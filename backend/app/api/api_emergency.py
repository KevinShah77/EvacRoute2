from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import EmergencyEvent, Hazard, EmergencyReport, AuditLog, User, SOSRequest, AssemblyCheckin
from app.authentication.auth_handler import get_current_user, require_roles, get_optional_current_user
from app.emergency.emergency_service import emergency_service
from app.api.ws_manager import ws_manager

router = APIRouter(prefix="/emergency", tags=["Emergency Management"])

class ActivateEmergencyRequest(BaseModel):
    emergency_type: str  # 'fire', 'smoke', 'gas', 'structural', 'blocked', 'general'
    building_name: str = "Main Academic Complex"
    floor: str           # 'Floor 2'
    location: str        # 'Room 205'
    node_id: Optional[str] = None
    severity: str = "high"
    description: Optional[str] = None
    is_simulation: bool = False

class ReportEmergencyRequest(BaseModel):
    reporter_name: str
    contact: Optional[str] = None
    emergency_type: str
    floor: str
    location: str
    description: Optional[str] = None

class ResolveEmergencyRequest(BaseModel):
    emergency_id: int
    resolution_notes: str

class VerifyReportRequest(BaseModel):
    action: str  # 'confirm' or 'dismiss'
    severity: Optional[str] = "high"
    is_simulation: bool = False

class AnnouncementRequest(BaseModel):
    title: str
    message: str
    priority: str = "urgent"

class SOSCreateRequest(BaseModel):
    user_name: Optional[str] = None
    user_role: Optional[str] = "student"
    contact: Optional[str] = None
    floor: str
    location: str
    node_id: Optional[str] = None
    situation: str = "trapped"  # 'trapped', 'injured', 'assistance', 'smoke', 'other'
    details: Optional[str] = None

class SOSAcknowledgeRequest(BaseModel):
    responder_name: Optional[str] = None
    notes: Optional[str] = None

class CheckinRequest(BaseModel):
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    assembly_point_id: str
    assembly_point_name: Optional[str] = None
    floor: Optional[str] = "Ground"

@router.get("/active")
def get_active_emergency(db: Session = Depends(get_db)):
    event = emergency_service.get_active_emergency(db)
    if not event:
        return {"active": False, "emergency": None, "hazards": []}

    hazards = [
        {
            "id": h.id,
            "hazard_type": h.hazard_type,
            "floor": h.floor,
            "node_id": h.node_id,
            "edge_source": h.edge_source,
            "edge_target": h.edge_target,
            "severity": h.severity,
            "description": h.description,
            "is_active": h.is_active
        }
        for h in event.hazards if h.is_active
    ]

    return {
        "active": True,
        "emergency": {
            "id": event.id,
            "emergency_type": event.emergency_type,
            "building_name": event.building_name,
            "floor": event.floor,
            "location": event.location,
            "node_id": event.node_id,
            "severity": event.severity,
            "description": event.description,
            "status": event.status,
            "is_simulation": event.is_simulation,
            "reported_by": event.reported_by,
            "activated_by": event.activated_by,
            "activated_at": event.activated_at.isoformat() if event.activated_at else None
        },
        "hazards": hazards
    }

@router.post("/activate")
async def activate_emergency(
    req: ActivateEmergencyRequest,
    current_user: User = Depends(require_roles(["admin"])),
    db: Session = Depends(get_db)
):
    event = await emergency_service.activate_emergency(
        db=db,
        emergency_type=req.emergency_type,
        building_name=req.building_name,
        floor=req.floor,
        location=req.location,
        node_id=req.node_id,
        severity=req.severity,
        description=req.description or f"Emergency activated by {current_user.full_name}",
        is_simulation=req.is_simulation,
        activated_by=current_user.email
    )
    return {
        "success": True,
        "message": f"{'Simulated ' if req.is_simulation else ''}Emergency activated successfully",
        "emergency_id": event.id,
        "status": event.status
    }

@router.post("/report")
async def report_emergency(
    req: ReportEmergencyRequest,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    reporter_role = current_user.role if current_user else "student"
    reporter_name = req.reporter_name or (current_user.full_name if current_user else "Anonymous Campus Occupant")
    
    report = EmergencyReport(
        reporter_name=reporter_name,
        reporter_role=reporter_role,
        contact=req.contact,
        emergency_type=req.emergency_type,
        floor=req.floor,
        location=req.location,
        description=req.description,
        status="pending"
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    # Broadcast to safety officer console via WebSockets
    await ws_manager.broadcast("NEW_EMERGENCY_REPORT", {
        "report_id": report.id,
        "reporter_name": report.reporter_name,
        "emergency_type": report.emergency_type,
        "floor": report.floor,
        "location": report.location,
        "description": report.description,
        "created_at": report.created_at.isoformat()
    })

    return {
        "success": True,
        "report_id": report.id,
        "message": "Emergency report submitted to campus safety officer for immediate verification."
    }

@router.get("/reports")
def get_reports(
    status_filter: Optional[str] = None,
    current_user: User = Depends(require_roles(["admin", "staff"])),
    db: Session = Depends(get_db)
):
    query = db.query(EmergencyReport)
    if status_filter:
        query = query.filter(EmergencyReport.status == status_filter)
    reports = query.order_by(EmergencyReport.created_at.desc()).all()
    return [
        {
            "id": r.id,
            "reporter_name": r.reporter_name,
            "reporter_role": r.reporter_role,
            "contact": r.contact,
            "emergency_type": r.emergency_type,
            "floor": r.floor,
            "location": r.location,
            "description": r.description,
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "verified_at": r.verified_at.isoformat() if r.verified_at else None,
            "verified_by": r.verified_by
        }
        for r in reports
    ]

@router.post("/reports/{report_id}/verify")
async def verify_report(
    report_id: int,
    req: VerifyReportRequest,
    current_user: User = Depends(require_roles(["admin"])),
    db: Session = Depends(get_db)
):
    report = db.query(EmergencyReport).filter(EmergencyReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if req.action == "confirm":
        report.status = "verified"
        report.verified_at = datetime.now(timezone.utc)
        report.verified_by = current_user.email
        db.commit()

        # Promote to active emergency
        event = await emergency_service.activate_emergency(
            db=db,
            emergency_type=report.emergency_type,
            building_name="Main Academic Complex",
            floor=report.floor,
            location=report.location,
            severity=req.severity or "high",
            description=f"Confirmed from report #{report.id}: {report.description or ''}",
            is_simulation=req.is_simulation,
            activated_by=current_user.email
        )
        return {"success": True, "action": "confirmed", "emergency_id": event.id}
    else:
        report.status = "dismissed"
        report.verified_at = datetime.utcnow()
        report.verified_by = current_user.email
        db.commit()
        return {"success": True, "action": "dismissed"}

@router.post("/resolve")
async def resolve_emergency(
    req: ResolveEmergencyRequest,
    current_user: User = Depends(require_roles(["admin"])),
    db: Session = Depends(get_db)
):
    event = await emergency_service.resolve_emergency(
        db=db,
        emergency_id=req.emergency_id,
        resolution_notes=req.resolution_notes,
        resolved_by=current_user.email
    )
    if not event:
        raise HTTPException(status_code=404, detail="Emergency event not found")
    return {"success": True, "message": "Emergency successfully resolved and campus marked all-clear."}

@router.get("/history")
def get_emergency_history(limit: int = 50, db: Session = Depends(get_db)):
    events = emergency_service.get_emergency_history(db, limit)
    return [
        {
            "id": e.id,
            "emergency_type": e.emergency_type,
            "building_name": e.building_name,
            "floor": e.floor,
            "location": e.location,
            "severity": e.severity,
            "description": e.description,
            "status": e.status,
            "is_simulation": e.is_simulation,
            "reported_by": e.reported_by,
            "activated_by": e.activated_by,
            "activated_at": e.activated_at.isoformat() if e.activated_at else None,
            "resolved_at": e.resolved_at.isoformat() if e.resolved_at else None,
            "resolution_notes": e.resolution_notes
        }
        for e in events
    ]

@router.post("/announcement")
async def broadcast_announcement(
    req: AnnouncementRequest,
    current_user: User = Depends(require_roles(["admin"])),
    db: Session = Depends(get_db)
):
    await ws_manager.broadcast("ANNOUNCEMENT", {
        "title": req.title,
        "message": req.message,
        "priority": req.priority,
        "sender": current_user.full_name,
        "timestamp": datetime.utcnow().isoformat()
    })
    return {"success": True, "message": "Announcement broadcast successfully."}

# ==================== SOS EMERGENCY ASSISTANCE ====================

@router.post("/sos")
async def send_sos_request(
    req: SOSCreateRequest,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    user_name = req.user_name or (current_user.full_name if current_user else "Campus Occupant")
    user_role = current_user.role if current_user else (req.user_role or "student")
    user_id = current_user.id if current_user else None

    sos = SOSRequest(
        user_id=user_id,
        user_name=user_name,
        user_role=user_role,
        contact=req.contact or (current_user.phone if current_user else None),
        floor=req.floor,
        location=req.location,
        node_id=req.node_id,
        situation=req.situation,
        details=req.details,
        status="pending"
    )
    db.add(sos)
    db.commit()
    db.refresh(sos)

    # Broadcast to safety officer and responder consoles
    await ws_manager.broadcast("NEW_SOS_REQUEST", {
        "id": sos.id,
        "user_name": sos.user_name,
        "user_role": sos.user_role,
        "floor": sos.floor,
        "location": sos.location,
        "situation": sos.situation,
        "details": sos.details,
        "status": sos.status,
        "created_at": sos.created_at.isoformat()
    })

    return {
        "success": True,
        "message": "Emergency SOS transmitted to Campus Safety Command and First Responders.",
        "sos_id": sos.id,
        "status": sos.status,
        "floor": sos.floor,
        "location": sos.location
    }

@router.get("/sos")
def get_sos_requests(
    status_filter: Optional[str] = None,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(SOSRequest)
    if status_filter:
        query = query.filter(SOSRequest.status == status_filter)
    requests = query.order_by(SOSRequest.created_at.desc()).all()
    return [
        {
            "id": s.id,
            "user_id": s.user_id,
            "user_name": s.user_name,
            "user_role": s.user_role,
            "contact": s.contact,
            "floor": s.floor,
            "location": s.location,
            "node_id": s.node_id,
            "situation": s.situation,
            "details": s.details,
            "status": s.status,
            "acknowledged_by": s.acknowledged_by,
            "acknowledged_at": s.acknowledged_at.isoformat() if s.acknowledged_at else None,
            "resolved_at": s.resolved_at.isoformat() if s.resolved_at else None,
            "created_at": s.created_at.isoformat() if s.created_at else None
        }
        for s in requests
    ]

@router.post("/sos/{sos_id}/acknowledge")
async def acknowledge_sos_request(
    sos_id: int,
    req: SOSAcknowledgeRequest,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    sos = db.query(SOSRequest).filter(SOSRequest.id == sos_id).first()
    if not sos:
        raise HTTPException(status_code=404, detail="SOS request not found")

    responder = req.responder_name or (current_user.full_name if current_user else "Campus Security Officer")
    sos.status = "acknowledged"
    sos.acknowledged_by = responder
    sos.acknowledged_at = datetime.utcnow()
    db.commit()

    await ws_manager.broadcast("SOS_STATUS_UPDATED", {
        "id": sos.id,
        "status": "acknowledged",
        "acknowledged_by": responder,
        "acknowledged_at": sos.acknowledged_at.isoformat()
    })

    return {
        "success": True,
        "message": f"SOS request #{sos_id} acknowledged by {responder}.",
        "sos_id": sos.id,
        "status": sos.status,
        "acknowledged_by": responder
    }

@router.post("/sos/{sos_id}/resolve")
async def resolve_sos_request(
    sos_id: int,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    sos = db.query(SOSRequest).filter(SOSRequest.id == sos_id).first()
    if not sos:
        raise HTTPException(status_code=404, detail="SOS request not found")

    sos.status = "resolved"
    sos.resolved_at = datetime.utcnow()
    db.commit()

    await ws_manager.broadcast("SOS_STATUS_UPDATED", {
        "id": sos.id,
        "status": "resolved",
        "resolved_at": sos.resolved_at.isoformat()
    })

    return {
        "success": True,
        "message": f"SOS request #{sos_id} marked resolved.",
        "sos_id": sos.id,
        "status": sos.status
    }

# ==================== ASSEMBLY POINT CHECK-IN ====================

@router.post("/checkin")
async def checkin_at_assembly(
    req: CheckinRequest,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    user_name = req.user_name or (current_user.full_name if current_user else "Campus Occupant")
    user_email = req.user_email or (current_user.email if current_user else None)
    role = current_user.role if current_user else "student"
    user_id = current_user.id if current_user else None

    # Resolve assembly point label
    ap_name = req.assembly_point_name or req.assembly_point_id
    if "MAIN" in req.assembly_point_id:
        ap_name = "Assembly Point A (East Lawn)"
    elif "WEST" in req.assembly_point_id:
        ap_name = "Assembly Point B (West Athletic Field)"
    elif "NORTH" in req.assembly_point_id:
        ap_name = "Assembly Point C (North Plaza)"

    checkin = AssemblyCheckin(
        user_id=user_id,
        user_name=user_name,
        user_email=user_email,
        role=role,
        assembly_point_id=req.assembly_point_id,
        assembly_point_name=ap_name,
        floor=req.floor or "Ground"
    )
    db.add(checkin)
    db.commit()
    db.refresh(checkin)

    # Broadcast checkin update
    total_count = db.query(AssemblyCheckin).count()
    await ws_manager.broadcast("NEW_CHECKIN", {
        "id": checkin.id,
        "user_name": checkin.user_name,
        "assembly_point": ap_name,
        "total_checkins": total_count,
        "timestamp": checkin.timestamp.isoformat()
    })

    return {
        "success": True,
        "message": f"Safe arrival confirmed at {ap_name}.",
        "checkin_id": checkin.id,
        "assembly_point": ap_name,
        "timestamp": checkin.timestamp.isoformat(),
        "total_checkins": total_count
    }

@router.get("/checkins")
def get_checkins(db: Session = Depends(get_db)):
    all_checkins = db.query(AssemblyCheckin).order_by(AssemblyCheckin.timestamp.desc()).all()
    total = len(all_checkins)

    # Group by assembly point
    by_assembly = {}
    for c in all_checkins:
        ap = c.assembly_point_name
        by_assembly[ap] = by_assembly.get(ap, 0) + 1

    # Check unconfirmed users
    all_users = db.query(User).all()
    checked_emails = set(c.user_email for c in all_checkins if c.user_email)
    unconfirmed_users = [
        {"id": u.id, "full_name": u.full_name, "email": u.email, "role": u.role}
        for u in all_users if u.email not in checked_emails
    ]

    return {
        "total_checkins": total,
        "by_assembly": by_assembly,
        "checkins": [
            {
                "id": c.id,
                "user_name": c.user_name,
                "user_email": c.user_email,
                "role": c.role,
                "assembly_point_id": c.assembly_point_id,
                "assembly_point_name": c.assembly_point_name,
                "timestamp": c.timestamp.isoformat()
            }
            for c in all_checkins
        ],
        "unconfirmed_users": unconfirmed_users,
        "note": "Unconfirmed status indicates pending check-in and does not imply missing or trapped."
    }

