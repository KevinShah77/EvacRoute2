from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="student")  # 'student', 'staff', 'admin'
    department = Column(String(100), nullable=True)
    phone = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    subscriptions = relationship("PushSubscription", back_populates="user", cascade="all, delete-orphan")

class PushSubscription(Base):
    __tablename__ = "push_subscriptions"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    endpoint = Column(Text, unique=True, nullable=False)
    p256dh = Column(String(255), nullable=False)
    auth = Column(String(255), nullable=False)
    device_name = Column(String(255), nullable=True, default="Web Client")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_used = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="subscriptions")

class EmergencyEvent(Base):
    __tablename__ = "emergency_events"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    emergency_type = Column(String(50), nullable=False)  # 'fire', 'smoke', 'gas', 'structural', 'blocked', 'general'
    building_name = Column(String(100), default="Main Academic Complex")
    floor = Column(String(50), nullable=False)
    location = Column(String(100), nullable=False)  # e.g. 'Room 205'
    node_id = Column(String(100), nullable=True)     # optional exact node ID
    severity = Column(String(50), default="high")   # 'low', 'medium', 'high', 'critical'
    description = Column(Text, nullable=True)
    status = Column(String(50), default="active")   # 'normal', 'reported', 'under_verification', 'active', 'resolved'
    is_simulation = Column(Boolean, default=False)
    reported_by = Column(String(100), nullable=True)
    activated_by = Column(String(100), nullable=True)
    reported_at = Column(DateTime, default=datetime.utcnow)
    activated_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
    resolution_notes = Column(Text, nullable=True)
    affected_radius_meters = Column(Float, default=15.0)
    
    hazards = relationship("Hazard", back_populates="emergency", cascade="all, delete-orphan")

class Hazard(Base):
    __tablename__ = "hazards"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    emergency_id = Column(Integer, ForeignKey("emergency_events.id"), nullable=True)
    hazard_type = Column(String(50), nullable=False)  # 'fire', 'smoke', 'gas', 'structural', 'blocked'
    floor = Column(String(50), nullable=False)
    node_id = Column(String(100), nullable=True)
    edge_source = Column(String(100), nullable=True)
    edge_target = Column(String(100), nullable=True)
    severity = Column(String(50), default="high")
    description = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    emergency = relationship("EmergencyEvent", back_populates="hazards")

class EmergencyReport(Base):
    __tablename__ = "emergency_reports"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    reporter_name = Column(String(100), nullable=False)
    reporter_role = Column(String(50), nullable=False)
    contact = Column(String(100), nullable=True)
    emergency_type = Column(String(50), nullable=False)
    floor = Column(String(50), nullable=False)
    location = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(50), default="pending")  # 'pending', 'verified', 'dismissed'
    created_at = Column(DateTime, default=datetime.utcnow)
    verified_at = Column(DateTime, nullable=True)
    verified_by = Column(String(100), nullable=True)

class IoTSensor(Base):
    __tablename__ = "iot_sensors"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    sensor_id = Column(String(100), unique=True, nullable=False)
    sensor_type = Column(String(50), nullable=False)  # 'smoke', 'temperature', 'flame', 'gas'
    building = Column(String(100), default="Main Academic Complex")
    floor = Column(String(50), nullable=False)
    room_id = Column(String(100), nullable=False)
    status = Column(String(50), default="normal")  # 'normal', 'warning', 'alert'
    current_value = Column(Float, default=0.0)
    threshold = Column(Float, default=50.0)
    unit = Column(String(20), default="ppm")
    last_ping = Column(DateTime, default=datetime.utcnow)

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    action = Column(String(100), nullable=False)
    user_email = Column(String(255), nullable=True)
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

class NotificationLog(Base):
    __tablename__ = "notification_logs"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    emergency_id = Column(Integer, nullable=True)
    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    recipients_count = Column(Integer, default=0)
    delivered_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    sent_at = Column(DateTime, default=datetime.utcnow)

class SOSRequest(Base):
    __tablename__ = "sos_requests"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    user_name = Column(String(100), nullable=False)
    user_role = Column(String(50), default="student")
    contact = Column(String(100), nullable=True)
    floor = Column(String(50), nullable=False)
    location = Column(String(100), nullable=False)
    node_id = Column(String(100), nullable=True)
    situation = Column(String(50), nullable=False, default="trapped")  # 'trapped', 'injured', 'assistance', 'smoke'
    details = Column(Text, nullable=True)
    status = Column(String(50), default="pending")  # 'pending', 'acknowledged', 'resolved'
    acknowledged_by = Column(String(100), nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class AssemblyCheckin(Base):
    __tablename__ = "assembly_checkins"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    user_name = Column(String(100), nullable=False)
    user_email = Column(String(100), nullable=True)
    role = Column(String(50), default="student")
    assembly_point_id = Column(String(100), nullable=False)
    assembly_point_name = Column(String(150), nullable=False)
    floor = Column(String(50), default="Ground")
    timestamp = Column(DateTime, default=datetime.utcnow)

