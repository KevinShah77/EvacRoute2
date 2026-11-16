from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.analytics.analytics_service import analytics_service

router = APIRouter(prefix="/analytics", tags=["Safety Egress Analytics"])

@router.get("/summary")
def get_analytics_summary(
    floor: Optional[str] = Query(None),
    entrance: Optional[str] = Query(None),
    emergency_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    return analytics_service.get_safety_analytics(
        db=db,
        floor_filter=floor,
        entrance_filter=entrance,
        emergency_id_filter=emergency_id
    )

@router.get("/floor/{floor_name}")
def get_floor_analytics(floor_name: str, db: Session = Depends(get_db)):
    return analytics_service.get_safety_analytics(db=db, floor_filter=floor_name)
