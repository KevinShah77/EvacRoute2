from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Hazard, User
from app.authentication.auth_handler import require_roles
from app.emergency.emergency_service import emergency_service
from app.api.ws_manager import ws_manager

router = APIRouter(prefix="/hazards", tags=["Hazard Management"])

class AddHazardRequest(BaseModel):
    emergency_id: Optional[int] = None
    hazard_type: str  # 'fire', 'smoke', 'gas', 'structural', 'blocked'
    floor: str
    node_id: Optional[str] = None
    edge_source: Optional[str] = None
    edge_target: Optional[str] = None
    severity: str = "high"
    description: Optional[str] = None

@router.get("")
def list_active_hazards(floor: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Hazard).filter(Hazard.is_active == True)
    if floor:
        query = query.filter(Hazard.floor == floor)
    hazards = query.all()
    return [
        {
            "id": h.id,
            "emergency_id": h.emergency_id,
            "hazard_type": h.hazard_type,
            "floor": h.floor,
            "node_id": h.node_id,
            "edge_source": h.edge_source,
            "edge_target": h.edge_target,
            "severity": h.severity,
            "description": h.description,
            "created_at": h.created_at.isoformat() if h.created_at else None
        }
        for h in hazards
    ]

@router.post("")
async def create_hazard(
    req: AddHazardRequest,
    current_user: User = Depends(require_roles(["admin", "staff"])),
    db: Session = Depends(get_db)
):
    # Find active emergency if not specified
    emergency_id = req.emergency_id
    if not emergency_id:
        active = emergency_service.get_active_emergency(db)
        if active:
            emergency_id = active.id

    hazard = await emergency_service.add_hazard(
        db=db,
        emergency_id=emergency_id,
        hazard_type=req.hazard_type,
        floor=req.floor,
        node_id=req.node_id,
        edge_source=req.edge_source,
        edge_target=req.edge_target,
        severity=req.severity,
        description=req.description or f"Reported by {current_user.full_name}"
    )

    return {
        "success": True,
        "hazard_id": hazard.id,
        "message": f"Hazard '{hazard.hazard_type}' added on {hazard.floor}."
    }

@router.delete("/{hazard_id}")
async def delete_hazard(
    hazard_id: int,
    current_user: User = Depends(require_roles(["admin"])),
    db: Session = Depends(get_db)
):
    success = await emergency_service.clear_hazard(db, hazard_id)
    if not success:
        raise HTTPException(status_code=404, detail="Hazard not found")
    return {"success": True, "message": f"Hazard #{hazard_id} cleared."}

@router.post("/reset")
async def reset_all_hazards(
    current_user: User = Depends(require_roles(["admin"])),
    db: Session = Depends(get_db)
):
    active_hazards = db.query(Hazard).filter(Hazard.is_active == True).all()
    for h in active_hazards:
        h.is_active = False
    db.commit()
    await ws_manager.broadcast("ALL_HAZARDS_CLEARED", {})
    await ws_manager.broadcast("ROUTE_RECALCULATION_NEEDED", {"reason": "all_hazards_cleared"})
    return {"success": True, "message": f"Cleared {len(active_hazards)} hazards across all floors."}
