import sys
import os
import pytest
from fastapi.testclient import TestClient

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.database import init_db, SessionLocal
from app.models.models import Hazard, EmergencyEvent

@pytest.fixture(scope="session", autouse=True)
def setup_db():
    init_db()
    db = SessionLocal()
    try:
        db.query(Hazard).delete()
        db.query(EmergencyEvent).filter(EmergencyEvent.status == "active").update({"status": "resolved"})
        db.commit()
    finally:
        db.close()

@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c

def test_health_check(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert "EvacRoute" in data["service"]

def test_auth_login_admin(client):
    res = client.post("/api/auth/login", json={"email": "admin@evacroute.edu", "password": "admin123"})
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["role"] == "admin"

def test_auth_quick_demo_login(client):
    res = client.post("/api/auth/quick-demo-login?role=student")
    assert res.status_code == 200
    data = res.json()
    assert data["user"]["role"] == "student"

def test_building_topology(client):
    res = client.get("/api/building/topology")
    assert res.status_code == 200
    data = res.json()
    assert len(data["nodes"]) >= 138
    assert len(data["edges"]) >= 180
    assert "Ground" in data["floors"]

def test_routing_normal_evacuation(client):
    # Route from F2-208 (evacuee location avoiding fire at F2-205)
    res = client.post("/api/routing/evacuate", json={
        "start_node_id": "F2-208",
        "accessible_mode": False
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["safe_route_found"] is True
    assert len(data["steps"]) > 0
    assert "rset_seconds" in data
    assert data["destination_node"] is not None

def test_routing_ada_wheelchair_mode(client):
    res = client.post("/api/routing/evacuate", json={
        "start_node_id": "F2-208",
        "accessible_mode": True
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    # In ADA mode, path must not contain any stairs
    path_nodes = data["path_nodes"]
    for node in path_nodes:
        assert node["type"] != "staircase"

def test_routing_fallback_to_exits_when_assembly_blocked(client):
    # Test our critical bug fix: when outdoor paths to assembly points are blocked,
    # routing must fall back to building exits rather than falsely declaring NO_SAFE_ROUTE
    login_res = client.post("/api/auth/login", json={"email": "admin@evacroute.edu", "password": "admin123"})
    headers = {"Authorization": f"Bearer {login_res.json()['access_token']}"}

    # Block edges to all 3 assembly points
    edges_to_block = [
        ("GF-E-MAIN", "ASSEMBLY-MAIN"),
        ("GF-E-WEST", "ASSEMBLY-WEST"),
        ("GF-E-NORTH", "ASSEMBLY-NORTH")
    ]
    created_hazards = []
    for src, dst in edges_to_block:
        h_res = client.post("/api/hazards", json={
            "hazard_type": "blocked",
            "floor": "Ground",
            "edge_source": src,
            "edge_target": dst,
            "severity": "critical"
        }, headers=headers)
        created_hazards.append(h_res.json()["hazard_id"])

    # Calculate route from F2-208: must successfully route to an exit!
    res = client.post("/api/routing/evacuate", json={
        "start_node_id": "F2-208",
        "accessible_mode": False
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["safe_route_found"] is True
    assert data["destination_node"]["type"] == "exit"

    # Clean up hazards
    for hid in created_hazards:
        client.delete(f"/api/hazards/{hid}", headers=headers)

def test_emergency_lifecycle_and_rerouting(client):
    # 1. Admin login to get token
    login_res = client.post("/api/auth/login", json={"email": "admin@evacroute.edu", "password": "admin123"})
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Activate emergency
    act_res = client.post("/api/emergency/activate", json={
        "emergency_type": "fire",
        "floor": "Floor 2",
        "location": "Room 205",
        "severity": "critical",
        "description": "Simulated fire drill",
        "is_simulation": True
    }, headers=headers)
    assert act_res.status_code == 200
    emergency_id = act_res.json()["emergency_id"]

    # 3. Check active emergency
    active_res = client.get("/api/emergency/active")
    assert active_res.status_code == 200
    assert active_res.json()["active"] is True
    assert active_res.json()["emergency"]["emergency_type"] == "fire"

    # 4. Add additional hazard blocking Staircase NW
    haz_res = client.post("/api/hazards", json={
        "emergency_id": emergency_id,
        "hazard_type": "fire",
        "floor": "Floor 2",
        "node_id": "F2-S-NW",
        "severity": "critical",
        "description": "Fire spread to NW stairwell"
    }, headers=headers)
    assert haz_res.status_code == 200

    # 5. Route from F2-208 should divert away from F2-S-NW
    reroute_res = client.post("/api/routing/evacuate", json={
        "start_node_id": "F2-208",
        "accessible_mode": False
    })
    assert reroute_res.status_code == 200
    r_data = reroute_res.json()
    assert r_data["safe_route_found"] is True
    assert "F2-S-NW" not in r_data["path_node_ids"]

    # 6. Resolve emergency
    res_res = client.post("/api/emergency/resolve", json={
        "emergency_id": emergency_id,
        "resolution_notes": "Drill completed successfully. All clear."
    }, headers=headers)
    assert res_res.status_code == 200

    # 7. Verify resolved
    active_after = client.get("/api/emergency/active")
    assert active_after.json()["active"] is False

def test_staff_reporting_and_verification(client):
    # Staff report emergency
    rep_res = client.post("/api/emergency/report", json={
        "reporter_name": "Dr. Vance",
        "contact": "vance@campus.edu",
        "emergency_type": "gas",
        "floor": "Floor 3",
        "location": "Research Lab 315",
        "description": "Sulfur compound leak detected"
    })
    assert rep_res.status_code == 200
    report_id = rep_res.json()["report_id"]

    # Admin verifies report
    login_res = client.post("/api/auth/login", json={"email": "admin@evacroute.edu", "password": "admin123"})
    headers = {"Authorization": f"Bearer {login_res.json()['access_token']}"}

    reports_list = client.get("/api/emergency/reports", headers=headers)
    assert reports_list.status_code == 200
    assert any(r["id"] == report_id for r in reports_list.json())

    verify_res = client.post(f"/api/emergency/reports/{report_id}/verify", json={
        "action": "confirm",
        "severity": "high",
        "is_simulation": True
    }, headers=headers)
    assert verify_res.status_code == 200

    # Clean up by resolving
    active = client.get("/api/emergency/active").json()
    if active["active"]:
        client.post("/api/emergency/resolve", json={
            "emergency_id": active["emergency"]["id"],
            "resolution_notes": "Gas leak test resolved."
        }, headers=headers)

def test_iot_sensors_and_alarm_simulation(client):
    login_res = client.post("/api/auth/login", json={"email": "admin@evacroute.edu", "password": "admin123"})
    headers = {"Authorization": f"Bearer {login_res.json()['access_token']}"}

    # List sensors
    sensors_res = client.get("/api/iot/sensors")
    assert sensors_res.status_code == 200
    assert len(sensors_res.json()) >= 5

    # Simulate spike on SMOKE-GF-011
    spike_res = client.post("/api/iot/simulate-alarm", json={
        "sensor_id": "SMOKE-GF-011",
        "value": 75.0,
        "auto_activate_emergency": True
    }, headers=headers)
    assert spike_res.status_code == 200
    assert spike_res.json()["status"] == "alert"

    # Reset sensors
    reset_res = client.post("/api/iot/reset", headers=headers)
    assert reset_res.status_code == 200

    # Resolve any emergency triggered
    active = client.get("/api/emergency/active").json()
    if active["active"]:
        client.post("/api/emergency/resolve", json={
            "emergency_id": active["emergency"]["id"],
            "resolution_notes": "IoT drill resolved."
        }, headers=headers)

def test_building_management_crud(client):
    login_res = client.post("/api/auth/login", json={"email": "admin@evacroute.edu", "password": "admin123"})
    headers = {"Authorization": f"Bearer {login_res.json()['access_token']}"}

    # 1. Create a new room node
    test_node_id = "F2-TEST-999"
    create_res = client.post("/api/building/nodes", json={
        "id": test_node_id,
        "label": "Test Robotics Lab",
        "floor": "Floor 2",
        "type": "classroom",
        "accessible": True,
        "x": 62.5,
        "y": 48.0
    }, headers=headers)
    assert create_res.status_code == 200

    # 2. Verify node exists in building topology
    node_res = client.get(f"/api/building/nodes/{test_node_id}")
    assert node_res.status_code == 200
    assert node_res.json()["label"] == "Test Robotics Lab"

    # 3. Update node
    upd_res = client.put(f"/api/building/nodes/{test_node_id}", json={
        "label": "Updated Robotics Center"
    }, headers=headers)
    assert upd_res.status_code == 200
    assert upd_res.json()["node"]["label"] == "Updated Robotics Center"

    # 4. Connect edge
    edge_res = client.post("/api/building/edges", json={
        "source": test_node_id,
        "target": "F2-C-EAST",
        "weight": 8.5,
        "is_stairs": False
    }, headers=headers)
    assert edge_res.status_code == 200

    # 5. Delete edge
    del_edge_res = client.request("DELETE", "/api/building/edges", json={
        "source": test_node_id,
        "target": "F2-C-EAST"
    }, headers=headers)
    assert del_edge_res.status_code == 200

    # 6. Delete node
    del_node_res = client.delete(f"/api/building/nodes/{test_node_id}", headers=headers)
    assert del_node_res.status_code == 200

    # Verify 404
    check_del = client.get(f"/api/building/nodes/{test_node_id}")
    assert check_del.status_code == 404

def test_user_management_and_stats(client):
    login_res = client.post("/api/auth/login", json={"email": "admin@evacroute.edu", "password": "admin123"})
    headers = {"Authorization": f"Bearer {login_res.json()['access_token']}"}

    # 1. Check user stats
    stats_res = client.get("/api/auth/stats")
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert stats["total_students"] >= 1
    assert stats["total_staff"] >= 1
    assert stats["total_admins"] >= 1

    # 2. Register temporary student user
    temp_email = "teststudent_mgmt@campus.edu"
    reg_res = client.post("/api/auth/register", json={
        "email": temp_email,
        "password": "password123",
        "full_name": "Temporary Test Student",
        "role": "student"
    })
    assert reg_res.status_code == 200
    new_user_id = reg_res.json()["user"]["id"]

    # 3. Promote to staff
    role_res = client.put(f"/api/auth/users/{new_user_id}/role", json={"role": "staff"}, headers=headers)
    assert role_res.status_code == 200
    assert role_res.json()["role"] == "staff"

    # 4. Delete user
    del_user_res = client.delete(f"/api/auth/users/{new_user_id}", headers=headers)
    assert del_user_res.status_code == 200

def test_safety_analytics(client):
    res = client.get("/api/analytics/summary?floor=Floor 2")
    assert res.status_code == 200
    data = res.json()
    assert "summary" in data
    assert "floor_breakdown" in data
    assert "top_bottlenecks" in data
    assert "hazard_distribution" in data
    assert "blocked_corridors" in data
    assert "emergency_history" in data
    assert data["summary"]["total_rooms"] > 0

def test_sos_lifecycle(client):
    # 1. Student sends SOS
    sos_res = client.post("/api/emergency/sos", json={
        "user_name": "Alex Chen",
        "floor": "Floor 2",
        "location": "Room 208",
        "node_id": "F2-208",
        "situation": "trapped",
        "details": "Exit corridor blocked by heavy smoke, door is hot."
    })
    assert sos_res.status_code == 200
    sos_data = sos_res.json()
    assert sos_data["success"] is True
    sos_id = sos_data["sos_id"]

    # 2. Responder lists SOS requests
    list_res = client.get("/api/emergency/sos")
    assert list_res.status_code == 200
    all_sos = list_res.json()
    assert any(s["id"] == sos_id and s["status"] == "pending" for s in all_sos)

    # 3. Responder acknowledges SOS
    ack_res = client.post(f"/api/emergency/sos/{sos_id}/acknowledge", json={
        "responder_name": "Officer Marcus Vance",
        "notes": "Emergency extraction team dispatched to Room 208."
    })
    assert ack_res.status_code == 200
    assert ack_res.json()["status"] == "acknowledged"

    # 4. Resolve SOS
    res_res = client.post(f"/api/emergency/sos/{sos_id}/resolve")
    assert res_res.status_code == 200
    assert res_res.json()["status"] == "resolved"

def test_assembly_checkin(client):
    checkin_res = client.post("/api/emergency/checkin", json={
        "user_name": "Prof. Robert Vance",
        "user_email": "staff@evacroute.edu",
        "assembly_point_id": "ASSEMBLY-MAIN"
    })
    assert checkin_res.status_code == 200
    c_data = checkin_res.json()
    assert c_data["success"] is True
    assert "Assembly Point A" in c_data["assembly_point"]

    list_res = client.get("/api/emergency/checkins")
    assert list_res.status_code == 200
    checkins_data = list_res.json()
    assert checkins_data["total_checkins"] >= 1
    assert "Assembly Point A (East Lawn)" in checkins_data["by_assembly"]

