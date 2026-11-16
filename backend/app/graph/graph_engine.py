import json
import math
import logging
from typing import List, Dict, Any, Optional, Tuple, Set
import networkx as nx
from app.config import settings

logger = logging.getLogger("evacroute.graph_engine")

FLOOR_LEVELS = {
    "Ground": 0,
    "Floor 1": 1,
    "Floor 2": 2,
    "Floor 3": 3,
    "Floor 4": 4,
}

class GraphEngine:
    def __init__(self, topology_path: Optional[str] = None):
        self.path = topology_path or str(settings.BUILDING_TOPOLOGY_PATH)
        self.raw_data = self._load_data()
        self._initial_raw_data = json.loads(json.dumps(self.raw_data))
        self.base_graph = self._build_graph()
        self.nodes_dict = {n["id"]: n for n in self.raw_data.get("nodes", [])}
        self.edges_list = self.raw_data.get("edges", [])
        self.building_info = self.raw_data.get("building", {})

    def _load_data(self) -> dict:
        try:
            with open(self.path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load building topology from {self.path}: {e}")
            return {"building": {}, "nodes": [], "edges": []}

    def _build_graph(self) -> nx.Graph:
        g = nx.Graph()
        for node in self.raw_data.get("nodes", []):
            g.add_node(
                node["id"],
                label=node.get("label", node["id"]),
                floor=node.get("floor", "Ground"),
                type=node.get("type", "classroom"),
                accessible=node.get("accessible", True),
                x=float(node.get("x", 50.0)),
                y=float(node.get("y", 50.0)),
            )

        for edge in self.raw_data.get("edges", []):
            g.add_edge(
                edge["source"],
                edge["target"],
                weight=float(edge.get("weight", 10.0)),
                is_stairs=bool(edge.get("is_stairs", False)),
            )
        return g

    def get_topology(self) -> dict:
        return {
            "building": self.building_info,
            "nodes": [self.nodes_dict[n] for n in self.nodes_dict],
            "edges": self.edges_list,
            "floors": self.building_info.get("floors", ["Ground", "Floor 1", "Floor 2", "Floor 3", "Floor 4"]),
            "assembly_points": self.building_info.get("assembly_points", [])
        }

    def get_node(self, node_id: str) -> Optional[dict]:
        return self.nodes_dict.get(node_id)

    def get_nodes_by_floor(self, floor: str) -> List[dict]:
        return [n for n in self.nodes_dict.values() if n.get("floor") == floor]

    def get_exits(self) -> List[dict]:
        return [n for n in self.nodes_dict.values() if n.get("type") == "exit"]

    def get_assembly_points(self) -> List[dict]:
        return [n for n in self.nodes_dict.values() if n.get("type") == "assembly_point"]

    def _apply_hazards_and_accessibility(
        self,
        accessible_mode: bool,
        active_hazards: List[Dict[str, Any]]
    ) -> nx.Graph:
        g = self.base_graph.copy()

        # Accessible mode excludes staircases and stair edges
        if accessible_mode:
            stair_nodes = [n for n, data in g.nodes(data=True) if data.get("type") == "staircase"]
            for n in stair_nodes:
                if g.has_node(n):
                    g.remove_node(n)
            stairs_edges = [(u, v) for u, v, data in g.edges(data=True) if data.get("is_stairs")]
            g.remove_edges_from(stairs_edges)

        # Apply hazards
        for h in active_hazards:
            htype = h.get("hazard_type", "").lower()
            node_id = h.get("node_id")
            edge_src = h.get("edge_source")
            edge_dst = h.get("edge_target")

            # Fire, gas, structural debris, or physical blockage: Impassable
            if htype in ["fire", "gas", "structural", "blocked"]:
                if node_id and g.has_node(node_id):
                    g.remove_node(node_id)
                if edge_src and edge_dst and g.has_edge(edge_src, edge_dst):
                    g.remove_edge(edge_src, edge_dst)

            # Smoke: passable with severe penalty multiplier (5.0x)
            elif htype == "smoke":
                if node_id and g.has_node(node_id):
                    for neighbor in list(g.neighbors(node_id)):
                        current_weight = g[node_id][neighbor].get("weight", 10.0)
                        g[node_id][neighbor]["weight"] = current_weight * 5.0
                if edge_src and edge_dst and g.has_edge(edge_src, edge_dst):
                    current_weight = g[edge_src][edge_dst].get("weight", 10.0)
                    g[edge_src][edge_dst]["weight"] = current_weight * 5.0

        return g

    def get_restricted_zones(self, hazards: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Identify Orange zones (Section 6: Potentially affected or restricted zones).
        Includes smoke-affected nodes and nodes directly adjacent to fire/gas hazards.
        """
        restricted = {}
        for h in hazards:
            htype = h.get("hazard_type", "").lower()
            nid = h.get("node_id")
            floor = h.get("floor", "")

            if htype == "smoke" and nid and nid in self.nodes_dict:
                node = self.nodes_dict[nid]
                restricted[nid] = {
                    "node_id": nid,
                    "label": node.get("label", nid),
                    "floor": node.get("floor", floor),
                    "reason": "Smoke Accumulation Zone (Passable with Caution)"
                }
            elif htype in ["fire", "gas"] and nid and self.base_graph.has_node(nid):
                # 1-hop adjacent corridors
                for neighbor in self.base_graph.neighbors(nid):
                    if neighbor in self.nodes_dict and neighbor not in restricted:
                        node = self.nodes_dict[neighbor]
                        restricted[neighbor] = {
                            "node_id": neighbor,
                            "label": node.get("label", neighbor),
                            "floor": node.get("floor", floor),
                            "reason": f"Proximity restricted zone near {htype.title()} hazard"
                        }
        return list(restricted.values())

    def calculate_evacuation_route(
        self,
        start_node_id: str,
        target_exit_id: Optional[str] = None,
        accessible_mode: bool = False,
        active_hazards: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        hazards = active_hazards or []

        if start_node_id not in self.nodes_dict:
            return {
                "success": False,
                "safe_route_found": False,
                "status": "NODE_NOT_FOUND",
                "message": f"Start node '{start_node_id}' not found in building model."
            }

        start_node = self.nodes_dict[start_node_id]
        work_graph = self._apply_hazards_and_accessibility(accessible_mode, hazards)

        if not work_graph.has_node(start_node_id):
            return {
                "success": False,
                "safe_route_found": False,
                "status": "IMMEDIATE_HAZARD_ZONE",
                "message": "Immediate start location is engulfed in danger. Evacuate through alternate doorway.",
                "fallback_guidance": "SHELTER IN PLACE IMMEDIATELY. Seal door seals with damp clothing. Signal out window."
            }

        # Available destinations
        assembly_points = [n["id"] for n in self.get_assembly_points() if work_graph.has_node(n["id"])]
        exits = [n["id"] for n in self.get_exits() if work_graph.has_node(n["id"])]

        candidate_destinations = []
        if target_exit_id:
            if work_graph.has_node(target_exit_id):
                candidate_destinations = [target_exit_id]
        else:
            # Assembly points are primary safe destination
            candidate_destinations = assembly_points

        best_path = None
        best_cost = float("inf")
        backup_path = None
        backup_cost = float("inf")

        # Phase 1: Try assembly points
        for dest in candidate_destinations:
            try:
                length, path = nx.single_source_dijkstra(work_graph, start_node_id, dest, weight="weight")
                if length < best_cost:
                    backup_path = best_path
                    backup_cost = best_cost
                    best_cost = length
                    best_path = path
                elif length < backup_cost and path != best_path:
                    backup_cost = length
                    backup_path = path
            except nx.NetworkXNoPath:
                continue

        # Phase 2: If no safe route to assembly points, fallback to direct building exits!
        if not best_path and not target_exit_id:
            for dest in exits:
                try:
                    length, path = nx.single_source_dijkstra(work_graph, start_node_id, dest, weight="weight")
                    if length < best_cost:
                        backup_path = best_path
                        backup_cost = best_cost
                        best_cost = length
                        best_path = path
                    elif length < backup_cost and path != best_path:
                        backup_cost = length
                        backup_path = path
                except nx.NetworkXNoPath:
                    continue

        if not best_path:
            return {
                "success": False,
                "safe_route_found": False,
                "status": "NO_SAFE_ROUTE",
                "start_node": start_node,
                "message": "CRITICAL: All egress corridors from your sector are blocked by active hazards.",
                "fallback_guidance": (
                    "CRITICAL SAFETY WARNING: All exit paths are currently cut off by fire or smoke. "
                    "DO NOT enter smoke-filled corridors. Return to the safest room, seal cracks around the "
                    "door with wet cloths or coats to block toxic fumes, open an exterior window if safe, "
                    "and wave a bright object to alert emergency response personnel. A rescue team is en route."
                ),
                "steps": [],
                "rset_seconds": 0,
                "path_node_ids": []
            }

        # Generate Google Maps style turn-by-turn guidance
        steps = self._generate_navigation_steps(best_path, work_graph, hazards, accessible_mode)

        # Calculate RSET (Required Safe Egress Time)
        total_distance_meters = sum(
            self.base_graph[u][v].get("weight", 10.0)
            for u, v in zip(best_path[:-1], best_path[1:])
            if self.base_graph.has_edge(u, v)
        )

        speed = 1.0 if accessible_mode else 1.2
        rset_seconds = round(total_distance_meters / speed) + (15 if len(best_path) > 5 else 5)

        backup_steps = []
        if backup_path:
            backup_steps = self._generate_navigation_steps(backup_path, work_graph, hazards, accessible_mode)

        hazard_warnings = self._detect_hazard_warnings(best_path, hazards)
        restricted_zones = self.get_restricted_zones(hazards)

        return {
            "success": True,
            "safe_route_found": True,
            "status": "SAFE_ROUTE_CALCULATED",
            "start_node": start_node,
            "destination_node": self.nodes_dict.get(best_path[-1]),
            "path_node_ids": best_path,
            "path_nodes": [self.nodes_dict[nid] for nid in best_path if nid in self.nodes_dict],
            "total_distance_meters": round(total_distance_meters, 1),
            "rset_seconds": rset_seconds,
            "rset_formatted": f"{rset_seconds // 60}m {rset_seconds % 60}s" if rset_seconds >= 60 else f"{rset_seconds}s",
            "steps": steps,
            "hazard_warnings": hazard_warnings,
            "restricted_zones": restricted_zones,
            "backup_path_node_ids": backup_path,
            "backup_steps": backup_steps,
            "accessible_mode": accessible_mode,
            "active_hazard_count": len(hazards)
        }

    def _generate_navigation_steps(
        self,
        path: List[str],
        graph: nx.Graph,
        hazards: List[Dict[str, Any]],
        accessible_mode: bool
    ) -> List[Dict[str, Any]]:
        steps = []
        if not path:
            return steps

        first_node = self.nodes_dict.get(path[0], {})
        steps.append({
            "step_number": 1,
            "instruction": f"Emergency evacuation activated. Please remain calm. You are currently at {first_node.get('label', path[0])} on {first_node.get('floor', 'current floor')}.",
            "short_direction": "Start Evacuation",
            "icon": "start",
            "floor": first_node.get("floor", "Ground"),
            "node_id": path[0],
            "coordinates": {"x": first_node.get("x", 50), "y": first_node.get("y", 50)},
            "distance_meters": 0.0
        })

        for i in range(len(path) - 1):
            curr_id = path[i]
            next_id = path[i + 1]
            curr_node = self.nodes_dict.get(curr_id, {})
            next_node = self.nodes_dict.get(next_id, {})

            curr_floor = curr_node.get("floor", "Ground")
            next_floor = next_node.get("floor", "Ground")
            next_type = next_node.get("type", "")
            next_label = next_node.get("label", next_id)

            edge_weight = self.base_graph[curr_id][next_id].get("weight", 10.0) if self.base_graph.has_edge(curr_id, next_id) else 10.0

            # Inter-floor vertical transitions
            if curr_floor != next_floor:
                curr_level = FLOOR_LEVELS.get(curr_floor, 0)
                next_level = FLOOR_LEVELS.get(next_floor, 0)
                is_down = next_level < curr_level

                if next_type == "staircase":
                    direction_word = "downstairs" if is_down else "upstairs"
                    instruction = f"Proceed {direction_word} via {next_label} to {next_floor}."
                    short = f"{direction_word.capitalize()} to {next_floor}"
                    icon = "stairs-down" if is_down else "stairs-up"
                elif next_type == "elevator":
                    instruction = f"Take evacuation lift to {next_floor}."
                    short = f"Lift to {next_floor}"
                    icon = "elevator"
                elif next_type == "ramp":
                    direction_word = "down" if is_down else "up"
                    instruction = f"Take accessible ramp {direction_word} to {next_floor}."
                    short = f"Ramp {direction_word} to {next_floor}"
                    icon = "ramp-down" if is_down else "ramp"
                else:
                    direction_word = "down" if is_down else "up"
                    instruction = f"Proceed {direction_word} to {next_floor} via {next_label}."
                    short = f"To {next_floor}"
                    icon = "straight"
            elif next_type == "exit":
                instruction = f"Exit the building through {next_label} immediately."
                short = f"Exit at {next_label}"
                icon = "exit"
            elif next_type == "assembly_point":
                instruction = f"Proceed to designated assembly area: {next_label}. Report to the safety officer."
                short = "Arrive at Assembly Point"
                icon = "assembly"
            elif next_type == "ramp":
                instruction = f"Follow accessible ramp towards {next_label}."
                short = "Follow Ramp"
                icon = "ramp"
            else:
                # Calculate turn direction using 2D coordinate vectors on SAME floor
                turn = "straight"
                if i > 0:
                    prev_id = path[i - 1]
                    prev_node = self.nodes_dict.get(prev_id, {})
                    if prev_node.get("floor") == curr_floor:
                        turn = self._calculate_turn(prev_node, curr_node, next_node)

                if turn == "left":
                    instruction = f"Turn left into {next_label}."
                    short = f"Turn Left into {next_label}"
                    icon = "turn-left"
                elif turn == "right":
                    instruction = f"Turn right into {next_label}."
                    short = f"Turn Right into {next_label}"
                    icon = "turn-right"
                else:
                    instruction = f"Proceed straight along {next_label}."
                    short = f"Straight to {next_label}"
                    icon = "straight"

            steps.append({
                "step_number": len(steps) + 1,
                "instruction": instruction,
                "short_direction": short,
                "icon": icon,
                "floor": next_floor,
                "node_id": next_id,
                "coordinates": {"x": next_node.get("x", 50), "y": next_node.get("y", 50)},
                "distance_meters": round(edge_weight, 1)
            })

        return steps

    def _calculate_turn(self, p: dict, c: dict, n: dict) -> str:
        try:
            v1_x = c.get("x", 0) - p.get("x", 0)
            v1_y = c.get("y", 0) - p.get("y", 0)
            v2_x = n.get("x", 0) - c.get("x", 0)
            v2_y = n.get("y", 0) - c.get("y", 0)

            cross = v1_x * v2_y - v1_y * v2_x
            dot = v1_x * v2_x + v1_y * v2_y

            mag1 = math.sqrt(v1_x**2 + v1_y**2)
            mag2 = math.sqrt(v2_x**2 + v2_y**2)
            if mag1 == 0 or mag2 == 0:
                return "straight"

            cos_angle = max(-1.0, min(1.0, dot / (mag1 * mag2)))
            angle_deg = math.degrees(math.acos(cos_angle))

            if angle_deg < 25:
                return "straight"
            return "right" if cross > 0 else "left"
        except Exception:
            return "straight"

    def _detect_hazard_warnings(self, path: List[str], hazards: List[Dict[str, Any]]) -> List[str]:
        warnings = []
        path_set = set(path)
        for h in hazards:
            htype = h.get("hazard_type", "hazard").upper()
            floor = h.get("floor", "")
            node_id = h.get("node_id")
            if node_id and node_id in self.nodes_dict:
                node_label = self.nodes_dict[node_id].get("label", node_id)
                for p in path_set:
                    if self.base_graph.has_edge(p, node_id):
                        warnings.append(f"Caution: {htype} reported near {node_label} ({floor}). Avoid diversion into that corridor.")
                        break
        return list(set(warnings))

    # Building Management Methods (Section 10)
    def add_node(self, node_data: dict) -> bool:
        node_id = node_data.get("id")
        if not node_id:
            return False
        self.nodes_dict[node_id] = node_data
        self.raw_data["nodes"] = list(self.nodes_dict.values())
        self.base_graph.add_node(
            node_id,
            label=node_data.get("label", node_id),
            floor=node_data.get("floor", "Ground"),
            type=node_data.get("type", "classroom"),
            accessible=node_data.get("accessible", True),
            x=float(node_data.get("x", 50.0)),
            y=float(node_data.get("y", 50.0)),
        )
        self.save_to_disk()
        return True

    def update_node(self, node_id: str, node_data: dict) -> bool:
        if node_id not in self.nodes_dict:
            return False
        curr = self.nodes_dict[node_id]
        curr.update(node_data)
        self.nodes_dict[node_id] = curr
        self.raw_data["nodes"] = list(self.nodes_dict.values())
        if self.base_graph.has_node(node_id):
            for k, v in node_data.items():
                self.base_graph.nodes[node_id][k] = v
        self.save_to_disk()
        return True

    def delete_node(self, node_id: str) -> bool:
        if node_id not in self.nodes_dict:
            return False
        del self.nodes_dict[node_id]
        self.raw_data["nodes"] = list(self.nodes_dict.values())
        # Delete connected edges
        self.edges_list = [
            e for e in self.edges_list
            if e.get("source") != node_id and e.get("target") != node_id
        ]
        self.raw_data["edges"] = self.edges_list
        if self.base_graph.has_node(node_id):
            self.base_graph.remove_node(node_id)
        self.save_to_disk()
        return True

    def add_edge(self, edge_data: dict) -> bool:
        src = edge_data.get("source")
        dst = edge_data.get("target")
        if not src or not dst:
            return False
        weight = float(edge_data.get("weight", 10.0))
        is_stairs = bool(edge_data.get("is_stairs", False))

        # Check if edge already exists
        for e in self.edges_list:
            if (e["source"] == src and e["target"] == dst) or (e["source"] == dst and e["target"] == src):
                e["weight"] = weight
                e["is_stairs"] = is_stairs
                self.base_graph.add_edge(src, dst, weight=weight, is_stairs=is_stairs)
                self.save_to_disk()
                return True

        new_edge = {
            "source": src,
            "target": dst,
            "weight": weight,
            "is_stairs": is_stairs
        }
        self.edges_list.append(new_edge)
        self.raw_data["edges"] = self.edges_list
        self.base_graph.add_edge(src, dst, weight=weight, is_stairs=is_stairs)
        self.save_to_disk()
        return True

    def delete_edge(self, source: str, target: str) -> bool:
        initial_len = len(self.edges_list)
        self.edges_list = [
            e for e in self.edges_list
            if not ((e["source"] == source and e["target"] == target) or (e["source"] == target and e["target"] == source))
        ]
        if len(self.edges_list) < initial_len:
            self.raw_data["edges"] = self.edges_list
            if self.base_graph.has_edge(source, target):
                self.base_graph.remove_edge(source, target)
            self.save_to_disk()
            return True
        return False

    def save_to_disk(self):
        try:
            with open(self.path, "w", encoding="utf-8") as f:
                json.dump(self.raw_data, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to persist topology to {self.path}: {e}")

    def reset_to_default(self):
        self.raw_data = json.loads(json.dumps(self._initial_raw_data))
        self.nodes_dict = {n["id"]: n for n in self.raw_data.get("nodes", [])}
        self.edges_list = self.raw_data.get("edges", [])
        self.building_info = self.raw_data.get("building", {})
        self.base_graph = self._build_graph()
        self.save_to_disk()

graph_engine = GraphEngine()
