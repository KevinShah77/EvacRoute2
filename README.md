# EvacRoute Emergency Response – Real-Time Emergency Alert and Voice-Guided Evacuation System

**EvacRoute Emergency Response 2.0** is an independent, production-grade campus life-safety platform designed to guide students and faculty to safety during dynamic indoor emergencies (fires, toxic gas leaks, structural debris, corridor collapses).

---

## 1. System Identity & Core Capabilities

- **Hazard-Aware Graph Routing**: Evaluates live hazard conditions, calculates safest escape routes using weighted Dijkstra algorithms, and diverts occupants away from danger zones.
- **Google Maps-Style Voice Assistant**: Browser-native turn-by-turn spoken audio guidance with directional HUD indicators, distance/RSET telemetry, and dynamic route-change alerts.
- **Real-Time WebSockets Synchronization**: Instant multi-device broadcast of active emergency events, spreading hazards, and corridor blockages.
- **Web Push API (VAPID RFC 8292)**: PWA push notification subsystem delivering system-level emergency alerts to registered student and staff mobile devices.
- **Indoor Location & QR Code Positioning**: Multi-floor room selector and door QR code positioning scanner for accurate indoor location fixing without relying on indoor GPS.
- **Safety Officer Command Dashboard**: Full-control command center for activating emergencies, placing/clearing corridor hazards, broadcasting alerts, and monitoring live evacuation progress.
- **Safety Analytics & Bottlenecks**: Floor-by-floor reachability percentages, corridor betweenness centrality risk ranking, and exit load distribution.
- **Interactive 15-Step Simulation Engine**: Built-in scenario runner demonstrating the complete Section 14 academic demonstration workflow with one-click actions.

---

## 2. Directory Structure

```
Evac_2.0/
├── backend/
│   ├── app/
│   │   ├── analytics/          # Egress reachability & centrality services
│   │   ├── api/                # FastAPI routers (auth, emergency, hazards, routing, etc.)
│   │   ├── authentication/     # JWT authentication & RBAC handlers
│   │   ├── emergency/          # Emergency lifecycle state machine
│   │   ├── graph/              # NetworkX pathfinding & voice instruction engine
│   │   ├── models/             # SQLAlchemy ORM models
│   │   ├── notifications/      # Web Push VAPID notification service
│   │   ├── config.py           # Application settings & environment variables
│   │   ├── database.py         # Database engine & seed functions
│   │   └── main.py             # FastAPI entry point & WebSocket handlers
│   ├── tests/                  # Automated pytest test suites
│   ├── requirements.txt        # Backend Python dependencies
│   └── run.py                  # Backend launcher
│
├── frontend/
│   ├── public/
│   │   ├── manifest.json       # PWA Manifest
│   │   ├── sw.js               # Service Worker for push notifications
│   │   └── shield-alert.svg    # Vector icons
│   ├── src/
│   │   ├── components/         # MapCanvas, VoiceNavPanel, LocationSelector, Navbar, etc.
│   │   ├── context/            # AuthContext, EmergencyContext, VoiceNavigationContext
│   │   ├── pages/              # Emergency, Admin, Staff Report, Analytics, Simulation
│   │   ├── services/           # API client, WebSocket client, Web Audio, Web Speech
│   │   ├── styles/             # Tailwind CSS & keyframe animations
│   │   ├── App.jsx             # Top-level router orchestrator
│   │   └── main.jsx            # React root
│   ├── package.json            # Frontend npm scripts & dependencies
│   ├── vite.config.js          # Vite bundler & reverse proxy
│   └── tailwind.config.js      # Life-safety color palette configuration
│
├── database/
│   └── seed_data/
│       └── building_topology.json # 140 nodes & 185 edges (Ground to Floor 4)
│
├── documentation/
│   ├── ARCHITECTURE.md         # Component diagrams & mathematical cost model
│   ├── API_REFERENCE.md        # Complete REST & WebSocket endpoint specs
│   └── SIMULATION_GUIDE.md     # 15-step demonstration scenario walkthrough
│
├── .env.example                # Environment variable documentation
├── package.json                # Root monorepo scripts
└── README.md                   # Project documentation
```

---

## 3. Quickstart & Execution Instructions

### Prerequisites
- **Python**: Version 3.10+ (Tested on Python 3.12)
- **Node.js**: Version 18+ (Tested on Node v26)

---

### Step 1: Start the Backend Server

Open a terminal in the project root:

```bash
# Optional: create virtual environment if desired
# python -m venv venv && .\venv\Scripts\Activate.ps1

# Install dependencies (already satisfied in current environment):
pip install -r backend/requirements.txt

# Run backend API & WebSocket server:
python run_backend.py
```

The backend server will start at:
- **API Base URL**: `http://127.0.0.1:8000`
- **Interactive Swagger Docs**: `http://127.0.0.1:8000/docs`
- **WebSocket Endpoint**: `ws://127.0.0.1:8000/ws/emergency`

---

### Step 2: Start the Frontend Application

In a second terminal:

```bash
# Install frontend dependencies:
npm run frontend:install

# Start Vite development server:
npm run frontend:dev
```

The frontend application will launch at:
- **Web App**: `http://localhost:3000`

---

## 4. Default Evaluation Credentials

For seamless testing, one-click demo login buttons are provided on the login page and in the top navigation bar:

| Role | Email | Password | Persona & Scope |
|---|---|---|---|
| **Safety Officer (Admin)** | `admin@evacroute.edu` | `admin123` | Chief Safety Officer Sarah Jenkins (Full Command & Drill Engine) |
| **First Responder / Security** | `security@evacroute.edu` | `security123` | Officer Marcus Vance (SOS Triage, Hazard Blockades & Check-Ins) |
| **Staff Member** | `staff@evacroute.edu` | `staff123` | Prof. Robert Vance (Evacuation & Incident Reporting) |
| **Student** | `student@evacroute.edu` | `student123` | Alex Chen (Evacuation Guide, Hindi/EN Voice & Distress SOS) |

---

## 5. Verification & Automated Test Results

The backend includes 15 automated unit and integration tests verifying all critical life-safety capabilities:

```bash
# Run backend test suite:
pytest backend/tests/test_api.py -v
```

### Test Suite Execution Output:
```
backend/tests/test_api.py::test_health_check PASSED                      [  6%]
backend/tests/test_api.py::test_auth_login_admin PASSED                  [ 13%]
backend/tests/test_api.py::test_auth_quick_demo_login PASSED             [ 20%]
backend/tests/test_api.py::test_building_topology PASSED                 [ 26%]
backend/tests/test_api.py::test_routing_normal_evacuation PASSED         [ 33%]
backend/tests/test_api.py::test_routing_ada_wheelchair_mode PASSED       [ 40%]
backend/tests/test_api.py::test_routing_fallback_to_exits_when_assembly_blocked PASSED [ 46%]
backend/tests/test_api.py::test_emergency_lifecycle_and_rerouting PASSED [ 53%]
backend/tests/test_api.py::test_staff_reporting_and_verification PASSED  [ 60%]
backend/tests/test_api.py::test_iot_sensors_and_alarm_simulation PASSED  [ 66%]
backend/tests/test_api.py::test_building_management_crud PASSED          [ 73%]
backend/tests/test_api.py::test_user_management_and_stats PASSED         [ 80%]
backend/tests/test_api.py::test_safety_analytics PASSED                  [ 86%]
backend/tests/test_api.py::test_sos_lifecycle PASSED                     [ 93%]
backend/tests/test_api.py::test_assembly_checkin PASSED                  [100%]

======================= 15 passed in 8.32s =======================
```

### Frontend Production Build Output:
```bash
npm run frontend:build
```
```
✓ 1495 modules transformed.
dist/index.html                   1.63 kB
dist/assets/index-C3WWDHCB.css   42.56 kB
dist/assets/index-B47HX0em.js   376.46 kB
✓ built in 2.46s (Zero Errors, Zero Warnings)
```

---

## 6. External Integrations Requiring Third-Party Credentials or Hardware

In compliance with academic project standards, external provider placeholders are architected and configured via `.env`:

1. **SMS Gateway (Twilio)**: Configurable in `backend/app/config.py` (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`). Web Push notifications are implemented as the primary production-grade alert mechanism.
2. **Email Gateway (SendGrid / SMTP)**: Configurable via `SENDGRID_API_KEY`.
3. **Physical IoT Sensors**: The backend provides a fully functional simulated sensor ingestion API (`/api/iot/telemetry` and `/api/iot/simulate-alarm`) and live telemetry feed. Physical connection to hardware requires physical smoke/flame sensors connected to an MQTT gateway.
4. **Indoor BLE / Wi-Fi Beacons**: The indoor positioning architecture provides QR code scanning and room-level database resolution; physical BLE triangulation hardware requires campus deployment.
