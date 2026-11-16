# EvacRoute API Reference Documentation

All endpoints are hosted under prefix `/api`.

---

## 1. Authentication (`/api/auth`)

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register new student, staff, or admin | None |
| `POST` | `/api/auth/login` | Login with email and password | None |
| `POST` | `/api/auth/quick-demo-login` | 1-click evaluation login (`role=student/staff/admin`) | None |
| `GET` | `/api/auth/me` | Fetch active profile | Bearer Token |
| `GET` | `/api/auth/users` | List registered campus users | Admin |

---

## 2. Emergency Management (`/api/emergency`)

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/emergency/active` | Get current active emergency and hazards | None |
| `POST` | `/api/emergency/activate` | Activate new emergency protocol | Admin |
| `POST` | `/api/emergency/report` | Submit hazard report | None / Optional |
| `GET` | `/api/emergency/reports` | List pending and verified reports | Staff / Admin |
| `POST` | `/api/emergency/reports/{id}/verify`| Confirm or dismiss report | Admin |
| `POST` | `/api/emergency/resolve` | Resolve emergency with debrief notes | Admin |
| `GET` | `/api/emergency/history` | Historical log of emergencies & drills | None |
| `POST` | `/api/emergency/announcement` | Broadcast campus announcement | Admin |

---

## 3. Hazard Management (`/api/hazards`)

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/hazards` | List active hazards and blocked corridors | None |
| `POST` | `/api/hazards` | Add hazard (`fire`, `smoke`, `gas`, `blocked`) | Staff / Admin |
| `DELETE` | `/api/hazards/{id}` | Clear specific hazard | Admin |
| `POST` | `/api/hazards/reset` | Clear all active hazards campus-wide | Admin |

---

## 4. Intelligent Routing (`/api/routing`)

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/routing/evacuate` | Calculate safest route, RSET & voice guidance | None |
| `GET` | `/api/routing/exits` | Get operational status of campus exits | None |

---

## 5. Building & QR Location (`/api/building`)

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/building/topology` | Full building graph nodes and edges | None |
| `GET` | `/api/building/floors` | List of floors | None |
| `GET` | `/api/building/nodes` | List nodes filtered by floor or type | None |
| `GET` | `/api/building/qr/{room_id}` | Resolve indoor QR door sticker to node | None |

---

## 6. Push Notifications (`/api/notifications`)

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/notifications/vapid-public-key`| Get RFC 8292 VAPID public key | None |
| `POST` | `/api/notifications/subscribe` | Register browser push subscription | None |
| `POST` | `/api/notifications/test` | Send test push alert to device | None |
| `GET` | `/api/notifications/stats` | Delivery metrics & device counts | None |
| `GET` | `/api/notifications/recent-dispatches`| Recent broadcast alerts queue | None |

---

## 7. IoT Sensor Gateway (`/api/iot`)

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/iot/sensors` | List IoT sensors and live readings | None |
| `POST` | `/api/iot/telemetry` | Sensor ingestion endpoint | Sensor Key |
| `POST` | `/api/iot/simulate-alarm` | Simulate hazard threshold spike | Admin |
| `POST` | `/api/iot/reset` | Reset all sensors to normal baseline | Admin |

---

## 8. Safety Analytics (`/api/analytics`)

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/analytics/summary` | Campus reachability %, RSET, bottlenecks | None |
| `GET` | `/api/analytics/floor/{floor}` | Floor-specific graph diagnostics | None |
