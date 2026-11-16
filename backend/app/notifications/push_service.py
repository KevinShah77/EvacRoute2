import json
import logging
from typing import List, Dict, Any, Optional
from pywebpush import webpush, WebPushException
from sqlalchemy.orm import Session
from app.config import settings
from app.models.models import PushSubscription, NotificationLog

logger = logging.getLogger("evacroute.push_service")

class PushNotificationService:
    def __init__(self):
        self.public_key = settings.VAPID_PUBLIC_KEY
        self.private_key = settings.VAPID_PRIVATE_KEY
        self.claims = {"sub": settings.VAPID_CLAIM_EMAIL}
        # In-memory store of recent dispatched alerts for fast UI demo polling / notification toasts
        self.recent_alerts: List[Dict[str, Any]] = []

    def get_public_key(self) -> str:
        return self.public_key

    def send_notification(
        self,
        subscription: Dict[str, Any],
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None,
        tag: str = "evac-emergency",
        urgent: bool = True
    ) -> bool:
        payload = json.dumps({
            "title": title,
            "body": body,
            "icon": "/icons/icon-192x192.png",
            "badge": "/icons/badge-72x72.png",
            "tag": tag,
            "requireInteraction": urgent,
            "vibrate": [300, 100, 400, 100, 400],
            "data": data or {"url": "/emergency"}
        })

        try:
            sub_info = {
                "endpoint": subscription.get("endpoint"),
                "keys": {
                    "p256dh": subscription.get("p256dh"),
                    "auth": subscription.get("auth")
                }
            }
            webpush(
                subscription_info=sub_info,
                data=payload,
                vapid_private_key=self.private_key,
                vapid_claims=self.claims,
                ttl=600
            )
            return True
        except WebPushException as e:
            logger.warning(f"WebPush delivery failed: {e}")
            return False
        except Exception as e:
            logger.warning(f"Generic push exception: {e}")
            return False

    def broadcast_emergency_alert(
        self,
        db: Session,
        emergency_id: int,
        emergency_type: str,
        floor: str,
        location: str,
        is_simulation: bool = False
    ) -> Dict[str, Any]:
        sim_prefix = "[SIMULATION] " if is_simulation else "EVACROUTE – "
        title = f"{sim_prefix}EMERGENCY ALERT: {emergency_type.upper()}"
        body = (
            f"A {emergency_type.lower()} has been reported on {floor}, {location}. "
            f"Avoid the affected area immediately. Open EvacRoute for safest evacuation route & voice guidance."
        )
        
        payload_data = {
            "emergency_id": emergency_id,
            "type": emergency_type,
            "floor": floor,
            "location": location,
            "is_simulation": is_simulation,
            "url": f"/emergency?id={emergency_id}"
        }

        # Save to recent alerts
        alert_record = {
            "emergency_id": emergency_id,
            "title": title,
            "body": body,
            "payload": payload_data,
            "timestamp": None
        }
        self.recent_alerts.insert(0, alert_record)
        if len(self.recent_alerts) > 50:
            self.recent_alerts.pop()

        # Retrieve active push subscriptions from database
        query = db.query(PushSubscription).filter(PushSubscription.is_active == True)
        
        # Section 14: Never send simulated emergency broadcasts to actual college students or staff
        if is_simulation:
            # Only send to test devices or administrator / safety officer accounts
            all_subs = query.all()
            subscriptions = [
                s for s in all_subs 
                if (s.user and s.user.role == "admin") or 
                   (s.device_name and any(kw in s.device_name.lower() for kw in ["test", "demo", "sim", "web client"])) or
                   (s.user_id is None)
            ]
        else:
            subscriptions = query.all()

        delivered = 0
        failed = 0
        dead_ids = []

        for sub in subscriptions:
            success = self.send_notification(
                subscription={"endpoint": sub.endpoint, "p256dh": sub.p256dh, "auth": sub.auth},
                title=title,
                body=body,
                data=payload_data,
                urgent=True
            )
            if success:
                delivered += 1
            else:
                failed += 1

        # Log delivery
        log = NotificationLog(
            emergency_id=emergency_id,
            title=title,
            body=body,
            recipients_count=len(subscriptions),
            delivered_count=delivered,
            failed_count=failed
        )
        db.add(log)
        db.commit()

        return {
            "recipients_count": len(subscriptions),
            "delivered_count": delivered,
            "failed_count": failed,
            "title": title,
            "body": body
        }

    def broadcast_resolution_alert(
        self,
        db: Session,
        emergency_id: int,
        resolution_notes: str = ""
    ) -> Dict[str, Any]:
        title = "EVACROUTE – ALL CLEAR"
        body = f"Emergency #{emergency_id} has been verified SAFE and RESOLVED by Safety Command. {resolution_notes}"
        
        subscriptions = db.query(PushSubscription).filter(PushSubscription.is_active == True).all()
        delivered = 0
        failed = 0

        for sub in subscriptions:
            success = self.send_notification(
                subscription={"endpoint": sub.endpoint, "p256dh": sub.p256dh, "auth": sub.auth},
                title=title,
                body=body,
                data={"url": "/", "resolved": True},
                urgent=False
            )
            if success:
                delivered += 1
            else:
                failed += 1

        return {
            "recipients_count": len(subscriptions),
            "delivered_count": delivered,
            "failed_count": failed,
            "title": title,
            "body": body
        }

push_service = PushNotificationService()
