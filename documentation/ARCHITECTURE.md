# EvacRoute Emergency Response – Architecture Overview

## 1. System Philosophy & Objectives
EvacRoute Emergency Response 2.0 is an independent campus life-safety platform built to solve real-world emergency bottlenecks inside multi-floor university buildings. Rather than directing occupants along static fire exits that may already be compromised by smoke or fire, EvacRoute provides dynamic, hazard-aware routing accompanied by Google Maps-style spoken voice navigation.

---

## 2. Component Architecture

```
                    +------------------------------------+
                    |   Client Devices (Browsers / PWA)  |
                    |  (Student, Staff, Safety Officer)  |
                    +-----------------+------------------+
                                      |
                 +--------------------+--------------------+
                 | HTTP REST (JSON)   | WebSockets (WSS)   | Web Push (RFC 8292)
                 v                    v                    v
+-------------------------------------------------------------------------+
|                  EvacRoute FastAPI Application Layer                    |
|                                                                         |
|  +-------------------+  +--------------------+  +--------------------+  |
|  | Auth & RBAC (JWT) |  | Emergency Engine   |  | Push Notifications |  |
|  +-------------------+  +--------------------+  +--------------------+  |
|                                                                         |
|  +-------------------+  +--------------------+  +--------------------+  |
|  | Graph & Routing   |  | Safety Analytics   |  | IoT Telemetry      |  |
|  | (NetworkX Dijkstra|  | (Centrality/RSET)  |  | Gateway Simulator  |  |
|  +-------------------+  +--------------------+  +--------------------+  |
+-------------------------------------------------------------------------+
                                      |
                 +--------------------+--------------------+
                 | SQLAlchemy ORM                          | JSON File
                 v                                         v
+----------------------------------+     +--------------------------------+
| SQLite / PostgreSQL Database     |     | Building Topology Seed Data    |
| - Users & Subscriptions          |     | - 140 Nodes (Rooms, Stairs,    |
| - Emergency Events & Hazards     |     |   Ramps, Exits, Assemblies)    |
| - Incident Reports & IoT Logs    |     | - 185 Corridors & Connectors   |
+----------------------------------+     +--------------------------------+
```

---

## 3. Dynamic Hazard & Routing Engine

### Hazard Traversal Cost Model
- **Fire (`fire`)**: Traversal Weight = $\infty$. Edge and node are completely removed from the graph. Occupants are diverted to alternate staircases or corridors.
- **Toxic Gas (`gas`)**: Traversal Weight = $\infty$. Immediate exclusion zone.
- **Structural Damage (`structural`)**: Traversal Weight = $\infty$ for wheelchair/ADA occupants; passable only if no alternative exists.
- **Blocked Corridor (`blocked`)**: Traversal Weight = $\infty$. Corridor marked as impassable.
- **Heavy Smoke (`smoke`)**: Traversal Weight multiplied by 5.0x penalty. Passable only as a last resort if all clean corridors are blocked.
- **Wheelchair / ADA Mode**: Automatically eliminates staircases (`type == 'staircase'` and `is_stairs == True`). Occupants are routed exclusively through accessible ramps (`GF-RAMP`) and designated evacuation lifts (`GF-LIFT-S`).

### Voice Instruction Generator
When a safe route is calculated, the system performs 2D cross-product vector calculations on node coordinates $(x, y)$ along the path to produce real-time directional instructions:
- `turn-left`: "Turn left into Floor 2 North Corridor"
- `turn-right`: "Turn right into Floor 2 NW Corridor"
- `straight`: "Proceed straight along Corridor"
- `stairs-down`: "Proceed downstairs via NW Stairs to Floor 1"
- `ramp-down`: "Take Accessible Ramp to Ground Floor"
- `exit`: "Exit through Main Entrance immediately"
- `assembly`: "Proceed to Designated Assembly Point A on East Lawn"

---

## 4. WebSockets Real-Time Synchronization Protocol
Clients maintain an active WebSocket connection to `/ws/emergency`. The server broadcasts the following event types:
1. `EMERGENCY_ACTIVATED`: Triggers siren audio chime, highlights red hazard zone, switches UI to emergency mode.
2. `HAZARD_UPDATED`: Broadcasts newly reported fire spread or corridor collapse.
3. `ROUTE_RECALCULATION_NEEDED`: Prompts all connected client devices to re-query the routing service.
4. `EMERGENCY_RESOLVED`: Clears hazard overlays and sends All-Clear signal.
5. `IOT_TELEMETRY`: Delivers live sensor updates to the safety officer dashboard.
6. `ANNOUNCEMENT`: Broadcasts urgent instructions from the Chief Safety Officer.

---

## 5. Web Push Notification Architecture
- Built on the standard Web Push API (RFC 8292) using Voluntary Application Server Identification (VAPID).
- PWA Service Worker (`sw.js`) intercepts push events in the background even if the browser tab is closed.
- Clicking the notification directly launches `/emergency?source=push_notification`, immediately fixing the user's location and computing safe egress.
