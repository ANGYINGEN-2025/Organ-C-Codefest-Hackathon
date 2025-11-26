"""
WebSocket Routes for Real-Time Communication

Endpoints:
- /ws/alerts - Real-time alerts and IoT updates
- /ws/dashboard - Dashboard data stream
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from websocket_manager import manager
import asyncio
import json
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/alerts")
async def websocket_alerts(
    websocket: WebSocket,
    client_id: str = Query(default=None, description="Optional client identifier")
):
    """
    🔌 Real-Time Alerts WebSocket
    
    Connect to receive:
    - IoT data updates with analysis
    - High-risk alerts
    - Anomaly detections
    
    Message Types:
    - "iot_update": New IoT data with risk/anomaly analysis
    - "alert": High-priority alert notification
    - "ping": Keep-alive message
    
    Example client (JavaScript):
    ```
    const ws = new WebSocket('ws://localhost:8000/ws/alerts');
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('Received:', data);
    };
    ```
    """
    await manager.connect(websocket, client_id)
    
    # Send welcome message
    await manager.send_personal_message({
        "type": "connected",
        "message": "Connected to real-time alerts",
        "client_id": client_id or "anonymous",
        "active_connections": manager.get_connection_count()
    }, websocket)
    
    try:
        while True:
            # Wait for messages from client (for bidirectional communication)
            try:
                data = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=30.0  # 30 second timeout for keep-alive
                )
                
                # Handle client messages
                try:
                    message = json.loads(data)
                    
                    if message.get("type") == "ping":
                        # Respond to ping with pong
                        await manager.send_personal_message({
                            "type": "pong",
                            "timestamp": message.get("timestamp")
                        }, websocket)
                    
                    elif message.get("type") == "subscribe":
                        # Client wants to subscribe to specific events
                        await manager.send_personal_message({
                            "type": "subscribed",
                            "channels": message.get("channels", ["all"])
                        }, websocket)
                    
                except json.JSONDecodeError:
                    await manager.send_personal_message({
                        "type": "error",
                        "message": "Invalid JSON format"
                    }, websocket)
                    
            except asyncio.TimeoutError:
                # Send keep-alive ping
                await manager.send_personal_message({
                    "type": "ping",
                    "message": "keep-alive"
                }, websocket)
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info(f"Client {client_id} disconnected")


@router.websocket("/dashboard")
async def websocket_dashboard(websocket: WebSocket):
    """
    📊 Dashboard Data Stream
    
    Provides periodic updates for dashboard metrics.
    Updates every 10 seconds with:
    - Connection stats
    - Recent activity summary
    """
    await manager.connect(websocket, "dashboard")
    
    try:
        while True:
            # Send dashboard stats every 10 seconds
            stats = manager.get_connection_stats()
            await manager.send_personal_message({
                "type": "dashboard_stats",
                "data": stats
            }, websocket)
            
            await asyncio.sleep(10)
            
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@router.get("/connections")
def get_websocket_connections():
    """
    Get current WebSocket connection statistics.
    
    Returns number of active connections and client info.
    """
    return manager.get_connection_stats()

