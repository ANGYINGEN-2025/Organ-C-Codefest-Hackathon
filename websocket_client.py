"""
WebSocket Test Client

Use this to test the WebSocket connection and receive real-time updates.

Usage:
    python websocket_client.py                 # Connect to localhost
    python websocket_client.py --url ws://...  # Connect to custom URL
"""

import asyncio
import json
import argparse
from datetime import datetime

try:
    import websockets
except ImportError:
    print("❌ websockets library not installed. Run: pip install websockets")
    exit(1)


async def listen_to_alerts(url: str):
    """Connect to WebSocket and listen for alerts"""
    
    print("=" * 60)
    print("🔌 WEBSOCKET CLIENT - Real-Time Alerts")
    print("=" * 60)
    print(f"Connecting to: {url}")
    print("Press Ctrl+C to disconnect\n")
    
    try:
        async with websockets.connect(url) as websocket:
            print("✅ Connected!\n")
            
            # Listen for messages
            while True:
                try:
                    message = await websocket.recv()
                    data = json.loads(message)
                    
                    msg_type = data.get("type", "unknown")
                    timestamp = datetime.now().strftime("%H:%M:%S")
                    
                    if msg_type == "connected":
                        print(f"[{timestamp}] 🟢 {data.get('message')}")
                        print(f"           Active connections: {data.get('active_connections')}\n")
                    
                    elif msg_type == "iot_update":
                        analysis = data.get("analysis", {})
                        iot_data = data.get("data", {})
                        
                        risk = analysis.get("risk_level", "UNKNOWN")
                        risk_icon = "🔴" if risk == "HIGH" else "🟡" if risk == "MEDIUM" else "🟢"
                        
                        print(f"[{timestamp}] 📡 IoT Update")
                        print(f"           Store: {iot_data.get('store')} | Dept: {iot_data.get('dept')}")
                        print(f"           Sales: ${iot_data.get('weekly_sales', 0):,.2f}")
                        print(f"           {risk_icon} Risk: {risk} (Score: {analysis.get('risk_score', 0)})")
                        
                        if analysis.get("anomaly_detected"):
                            print(f"           ⚠️  ANOMALY DETECTED!")
                        print()
                    
                    elif msg_type == "alert":
                        print(f"[{timestamp}] 🚨 ALERT!")
                        print(f"           Store: {data.get('store')} | Dept: {data.get('dept')}")
                        print(f"           Message: {data.get('message')}")
                        print(f"           Risk Score: {data.get('risk_score')}")
                        print()
                    
                    elif msg_type == "ping":
                        # Respond with pong
                        await websocket.send(json.dumps({
                            "type": "pong",
                            "timestamp": datetime.utcnow().isoformat()
                        }))
                    
                    elif msg_type == "pong":
                        pass  # Keep-alive response, ignore
                    
                    else:
                        print(f"[{timestamp}] 📨 {msg_type}: {json.dumps(data, indent=2)}\n")
                        
                except websockets.exceptions.ConnectionClosed:
                    print("\n❌ Connection closed by server")
                    break
                    
    except ConnectionRefusedError:
        print("❌ Connection refused - is the server running?")
    except Exception as e:
        print(f"❌ Error: {e}")


def main():
    parser = argparse.ArgumentParser(description="WebSocket Test Client")
    parser.add_argument(
        "--url",
        default="ws://localhost:8000/ws/alerts",
        help="WebSocket URL (default: ws://localhost:8000/ws/alerts)"
    )
    
    args = parser.parse_args()
    
    try:
        asyncio.run(listen_to_alerts(args.url))
    except KeyboardInterrupt:
        print("\n\n👋 Disconnected")


if __name__ == "__main__":
    main()

