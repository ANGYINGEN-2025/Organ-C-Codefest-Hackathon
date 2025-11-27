"""
IoT Simulator - Sends synthetic sensor data to the backend

Usage:
    python iot_simulator.py --local --interval 3    # Local dev, every 3 seconds
    python iot_simulator.py --interval 60           # Production, every 60 seconds
"""

import requests
import random
import time
import argparse
from datetime import datetime, timezone

# URLs
LOCAL_URL = "http://localhost:8000/api/v1/iot/"
PROD_URL = " https://organ-c-codefest-hackathon-production.up.railway.app/api/v1/iot/"


def generate_random_record():
    """Generate random IoT sensor data"""
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "store": random.randint(1, 45),
        "dept": random.randint(1, 98),
        "Weekly_Sales": round(random.uniform(2000, 60000), 2),
        "Temperature": round(random.uniform(10, 38), 2),
        "Fuel_Price": round(random.uniform(2.0, 4.5), 2),
        "CPI": round(random.uniform(150, 260), 2),
        "Unemployment": round(random.uniform(3.0, 11.0), 2),
        "IsHoliday": random.choice([0, 1])
    }


def send_record(url: str):
    """Send a record to the backend"""
    data = generate_random_record()
    
    # Color output
    print(f"\n📡 Sending to: {url}")
    print(f"   Store: {data['store']}, Dept: {data['dept']}")
    print(f"   Sales: ${data['Weekly_Sales']:,.2f}")

    try:
        r = requests.post(url, json=data, timeout=10)
        result = r.json()
        
        # Color-coded risk level
        risk = result.get('risk_level', 'UNKNOWN')
        if risk == "HIGH":
            risk_icon = "🔴"
        elif risk == "MEDIUM":
            risk_icon = "🟡"
        else:
            risk_icon = "🟢"
        
        print(f"   Response: {r.status_code}")
        print(f"   {risk_icon} Risk: {risk} (Score: {result.get('risk_score', 0)})")
        
        if result.get('anomaly') == -1:
            print(f"   ⚠️  ANOMALY DETECTED!")
            
    except requests.exceptions.Timeout:
        print("   ❌ Timeout - server not responding")
    except requests.exceptions.ConnectionError:
        print("   ❌ Connection Error - is the server running?")
    except Exception as e:
        print(f"   ❌ Failed: {e}")


def main():
    parser = argparse.ArgumentParser(description="IoT Data Simulator")
    parser.add_argument(
        "--local", 
        action="store_true", 
        help="Use localhost instead of production"
    )
    parser.add_argument(
        "--interval", 
        type=int, 
        default=10,
        help="Seconds between requests (default: 10)"
    )
    parser.add_argument(
        "--count",
        type=int,
        default=0,
        help="Number of records to send (0 = infinite)"
    )
    
    args = parser.parse_args()
    
    url = LOCAL_URL if args.local else PROD_URL
    
    print("=" * 50)
    print("🚀 IoT Simulator")
    print("=" * 50)
    print(f"Target: {'LOCAL' if args.local else 'PRODUCTION'}")
    print(f"URL: {url}")
    print(f"Interval: {args.interval} seconds")
    print(f"Count: {'Infinite' if args.count == 0 else args.count}")
    print("Press Ctrl+C to stop\n")
    
    sent = 0
    try:
        while args.count == 0 or sent < args.count:
            send_record(url)
            sent += 1
            
            if args.count == 0 or sent < args.count:
                time.sleep(args.interval)
                
    except KeyboardInterrupt:
        print(f"\n\n👋 Stopped after {sent} records")


if __name__ == "__main__":
    main()
