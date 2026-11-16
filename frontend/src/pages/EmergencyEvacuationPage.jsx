import React, { useState, useEffect, useRef, useMemo } from 'react';
import MapCanvas from '../components/MapCanvas';
import VoiceNavPanel from '../components/VoiceNavPanel';
import LocationSelector from '../components/LocationSelector';
import QrScannerModal from '../components/QrScannerModal';
import SosModal from '../components/SosModal';
import { useEmergency } from '../context/EmergencyContext';
import { cleanRoomNumber } from '../context/VoiceNavigationContext';
import { 
  AlertOctagon, 
  ShieldCheck, 
  PhoneCall,
  Play,
  Pause,
  RotateCcw,
  Navigation,
  Footprints,
  DoorOpen,
  ArrowUp,
  CornerUpLeft,
  CornerUpRight,
  Layers,
  CheckCircle2,
  Clock,
  Sparkles
} from 'lucide-react';

// Clean raw node tokens like "F2-208" or "F1-105" from written instructions
function cleanInstructionText(text) {
  if (!text) return '';
  return text
    .replace(/\b(F\d+|GF)-/gi, 'Room ')
    .replace(/\b(F\d+|GF)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getStepIcon(iconType) {
  switch (iconType) {
    case 'turn_left':
      return <CornerUpLeft className="w-4 h-4 text-amber-400" />;
    case 'turn_right':
      return <CornerUpRight className="w-4 h-4 text-amber-400" />;
    case 'stairs':
      return <Layers className="w-4 h-4 text-cyan-400" />;
    case 'exit':
    case 'door':
      return <DoorOpen className="w-4 h-4 text-emerald-400" />;
    case 'straight':
      return <ArrowUp className="w-4 h-4 text-blue-400" />;
    default:
      return <Footprints className="w-4 h-4 text-emerald-400" />;
  }
}

export default function EmergencyEvacuationPage() {
  const { 
    activeEmergency, 
    openSosModal,
    topology,
    routeResult,
    selectedRoute,
    setSelectedRoute,
    selectedFloor,
    setSelectedFloor
  } = useEmergency();

  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  // ================= ESCAPE SIMULATION STATE ON EVACUATION MAP =================
  const [simRunning, setSimRunning] = useState(false);
  const [simCompleted, setSimCompleted] = useState(false);
  const [simSpeed, setSimSpeed] = useState(1); // 1x or 2x
  const [elapsedTime, setElapsedTime] = useState(0);
  const [markerPos, setMarkerPos] = useState(null);

  // Pre-calculate node coordinates along the route
  const nodeMap = useMemo(() => {
    const map = new Map();
    (topology?.nodes || []).forEach(n => map.set(n.id, n));
    return map;
  }, [topology]);

  // Active path IDs based on selected route (Primary vs Backup/Alt)
  const activePathIds = useMemo(() => {
    if (selectedRoute === 'backup' && routeResult?.backup_path_node_ids && routeResult.backup_path_node_ids.length > 0) {
      return routeResult.backup_path_node_ids;
    }
    return routeResult?.path_node_ids || [];
  }, [selectedRoute, routeResult]);

  const pathNodes = useMemo(() => {
    if (!activePathIds || activePathIds.length === 0) return [];
    return activePathIds.map(id => nodeMap.get(id)).filter(Boolean);
  }, [activePathIds, nodeMap]);

  const steps = useMemo(() => {
    if (selectedRoute === 'backup' && routeResult?.backup_steps && routeResult.backup_steps.length > 0) {
      return routeResult.backup_steps;
    }
    return routeResult?.steps || [];
  }, [selectedRoute, routeResult]);

  const destinationExitLabel = useMemo(() => {
    if (pathNodes.length > 0) {
      const end = pathNodes[pathNodes.length - 1];
      return end.label || end.id;
    }
    return routeResult?.destination_node?.label || 'Safe Exit';
  }, [pathNodes, routeResult]);

  const currentSegRef = useRef(0);
  const progressRef = useRef(0);
  const animFrameRef = useRef(null);
  const lastTimeRef = useRef(null);
  const lastElapsedUpdateRef = useRef(0);
  const selectedFloorRef = useRef(selectedFloor);

  useEffect(() => {
    selectedFloorRef.current = selectedFloor;
  }, [selectedFloor]);

  // Reset simulation when route changes or upon manual reset
  const handleResetSimulation = () => {
    setSimRunning(false);
    setSimCompleted(false);
    currentSegRef.current = 0;
    progressRef.current = 0;
    setElapsedTime(0);
    lastElapsedUpdateRef.current = 0;
    lastTimeRef.current = null;
    if (pathNodes.length > 0) {
      const start = pathNodes[0];
      setMarkerPos({ x: start.x, y: start.y, floor: start.floor });
      if (start.floor && start.floor !== selectedFloorRef.current) {
        selectedFloorRef.current = start.floor;
        setSelectedFloor(start.floor);
      }
    } else {
      setMarkerPos(null);
    }
  };

  // Start or resume simulation cleanly
  const handleStartSimulation = () => {
    if (simCompleted || currentSegRef.current >= pathNodes.length - 1) {
      currentSegRef.current = 0;
      progressRef.current = 0;
      setSimCompleted(false);
      setElapsedTime(0);
      lastElapsedUpdateRef.current = 0;
      lastTimeRef.current = null;
      if (pathNodes.length > 0) {
        const start = pathNodes[0];
        setMarkerPos({ x: start.x, y: start.y, floor: start.floor });
        if (start.floor && start.floor !== selectedFloorRef.current) {
          selectedFloorRef.current = start.floor;
          setSelectedFloor(start.floor);
        }
      }
    }
    setSimRunning(true);
  };

  // Sync simulation reset whenever active route changes
  useEffect(() => {
    handleResetSimulation();
  }, [selectedRoute, activePathIds]);

  // Sync initial marker position to starting room
  useEffect(() => {
    if (pathNodes.length > 0 && !simRunning && !simCompleted) {
      const start = pathNodes[0];
      setMarkerPos({ x: start.x, y: start.y, floor: start.floor });
    }
  }, [pathNodes, simRunning, simCompleted]);

  // Main animation loop - does NOT tear down on floor switches
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

      // Throttle elapsed time state update to at most once every 500ms
      if (!lastElapsedUpdateRef.current || timestamp - lastElapsedUpdateRef.current >= 500) {
        lastElapsedUpdateRef.current = timestamp;
        setElapsedTime(prev => +(prev + 0.5).toFixed(1));
      }

      // Speed factor: 1x = ~2.2 seconds per node segment
      const speedFactor = 0.5 * simSpeed;
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

        // Auto-switch floor view if entering new level without restarting animation loop
        if (t >= 0.5 && v.floor && v.floor !== selectedFloorRef.current) {
          selectedFloorRef.current = v.floor;
          setSelectedFloor(v.floor);
        }

        if (progressRef.current >= 1) {
          progressRef.current = 0;
          currentSegRef.current += 1;

          if (currentSegRef.current >= pathNodes.length - 1) {
            // Destination reached!
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
  }, [simRunning, pathNodes, simSpeed, setSelectedFloor]);

  const totalSegments = Math.max(pathNodes.length - 1, 1);
  const currentStepNum = Math.min(currentSegRef.current + 1, pathNodes.length);
  const overallProgress = Math.min(
    Math.round(((currentSegRef.current + progressRef.current) / totalSegments) * 100),
    100
  );

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-2 sm:py-5 space-y-3 sm:space-y-5">
      
      {/* Top Banner / Heading & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center space-x-2.5">
            <span>Evacuation Map</span>
            {activeEmergency && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white uppercase tracking-wider animate-pulse">
                Active Protocol
              </span>
            )}
          </h1>
        </div>

        {/* Action Controls: Route Selector, Escape Simulation, SOS Button & Check-In */}
        <div className="flex flex-wrap items-center gap-2">

          {/* Quick Route Selector: Primary vs Alt Route */}
          {routeResult?.backup_path_node_ids && routeResult.backup_path_node_ids.length > 0 && (
            <div className="flex items-center bg-slate-900 border border-slate-700/80 rounded-xl p-1 shadow-md">
              <button
                type="button"
                onClick={() => setSelectedRoute('primary')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                  selectedRoute === 'primary'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Select Primary Recommended Route"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Primary</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedRoute('backup')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                  selectedRoute === 'backup'
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Select Alternative Safe Route"
              >
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <span>Alt Route</span>
              </button>
            </div>
          )}
          
          {/* Escape Simulation Button directly on Evacuation Map */}
          {!simRunning ? (
            <button
              onClick={handleStartSimulation}
              className={`flex items-center space-x-2 px-3.5 py-2 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg transition-all hover:scale-105 ${
                selectedRoute === 'backup'
                  ? 'bg-amber-600 hover:bg-amber-500 active:bg-amber-700 shadow-amber-600/30'
                  : 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 shadow-emerald-600/30'
              }`}
              title={selectedRoute === 'backup' ? 'Run Alt Route Simulation on Map' : 'Run Escape Simulation on Map'}
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>
                {simCompleted 
                  ? (selectedRoute === 'backup' ? 'Replay Alt Simulation' : 'Replay Simulation') 
                  : (selectedRoute === 'backup' ? 'Escape Simulation (Alt)' : 'Escape Simulation')}
              </span>
            </button>
          ) : (
            <div className="flex items-center space-x-1.5 bg-slate-900 border border-emerald-500/60 rounded-xl p-1 shadow-lg">
              <button
                onClick={() => setSimRunning(false)}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold flex items-center space-x-1"
                title="Pause Simulation"
              >
                <Pause className="w-3.5 h-3.5 fill-white" />
                <span>Pause</span>
              </button>
              <button
                onClick={handleResetSimulation}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
                title="Reset Simulation"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setSimSpeed(s => s === 1 ? 2 : 1)}
                className="px-2 py-1 bg-slate-800 text-cyan-400 font-mono text-[11px] font-bold rounded-lg"
                title="Toggle Speed"
              >
                {simSpeed}x
              </button>
              <span className="text-[11px] font-mono text-emerald-400 font-bold px-2">
                {overallProgress}%
              </span>
            </div>
          )}

          {/* Prominent SOS Button */}
          <button
            onClick={openSosModal}
            className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-red-600/40 animate-pulse transition-all ring-2 ring-red-400"
            title="Send Emergency Distress Signal"
          >
            <AlertOctagon className="w-4 h-4 fill-white text-red-600" />
            <span>EMERGENCY S.O.S.</span>
          </button>

          {/* Safe Arrival Check-In */}
          <button
            onClick={() => setIsQrModalOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold shadow-md transition-all"
            title="Confirm Safe Arrival at Assembly Point"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Assembly Check-In</span>
          </button>

          {/* Dispatch Phone Pill */}
          <div className="hidden xl:flex items-center space-x-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300">
            <PhoneCall className="w-3.5 h-3.5 text-red-400" />
            <span>Dispatch: <strong className="text-white">+1-555-019-SAFE</strong></span>
          </div>
        </div>
      </div>

      {/* Main Grid: Interactive Map + Voice Guidance Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
        
        {/* Left Column: Interactive Vector Floor Map + Written Instructions Below */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          
          {/* Interactive Map with Animated Escape Simulation Marker */}
          <MapCanvas 
            onOpenQrModal={() => setIsQrModalOpen(true)}
            onOpenSosModal={openSosModal}
            simulationCoord={markerPos}
          />

          {/* Turn-by-Turn Written Instructions Below the Map */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
                  <Navigation className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-white tracking-tight flex items-center space-x-2">
                    <span>Turn-by-Turn Evacuation Instructions</span>
                    {simRunning && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider animate-pulse ${
                        selectedRoute === 'backup'
                          ? 'bg-amber-950 border-amber-500 text-amber-300'
                          : 'bg-emerald-950 border-emerald-500 text-emerald-300'
                      }`}>
                        Simulating {selectedRoute === 'backup' ? 'Alt ' : ''}Step {currentStepNum}
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Step-by-step guidance navigating to {destinationExitLabel} {selectedRoute === 'backup' ? '(via Alt Safe Route)' : ''} avoiding all hazards
                  </p>
                </div>
              </div>

              {routeResult && (
                <div className="flex items-center space-x-2 text-xs">
                  <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800">
                    <Clock className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-slate-400">Est. Time:</span>
                    <strong className="text-white font-mono">{routeResult.rset_formatted}</strong>
                  </div>
                  <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800">
                    <Footprints className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-slate-400">Total:</span>
                    <strong className="text-white font-mono">{routeResult.total_distance_meters} m</strong>
                  </div>
                </div>
              )}
            </div>

            {/* Written Step-by-Step Card List */}
            {steps.length > 0 ? (
              <div className="space-y-2">
                {steps.map((st, idx) => {
                  const isCurrentActiveStep = simRunning && idx === currentSegRef.current;
                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                        isCurrentActiveStep
                          ? 'bg-blue-950/60 border-blue-500 shadow-md shadow-blue-900/30 ring-1 ring-blue-400'
                          : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start space-x-3 min-w-0">
                        {/* Step Number / Icon Badge */}
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-black ${
                          isCurrentActiveStep
                            ? 'bg-blue-600 text-white animate-pulse'
                            : 'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}>
                          {st.step_number || idx + 1}
                        </div>

                        {/* Instruction Direction & Text */}
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center space-x-2">
                            {getStepIcon(st.icon)}
                            <span className="font-bold text-xs sm:text-sm text-white">
                              {st.short_direction || 'Advance Safely'}
                            </span>
                            {st.floor && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                                {st.floor}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed">
                            {cleanInstructionText(st.instruction)}
                          </p>
                        </div>
                      </div>

                      {/* Distance & Safe Status Pill */}
                      <div className="flex flex-col items-end flex-shrink-0 space-y-1">
                        <span className="text-[11px] font-mono font-bold text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded">
                          {st.distance_meters > 0 ? `${st.distance_meters} m` : 'Start'}
                        </span>
                        <span className="text-[10px] text-emerald-400 font-semibold flex items-center space-x-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>Clear</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 text-center text-xs text-slate-400 bg-slate-950 rounded-xl border border-slate-800">
                Turn-by-turn written route instructions will appear once route calculation completes.
              </div>
            )}

            {/* Safe Arrival Footer Notice */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>All listed corridors actively monitored & verified clear of active hazards.</span>
              </span>
              <span className="font-semibold text-slate-300">
                Follow green directional signage
              </span>
            </div>

          </div>

        </div>

        {/* Right Column: Voice Guidance Panel & Location Selector */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-4">
          <VoiceNavPanel />
          <LocationSelector onOpenQrModal={() => setIsQrModalOpen(true)} />
        </div>

      </div>

      {/* QR Scanner & Assembly Check-in Modal */}
      <QrScannerModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
      />

      {/* Global SOS Emergency Modal */}
      <SosModal />

    </div>
  );
}