"""
WebSocket Connection Manager

Handles real-time communication with connected clients.
Broadcasts IoT data, alerts, and analytics updates.
"""

from fastapi import WebSocket
from typing import List, Dict, Any
import json
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

# Constants for anomaly detection
ANOMALY_DETECTED = -1  # Isolation Forest returns -1 for anomalies


class ConnectionManager:
    """
    Manages WebSocket connections and broadcasts messages to clients.
    
    Features:
    - Track connected clients
    - Broadcast to all clients
    - Send to specific clients
    - Handle disconnections gracefully
    """
    
    def __init__(self):
        # List of active WebSocket connections
        self.active_connections: List[WebSocket] = []
        # Track connection metadata (optional)
        self.connection_info: Dict[WebSocket, Dict[str, Any]] = {}
    
    async def connect(self, websocket: WebSocket, client_id: str = None):
        """Accept a new WebSocket connection"""
        await websocket.accept()
        self.active_connections.append(websocket)
        self.connection_info[websocket] = {
            "client_id": client_id or f"client_{len(self.active_connections)}",
            "connected_at": datetime.utcnow().isoformat()
        }
        logger.info(f"🔌 Client connected. Total connections: {len(self.active_connections)}")
    
    def disconnect(self, websocket: WebSocket):
        """Remove a WebSocket connection"""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        if websocket in self.connection_info:
            del self.connection_info[websocket]
        logger.info(f"🔌 Client disconnected. Total connections: {len(self.active_connections)}")
    
    async def send_personal_message(self, message: dict, websocket: WebSocket):
        """
        Send message to a specific client.
        
        Handles disconnections gracefully by removing the client from active connections.
        """
        try:
            await websocket.send_json(message)
        except (ConnectionError, RuntimeError) as e:
            # Client disconnected
            logger.debug(f"Client disconnected during personal message: {e}")
            self.disconnect(websocket)
        except Exception as e:
            # Other unexpected errors
            logger.error(f"Failed to send personal message: {e}", exc_info=True)
            self.disconnect(websocket)
    
    async def broadcast(self, message: dict):
        """
        Broadcast message to ALL connected clients.
        
        Handles errors gracefully - if a client disconnects or fails,
        it's removed from the active connections list without affecting others.
        """
        if not self.active_connections:
            # No clients connected, nothing to broadcast
            return
        
        disconnected = []
        
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except (ConnectionError, RuntimeError) as e:
                # Client disconnected or connection closed
                logger.debug(f"Client disconnected during broadcast: {e}")
                disconnected.append(connection)
            except Exception as e:
                # Other unexpected errors
                logger.error(f"Unexpected error broadcasting to client: {e}", exc_info=True)
                disconnected.append(connection)
        
        # Clean up disconnected clients
        for conn in disconnected:
            try:
                self.disconnect(conn)
            except Exception as e:
                logger.warning(f"Error during disconnect cleanup: {e}")
    
    async def broadcast_iot_update(self, data: dict, analysis_result: dict):
        """
        Broadcast an IoT data update with analysis results.
        
        This is called when new IoT data is ingested.
        """
        try:
            message = {
                "type": "iot_update",
                "timestamp": datetime.utcnow().isoformat(),
                "data": {
                    "store": data.get("store"),
                    "dept": data.get("dept"),
                    "weekly_sales": data.get("Weekly_Sales"),
                    "temperature": data.get("Temperature"),
                    "is_holiday": data.get("IsHoliday")
                },
                "analysis": {
                    "anomaly_detected": analysis_result.get("anomaly") == ANOMALY_DETECTED,
                    "anomaly_score": analysis_result.get("anomaly_score"),
                    "risk_level": analysis_result.get("risk_level"),
                    "risk_score": analysis_result.get("risk_score"),
                    "cluster": analysis_result.get("cluster")
                }
            }
            await self.broadcast(message)
            logger.info(f"📡 Broadcasted IoT update to {len(self.active_connections)} clients")
        except Exception as e:
            # Log error but don't re-raise - let caller handle it
            logger.error(f"Failed to create/broadcast IoT update message: {e}", exc_info=True)
            raise  # Re-raise so caller can handle gracefully
    
    async def broadcast_alert(self, store: int, dept: int, message: str, risk_score: int):
        """
        Broadcast a high-priority alert.
        
        Raises exception if broadcast fails, so caller can handle gracefully.
        """
        try:
            alert = {
                "type": "alert",
                "priority": "HIGH",
                "timestamp": datetime.utcnow().isoformat(),
                "store": store,
                "dept": dept,
                "message": message,
                "risk_score": risk_score
            }
            await self.broadcast(alert)
            logger.warning(f"🚨 Alert broadcasted: Store {store}, Dept {dept}")
        except Exception as e:
            logger.error(f"Failed to create/broadcast alert message: {e}", exc_info=True)
            raise  # Re-raise so caller can handle gracefully
    
    def get_connection_count(self) -> int:
        """Get number of active connections"""
        return len(self.active_connections)
    
    def get_connection_stats(self) -> dict:
        """Get connection statistics"""
        return {
            "active_connections": len(self.active_connections),
            "clients": [
                info for info in self.connection_info.values()
            ]
        }


# Global instance - import this in other modules
manager = ConnectionManager()

