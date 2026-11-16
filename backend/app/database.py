import logging
import bcrypt
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from app.config import settings
from app.models.base import Base
from app.models.models import User, IoTSensor, EmergencyEvent

logger = logging.getLogger("evacroute.database")

# Handle SQLite vs PostgreSQL arguments
connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(settings.DATABASE_URL, connect_args=connect_args, echo=False)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False

def init_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Check if default admin exists
        admin = db.query(User).filter(User.email == "admin@evacroute.edu").first()
        if not admin:
            admin = User(
                email="admin@evacroute.edu",
                password_hash=hash_password("admin123"),
                full_name="Chief Safety Officer Sarah Jenkins",
                role="admin",
                department="Campus Safety & Emergency Operations",
                phone="+1-555-019-SAFE"
            )
            db.add(admin)
        
        # Check responder / security
        responder = db.query(User).filter(User.email == "security@evacroute.edu").first()
        if not responder:
            responder = User(
                email="security@evacroute.edu",
                password_hash=hash_password("security123"),
                full_name="Officer Marcus Vance",
                role="responder",
                department="Campus Police & Emergency First Response",
                phone="+1-555-018-RESP"
            )
            db.add(responder)

        # Check staff
        staff = db.query(User).filter(User.email == "staff@evacroute.edu").first()
        if not staff:
            staff = User(
                email="staff@evacroute.edu",
                password_hash=hash_password("staff123"),
                full_name="Prof. Robert Vance",
                role="staff",
                department="Department of Chemical Engineering",
                phone="+1-555-012-CHEM"
            )
            db.add(staff)
        
        # Check student
        student = db.query(User).filter(User.email == "student@evacroute.edu").first()
        if not student:
            student = User(
                email="student@evacroute.edu",
                password_hash=hash_password("student123"),
                full_name="Alex Chen",
                role="student",
                department="Computer Engineering (Senior)",
                phone="+1-555-014-STUD"
            )
            db.add(student)
        
        # Seed IoT Sensors if none exist
        if db.query(IoTSensor).count() == 0:
            sensors = [
                IoTSensor(sensor_id="SMOKE-GF-011", sensor_type="smoke", floor="Ground", room_id="GF-011", status="normal", current_value=4.2, threshold=45.0, unit="ppm"),
                IoTSensor(sensor_id="TEMP-GF-011", sensor_type="temperature", floor="Ground", room_id="GF-011", status="normal", current_value=24.5, threshold=60.0, unit="°C"),
                IoTSensor(sensor_id="SMOKE-F1-105", sensor_type="smoke", floor="Floor 1", room_id="F1-105", status="normal", current_value=2.8, threshold=45.0, unit="ppm"),
                IoTSensor(sensor_id="SMOKE-F2-205", sensor_type="smoke", floor="Floor 2", room_id="F2-205", status="normal", current_value=3.1, threshold=45.0, unit="ppm"),
                IoTSensor(sensor_id="FLAME-F2-205", sensor_type="flame", floor="Floor 2", room_id="F2-205", status="normal", current_value=0.0, threshold=1.0, unit="bool"),
                IoTSensor(sensor_id="GAS-F3-315", sensor_type="gas", floor="Floor 3", room_id="F3-315", status="normal", current_value=12.0, threshold=100.0, unit="ppm"),
                IoTSensor(sensor_id="SMOKE-F4-420", sensor_type="smoke", floor="Floor 4", room_id="F4-420", status="normal", current_value=1.9, threshold=45.0, unit="ppm"),
            ]
            for s in sensors:
                db.add(s)

        # Ensure active fire emergency exists by default for life-safety response
        from app.models.models import Hazard
        active_event = db.query(EmergencyEvent).filter(EmergencyEvent.status == "active").first()
        if not active_event:
            default_event = EmergencyEvent(
                emergency_type="fire",
                building_name="Main Academic Complex",
                floor="Floor 2",
                location="Room 205 (Lecture Hall)",
                node_id="F2-205",
                severity="critical",
                status="active",
                description="Active fire emergency reported in Room 205 on Floor 2. Evacuate immediately.",
                reported_by="Campus Automated Fire Alarm",
                activated_by="Chief Safety Officer Sarah Jenkins"
            )
            db.add(default_event)
            db.flush()

            fire_hazard = Hazard(
                emergency_id=default_event.id,
                hazard_type="fire",
                floor="Floor 2",
                node_id="F2-205",
                severity="critical",
                description="Active flames and smoke in Room 205",
                is_active=True
            )
            db.add(fire_hazard)

        db.commit()
        logger.info("Database initialized and seeded successfully.")
    except Exception as e:
        db.rollback()
        logger.error(f"Error seeding database: {e}")
        raise
    finally:
        db.close()
