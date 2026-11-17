import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  CheckCircle2, 
  Gauge, 
  AlertTriangle
} from 'lucide-react';
import MapCanvas from '../components/MapCanvas';
import { useEmergency } from '../context/EmergencyContext';
import { api } from '../services/api';

export default function SimulationDemoPage() {
  const { 
    activeEmergency, 
    refreshEmergencyState, 
    recalculateRoute, 
    selectUserLocation,
    setSelectedFloor,
    selectedFloor,
    topology,
    routeResult
  } = useEmergency();

  const [simRunning, setSimRunning] = useState(false);
  const [simCompleted, setSimCompleted] = useState(false);
  const [simSpeed, setSimSpeed] = useState(1); // 1x, 2x, 4x
  const [elapsedTime, setElapsedTime] = useState(0);
  const [markerPos, setMarkerPos] = useState(null);
  const [initLoaded, setInitLoaded] = useState(false);

  // Path nodes list
  const nodeMap = useMemo(() => {
    const map = new Map();
    (topology?.nodes || []).forEach(n => map.set(n.id, n));
    return map;
  }, [topology]);

  const pathNodes = useMemo(() => {
    if (!routeResult?.path_node_ids) return [];
    return routeResult.path_node_ids.map(id => nodeMap.get(id)).filter(Boolean);
  }, [routeResult, nodeMap]);

  // Animation refs
  const currentSegRef = useRef(0);
  const progressRef = useRef(0);
  const animFrameRef = useRef(null);
  const lastTimeRef = useRef(null);

  // Initialize simulation scenario automatically on load
  useEffect(() => {
    const setupSimulation = async () => {
      try {
        if (!activeEmergency) {
          await api.activateEmergency({
            emergency_type: 'fire',
            building_name: 'Main Academic Complex',
            floor: 'Floor 2',
            location: 'Room 205 (Lecture Hall)',
            node_id: 'F2-205',
            severity: 'critical',
            description: 'Simulation emergency fire near Room 205',
            is_simulation: true,
          });
        }
        selectUserLocation('F2-208');
        setSelectedFloor('Floor 2');
        await refreshEmergencyState();
        await recalculateRoute('F2-208', false);
        setInitLoaded(true);
      } catch (e) {
        console.warn('Simulation setup error:', e);
        setInitLoaded(true);
      }
    };

    setupSimulation();
  }, []);

  // Reset simulation
  const handleReset = () => {
    setSimRunning(false);
    setSimCompleted(false);
    currentSegRef.current = 0;
    progressRef.current = 0;
    setElapsedTime(0);
    if (pathNodes.length > 0) {
      const start = pathNodes[0];
      setMarkerPos({ x: start.x, y: start.y, floor: start.floor });
      if (start.floor) setSelectedFloor(start.floor);
    }
  };

  // Initialize marker position when route changes
  useEffect(() => {
    if (pathNodes.length > 0 && !simRunning && !simCompleted) {
      const start = pathNodes[0];
      setMarkerPos({ x: start.x, y: start.y, floor: start.floor });
    }
  }, [pathNodes, simRunning, simCompleted]);

  // Main animation loop
  useEffect(() => {
    if (!simRunning || pathNodes.length < 2) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      lastTimeRef.current = null;
      return;
    }

    const animate = (timestamp) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const deltaSec = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;

      setElapsedTime(prev => +(prev + deltaSec).toFixed(1));

      // Speed factor: 1x = ~2.5 seconds per node segment
      const speedFactor = 0.45 * simSpeed;
      progressRef.current += deltaSec * speedFactor;

      const segIdx = currentSegRef.current;
      const u = pathNodes[segIdx];
      const v = pathNodes[segIdx + 1];

      if (u && v) {
        const t = Math.min(progressRef.current, 1);
        const curX = u.x + (v.x - u.x) * t;
        const curY = u.y + (v.y - u.y) * t;
        const curFloor = t >= 0.5 ? v.floor : u.floor;

        setMarkerPos({ x: curX, y: curY, floor: curFloor });

        // Auto-switch floor view if entering new level
        if (t >= 0.5 && v.floor && v.floor !== selectedFloor) {
          setSelectedFloor(v.floor);
        }

        if (progressRef.current >= 1) {
          progressRef.current = 0;
          currentSegRef.current += 1;

          if (currentSegRef.current >= pathNodes.length - 1) {
            // Reached destination!
            setSimRunning(false);
            setSimCompleted(true);
            const endNode = pathNodes[pathNodes.length - 1];
            setMarkerPos({ x: endNode.x, y: endNode.y, floor: endNode.floor });
            return;
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [simRunning, pathNodes, simSpeed, selectedFloor, setSelectedFloor]);

  const totalSegments = Math.max(pathNodes.length - 1, 1);
  const currentStepNum = Math.min(currentSegRef.current + 1, pathNodes.length);
  const overallProgress = Math.min(
    Math.round(((currentSegRef.current + progressRef.current) / totalSegments) * 100),
    100
  );

  const destinationNode = pathNodes[pathNodes.length - 1];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4">
      
      {/* Simulation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center space-x-2">
            <span>Escape Simulation</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 uppercase">
              Automated
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time egress simulation navigating around dynamic corridor hazards to safety.
          </p>
        </div>

        {/* 1-Click Simulation Start / Pause / Reset Buttons */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {!simRunning ? (
            <button
              onClick={() => {
                if (simCompleted) handleReset();
                setSimRunning(true);
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs sm:text-sm font-bold flex items-center space-x-2 shadow-xs transition-colors cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>{simCompleted ? 'Replay Simulation' : 'Start Simulation'}</span>
            </button>
          ) : (
            <button
              onClick={() => setSimRunning(false)}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg text-xs sm:text-sm font-bold flex items-center space-x-2 shadow-xs transition-colors cursor-pointer"
            >
              <Pause className="w-3.5 h-3.5 fill-white" />
              <span>Pause</span>
            </button>
          )}

          <button
            onClick={handleReset}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 transition-colors cursor-pointer"
            title="Reset to Start"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Speed Multiplier */}
          <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg p-0.5 text-xs">
            <span className="text-slate-500 font-semibold px-1.5 flex items-center space-x-1">
              <Gauge className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Speed:</span>
            </span>
            {[1, 2, 4].map(spd => (
              <button
                key={spd}
                onClick={() => setSimSpeed(spd)}
                className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] transition-colors cursor-pointer ${
                  simSpeed === spd
                    ? 'bg-[#0f172a] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Progress & Live Telemetry Bar */}
      <div className="bg-white rounded-xl p-3 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md">
            <span className="text-slate-500">Step:</span>
            <span className="text-slate-900 font-mono font-bold">{currentStepNum} / {pathNodes.length}</span>
          </div>

          <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md">
            <span className="text-slate-500">Time:</span>
            <span className="text-emerald-700 font-mono font-bold">{elapsedTime}s</span>
          </div>

          <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md">
            <span className="text-slate-500">Progress:</span>
            <span className="text-blue-700 font-mono font-bold">{overallProgress}%</span>
          </div>
        </div>

        {/* Progress Bar Line */}
        <div className="flex-1 min-w-[120px] max-w-xs bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
          <div 
            className="bg-emerald-600 h-full transition-all duration-150"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      </div>

      {/* Completion Banner */}
      {simCompleted && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-slate-900 rounded-xl flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-600 rounded-lg text-white">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-emerald-950">Safe Exit Reached</h3>
              <p className="text-xs text-emerald-800">
                Arrived safely at <strong>{destinationNode?.label || 'Safe Exit'}</strong> in {elapsedTime} seconds.
              </p>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            Replay
          </button>
        </div>
      )}

      {/* Interactive Floor Map Canvas with Animated Evacuee Marker */}
      <div>
        <MapCanvas 
          simulationCoord={markerPos}
        />
      </div>

    </div>
  );
}
