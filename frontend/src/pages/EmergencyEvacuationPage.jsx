import React, { useState, useEffect, useRef, useMemo } from 'react';
import MapCanvas from '../components/MapCanvas';
import VoiceNavPanel from '../components/VoiceNavPanel';
import LocationSelector from '../components/LocationSelector';
import DistressSignalCard from '../components/DistressSignalCard';
import QrScannerModal from '../components/QrScannerModal';
import { useEmergency } from '../context/EmergencyContext';
import { useAuth } from '../context/AuthContext';
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
  Sparkles,
  ListOrdered,
  X,
  MapPin,
  Flame,
  AlertTriangle,
  Info,
  ChevronRight,
  Users,
  ShieldAlert,
  Radio,
  Share2,
  Maximize2,
  Volume2
} from 'lucide-react';

// Clean raw node tokens into human-readable instructions
function cleanInstructionText(text) {
  if (!text) return '';
  return text
    .replace(/\b(?:F\d+|GF)-(\d+[A-Za-z]?)\b/gi, 'Room $1')
    .replace(/\b(?:F\d+|GF)-STAIRS?-(EAST|WEST|NORTH|SOUTH|NW|NE|SW|SE)\b/gi, '$1 Stairs')
    .replace(/\b(?:F\d+|GF)-E-(MAIN|WEST|NORTH|SOUTH)\b/gi, '$1 Exit')
    .replace(/\b(?:F\d+|GF)-C-(EAST|WEST|NORTH|SOUTH|NW|NE|SW|SE)\b/gi, '$1 Corridor')
    .replace(/\bF(\d+)\b/gi, 'Floor $1')
    .replace(/\bGF\b/gi, 'Ground Floor')
    .replace(/\b(?:F\d+|GF)-/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getStepIcon(iconType) {
  switch (iconType) {
    case 'turn_left':
      return <CornerUpLeft className="w-4 h-4 text-amber-600" />;
    case 'turn_right':
      return <CornerUpRight className="w-4 h-4 text-amber-600" />;
    case 'stairs':
      return <Layers className="w-4 h-4 text-blue-600" />;
    case 'exit':
    case 'door':
      return <DoorOpen className="w-4 h-4 text-emerald-600" />;
    case 'straight':
      return <ArrowUp className="w-4 h-4 text-blue-600" />;
    default:
      return <Footprints className="w-4 h-4 text-emerald-600" />;
  }
}

export default function EmergencyEvacuationPage() {
  const { role, user } = useAuth();
  const isSafetyOfficer = role === 'admin' || user?.role === 'admin';
  const { 
    activeEmergency, 
    openSosModal,
    activeSos,
    topology,
    routeResult,
    selectedRoute,
    setSelectedRoute,
    selectedFloor,
    setSelectedFloor,
    selectUserLocation
  } = useEmergency();

  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isInstructionsModalOpen, setIsInstructionsModalOpen] = useState(false);
  const [showDistressForm, setShowDistressForm] = useState(false);
  const [operationalTab, setOperationalTab] = useState('voice'); // 'voice' | 'location'
  const [isMapExpanded, setIsMapExpanded] = useState(false);

  // Close written instructions modal with Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isInstructionsModalOpen) {
        setIsInstructionsModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isInstructionsModalOpen]);

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

      if (!lastElapsedUpdateRef.current || timestamp - lastElapsedUpdateRef.current >= 500) {
        lastElapsedUpdateRef.current = timestamp;
        setElapsedTime(prev => +(prev + 0.5).toFixed(1));
      }

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

        if (t >= 0.5 && v.floor && v.floor !== selectedFloorRef.current) {
          selectedFloorRef.current = v.floor;
          setSelectedFloor(v.floor);
        }

        if (progressRef.current >= 1) {
          progressRef.current = 0;
          currentSegRef.current += 1;

          if (currentSegRef.current >= pathNodes.length - 1) {
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

  // Formatted date string for top-right emergency badge (matching reference image)
  const currentFormattedTime = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }) + ' • ' + d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  return (
    <div className="max-w-7xl 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-5">
      
      {/* ============================================================== */}
      {/* 1. TOP PAGE HEADER (MATCHING REFERENCE IMAGE)                  */}
      {/* ============================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Emergency Response
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Get to safety. Follow the designated evacuation routes.
          </p>
        </div>

        {/* Top-Right Emergency Status Badge (Reference Image Style) */}
        <div>
          {activeEmergency ? (
            <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-red-100 border border-red-200 text-red-900 text-xs font-semibold shadow-xs">
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span className="font-bold text-red-700">Active Emergency</span>
              <span className="text-slate-400">|</span>
              <span className="text-slate-600 font-medium">{currentFormattedTime}</span>
            </div>
          ) : (
            <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="font-bold text-emerald-700">Normal Operations</span>
              <span className="text-slate-400">|</span>
              <span className="text-slate-600 font-medium">{currentFormattedTime}</span>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. RESTRAINED ACTIVE ALERT BANNER (MATCHING REFERENCE IMAGE)   */}
      {/* ============================================================== */}
      {activeEmergency && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center space-x-3.5 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-red-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
              <Flame className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-red-950 truncate">
                {activeEmergency.emergency_type ? (activeEmergency.emergency_type.charAt(0).toUpperCase() + activeEmergency.emergency_type.slice(1)) : 'Fire'} Alert – {activeEmergency.location || 'Engineering Building'}
              </h2>
              <p className="text-xs text-red-800/90 mt-0.5 truncate">
                Please evacuate the area and follow the nearest safe route.
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsInstructionsModalOpen(true)}
            className="flex-shrink-0 inline-flex items-center justify-center space-x-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
          >
            <span>View Details</span>
            <ChevronRight className="w-4 h-4 ml-0.5" />
          </button>
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. MAIN GRID: EVACUATION MAP + STATUS PANELS                   */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* Left Column: Interactive GIS Evacuation Map (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* Map Card */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            
            {/* Card Header Bar (matches Reference Image "Evacuation Map") */}
            <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5 bg-slate-50/50">
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-slate-700" />
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                  Evacuation Map
                </h3>
              </div>

              {/* Action Controls: Escape Simulation, Written Directions, View Full Map */}
              <div className="flex flex-wrap items-center gap-2">
                
                {/* Escape Simulation on Map */}
                {!simRunning ? (
                  <button
                    onClick={handleStartSimulation}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition-colors ${
                      selectedRoute === 'backup'
                        ? 'bg-amber-600 hover:bg-amber-700 text-white'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                    title={selectedRoute === 'backup' ? 'Run Alt Route Simulation' : 'Run Escape Simulation'}
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span className="hidden sm:inline">
                      {simCompleted 
                        ? (selectedRoute === 'backup' ? 'Replay Alt' : 'Replay Simulation') 
                        : (selectedRoute === 'backup' ? 'Escape Simulation (Alt)' : 'Escape Simulation')}
                    </span>
                    <span className="sm:hidden">Sim</span>
                  </button>
                ) : (
                  <div className="flex items-center space-x-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-xs">
                    <button
                      onClick={() => setSimRunning(false)}
                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs font-bold flex items-center space-x-1"
                    >
                      <Pause className="w-3 h-3 fill-white" />
                      <span>Pause</span>
                    </button>
                    <button
                      onClick={handleResetSimulation}
                      className="p-1 hover:bg-slate-100 text-slate-600 rounded text-xs"
                      title="Reset"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setSimSpeed(s => s === 1 ? 2 : 1)}
                      className="px-1.5 py-0.5 text-slate-700 font-mono text-[11px] font-bold"
                    >
                      {simSpeed}x
                    </button>
                    <span className="text-[11px] font-mono text-emerald-700 font-bold px-1.5">
                      {overallProgress}%
                    </span>
                  </div>
                )}

                {/* Turn-by-Turn Written Instructions Button */}
                <button
                  onClick={() => setIsInstructionsModalOpen(true)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold shadow-xs transition-colors"
                  title="View Turn-by-Turn Directions"
                >
                  <ListOrdered className="w-3.5 h-3.5 text-blue-600" />
                  <span className="hidden sm:inline">Directions</span>
                  {steps.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-200 font-bold">
                      {steps.length}
                    </span>
                  )}
                </button>

                {/* View Full Map Button (Matches Reference Image exactly) */}
                <button
                  onClick={() => setIsMapExpanded(prev => !prev)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold shadow-xs transition-colors"
                  title={isMapExpanded ? "Restore Map View" : "View Full Map"}
                >
                  <span>{isMapExpanded ? "Collapse Map" : "View Full Map"}</span>
                  <Maximize2 className="w-3.5 h-3.5 text-slate-500" />
                </button>
              </div>
            </div>

            {/* Interactive Vector GIS Canvas */}
            <MapCanvas 
              onOpenQrModal={() => setIsQrModalOpen(true)}
              onOpenSosModal={openSosModal}
              onOpenInstructions={() => setIsInstructionsModalOpen(true)}
              simulationCoord={markerPos}
              className={isMapExpanded ? "h-[750px] sm:h-[820px]" : "h-[520px] sm:h-[580px] lg:h-[620px]"}
            />
          </div>

        </div>

        {/* Right Column: Status, Safety Instructions, Voice & Location (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* ============================================================== */}
          {/* CARD 1: EMERGENCY STATUS (MATCHING REFERENCE IMAGE)             */}
          {/* ============================================================== */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            {/* Dark Navy Header (Reference Image Style) */}
            <div className="bg-[#0b1728] px-4 py-3 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white tracking-tight">Emergency Status</h3>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider ${
                activeEmergency 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-slate-700 text-slate-200'
              }`}>
                {activeEmergency ? 'Active' : 'Standby'}
              </span>
            </div>

            <div className="p-4 space-y-2.5 text-xs text-slate-700 bg-white">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Incident Type</span>
                <span className="font-bold text-slate-900 flex items-center space-x-1.5">
                  <Flame className="w-3.5 h-3.5 text-red-500" />
                  <span className="capitalize">{activeEmergency?.emergency_type || 'Fire'}</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Location</span>
                <span className="font-bold text-slate-900 flex items-center space-x-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-600" />
                  <span>{activeEmergency?.location || 'Engineering Building'}</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Reported At</span>
                <span className="font-bold text-slate-900 flex items-center space-x-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>10:24 AM</span>
                </span>
              </div>
            </div>
          </div>

          {/* ============================================================== */}
          {/* CARD 2: SAFETY INSTRUCTIONS (MATCHING REFERENCE IMAGE)         */}
          {/* ============================================================== */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
              <Info className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">Safety Instructions</h3>
            </div>

            <ul className="mt-3 space-y-2.5 text-xs text-slate-700">
              <li className="flex items-start space-x-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>Evacuate the affected area immediately</span>
              </li>
              <li className="flex items-start space-x-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>Follow marked evacuation routes</span>
              </li>
              <li className="flex items-start space-x-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>Report any hazards to campus security</span>
              </li>
              <li className="flex items-start space-x-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>Proceed directly to the nearest safe zone</span>
              </li>
            </ul>
          </div>

          {/* ============================================================== */}
          {/* CARD 3: OPERATIONAL CONTROLS (VOICE ADVISORY & LOCATION)        */}
          {/* ============================================================== */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="flex border-b border-slate-200 bg-slate-50/70 p-1">
              <button
                onClick={() => setOperationalTab('voice')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                  operationalTab === 'voice'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80 font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Voice Guidance</span>
              </button>
              <button
                onClick={() => setOperationalTab('location')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                  operationalTab === 'location'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80 font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <MapPin className="w-3.5 h-3.5 text-blue-600" />
                <span>My Room / ADA</span>
              </button>
            </div>
            
            <div className="p-3">
              {operationalTab === 'voice' ? (
                <VoiceNavPanel />
              ) : (
                <LocationSelector onOpenQrModal={() => setIsQrModalOpen(true)} />
              )}
            </div>
          </div>

        </div>

      </div>

      {/* ============================================================== */}
      {/* 4. BOTTOM 3-CARD ROW (EXACTLY MATCHING REFERENCE IMAGE)        */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Nearby Safe Zones Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
            <Users className="w-4 h-4 text-slate-700" />
            <h3 className="text-sm font-bold text-slate-900">Nearby Safe Zones</h3>
          </div>

          <div className="mt-3 space-y-2.5">
            <div 
              onClick={() => setIsQrModalOpen(true)}
              className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer group"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center flex-shrink-0">
                  <DoorOpen className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors">Main Assembly Point</div>
                  <div className="text-[11px] text-slate-500">2 min • 150 m</div>
                </div>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200">Open</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" />
              </div>
            </div>

            <div 
              onClick={() => setIsQrModalOpen(true)}
              className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer group"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center flex-shrink-0">
                  <DoorOpen className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors">Sports Field</div>
                  <div className="text-[11px] text-slate-500">4 min • 300 m</div>
                </div>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200">Open</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
            <Info className="w-4 h-4 text-slate-700" />
            <h3 className="text-sm font-bold text-slate-900">Quick Actions</h3>
          </div>

          <div className="mt-3 space-y-2">
            <button
              onClick={openSosModal}
              className="w-full flex items-center justify-center space-x-2 py-2 px-3 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Report an Incident</span>
            </button>

            <button
              onClick={() => setIsInstructionsModalOpen(true)}
              className="w-full flex items-center justify-center space-x-2 py-2 px-3 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 rounded-lg text-xs font-semibold transition-colors"
            >
              <Navigation className="w-3.5 h-3.5 text-blue-600" />
              <span>Get Evacuation Route</span>
            </button>

            <button
              onClick={() => setIsQrModalOpen(true)}
              className="w-full flex items-center justify-center space-x-2 py-2 px-3 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 rounded-lg text-xs font-semibold transition-colors"
            >
              <MapPin className="w-3.5 h-3.5 text-slate-600" />
              <span>Share My Location</span>
            </button>
          </div>
        </div>

        {/* Important Contacts Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
            <Info className="w-4 h-4 text-slate-700" />
            <h3 className="text-sm font-bold text-slate-900">Important Contacts</h3>
          </div>

          <div className="mt-3 space-y-3 text-xs">
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
              <div className="flex items-center space-x-2.5">
                <PhoneCall className="w-4 h-4 text-slate-700" />
                <span className="font-semibold text-slate-800">Campus Security</span>
              </div>
              <a 
                href="tel:+61212345678" 
                className="font-mono font-bold text-blue-600 hover:underline"
              >
                +61 2 1234 5678
              </a>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
              <div className="flex items-center space-x-2.5">
                <PhoneCall className="w-4 h-4 text-red-600" />
                <span className="font-semibold text-slate-800">Emergency Services</span>
              </div>
              <a
                href="tel:000"
                className="font-mono font-bold text-red-600 hover:underline"
              >
                000 / 911
              </a>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
              <div className="flex items-center space-x-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span className="font-semibold text-slate-800">Student Health Dispatch</span>
              </div>
              <a 
                href="tel:+15550194325" 
                className="font-mono font-bold text-emerald-700 hover:underline"
              >
                +1 555 019 4325
              </a>
            </div>
          </div>
        </div>

      </div>

      {/* ============================================================== */}
      {/* 5. STUDENT DISTRESS SIGNAL CARD (RESCUE DISPATCH)              */}
      {/* ============================================================== */}
      <div className="pt-2">
        <DistressSignalCard />
      </div>

      {/* ============================================================== */}
      {/* 6. TURN-BY-TURN WRITTEN INSTRUCTIONS MODAL                     */}
      {/* ============================================================== */}
      {isInstructionsModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={() => setIsInstructionsModalOpen(false)}
        >
          <div 
            className="bg-white max-w-2xl w-full max-h-[85vh] rounded-xl border border-slate-200 shadow-xl flex flex-col overflow-hidden text-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between gap-3 bg-slate-50">
              <div className="flex items-center space-x-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0">
                  <Navigation className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-2 flex-wrap">
                    <h3 className="font-bold text-base text-slate-900">
                      Turn-by-Turn Evacuation Instructions
                    </h3>
                    {simRunning && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase">
                        Simulating Step {currentStepNum}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    Target destination: <strong className="text-slate-800">{destinationExitLabel}</strong>
                  </p>
                </div>
              </div>

              {/* Dismiss Cross Icon on Top Right */}
              <button
                onClick={() => setIsInstructionsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
                title="Dismiss Instructions"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Summary Telemetry Strip */}
            {routeResult && (
              <div className="px-4 py-2.5 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between gap-2 text-xs flex-wrap">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-slate-500">Est. Time:</span>
                    <strong className="text-slate-900 font-mono">{routeResult.rset_formatted}</strong>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <Footprints className="w-3.5 h-3.5 text-blue-600" />
                    <span className="text-slate-500">Total Distance:</span>
                    <strong className="text-slate-900 font-mono">{routeResult.total_distance_meters} m</strong>
                  </div>
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold">
                  {steps.length} Steps Total
                </span>
              </div>
            )}

            {/* Scrollable Step-by-Step Instructions */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-2 flex-1">
              {steps.length > 0 ? (
                steps.map((st, idx) => {
                  const isCurrentActiveStep = simRunning && idx === currentSegRef.current;
                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border transition-all flex items-start justify-between gap-3 ${
                        isCurrentActiveStep
                          ? 'bg-blue-50/80 border-blue-400 shadow-xs'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start space-x-3 min-w-0">
                        <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                          isCurrentActiveStep
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {st.step_number || idx + 1}
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center space-x-2 flex-wrap">
                            {getStepIcon(st.icon)}
                            <span className="font-bold text-xs sm:text-sm text-slate-900">
                              {st.short_direction || 'Advance Safely'}
                            </span>
                            {st.floor && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                {st.floor}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            {cleanInstructionText(st.instruction)}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end flex-shrink-0 space-y-1">
                        <span className="text-[11px] font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          {st.distance_meters > 0 ? `${st.distance_meters} m` : 'Start'}
                        </span>
                        <span className="text-[10px] text-emerald-700 font-semibold flex items-center space-x-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Clear</span>
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-lg border border-slate-200">
                  Turn-by-turn written route instructions will appear once route calculation completes.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Corridors verified clear of active hazards.</span>
              </span>
              <button
                onClick={() => setIsInstructionsModalOpen(false)}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Scanner & Assembly Check-in Modal */}
      <QrScannerModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
      />

    </div>
  );
}
