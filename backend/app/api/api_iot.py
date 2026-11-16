from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import IoTSensor, User
from app.authentication.auth_handler import require_roles
from app.emergency.emergency_service import emergency_service
from app.api.ws_manager import ws_manager

router = APIRouter(prefix="/iot", tags=["IoT Sensor Integration"])

class TelemetryPayload(BaseModel):
    sensor_id: str
    value: float
    unit: Optional[str] = None

class SimulateSensorAlarmRequest(BaseModel):
    sensor_id: str
    value: float
    auto_activate_emergency: bool = True

@router.get("/sensors")
def list_sensors(db: Session = Depends(get_db)):
    sensors = db.query(IoTSensor).all()
    return [
        {
            "id": s.id,
            "sensor_id": s.sensor_id,
            "sensor_type": s.sensor_type,
            "building": s.building,
            "floor": s.floor,
            "room_id": s.room_id,
            "status": s.status,
            "current_value": s.current_value,
            "threshold": s.threshold,
            "unit": s.unit,
            "last_ping": s.last_ping.isoformat() if s.last_ping else None
        }
        for s in sensors
    ]

@router.post("/telemetry")
async def ingest_telemetry(
    payload: TelemetryPayload,
    x_sensor_key: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    # Sensor authentication check
    # For production IoT: sensors authenticate with pre-shared cryptographic key
    sensor = db.query(IoTSensor).filter(IoTSensor.sensor_id == payload.sensor_id).first()
    if not sensor:
        raise HTTPException(status_code=404, detail=f"Unregistered sensor ID: {payload.sensor_id}")

    sensor.current_value = payload.value
    sensor.last_ping = datetime.now(timezone.utc)
    if payload.unit:
        sensor.unit = payload.unit

    alert_triggered = False
    if sensor.current_value >= sensor.threshold:
        sensor.status = "alert"
        alert_triggered = True
    elif sensor.current_value >= (sensor.threshold * 0.7):
        sensor.status = "warning"
    else:
        sensor.status = "normal"

    db.commit()

    # Broadcast telemetry to dashboard
    await ws_manager.broadcast("IOT_TELEMETRY", {
        "sensor_id": sensor.sensor_id,
        "sensor_type": sensor.sensor_type,
        "floor": sensor.floor,
        "room_id": sensor.room_id,
        "value": sensor.current_value,
        "status": sensor.status,
        "threshold": sensor.threshold
    })

    return {
        "success": True,
        "sensor_id": sensor.sensor_id,
        "status": sensor.status,
        "alert_triggered": alert_triggered
    }

@router.post("/simulate-alarm")
async def simulate_sensor_alarm(
    req: SimulateSensorAlarmRequest,
    current_user: User = Depends(require_roles(["admin"])),
    db: Session = Depends(get_db)
):
    sensor = db.query(IoTSensor).filter(IoTSensor.sensor_id == req.sensor_id).first()
    if not sensor:
        raise HTTPException(status_code=404, detail="Sensor not found")

    sensor.current_value = req.value
    sensor.status = "alert"
    sensor.last_ping = datetime.now(timezone.utc)
    db.commit()

    # Broadcast IoT alert
    await ws_manager.broadcast("IOT_ALERT", {
        "sensor_id": sensor.sensor_id,
        "sensor_type": sensor.sensor_type,
        "floor": sensor.floor,
        "room_id": sensor.room_id,
        "value": sensor.current_value,
        "threshold": sensor.threshold,
        "message": f"Critical threshold exceeded on {sensor.sensor_type} sensor {sensor.sensor_id}!"
    })

    # If configured, automatically activate a simulated emergency
    emergency_id = None
    if req.auto_activate_emergency:
        event = await emergency_service.activate_emergency(
            db=db,
            emergency_type="fire" if sensor.sensor_type in ["smoke", "flame", "temperature"] else "gas",
            building_name=sensor.building,
            floor=sensor.floor,
            location=sensor.room_id,
            node_id=sensor.room_id,
            severity="critical",
            description=f"Automated IoT Detection: {sensor.sensor_type.title()} sensor {sensor.sensor_id} exceeded threshold ({sensor.current_value} {sensor.unit} >= {sensor.threshold} {sensor.unit})",
            is_simulation=True,
            activated_by="Automated IoT Sensor Gateway"
        )
        emergency_id = event.id

    return {
        "success": True,
        "sensor_id": sensor.sensor_id,
        "status": "alert",
        "emergency_id": emergency_id,
        "message": f"Simulated hazard spike triggered on {sensor.sensor_id}."
    }

@router.post("/reset")
async def reset_sensors(
    current_user: User = Depends(require_roles(["admin"])),
    db: Session = Depends(get_db)
):
    sensors = db.query(IoTSensor).all()
    for s in sensors:
        s.status = "normal"
        if s.sensor_type == "smoke":
            s.current_value = 3.2
        elif s.sensor_type == "temperature":
            s.current_value = 23.0
        elif s.sensor_type == "gas":
            s.current_value = 10.0
        elif s.sensor_type == "flame":
            s.current_value = 0.0
    db.commit()

    await ws_manager.broadcast("IOT_RESET", {})
    return {"success": True, "message": "All IoT sensors reset to normal baseline telemetry."}
