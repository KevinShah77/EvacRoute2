from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.graph.graph_engine import graph_engine
from app.authentication.auth_handler import require_roles
from app.models.models import User
from app.api.ws_manager import ws_manager

router = APIRouter(prefix="/building", tags=["Building Topology"])

class NodeCreateRequest(BaseModel):
    id: str
    label: str
    floor: str
    type: str  # 'classroom', 'corridor', 'staircase', 'elevator', 'ramp', 'exit', 'assembly_point'
    accessible: bool = True
    x: float
    y: float

class NodeUpdateRequest(BaseModel):
    label: Optional[str] = None
    floor: Optional[str] = None
    type: Optional[str] = None
    accessible: Optional[bool] = None
    x: Optional[float] = None
    y: Optional[float] = None

class EdgeCreateRequest(BaseModel):
    source: str
    target: str
    weight: float = 10.0
    is_stairs: bool = False

class EdgeDeleteRequest(BaseModel):
    source: str
    target: str

@router.get("/topology")
def get_building_topology():
    return graph_engine.get_topology()

@router.get("/floors")
def get_floors():
    return graph_engine.building_info.get("floors", ["Ground", "Floor 1", "Floor 2", "Floor 3", "Floor 4"])

@router.get("/nodes")
def get_nodes(floor: Optional[str] = None, node_type: Optional[str] = None):
    nodes = list(graph_engine.nodes_dict.values())
    if floor:
        nodes = [n for n in nodes if n.get("floor") == floor]
    if node_type:
        nodes = [n for n in nodes if n.get("type") == node_type]
    return nodes

@router.get("/nodes/{node_id}")
def get_node_by_id(node_id: str):
    node = graph_engine.get_node(node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    return node

@router.post("/nodes", dependencies=[Depends(require_roles(["admin"]))])
async def create_node(req: NodeCreateRequest):
    if req.id in graph_engine.nodes_dict:
        raise HTTPException(status_code=400, detail=f"Node '{req.id}' already exists")
    
    node_data = req.model_dump()
    success = graph_engine.add_node(node_data)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to add node")
    
    await ws_manager.broadcast("BUILDING_UPDATED", {"action": "node_created", "node": node_data})
    await ws_manager.broadcast("ROUTE_RECALCULATION_NEEDED", {"reason": "building_topology_changed"})
    return {"success": True, "message": f"Node '{req.id}' created successfully.", "node": node_data}

@router.put("/nodes/{node_id}", dependencies=[Depends(require_roles(["admin"]))])
async def update_node(node_id: str, req: NodeUpdateRequest):
    if node_id not in graph_engine.nodes_dict:
        raise HTTPException(status_code=404, detail=f"Node '{node_id}' not found")
    
    update_data = {k: v for k, v in req.model_dump().items() if v is not None}
    success = graph_engine.update_node(node_id, update_data)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update node")
    
    updated_node = graph_engine.get_node(node_id)
    await ws_manager.broadcast("BUILDING_UPDATED", {"action": "node_updated", "node": updated_node})
    await ws_manager.broadcast("ROUTE_RECALCULATION_NEEDED", {"reason": "building_topology_changed"})
    return {"success": True, "message": f"Node '{node_id}' updated successfully.", "node": updated_node}

@router.delete("/nodes/{node_id}", dependencies=[Depends(require_roles(["admin"]))])
async def delete_node(node_id: str):
    if node_id not in graph_engine.nodes_dict:
        raise HTTPException(status_code=404, detail=f"Node '{node_id}' not found")
    
    success = graph_engine.delete_node(node_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete node")
    
    await ws_manager.broadcast("BUILDING_UPDATED", {"action": "node_deleted", "node_id": node_id})
    await ws_manager.broadcast("ROUTE_RECALCULATION_NEEDED", {"reason": "building_topology_changed"})
    return {"success": True, "message": f"Node '{node_id}' and connected edges deleted."}

@router.get("/edges")
def get_edges():
    return graph_engine.edges_list

@router.post("/edges", dependencies=[Depends(require_roles(["admin"]))])
async def create_edge(req: EdgeCreateRequest):
    if req.source not in graph_engine.nodes_dict:
        raise HTTPException(status_code=404, detail=f"Source node '{req.source}' not found")
    if req.target not in graph_engine.nodes_dict:
        raise HTTPException(status_code=404, detail=f"Target node '{req.target}' not found")
    
    edge_data = req.model_dump()
    success = graph_engine.add_edge(edge_data)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to add edge")
    
    await ws_manager.broadcast("BUILDING_UPDATED", {"action": "edge_created", "edge": edge_data})
    await ws_manager.broadcast("ROUTE_RECALCULATION_NEEDED", {"reason": "building_topology_changed"})
    return {"success": True, "message": f"Connection '{req.source}' <-> '{req.target}' added successfully."}

@router.delete("/edges", dependencies=[Depends(require_roles(["admin"]))])
async def delete_edge(req: EdgeDeleteRequest):
    success = graph_engine.delete_edge(req.source, req.target)
    if not success:
        raise HTTPException(status_code=404, detail=f"Connection between '{req.source}' and '{req.target}' not found")
    
    await ws_manager.broadcast("BUILDING_UPDATED", {"action": "edge_deleted", "source": req.source, "target": req.target})
    await ws_manager.broadcast("ROUTE_RECALCULATION_NEEDED", {"reason": "building_topology_changed"})
    return {"success": True, "message": f"Connection '{req.source}' <-> '{req.target}' removed."}

@router.post("/reset", dependencies=[Depends(require_roles(["admin"]))])
async def reset_topology():
    graph_engine.reset_to_default()
    await ws_manager.broadcast("BUILDING_UPDATED", {"action": "topology_reset"})
    await ws_manager.broadcast("ROUTE_RECALCULATION_NEEDED", {"reason": "building_topology_reset"})
    return {"success": True, "message": "Building topology reset to default campus floor plans."}

@router.get("/qr/{room_id}")
def get_qr_location(room_id: str):
    node = graph_engine.get_node(room_id)
    if not node:
        for n in graph_engine.nodes_dict.values():
            if room_id.lower() in n.get("id", "").lower() or room_id.lower() in n.get("label", "").lower():
                node = n
                break

    if not node:
        raise HTTPException(status_code=404, detail=f"No college location matching QR code '{room_id}'")

    return {
        "success": True,
        "qr_code": room_id,
        "resolved_node_id": node["id"],
        "label": node.get("label", node["id"]),
        "floor": node.get("floor", "Ground"),
        "coordinates": {"x": node.get("x", 50), "y": node.get("y", 50)}
    }
