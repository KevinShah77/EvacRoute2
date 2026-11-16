from typing import Dict, Any, List, Optional
from datetime import datetime
import networkx as nx
from sqlalchemy.orm import Session
from app.graph.graph_engine import graph_engine
from app.models.models import EmergencyEvent, Hazard, AuditLog, SOSRequest, AssemblyCheckin

class AnalyticsService:
    def get_safety_analytics(
        self,
        db: Session,
        floor_filter: Optional[str] = None,
        entrance_filter: Optional[str] = None,
        emergency_id_filter: Optional[int] = None
    ) -> Dict[str, Any]:
        # Hazards query based on emergency event filter or active
        if emergency_id_filter:
            hazards_query = db.query(Hazard).filter(Hazard.emergency_id == emergency_id_filter)
        else:
            hazards_query = db.query(Hazard).filter(Hazard.is_active == True)
        
        hazards_records = hazards_query.all()
        hazards_list = [
            {
                "id": h.id,
                "hazard_type": h.hazard_type,
                "floor": h.floor,
                "node_id": h.node_id,
                "edge_source": h.edge_source,
                "edge_target": h.edge_target,
                "severity": h.severity,
                "description": h.description
            }
            for h in hazards_records
        ]

        # Evaluate work graph under hazards
        work_graph = graph_engine._apply_hazards_and_accessibility(accessible_mode=False, active_hazards=hazards_list)
        all_exits = graph_engine.get_exits()
        operational_exits = [n["id"] for n in all_exits if work_graph.has_node(n["id"])]
        
        # Entrance filter
        effective_exits = operational_exits
        if entrance_filter and entrance_filter != "all":
            effective_exits = [ex for ex in operational_exits if ex == entrance_filter]

        all_rooms = [n for n in graph_engine.nodes_dict.values() if n.get("type") == "classroom"]

        if floor_filter and floor_filter != "all":
            all_rooms = [r for r in all_rooms if r.get("floor") == floor_filter]

        reachable_rooms = []
        unreachable_rooms = []
        room_rset_samples = []
        available_routes = []

        for room in all_rooms:
            rid = room["id"]
            if not work_graph.has_node(rid):
                unreachable_rooms.append({
                    "id": rid,
                    "label": room.get("label", rid),
                    "floor": room.get("floor", "Ground"),
                    "reason": "Directly engulfed in danger zone"
                })
                continue

            can_reach = False
            shortest_dist = float("inf")
            best_exit = None

            for ex in effective_exits:
                try:
                    dist = nx.shortest_path_length(work_graph, rid, ex, weight="weight")
                    if dist < shortest_dist:
                        shortest_dist = dist
                        best_exit = ex
                    can_reach = True
                except nx.NetworkXNoPath:
                    pass

            if can_reach and best_exit:
                reachable_rooms.append({
                    "id": rid,
                    "label": room.get("label", rid),
                    "floor": room.get("floor", "Ground"),
                    "distance_meters": round(shortest_dist, 1),
                    "assigned_exit": best_exit,
                    "rset_seconds": round(shortest_dist / 1.2) + 10
                })
                room_rset_samples.append(round(shortest_dist / 1.2, 1))
                available_routes.append({
                    "room_id": rid,
                    "exit_id": best_exit,
                    "distance_meters": round(shortest_dist, 1)
                })
            else:
                unreachable_rooms.append({
                    "id": rid,
                    "label": room.get("label", rid),
                    "floor": room.get("floor", "Ground"),
                    "reason": "All egress corridors leading to exit blocked by active hazards"
                })

        total_rooms = len(all_rooms)
        reachability_pct = round((len(reachable_rooms) / total_rooms * 100), 1) if total_rooms > 0 else 100.0
        avg_rset = round(sum(room_rset_samples) / len(room_rset_samples), 1) if room_rset_samples else 0.0

        # Bottleneck Corridors (Betweenness Centrality on corridor nodes)
        centrality = nx.betweenness_centrality(work_graph, weight="weight")
        bottlenecks = []
        for nid, score in sorted(centrality.items(), key=lambda x: x[1], reverse=True):
            node_data = graph_engine.nodes_dict.get(nid, {})
            if node_data.get("type") in ["corridor", "staircase"]:
                bottlenecks.append({
                    "node_id": nid,
                    "label": node_data.get("label", nid),
                    "floor": node_data.get("floor", "Ground"),
                    "type": node_data.get("type", "corridor"),
                    "centrality_score": round(score, 4),
                    "risk_level": "CRITICAL" if score > 0.15 else "MODERATE" if score > 0.08 else "LOW"
                })
            if len(bottlenecks) >= 10:
                break

        # Floor-wise breakdown
        floors = ["Ground", "Floor 1", "Floor 2", "Floor 3", "Floor 4"]
        floor_metrics = []
        for fl in floors:
            fl_rooms = [r for r in graph_engine.nodes_dict.values() if r.get("type") == "classroom" and r.get("floor") == fl]
            fl_reachable = 0
            for r in fl_rooms:
                rid = r["id"]
                if work_graph.has_node(rid):
                    for ex in operational_exits:
                        if nx.has_path(work_graph, rid, ex):
                            fl_reachable += 1
                            break
            pct = round((fl_reachable / len(fl_rooms) * 100), 1) if fl_rooms else 100.0
            floor_metrics.append({
                "floor": fl,
                "total_rooms": len(fl_rooms),
                "reachable_rooms": fl_reachable,
                "unreachable_rooms": len(fl_rooms) - fl_reachable,
                "reachability_pct": pct,
                "active_hazards": len([h for h in hazards_records if h.floor == fl])
            })

        # Exit Loads (Entrance-wise graph evaluation)
        exit_loads = []
        for ex in all_exits:
            ex_id = ex["id"]
            closest_count = 0
            if work_graph.has_node(ex_id):
                for room in reachable_rooms:
                    if room.get("assigned_exit") == ex_id:
                        closest_count += 1
            exit_loads.append({
                "exit_id": ex_id,
                "label": ex.get("label", ex_id),
                "status": "OPERATIONAL" if work_graph.has_node(ex_id) else "COMPROMISED",
                "assigned_rooms_count": closest_count,
                "percentage_load": round(closest_count / len(reachable_rooms) * 100, 1) if reachable_rooms else 0.0
            })

        # Hazard distribution breakdown (by type and floor)
        hazard_type_counts = {"fire": 0, "smoke": 0, "gas": 0, "structural": 0, "blocked": 0}
        hazard_floor_counts = {fl: 0 for fl in floors}
        for h in hazards_records:
            htype = (h.hazard_type or "blocked").lower()
            if htype in hazard_type_counts:
                hazard_type_counts[htype] += 1
            else:
                hazard_type_counts[htype] = 1
            if h.floor in hazard_floor_counts:
                hazard_floor_counts[h.floor] += 1

        # Blocked corridors list
        blocked_corridors = []
        for h in hazards_records:
            if h.edge_source and h.edge_target:
                blocked_corridors.append({
                    "id": f"{h.edge_source}-{h.edge_target}",
                    "corridor": f"{h.edge_source} ↔ {h.edge_target}",
                    "floor": h.floor,
                    "type": h.hazard_type,
                    "description": h.description or "Impassable corridor segment"
                })
            elif h.node_id:
                blocked_corridors.append({
                    "id": h.node_id,
                    "corridor": f"Corridor Node {h.node_id}",
                    "floor": h.floor,
                    "type": h.hazard_type,
                    "description": h.description or "Blocked intersection node"
                })

        # Emergency response history
        history_events = db.query(EmergencyEvent).order_by(EmergencyEvent.reported_at.desc()).limit(15).all()
        history_data = []
        for e in history_events:
            duration_str = "Ongoing"
            if e.resolved_at and e.activated_at:
                dur_secs = int((e.resolved_at - e.activated_at).total_seconds())
                duration_str = f"{dur_secs // 60}m {dur_secs % 60}s" if dur_secs >= 60 else f"{dur_secs}s"
            history_data.append({
                "id": e.id,
                "emergency_type": e.emergency_type,
                "floor": e.floor,
                "location": e.location,
                "severity": e.severity,
                "status": e.status,
                "is_simulation": e.is_simulation,
                "activated_at": e.activated_at.isoformat() if e.activated_at else None,
                "resolved_at": e.resolved_at.isoformat() if e.resolved_at else None,
                "duration": duration_str,
                "resolution_notes": e.resolution_notes
            })

        # SOS Statistics (Section 5: Number of SOS requests & avg response time)
        all_sos = db.query(SOSRequest).all()
        sos_response_times = []
        for s in all_sos:
            if s.acknowledged_at and s.created_at:
                delta = (s.acknowledged_at - s.created_at).total_seconds()
                if delta >= 0:
                    sos_response_times.append(delta)

        avg_sos_response_seconds = round(sum(sos_response_times) / len(sos_response_times), 1) if sos_response_times else 0.0

        # Assembly Check-in Statistics (Section 5: Number of people checked in & floor-wise)
        all_checkins = db.query(AssemblyCheckin).all()
        checkins_by_assembly = {}
        checkins_by_floor = {fl: 0 for fl in floors}
        for c in all_checkins:
            ap = c.assembly_point_name or c.assembly_point_id
            checkins_by_assembly[ap] = checkins_by_assembly.get(ap, 0) + 1
            fl = c.floor or "Ground"
            if fl in checkins_by_floor:
                checkins_by_floor[fl] += 1
            else:
                checkins_by_floor[fl] = 1

        # Drill Completion Time (Section 5: Emergency drill completion time)
        drill_events = db.query(EmergencyEvent).filter(EmergencyEvent.is_simulation == True).all()
        drill_durations = []
        for d in drill_events:
            if d.resolved_at and d.activated_at:
                dur = (d.resolved_at - d.activated_at).total_seconds()
                if dur > 0:
                    drill_durations.append(dur)
        avg_drill_time = round(sum(drill_durations) / len(drill_durations), 1) if drill_durations else 0.0

        return {
            "summary": {
                "total_rooms": total_rooms,
                "reachable_count": len(reachable_rooms),
                "unreachable_count": len(unreachable_rooms),
                "reachability_percentage": reachability_pct,
                "average_rset_seconds": avg_rset,
                "average_rset_formatted": f"{int(avg_rset // 60)}m {int(avg_rset % 60)}s" if avg_rset >= 60 else f"{int(avg_rset)}s",
                "active_hazards_count": len(hazards_records),
                "operational_exits_count": len(operational_exits),
                "available_routes_count": len(available_routes),
                "total_sos_requests": len(all_sos),
                "avg_sos_response_seconds": avg_sos_response_seconds,
                "total_checkins": len(all_checkins),
                "avg_drill_completion_seconds": avg_drill_time
            },
            "sos_analytics": {
                "total_requests": len(all_sos),
                "pending_count": len([s for s in all_sos if s.status == "pending"]),
                "acknowledged_count": len([s for s in all_sos if s.status == "acknowledged"]),
                "resolved_count": len([s for s in all_sos if s.status == "resolved"]),
                "average_response_seconds": avg_sos_response_seconds,
                "average_response_formatted": f"{int(avg_sos_response_seconds // 60)}m {int(avg_sos_response_seconds % 60)}s" if avg_sos_response_seconds >= 60 else f"{int(avg_sos_response_seconds)}s"
            },
            "checkin_analytics": {
                "total_checkins": len(all_checkins),
                "by_assembly": checkins_by_assembly,
                "by_floor": checkins_by_floor
            },
            "drill_analytics": {
                "total_drills": len(drill_events),
                "completed_drills": len(drill_durations),
                "average_duration_seconds": avg_drill_time,
                "average_duration_formatted": f"{int(avg_drill_time // 60)}m {int(avg_drill_time % 60)}s" if avg_drill_time >= 60 else f"{int(avg_drill_time)}s"
            },
            "floor_breakdown": floor_metrics,
            "exit_distribution": exit_loads,
            "top_bottlenecks": bottlenecks,
            "unreachable_rooms": unreachable_rooms,
            "hazard_distribution": {
                "by_type": hazard_type_counts,
                "by_floor": hazard_floor_counts
            },
            "blocked_corridors": blocked_corridors,
            "emergency_history": history_data
        }

analytics_service = AnalyticsService()
