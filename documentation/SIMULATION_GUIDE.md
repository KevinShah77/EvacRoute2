# EvacRoute Simulation & Demonstration Guide

This guide details the exact 15-step demonstration scenario described in Section 14.

---

## Interactive 1-Click Simulation Walkthrough

EvacRoute includes a built-in automated scenario runner at route:
`http://localhost:3000/simulation`

You can click through each step sequentially, observing both the visual map updates and hearing the browser speech synthesis in real-time.

---

## Step-by-Step Scenario Execution

### Step 1: Admin Authentication
- **Action**: Authenticate as Chief Safety Officer Sarah Jenkins (`admin@evacroute.edu` / `admin123`).
- **Result**: Administrator privileges granted.

### Step 2: Access Emergency Control Dashboard
- **Action**: Navigate to `/admin`.
- **Result**: Overview displays normal status, 0 active hazards, and operational exits.

### Step 3 & 4: Configure Emergency Parameters
- **Action**: Select **Fire** as Emergency Type, **Floor 2**, **Room 205** (Lecture Hall 205).
- **Result**: Emergency activation payload prepared.

### Step 5: Activate Simulated Emergency
- **Action**: Click "Activate Emergency Protocol".
- **Result**:
  - Emergency event created with `is_simulation=True`.
  - Node `F2-205` flagged with a critical fire hazard.
  - WebSocket broadcasts `EMERGENCY_ACTIVATED` to all connected clients.
  - Emergency audio siren chimes.

### Step 6: Dispatch Push Notifications
- **Action**: VAPID Web Push alert dispatched to registered devices.
- **Result**: System notification appears on test devices with direct link to evacuation map.

### Step 7 & 8: Student Device View
- **Action**: Open student view at `/emergency`.
- **Result**: Room 205 is highlighted in pulsating **RED** danger aura.

### Step 9: Select Student Current Room
- **Action**: In the location selector, select **Room 208 (Floor 2)** (or click Scan Door QR).
- **Result**: Blue user marker positioned at Room 208.

### Step 10: Safest Evacuation Route Calculated
- **Action**: Pathfinding engine computes shortest safe route avoiding Room 205 fire.
- **Result**:
  - Green glowing route directs occupant north along Floor 2 Corridor to North-West Staircase (`F2-S-NW`), down to Ground Floor, exiting through North Perimeter Exit to Assembly Point C.

### Step 11: Voice-Guided Navigation
- **Action**: Click "Start Voice Guidance".
- **Result**:
  - Web Audio pleasant chime sounds.
  - Spoken audio: *"Emergency evacuation activated. Please remain calm. You are currently at Seminar Room 208 on Floor 2."*
  - Turn-by-turn guidance begins.

### Step 12: Fire Spreads Mid-Evacuation
- **Action**: In Admin dashboard or via Step 12 runner, simulate fire spreading to North-West Staircase (`F2-S-NW`).
- **Result**: WebSocket emits `HAZARD_UPDATED` and `ROUTE_RECALCULATION_NEEDED`.

### Step 13 & 14: Dynamic Recalculation & Voice Announcement
- **Action**: Client detects path invalidation.
- **Result**:
  - Route dynamically recalculates to divert east along `F2-C-EAST` towards North-East Stairs (`F2-S-NE`) down to Ground Floor Main Exit (`GF-E-MAIN`).
  - Spoken audio: *"Attention: Evacuation route updated due to hazard ahead. Recalculating safest available escape path."*

### Step 15: Emergency Resolution
- **Action**: Safety Officer resolves emergency with notes: *"Simulation drill complete. All occupants evacuated."*
- **Result**:
  - Status returns to Normal.
  - All hazards cleared.
  - All-Clear broadcast dispatched.
