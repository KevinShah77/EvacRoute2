from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import PushSubscription, NotificationLog, User
from app.authentication.auth_handler import get_optional_current_user, require_roles
from app.notifications.push_service import push_service

router = APIRouter(prefix="/notifications", tags=["Push Notifications"])

class SubscriptionKeys(BaseModel):
    p256dh: str
    auth: str

class SubscribeRequest(BaseModel):
    endpoint: str
    keys: SubscriptionKeys
    device_name: Optional[str] = "Web Browser Client"

class TestNotificationRequest(BaseModel):
    title: Optional[str] = "EVACROUTE – TEST ALERT"
    body: Optional[str] = "Campus push notification subsystem operational."

@router.get("/vapid-public-key")
def get_vapid_key():
    return {"publicKey": push_service.get_public_key()}

@router.post("/subscribe")
def register_subscription(
    req: SubscribeRequest,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    sub = db.query(PushSubscription).filter(PushSubscription.endpoint == req.endpoint).first()
    if not sub:
        sub = PushSubscription(
            user_id=current_user.id if current_user else None,
            endpoint=req.endpoint,
            p256dh=req.keys.p256dh,
            auth=req.keys.auth,
            device_name=req.device_name
        )
        db.add(sub)
    else:
        sub.p256dh = req.keys.p256dh
        sub.auth = req.keys.auth
        sub.device_name = req.device_name
        sub.is_active = True
        if current_user:
            sub.user_id = current_user.id

    db.commit()
    return {"success": True, "message": "Device successfully subscribed to emergency alerts"}

@router.post("/test")
def send_test_notification(
    req: TestNotificationRequest,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    # Find subscription for user or last active subscription
    query = db.query(PushSubscription).filter(PushSubscription.is_active == True)
    if current_user:
        sub = query.filter(PushSubscription.user_id == current_user.id).first()
    else:
        sub = query.order_by(PushSubscription.created_at.desc()).first()

    if not sub:
        return {
            "success": False,
            "message": "No active device subscription registered yet. Click 'Enable Emergency Alerts' in the app first."
        }

    sent = push_service.send_notification(
        subscription={"endpoint": sub.endpoint, "p256dh": sub.p256dh, "auth": sub.auth},
        title=req.title or "EVACROUTE – TEST ALERT",
        body=req.body or "Campus push notification subsystem operational.",
        data={"url": "/emergency", "test": True}
    )

    return {"success": sent, "message": "Test notification dispatched" if sent else "Delivery failed"}

@router.get("/stats")
def get_notification_stats(db: Session = Depends(get_db)):
    active_devices = db.query(PushSubscription).filter(PushSubscription.is_active == True).count()
    total_logs = db.query(NotificationLog).all()
    total_delivered = sum(l.delivered_count for l in total_logs)
    total_failed = sum(l.failed_count for l in total_logs)
    
    return {
        "registered_devices_count": active_devices,
        "total_broadcasts_sent": len(total_logs),
        "total_notifications_delivered": total_delivered,
        "total_notifications_failed": total_failed,
        "recent_logs": [
            {
                "id": l.id,
                "emergency_id": l.emergency_id,
                "title": l.title,
                "recipients": l.recipients_count,
                "delivered": l.delivered_count,
                "sent_at": l.sent_at.isoformat() if l.sent_at else None
            }
            for l in total_logs[-10:]
        ]
    }

@router.get("/recent-dispatches")
def get_recent_dispatches():
    return push_service.recent_alerts[:10]
