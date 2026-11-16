from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Hazard
from app.graph.graph_engine import graph_engine

router = APIRouter(prefix="/routing", tags=["Evacuation Routing"])

class EvacuationRouteRequest(BaseModel):
    start_node_id: str
    target_exit_id: Optional[str] = None
    accessible_mode: bool = False

@router.post("/evacuate")
def calculate_evacuation(req: EvacuationRouteRequest, db: Session = Depends(get_db)):
    # Fetch active hazards
    active_hazards = db.query(Hazard).filter(Hazard.is_active == True).all()
    hazards_data = [
        {
            "hazard_type": h.hazard_type,
            "floor": h.floor,
            "node_id": h.node_id,
            "edge_source": h.edge_source,
            "edge_target": h.edge_target,
            "severity": h.severity
        }
        for h in active_hazards
    ]

    result = graph_engine.calculate_evacuation_route(
        start_node_id=req.start_node_id,
        target_exit_id=req.target_exit_id,
        accessible_mode=req.accessible_mode,
        active_hazards=hazards_data
    )

    return result

@router.get("/exits")
def get_operational_exits(db: Session = Depends(get_db)):
    active_hazards = db.query(Hazard).filter(Hazard.is_active == True).all()
    hazards_data = [
        {
            "hazard_type": h.hazard_type,
            "floor": h.floor,
            "node_id": h.node_id,
            "edge_source": h.edge_source,
            "edge_target": h.edge_target
        }
        for h in active_hazards
    ]
    work_graph = graph_engine._apply_hazards_and_accessibility(False, hazards_data)
    
    exits = graph_engine.get_exits()
    result = []
    for ex in exits:
        is_safe = work_graph.has_node(ex["id"])
        result.append({
            "id": ex["id"],
            "label": ex.get("label", ex["id"]),
            "floor": ex.get("floor", "Ground"),
            "coordinates": {"x": ex.get("x", 50), "y": ex.get("y", 50)},
            "status": "OPERATIONAL" if is_safe else "COMPROMISED"
        })
    return result
