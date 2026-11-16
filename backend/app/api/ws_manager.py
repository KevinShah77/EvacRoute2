import json
import logging
from typing import List, Set
from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger("evacroute.websocket")

class WebSocketManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(f"WebSocket client connected. Total clients: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)
        logger.info(f"WebSocket client disconnected. Total clients: {len(self.active_connections)}")

    async def broadcast(self, event_type: str, data: dict):
        if not self.active_connections:
            return

        message = {
            "type": event_type,
            "data": data
        }
        json_str = json.dumps(message)
        dead_connections = set()

        for conn in self.active_connections:
            try:
                await conn.send_text(json_str)
            except Exception as e:
                logger.warning(f"Failed to send to client: {e}")
                dead_connections.add(conn)

        for dead in dead_connections:
            self.active_connections.discard(dead)

    def get_connected_count(self) -> int:
        return len(self.active_connections)

ws_manager = WebSocketManager()
