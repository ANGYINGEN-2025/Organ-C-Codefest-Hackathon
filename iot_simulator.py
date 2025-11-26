"""
IoT Data Simulator

Simulates IoT sensor data from retail stores and sends to backend.

Usage:
    python iot_simulator.py                    # Default: HTTP mode, 10 sec interval
    python iot_simulator.py --interval 5       # 5 second interval
    python iot_simulator.py --mode burst       # Send 10 records quickly
    python iot_simulator.py --local            # Use localhost:8000
"""

import requests
import random
import time
import argparse
from datetime import datetime

# Configuration
PRODUCTION_URL = "https://organ-c-codefest-hackathon.onrender.com/api/v1/iot"
LOCAL_URL = "http://localhost:8000/api/v1/iot"


def generate_random_record():
    """Generate a random IoT sensor reading"""
    return {
        "timestamp": datetime.utcnow().isoformat(),
        "store": random.randint(1, 45),
        "dept": random.randint(1, 98),
        "Weekly_Sales": round(random.uniform(2000, 60000), 2),
        "Temperature": round(random.uniform(10, 38), 2),
        "Fuel_Price": round(random.uniform(2.0, 4.5), 2),
        "CPI": round(random.uniform(150, 260), 2),
        "Unemployment": round(random.uniform(3.0, 11.0), 2),
        "IsHoliday": random.choice([0, 1])
    }


def generate_anomaly_record():
    """Generate a record likely to trigger anomaly detection"""
    return {
        "timestamp": datetime.utcnow().isoformat(),
        "store": random.randint(1, 45),
        "dept": random.randint(1, 98),
        "Weekly_Sales": round(random.uniform(100000, 500000), 2),  # Unusually high
        "Temperature": round(random.uniform(-20, 50), 2),  # Extreme temps
        "Fuel_Price": round(random.uniform(6.0, 10.0), 2),  # High fuel
        "CPI": round(random.uniform(300, 400), 2),  # High CPI
        "Unemployment": round(random.uniform(15.0, 25.0), 2),  # High unemployment
        "IsHoliday": 1
    }


def send_record(url: str, anomaly: bool = False):
    """Send a single record to the backend"""
    data = generate_anomaly_record() if anomaly else generate_random_record()
    
    print(f"\n📡 Sending {'ANOMALY' if anomaly else 'normal'} data:")
    print(f"   Store: {data['store']}, Dept: {data['dept']}")
    print(f"   Sales: ${data['Weekly_Sales']:,.2f}")
    
    try:
        r = requests.post(url, json=data, timeout=10)
        result = r.json()
        
        # Color-coded output based on risk level
        risk = result.get('risk_level', 'UNKNOWN')
        risk_icon = "🔴" if risk == "HIGH" else "🟡" if risk == "MEDIUM" else "🟢"
        
        print(f"   Response: {r.status_code}")
        print(f"   {risk_icon} Risk: {risk} (Score: {result.get('risk_score', 0)})")
        print(f"   Anomaly: {result.get('anomaly')} | Cluster: {result.get('cluster')}")
        
        return result
    except requests.exceptions.Timeout:
        print("   ⚠️ Request timed out")
        return None
    except requests.exceptions.ConnectionError:
        print("   ❌ Connection failed - is the server running?")
        return None
    except Exception as e:
        print(f"   ❌ Failed: {e}")
        return None


def run_continuous(url: str, interval: int):
    """Run continuous simulation"""
    print(f"\n🚀 IoT Simulator started")
    print(f"   Target: {url}")
    print(f"   Interval: {interval} seconds")
    print(f"   Press Ctrl+C to stop\n")
    
    count = 0
    while True:
        count += 1
        # Every 10th record, send an anomaly
        is_anomaly = (count % 10 == 0)
        
        print(f"--- Record #{count} ---")
        send_record(url, anomaly=is_anomaly)
        
        time.sleep(interval)


def run_burst(url: str, count: int = 10):
    """Send multiple records quickly"""
    print(f"\n🚀 Burst mode: Sending {count} records...")
    
    for i in range(count):
        is_anomaly = (i % 3 == 0)  # Every 3rd is anomaly
        send_record(url, anomaly=is_anomaly)
        time.sleep(0.5)  # Small delay between requests
    
    print(f"\n✅ Burst complete: {count} records sent")


def main():
    parser = argparse.ArgumentParser(description="IoT Data Simulator")
    parser.add_argument("--interval", type=int, default=10, help="Seconds between sends (default: 10)")
    parser.add_argument("--mode", choices=["continuous", "burst", "single"], default="continuous", help="Simulation mode")
    parser.add_argument("--local", action="store_true", help="Use localhost:8000 instead of production")
    parser.add_argument("--burst-count", type=int, default=10, help="Number of records in burst mode")
    
    args = parser.parse_args()
    
    url = LOCAL_URL if args.local else PRODUCTION_URL
    
    print("=" * 50)
    print("🏭 IoT DATA SIMULATOR")
    print("=" * 50)
    
    if args.mode == "continuous":
        run_continuous(url, args.interval)
    elif args.mode == "burst":
        run_burst(url, args.burst_count)
    elif args.mode == "single":
        send_record(url)


if __name__ == "__main__":
    main()
