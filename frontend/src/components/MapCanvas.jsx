import React, { useState, useMemo, useRef, useCallback } from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  DoorOpen, 
  Flame, 
  Flag, 
  Navigation, 
  Accessibility, 
  Layers, 
  Sliders, 
  Crosshair, 
  ShieldAlert, 
  AlertTriangle,
  ArrowRight,
  Eye,
  EyeOff,
  Move,
  AlertOctagon,
  Volume2,
  ListOrdered
} from 'lucide-react';
import { useEmergency } from '../context/EmergencyContext';
import { useAuth } from '../context/AuthContext';
import { useVoiceNavigation } from '../context/VoiceNavigationContext';

export const FLOOR_MAP_IMAGES = {
  'Ground': '/maps/Floor-0.png',
  'Floor 1': '/maps/Floor-1.png',
  'Floor 2': '/maps/Floor-2.png',
  'Floor 3': '/maps/Floor-3.png',
  'Floor 4': '/maps/Floor-4.png',
};

export default function MapCanvas({ 
  onNodeClick, 
  adminHazardMode = false, 
  onOpenQrModal,
  simulationCoord = null,
  onOpenSosModal = null,
  onOpenInstructions = null,
  isMobileView = false,
  className = ''
}) {
  const { 
    topology, 
    selectedFloor, 
    setSelectedFloor, 
    userLocationNode, 
    selectUserLocation,
    hazards, 
    routeResult,
    selectedRoute,
    setSelectedRoute,
    accessibleMode,
    activeSos
  } = useEmergency();
  const { role, user } = useAuth();
  const isSafetyOfficer = role === 'admin' || user?.role === 'admin';
  
  let voiceNav = null;
  try {
    voiceNav = useVoiceNavigation();
  } catch (e) {}

  // Pan & Zoom State
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // Map Controls State
  const [blueprintOpacity, setBlueprintOpacity] = useState(0.85);
  const [showBlueprint, setShowBlueprint] = useState(true);
  const [hazardFilter, setHazardFilter] = useState('all'); // 'all' | 'danger' | 'smoke' | 'blocked'
  const [hoveredNode, setHoveredNode] = useState(null);
  const [selectedHazardInfo, setSelectedHazardInfo] = useState(null);

  const containerRef = useRef(null);

  const floors = topology?.floors || ['Ground', 'Floor 1', 'Floor 2', 'Floor 3', 'Floor 4'];
  const nodes = topology?.nodes || [];
  const edges = topology?.edges || [];

  // Map of nodes for fast coordinate and attribute lookup
  const nodeMap = useMemo(() => {
    const map = new Map();
    nodes.forEach(n => map.set(n.id, n));
    return map;
  }, [nodes]);

  // Filter nodes on current floor
  const floorNodes = useMemo(() => {
    return nodes.filter(n => n.floor === selectedFloor);
  }, [nodes, selectedFloor]);

  // Edges on current floor
  const floorEdges = useMemo(() => {
    return edges.filter(e => {
      const u = nodeMap.get(e.source);
      const v = nodeMap.get(e.target);
      return u && v && u.floor === selectedFloor && v.floor === selectedFloor;
    });
  }, [edges, nodeMap, selectedFloor]);

  // Active hazards on this floor
  const floorHazards = useMemo(() => {
    return hazards.filter(h => h.floor === selectedFloor && h.is_active !== false);
  }, [hazards, selectedFloor]);

  // Red: Active Danger Zones (Fire, Gas, Structural Debris, Blocked)
  const dangerNodeIds = useMemo(() => {
    return new Set(
      floorHazards
        .filter(h => ['fire', 'gas', 'structural', 'blocked'].includes((h.hazard_type || '').toLowerCase()))
        .map(h => h.node_id)
        .filter(Boolean)
    );
  }, [floorHazards]);

  // Orange: Potentially affected or restricted zones (Smoke hazards or proximity buffer)
  const restrictedNodeIds = useMemo(() => {
    const set = new Set();
    floorHazards.forEach(h => {
      if ((h.hazard_type || '').toLowerCase() === 'smoke' && h.node_id) {
        set.add(h.node_id);
      }
    });
    // Add proximity buffer restricted zones reported by backend route calculation
    (routeResult?.restricted_zones || []).forEach(rz => {
      if (rz.floor === selectedFloor && !dangerNodeIds.has(rz.node_id)) {
        set.add(rz.node_id);
      }
    });
    return set;
  }, [floorHazards, routeResult, selectedFloor, dangerNodeIds]);

  // Primary Route segments on this floor
  const primarySegments = useMemo(() => {
    if (!routeResult?.path_node_ids) return [];
    const p = routeResult.path_node_ids;
    const segs = [];
    for (let i = 0; i < p.length - 1; i++) {
      const u = nodeMap.get(p[i]);
      const v = nodeMap.get(p[i + 1]);
      if (u && v && u.floor === selectedFloor && v.floor === selectedFloor) {
        segs.push({ u, v, stepIndex: i });
      }
    }
    return segs;
  }, [routeResult, nodeMap, selectedFloor]);

  // Alternative / Backup Route segments on this floor
  const backupSegments = useMemo(() => {
    if (!routeResult?.backup_path_node_ids) return [];
    const p = routeResult.backup_path_node_ids;
    const segs = [];
    for (let i = 0; i < p.length - 1; i++) {
      const u = nodeMap.get(p[i]);
      const v = nodeMap.get(p[i + 1]);
      if (u && v && u.floor === selectedFloor && v.floor === selectedFloor) {
        segs.push({ u, v, stepIndex: i });
      }
    }
    return segs;
  }, [routeResult, nodeMap, selectedFloor]);

  // Current active displayed route segments based on user route selection
  // (Section 1: Route visibility: Display ONLY the selected route, hide other route overlays)
  const displayedRouteSegments = useMemo(() => {
    if (selectedRoute === 'backup' && backupSegments.length > 0) {
      return backupSegments;
    }
    return primarySegments;
  }, [selectedRoute, primarySegments, backupSegments]);

  // Set of node IDs on the currently selected route
  const selectedRouteNodeIds = useMemo(() => {
    const activePath = (selectedRoute === 'backup' && routeResult?.backup_path_node_ids)
      ? routeResult.backup_path_node_ids
      : (routeResult?.path_node_ids || []);
    return new Set(activePath);
  }, [selectedRoute, routeResult]);

  // Filtered hazards based on hazard filter overlay setting
  const visibleFloorHazards = useMemo(() => {
    if (hazardFilter === 'danger') {
      return floorHazards.filter(h => ['fire', 'gas', 'structural'].includes((h.hazard_type || '').toLowerCase()));
    }
    if (hazardFilter === 'smoke') {
      return floorHazards.filter(h => (h.hazard_type || '').toLowerCase() === 'smoke');
    }
    if (hazardFilter === 'blocked') {
      return floorHazards.filter(h => (h.hazard_type || '').toLowerCase() === 'blocked');
    }
    return floorHazards;
  }, [floorHazards, hazardFilter]);

  // Mouse / Touch Drag Handlers for Panning & Moving Around
  const handleMouseDown = (e) => {
    // Only drag with primary mouse button
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    const dx = (e.clientX - dragStartRef.current.x) / (zoom * 4);
    const dy = (e.clientY - dragStartRef.current.y) / (zoom * 4);
    setPan({
      x: Math.min(Math.max(dragStartRef.current.panX + dx, -40), 40),
      y: Math.min(Math.max(dragStartRef.current.panY + dy, -40), 40),
    });
  }, [isDragging, zoom]);

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch Handlers for Mobile Devices
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      dragStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        panX: pan.x,
        panY: pan.y,
      };
    }
  };

  const handleTouchMove = (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    const dx = (e.touches[0].clientX - dragStartRef.current.x) / (zoom * 4);
    const dy = (e.touches[0].clientY - dragStartRef.current.y) / (zoom * 4);
    setPan({
      x: Math.min(Math.max(dragStartRef.current.panX + dx, -40), 40),
      y: Math.min(Math.max(dragStartRef.current.panY + dy, -40), 40),
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Mouse Wheel Zoom
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setZoom(prev => Math.min(Math.max(prev + delta, 0.75), 3.0));
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Center on user's current room location
  const centerOnUser = () => {
    const userNode = nodeMap.get(userLocationNode);
    if (userNode) {
      if (userNode.floor && userNode.floor !== selectedFloor) {
        setSelectedFloor(userNode.floor);
      }
      setPan({
        x: 50 - userNode.x,
        y: 50 - userNode.y,
      });
      setZoom(1.4);
    }
  };

  const handleNodeClick = (node) => {
    if (adminHazardMode && onNodeClick) {
      onNodeClick(node);
    } else {
      selectUserLocation(node.id);
    }
  };

  // Current floor map blueprint image path
  const currentBlueprintUrl = FLOOR_MAP_IMAGES[selectedFloor] || '/maps/Floor-0.png';

  return (
    <div 
      ref={containerRef}
      className={`relative w-full ${className || 'h-[680px] sm:h-[760px] lg:h-[820px] xl:h-[880px] min-h-[640px]'} evac-card rounded-2xl border border-white/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.4),0_16px_36px_-12px_rgba(0,0,0,0.6)] overflow-hidden select-none flex flex-col`}
    >
      {/* ================= GOOGLE MAPS STYLE MOBILE NAVIGATION BANNER ================= */}
      <div className="absolute top-2 left-2 right-2 sm:hidden z-40 pointer-events-auto bg-slate-950/85 backdrop-blur-xl border border-emerald-500/40 rounded-2xl p-2.5 shadow-2xl flex items-center justify-between gap-2 text-white">
        <div 
          onClick={onOpenInstructions || undefined} 
          className={`flex items-center space-x-2.5 min-w-0 ${onOpenInstructions ? 'cursor-pointer active:opacity-80' : ''}`}
          title={onOpenInstructions ? "Tap to view full turn-by-turn written instructions" : undefined}
        >
          <div className={`p-2 rounded-xl flex-shrink-0 shadow-md ${routeResult?.safe_route_found ? 'bg-emerald-600' : 'bg-red-600 animate-bounce'}`}>
            <Navigation className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <div className={`text-xs font-bold truncate ${routeResult?.safe_route_found ? 'text-emerald-300' : 'text-red-300'}`}>
              {routeResult?.safe_route_found
                ? (routeResult.steps?.[0]?.short_direction || 'Follow Green Safe Route')
                : 'All Exits Blocked - Shelter In Place'}
            </div>
            <div className="text-[10px] text-slate-300 truncate">
              {routeResult?.safe_route_found
                ? `To ${routeResult.destination_node?.label || 'Safe Exit'} • ${routeResult.rset_formatted || '45s'} (${routeResult.total_distance_meters || 65}m)`
                : 'Stay low, seal doors & wait for rescue'}
            </div>
          </div>
        </div>
        {onOpenSosModal && (
          <button
            onClick={onOpenSosModal}
            className={`px-2.5 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider flex items-center space-x-1 flex-shrink-0 evac-btn-inset shadow-md transition-all ${
              isSafetyOfficer || activeSos
                ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse ring-1 ring-red-400/50'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border border-white/[0.1]'
            }`}
            title={isSafetyOfficer ? "Generate Campus S.O.S. (Safety Officer)" : (activeSos ? "View Active S.O.S." : "View S.O.S. Status (Students View Only)")}
          >
            <AlertOctagon className="w-3.5 h-3.5" />
            <span>{isSafetyOfficer ? 'SOS' : (activeSos ? 'SOS' : 'VIEW')}</span>
          </button>
        )}
      </div>

      {/* ================= MOBILE FLOATING CONTROLS (VERTICAL FLOORS, INSTRUCTIONS, VOICE, RECENTER) ================= */}
      <div className="absolute top-16 right-2 sm:hidden z-30 flex flex-col space-y-1.5 pointer-events-auto">
        <div className="bg-slate-950/85 backdrop-blur-xl p-1 rounded-2xl border border-white/[0.08] shadow-xl flex flex-col space-y-1">
          {floors.map(floor => {
            const isSelected = selectedFloor === floor;
            const hasDanger = hazards.some(h => h.floor === floor && h.is_active !== false);
            return (
              <button
                key={floor}
                onClick={() => setSelectedFloor(floor)}
                className={`w-7 h-7 rounded-xl text-[10px] font-extrabold flex items-center justify-center relative transition-all ${
                  isSelected ? 'bg-blue-600 text-white shadow-md evac-btn-inset' : 'text-slate-300 hover:bg-white/[0.08]'
                }`}
              >
                <span>{floor === 'Ground' ? 'GF' : floor.replace('Floor ', 'F')}</span>
                {hasDanger && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-red-500" />}
              </button>
            );
          })}
        </div>
        {onOpenInstructions && (
          <button
            onClick={onOpenInstructions}
            className="w-8 h-8 bg-slate-950/85 backdrop-blur-xl border border-white/[0.08] rounded-xl flex items-center justify-center text-blue-400 shadow-lg hover:text-white transition-colors"
            title="View Turn-by-Turn Instructions"
          >
            <ListOrdered className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={centerOnUser}
          className="w-8 h-8 bg-slate-950/85 backdrop-blur-xl border border-white/[0.08] rounded-xl flex items-center justify-center text-blue-400 shadow-lg hover:text-white transition-colors"
          title="Center My Location"
        >
          <Crosshair className="w-4 h-4" />
        </button>
        {voiceNav?.speakHazardWarning && (
          <button
            onClick={voiceNav.speakHazardWarning}
            className="w-8 h-8 bg-slate-950/85 backdrop-blur-xl border border-white/[0.08] rounded-xl flex items-center justify-center text-emerald-400 shadow-lg hover:text-white transition-colors"
            title="Hear Voice Warning"
          >
            <Volume2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ================= TOP TOOLBAR (DESKTOP / TABLET) ================= */}
      <div className="hidden sm:flex absolute top-3 left-3 right-3 z-30 items-center justify-between gap-2 pointer-events-none">
        
        {/* Floor Selection Buttons */}
        <div className="flex items-center space-x-1 bg-slate-950/80 backdrop-blur-xl p-1.5 rounded-full border border-white/[0.08] shadow-xl pointer-events-auto">
          {floors.map(floor => {
            const hasDangerOnFloor = hazards.some(h => h.floor === floor && h.is_active !== false && (h.hazard_type || '').toLowerCase() !== 'smoke');
            const hasSmokeOnFloor = hazards.some(h => h.floor === floor && h.is_active !== false && (h.hazard_type || '').toLowerCase() === 'smoke');
            const isUserFloor = nodeMap.get(userLocationNode)?.floor === floor;
            const isSelected = selectedFloor === floor;

            return (
              <button
                key={floor}
                onClick={() => setSelectedFloor(floor)}
                className={`relative px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center space-x-1.5 ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 evac-btn-inset'
                    : 'text-slate-300 hover:text-white hover:bg-white/[0.06]'
                }`}
              >
                <span>{floor}</span>
                {/* Active Danger Ping */}
                {hasDangerOnFloor && (
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" title="Critical hazard on floor" />
                )}
                {hasSmokeOnFloor && !hasDangerOnFloor && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Smoke detected on floor" />
                )}
                {/* User Location indicator */}
                {isUserFloor && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400" title="Your current location floor" />
                )}
              </button>
            );
          })}
        </div>

        {/* Route Selector & View Controls (Section 1: Route visibility selection) */}
        <div className="flex items-center space-x-2 pointer-events-auto">
          
          {/* Route Visibility Toggle: Primary vs Alternative */}
          {routeResult?.safe_route_found && (
            <div className="flex items-center bg-slate-950/80 backdrop-blur-xl p-1 rounded-full border border-white/[0.08] shadow-xl">
              <button
                onClick={() => setSelectedRoute('primary')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all flex items-center space-x-1.5 ${
                  selectedRoute === 'primary'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/25 evac-btn-inset'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Display Primary Recommended Route"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Primary</span>
              </button>

              {routeResult.backup_path_node_ids && routeResult.backup_path_node_ids.length > 0 && (
                <button
                  onClick={() => setSelectedRoute('backup')}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all flex items-center space-x-1.5 ${
                    selectedRoute === 'backup'
                      ? 'bg-amber-600 text-white shadow-md shadow-amber-500/25 evac-btn-inset'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Display Alternative Safe Route"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span>Alt Route</span>
                </button>
              )}
            </div>
          )}

          {/* Turn-by-Turn Instructions Icon Button */}
          {onOpenInstructions && (
            <button
              onClick={onOpenInstructions}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-950/80 backdrop-blur-xl border border-white/[0.08] text-slate-300 hover:text-white hover:border-blue-500/40 shadow-xl transition-all cursor-pointer group"
              title="View Turn-by-Turn Evacuation Instructions"
            >
              <ListOrdered className="w-4 h-4 text-blue-400 group-hover:text-blue-300" />
              <span className="hidden md:inline">Instructions</span>
            </button>
          )}

          {/* Blueprint Opacity / Layer Toggle */}
          <div className="flex items-center bg-slate-950/80 backdrop-blur-xl p-1 px-2 rounded-full border border-white/[0.08] shadow-xl">
            <button
              onClick={() => setShowBlueprint(prev => !prev)}
              className={`p-1.5 rounded-full text-xs font-medium transition-all ${
                showBlueprint ? 'text-blue-400 bg-blue-500/15' : 'text-slate-500 hover:text-slate-300'
              }`}
              title={showBlueprint ? 'Hide Floor Plan Blueprint' : 'Show Floor Plan Blueprint'}
            >
              {showBlueprint ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
            {showBlueprint && (
              <input
                type="range"
                min="0.2"
                max="1.0"
                step="0.05"
                value={blueprintOpacity}
                onChange={(e) => setBlueprintOpacity(parseFloat(e.target.value))}
                className="w-16 h-1 mx-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                title={`Floor Blueprint Opacity: ${Math.round(blueprintOpacity * 100)}%`}
              />
            )}
          </div>

          {/* Zoom & View Controls */}
          <div className="flex items-center space-x-0.5 bg-slate-950/80 backdrop-blur-xl p-1 px-1.5 rounded-full border border-white/[0.08] shadow-xl">
            <button
              onClick={centerOnUser}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-white/[0.08] rounded-full transition-colors"
              title="Locate My Room (Center View)"
            >
              <Crosshair className="w-4 h-4 text-blue-400" />
            </button>
            <button
              onClick={() => setZoom(prev => Math.min(prev + 0.25, 3.0))}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-white/[0.08] rounded-full transition-colors"
              title="Zoom In (+)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoom(prev => Math.max(prev - 0.25, 0.75))}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-white/[0.08] rounded-full transition-colors"
              title="Zoom Out (-)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={resetView}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-white/[0.08] rounded-full transition-colors"
              title="Reset View"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

        </div>

      </div>

      {/* ================= MAIN SVG VIEWPORT ================= */}
      <div 
        className={`flex-1 w-full h-full relative overflow-hidden ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
      >
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full pointer-events-auto"
          style={{
            transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
            transformOrigin: '50% 50%',
            transition: isDragging ? 'none' : 'transform 0.15s ease-out',
          }}
        >
          <defs>
            {/* Subtle engineering grid */}
            <pattern id="campusGrid" width="5" height="5" patternUnits="userSpaceOnUse">
              <path d="M 5 0 L 0 0 0 5" fill="none" stroke="#1e293b" strokeWidth="0.15" strokeOpacity="0.4" />
            </pattern>

            {/* Pulsing Aura Filters */}
            <filter id="hazardGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="restrictedGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="routeGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.0" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background grid */}
          <rect width="100" height="100" fill="#030712" />
          <rect width="100" height="100" fill="url(#campusGrid)" />

          {/* ================= ARCHITECTURAL FLOOR PLAN BLUEPRINT ================= */}
          {/* Section 1 Priority: The campus map must be visible at all times */}
          {showBlueprint && (
            <image
              href={currentBlueprintUrl}
              x="0"
              y="0"
              width="100"
              height="100"
              preserveAspectRatio="none"
              opacity={blueprintOpacity}
              className="pointer-events-none transition-opacity duration-300"
            />
          )}

          {/* Architectural structural boundary lines for clarity */}
          <rect
            x="12"
            y="7"
            width="76"
            height="72"
            rx="3"
            fill="none"
            stroke="#334155"
            strokeWidth="0.5"
            strokeDasharray="2 1"
            className="pointer-events-none"
          />

          {/* ================= BASE CORRIDOR EDGES ================= */}
          {/* Corridors stay visible so occupants understand building geometry */}
          <g id="base-corridors">
            {floorEdges.map((e, idx) => {
              const u = nodeMap.get(e.source);
              const v = nodeMap.get(e.target);
              if (!u || !v) return null;

              // Check if edge is blocked or affected by smoke hazard
              const matchingHazard = floorHazards.find(
                h => (h.edge_source === e.source && h.edge_target === e.target) ||
                     (h.edge_source === e.target && h.edge_target === e.source)
              );

              const isBlocked = matchingHazard && matchingHazard.hazard_type !== 'smoke';
              const isSmokeCorridor = matchingHazard && matchingHazard.hazard_type === 'smoke';

              let strokeColor = '#475569'; // Grey base corridor
              let strokeWidth = 0.4;
              let dash = 'none';

              if (isBlocked) {
                strokeColor = '#64748b'; // Section 2.B: Grey: Blocked or unavailable path
                strokeWidth = 0.9;
                dash = '2 1';
              } else if (isSmokeCorridor) {
                strokeColor = '#ea580c'; // Section 2.B: Orange: Potential hazard / smoke
                strokeWidth = 0.9;
                dash = '1.5 1.5';
              }

              return (
                <line
                  key={`corridor-${idx}`}
                  x1={u.x}
                  y1={u.y}
                  x2={v.x}
                  y2={v.y}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeDasharray={dash}
                  strokeLinecap="round"
                  className="pointer-events-none"
                />
              );
            })}
          </g>

          {/* ================= ACTIVE EVACUATION ROUTE (SELECTED ROUTE ONLY) ================= */}
          {/* Section 1: When user selects a route, display ONLY selected route, hide other overlays */}
          {displayedRouteSegments.length > 0 && (
            <g id="selected-evacuation-route">
              {displayedRouteSegments.map((seg, idx) => (
                <g key={`route-segment-${idx}`}>
                  {/* Glowing background underlay */}
                  <line
                    x1={seg.u.x}
                    y1={seg.u.y}
                    x2={seg.v.x}
                    y2={seg.v.y}
                    stroke={selectedRoute === 'backup' ? '#f59e0b' : '#10b981'}
                    strokeWidth="1.6"
                    strokeOpacity="0.4"
                    filter="url(#routeGlow)"
                    strokeLinecap="round"
                    className="pointer-events-none"
                  />
                  {/* Crisp animated directional dashed centerline */}
                  <line
                    x1={seg.u.x}
                    y1={seg.u.y}
                    x2={seg.v.x}
                    y2={seg.v.y}
                    stroke={selectedRoute === 'backup' ? '#fbbf24' : '#34d399'}
                    strokeWidth="0.9"
                    strokeDasharray="2 1.5"
                    strokeLinecap="round"
                    className="pointer-events-none animated-evac-path"
                  />
                </g>
              ))}
            </g>
          )}

          {/* ================= INTER-FLOOR STAIRWELL TRANSITION INDICATORS ================= */}
          {displayedRouteSegments.length > 0 && (
            <g id="stairwell-transitions">
              {displayedRouteSegments.map((seg, idx) => {
                const isStairs = seg.u.type === 'staircase' || seg.v.type === 'staircase';
                if (!isStairs) return null;
                const node = seg.u.type === 'staircase' ? seg.u : seg.v;
                return (
                  <circle
                    key={`stair-glow-${idx}`}
                    cx={node.x}
                    cy={node.y}
                    r="2.2"
                    fill="#a855f7"
                    fillOpacity="0.25"
                    className="pointer-events-none"
                  >
                    <animate attributeName="r" values="2.0;3.6;2.0" dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.4;0.1;0.4" dur="2s" repeatCount="indefinite" />
                  </circle>
                );
              })}
            </g>
          )}

          {/* ================= NODES LAYER (ROOMS, EXITS, ASSEMBLY POINTS, STAIRS) ================= */}
          <g id="campus-nodes">
            {floorNodes.map(node => {
              const isUserLocation = userLocationNode === node.id;
              const isDanger = dangerNodeIds.has(node.id);
              const isRestricted = restrictedNodeIds.has(node.id);
              const isOnSelectedRoute = selectedRouteNodeIds.has(node.id);
              const isExit = node.type === 'exit';
              const isAssembly = node.type === 'assembly_point';
              const isStaircase = node.type === 'staircase';
              const isElevator = node.type === 'elevator' || node.type === 'ramp';
              const isClassroom = node.type === 'classroom';
              const isCorridor = node.type === 'corridor';

              let fillColor = '#64748b';
              let radius = isCorridor ? 0.7 : 1.2;

              if (isDanger) {
                fillColor = '#ef4444';
                radius = 2.0;
              } else if (isRestricted) {
                fillColor = '#f97316';
                radius = 1.7;
              } else if (isUserLocation) {
                fillColor = '#3b82f6';
                radius = 1.9;
              } else if (isOnSelectedRoute) {
                fillColor = selectedRoute === 'backup' ? '#f59e0b' : '#10b981';
                radius = 1.4;
              } else if (isExit) {
                fillColor = '#22c55e';
                radius = 1.8;
              } else if (isAssembly) {
                fillColor = '#eab308';
                radius = 2.1;
              } else if (isStaircase) {
                fillColor = '#a855f7';
                radius = 1.4;
              } else if (isElevator) {
                fillColor = '#06b6d4';
                radius = 1.4;
              }

              return (
                <g
                  key={node.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNodeClick(node);
                  }}
                  onMouseEnter={() => setHoveredNode(node)}
                  onMouseLeave={() => setHoveredNode(null)}
                  className="cursor-pointer group"
                >
                  {/* Red: Active Danger Pulsing Aura */}
                  {isDanger && (
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r="2.0"
                      fill="#ef4444"
                      fillOpacity="0.35"
                      className="pointer-events-none"
                    >
                      <animate attributeName="r" values="2.0;4.0;2.0" dur="2s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.6;0.1;0.6" dur="2s" repeatCount="indefinite" />
                    </circle>
                  )}

                  {/* Orange: Warning / Restricted Pulsing Aura */}
                  {isRestricted && (
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r="1.7"
                      fill="#f97316"
                      fillOpacity="0.3"
                      className="pointer-events-none"
                    >
                      <animate attributeName="r" values="1.7;3.4;1.7" dur="2s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.6;0.1;0.6" dur="2s" repeatCount="indefinite" />
                    </circle>
                  )}

                  {/* Blue: User Location Concentric Pulse */}
                  {isUserLocation && (
                    <>
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r="1.9"
                        fill="#3b82f6"
                        fillOpacity="0.3"
                        className="pointer-events-none"
                      >
                        <animate attributeName="r" values="1.9;3.8;1.9" dur="2s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.7;0.1;0.7" dur="2s" repeatCount="indefinite" />
                      </circle>
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r="2.3"
                        fill="none"
                        stroke="#93c5fd"
                        strokeWidth="0.5"
                        className="pointer-events-none"
                      />
                    </>
                  )}

                  {/* Core Node Marker (r and strokeWidth strictly constant - zero displacement or jitter on hover) */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={radius}
                    fill={fillColor}
                    stroke={
                      hoveredNode?.id === node.id ? '#ffffff' :
                      isDanger ? '#fecaca' :
                      isRestricted ? '#ffedd5' :
                      isUserLocation ? '#dbeafe' :
                      isOnSelectedRoute ? '#a7f3d0' :
                      '#0f172a'
                    }
                    strokeWidth={0.5}
                    filter={isDanger ? 'url(#hazardGlow)' : isRestricted ? 'url(#restrictedGlow)' : 'none'}
                  />

                  {/* Room Number Labels */}
                  {isClassroom && (
                    <text
                      x={node.x}
                      y={node.y + 2.5}
                      textAnchor="middle"
                      fill="#94a3b8"
                      fontSize="1.4"
                      fontWeight="700"
                      className="pointer-events-none select-none font-mono"
                    >
                      {node.id.replace(/^[A-Z0-9]+-/, '')}
                    </text>
                  )}

                  {/* Exit / Assembly Badges */}
                  {(isExit || isAssembly) && (
                    <text
                      x={node.x}
                      y={node.y - 2.2}
                      textAnchor="middle"
                      fill={isExit ? '#4ade80' : '#fde047'}
                      fontSize="1.5"
                      fontWeight="800"
                      className="pointer-events-none select-none uppercase tracking-wider"
                    >
                      {isExit ? 'EXIT' : 'ASSEMBLY'}
                    </text>
                  )}
                </g>
              );
            })}
          </g>

          {/* ================= ESCAPE SIMULATION ANIMATED EVACUEE MARKER ================= */}
          {simulationCoord && simulationCoord.floor === selectedFloor && (
            <g id="simulation-evacuee-marker" className="pointer-events-none">
              <circle
                cx={simulationCoord.x}
                cy={simulationCoord.y}
                r="2.6"
                fill={selectedRoute === 'backup' ? '#fbbf24' : '#38bdf8'}
                fillOpacity="0.4"
              >
                <animate attributeName="r" values="2.2;4.2;2.2" dur="1.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.6;0.1;0.6" dur="1.5s" repeatCount="indefinite" />
              </circle>
              <circle
                cx={simulationCoord.x}
                cy={simulationCoord.y}
                r="1.8"
                fill={selectedRoute === 'backup' ? '#d97706' : '#0284c7'}
                stroke="#ffffff"
                strokeWidth="0.5"
              />
              <circle
                cx={simulationCoord.x}
                cy={simulationCoord.y}
                r="0.9"
                fill="#ffffff"
              />
              <text
                x={simulationCoord.x}
                y={simulationCoord.y - 2.6}
                textAnchor="middle"
                fill={selectedRoute === 'backup' ? '#fde68a' : '#38bdf8'}
                fontSize="1.6"
                fontWeight="900"
                className="font-mono drop-shadow select-none"
              >
                🏃 {selectedRoute === 'backup' ? 'ALT EVACUEE' : 'EVACUEE'}
              </text>
            </g>
          )}
        </svg>

        {/* Hovered Node Tooltip HUD */}
        {hoveredNode && (
          <div className="absolute bottom-4 left-4 z-40 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 px-4 py-2.5 rounded-xl shadow-2xl pointer-events-none text-xs max-w-xs">
            <div className="font-extrabold text-white flex items-center justify-between space-x-2">
              <span>{hoveredNode.label}</span>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                {hoveredNode.id}
              </span>
            </div>
            <div className="text-[11px] text-slate-300 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span>Floor: <strong>{hoveredNode.floor}</strong></span>
              <span>•</span>
              <span className="capitalize">Type: <strong>{hoveredNode.type}</strong></span>
              {userLocationNode === hoveredNode.id && (
                <span className="text-blue-400 font-bold">• YOUR CURRENT LOCATION</span>
              )}
              {dangerNodeIds.has(hoveredNode.id) && (
                <span className="text-red-400 font-bold">• ACTIVE DANGER ZONE (RED)</span>
              )}
              {restrictedNodeIds.has(hoveredNode.id) && !dangerNodeIds.has(hoveredNode.id) && (
                <span className="text-orange-400 font-bold">• RESTRICTED / SMOKE ZONE (ORANGE)</span>
              )}
              {selectedRouteNodeIds.has(hoveredNode.id) && (
                <span className="text-emerald-400 font-bold">• ON EVACUATION PATH (GREEN)</span>
              )}
            </div>
          </div>
        )}

        {/* ================= GOOGLE MAPS MOBILE BOTTOM HUD ================= */}
        {routeResult?.safe_route_found && (
          <div className="absolute bottom-2 left-2 right-2 sm:hidden z-30 pointer-events-auto bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl p-2.5 shadow-2xl flex items-center justify-between gap-3 text-white">
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5">
                <span className="text-base font-black text-emerald-400 font-mono">
                  {routeResult.rset_formatted || '45s'}
                </span>
                <span className="text-[11px] text-slate-400">
                  ({routeResult.total_distance_meters || 65} m)
                </span>
              </div>
              <div className="text-[10px] text-slate-300 truncate">
                Exit: <strong className="text-emerald-300">{routeResult.destination_node?.label || 'Safe Exit'}</strong>
              </div>
            </div>

            <div className="flex items-center space-x-1.5 flex-shrink-0">
              {voiceNav?.speakHazardWarning && (
                <button
                  onClick={voiceNav.speakHazardWarning}
                  className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-md flex items-center justify-center"
                  title="Hear Voice Warning"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              )}
              {onOpenSosModal && (
                <button
                  onClick={onOpenSosModal}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider shadow-md flex items-center space-x-1 ${
                    isSafetyOfficer || activeSos
                      ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/[0.1]'
                  }`}
                  title={isSafetyOfficer ? "Generate Campus S.O.S." : "View Campus S.O.S. Status"}
                >
                  <AlertOctagon className="w-3.5 h-3.5" />
                  <span>{isSafetyOfficer ? 'SOS' : (activeSos ? 'SOS' : 'VIEW')}</span>
                </button>
              )}
            </div>
          </div>
        )}

      </div>

      {/* ================= BOTTOM LEGEND & EMERGENCY COLOR STATUS ================= */}
      <div className="bg-slate-950/80 backdrop-blur-xl border-t border-white/[0.06] px-4 py-2.5 hidden sm:flex flex-wrap items-center justify-between gap-3 text-xs z-30">
        
        {/* Color System Badges */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-5 text-slate-300 font-medium">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm shadow-red-500/50"></span>
            <span className="text-slate-200">Red: Danger</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-sm shadow-orange-500/50"></span>
            <span className="text-slate-200">Orange: Warning</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50"></span>
            <span className="text-slate-200">Green: Safe Route</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50"></span>
            <span className="text-slate-200">Blue: You</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-500"></span>
            <span className="text-slate-200">Grey: Blocked</span>
          </div>
        </div>

        {/* Action Prompt */}
        <div className="flex items-center space-x-2 text-[11px] text-slate-400">
          <span>Click room on map to set location</span>
          {onOpenQrModal && (
            <button
              onClick={onOpenQrModal}
              className="text-blue-400 hover:text-blue-300 font-bold underline ml-1"
            >
              Scan QR
            </button>
          )}
        </div>

      </div>

    </div>
  );
}
