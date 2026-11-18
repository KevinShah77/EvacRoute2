import React, { useState, useEffect } from 'react';
import { 
  AlertOctagon, 
  AlertTriangle,
  X, 
  Send, 
  CheckCircle2, 
  Clock, 
  ShieldAlert, 
  PhoneCall, 
  Flame, 
  RotateCcw,
  Radio,
  ArrowLeft,
  MapPin,
  ChevronRight,
  ShieldCheck,
  Building
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useEmergency } from '../context/EmergencyContext';
import { cleanRoomNumber } from '../context/VoiceNavigationContext';

export default function SosModal({ isOpen, onClose }) {
  const { user, role } = useAuth();
  const isSafetyOfficer = role === 'admin' || user?.role === 'admin';
  const { 
    selectedFloor, 
    userLocationNode, 
    topology,
    isSosModalOpen,
    closeSosModal,
    activeSos,
    setActiveSos,
    sosRequests = [],
    activeEmergency,
    sendSosSignal,
    resolveSosRequest
  } = useEmergency();

  const modalOpen = isOpen !== undefined ? isOpen : isSosModalOpen;
  const handleClose = onClose || closeSosModal;

  // 'view' to view active SOS broadcast message, 'broadcast' for safety officer to transmit a new SOS
  const [modalMode, setModalMode] = useState('view');
  const [situation, setSituation] = useState('fire'); // 'fire' | 'structural'
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Close modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && modalOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalOpen, handleClose]);

  // Current room label resolution (clean, no F2- prefix)
  const roomNode = topology?.nodes?.find(n => n.id === userLocationNode);
  const rawLabel = roomNode?.label || userLocationNode || '208';
  const roomLabel = cleanRoomNumber(rawLabel) || 'Room 208';
  const initialRoomNumber = cleanRoomNumber(rawLabel) 
    ? cleanRoomNumber(rawLabel).replace(/^Room\s*/i, '') 
    : (userLocationNode ? userLocationNode.replace(/^(F\d+|GF)[-_ ]+/i, '') : '208');

  // Option to write custom room number and adjust floor for broadcast
  const [customRoom, setCustomRoom] = useState(initialRoomNumber);
  const [customFloor, setCustomFloor] = useState(() => selectedFloor || 'Floor 2');

  // Keep synced if userLocationNode changes
  useEffect(() => {
    if (userLocationNode) {
      const node = topology?.nodes?.find(n => n.id === userLocationNode);
      const cleaned = cleanRoomNumber(node?.label || userLocationNode)?.replace(/^Room\s*/i, '') || userLocationNode.replace(/^(F\d+|GF)[-_ ]+/i, '');
      if (cleaned) {
        setCustomRoom(cleaned);
      }
      if (node?.floor) {
        setCustomFloor(node.floor);
      } else if (selectedFloor) {
        setCustomFloor(selectedFloor);
      }
    }
  }, [userLocationNode, topology, selectedFloor]);

  // Deduce floor, label, and nodeId from room string
  const deduceFloorAndLocation = (roomStr, currentFloor) => {
    const trimmed = (roomStr || '').trim();
    if (!trimmed) {
      return { 
        floor: currentFloor || selectedFloor || 'Floor 2', 
        label: roomLabel || 'Room 208', 
        nodeId: userLocationNode || 'F2-208' 
      };
    }

    const allNodes = topology?.nodes || [];

    // Exact or partial match on node id / label
    const matchedNode = allNodes.find(n => {
      const cleanId = n.id.replace(/^(F\d+|GF)[-_ ]+/i, '').toLowerCase();
      const cleanLbl = (n.label || '').toLowerCase();
      const t = trimmed.toLowerCase();
      return cleanId === t || n.id.toLowerCase() === t || cleanLbl.includes(t);
    });

    if (matchedNode) {
      return {
        floor: matchedNode.floor || currentFloor || selectedFloor || 'Floor 2',
        label: cleanRoomNumber(matchedNode.label) || (trimmed.toLowerCase().startsWith('room') ? trimmed : `Room ${trimmed}`),
        nodeId: matchedNode.id
      };
    }

    // Heuristic floor parsing from digits
    let detectedFloor = currentFloor || selectedFloor || 'Floor 2';
    const numMatch = trimmed.match(/\b\d+\b/);
    if (numMatch) {
      const num = parseInt(numMatch[0], 10);
      if (num >= 400 && num < 500) detectedFloor = 'Floor 4';
      else if (num >= 300 && num < 400) detectedFloor = 'Floor 3';
      else if (num >= 200 && num < 300) detectedFloor = 'Floor 2';
      else if (num >= 100 && num < 200) detectedFloor = 'Floor 1';
      else if (num < 100) detectedFloor = 'Ground';
    } else if (/^gf/i.test(trimmed) || /ground/i.test(trimmed)) {
      detectedFloor = 'Ground';
    }

    return {
      floor: detectedFloor,
      label: trimmed.toLowerCase().startsWith('room') ? trimmed : `Room ${trimmed}`,
      nodeId: null
    };
  };

  const handleRoomChange = (e) => {
    const val = e.target.value;
    setCustomRoom(val);
    const parsed = deduceFloorAndLocation(val, customFloor);
    if (parsed.floor && parsed.floor !== customFloor) {
      setCustomFloor(parsed.floor);
    }
  };

  if (!modalOpen) return null;

  // Determine current active SOS record (activeSos, or latest pending from sosRequests, or latest request)
  const currentSos = activeSos 
    || (sosRequests || []).find(s => s.status !== 'resolved')
    || (sosRequests || [])[0]
    || null;

  // Derive the active SOS broadcast message
  const sosMessageText = currentSos?.details 
    || (currentSos?.situation === 'structural'
        ? `EMERGENCY S.O.S. BROADCAST: Structural damage and corridor breach detected on ${currentSos?.floor || selectedFloor || 'Floor 2'}. Immediate evacuation required. Avoid compromised sectors and follow designated green paths.`
        : currentSos?.situation === 'BLOCKED' || currentSos?.situation === 'trapped'
          ? `EMERGENCY S.O.S. BROADCAST: Occupant distress signal active at ${currentSos?.floor || selectedFloor || 'Floor 2'} • ${currentSos?.location || 'Seminar Room 208'}. First responders dispatched. All adjacent occupants evacuate immediately.`
          : activeEmergency?.description
            || `EMERGENCY S.O.S. BROADCAST: Confirmed active fire condition reported at ${activeEmergency?.location || 'Room 205'} on ${activeEmergency?.floor || 'Floor 2'}. All occupants proceed immediately to designated emergency assembly points.`);

  const broadcastAuthor = currentSos?.user_name 
    || 'Chief Safety Officer Sarah Jenkins';

  const broadcastFloor = currentSos?.floor || activeEmergency?.floor || selectedFloor || 'Floor 2';
  const broadcastLocation = currentSos?.location || activeEmergency?.location || 'Room 205';

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setSubmitting(true);
    try {
      const parsedLoc = deduceFloorAndLocation(customRoom, customFloor);
      const floorToSend = customFloor || parsedLoc.floor || 'Floor 2';
      const locationToSend = parsedLoc.label || (customRoom.trim() ? `Room ${customRoom.trim()}` : 'Room 208');
      const nodeToSend = parsedLoc.nodeId || userLocationNode || 'F2-208';

      const defaultDetails = situation === 'structural'
        ? `EMERGENCY S.O.S. BROADCAST: Structural damage reported at ${floorToSend} • ${locationToSend}. Evacuate immediately.`
        : `EMERGENCY S.O.S. BROADCAST: Active fire reported at ${floorToSend} • ${locationToSend}. Evacuate immediately.`;

      await sendSosSignal({
        floor: floorToSend,
        location: locationToSend,
        node_id: nodeToSend,
        situation: situation || 'fire',
        details: details.trim() || defaultDetails,
        user_name: user?.full_name || (isSafetyOfficer ? 'Chief Safety Officer Sarah Jenkins' : 'Alex Chen'),
        user_role: isSafetyOfficer ? 'admin' : 'student',
        contact: user?.phone || (isSafetyOfficer ? '+1-555-019-SAFE' : '+1-555-014-STUD')
      });
      setModalMode('view');
    } catch (err) {
      alert(`Error transmitting SOS: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // SOS situation options strictly for Fire or Structural Damage
  const situationOptions = [
    { 
      id: 'fire', 
      label: 'Active Fire Emergency', 
      icon: Flame, 
      desc: 'Active flames, extreme heat, or spreading smoke' 
    },
    { 
      id: 'structural', 
      label: 'Structural Damage / Collapse', 
      icon: AlertTriangle, 
      desc: 'Wall breach, ceiling collapse, or structural failure' 
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white max-w-lg w-full rounded-2xl border border-slate-200 shadow-2xl overflow-hidden p-5 sm:p-6 relative text-slate-900 animate-in fade-in-50 zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-red-600 text-white shadow-xs flex-shrink-0">
              <AlertOctagon className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-black text-base text-slate-900 tracking-tight uppercase">
                  Campus Emergency S.O.S.
                </h3>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200">
                  {currentSos?.status === 'acknowledged' ? 'Responders En Route' : 'Live Alert'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Official Life-Safety Emergency Distress Broadcast
              </p>
            </div>
          </div>
          <button 
            onClick={handleClose} 
            title="Close S.O.S. Modal" 
            aria-label="Close S.O.S. Modal" 
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ================= MODAL MODE: VIEW OFFICIAL S.O.S. MESSAGE ================= */}
        {modalMode === 'view' ? (
          <div className="py-4 space-y-4">

            {/* 1. THE OFFICIAL S.O.S. BROADCAST MESSAGE BOX */}
            <div className="bg-red-50/90 border-2 border-red-500 rounded-xl p-4 text-slate-900 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping"></span>
                  <span className="text-[11px] font-black uppercase tracking-wider text-red-800 bg-red-200/80 border border-red-300 px-2 py-0.5 rounded">
                    S.O.S. BROADCAST MESSAGE
                  </span>
                </div>
                <span className="text-[10px] font-mono font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded border border-red-200">
                  {currentSos?.status === 'acknowledged'
                    ? 'ACKNOWLEDGED'
                    : currentSos?.status === 'pending'
                      ? 'PENDING DISPATCH'
                      : 'ACTIVE'}
                </span>
              </div>

              {/* The actual broadcasted SOS message text */}
              <div className="bg-white border border-red-200 rounded-lg p-3 text-red-950 text-sm font-semibold leading-relaxed shadow-2xs">
                "{sosMessageText}"
              </div>

              {/* Key broadcast metadata */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-red-200/80 text-xs">
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-bold block">Incident</span>
                  <span className="font-bold text-red-700 uppercase">
                    {currentSos?.situation || activeEmergency?.emergency_type || 'Fire Emergency'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-bold block">Hazard Sector</span>
                  <span className="font-bold text-slate-900">
                    {broadcastFloor} • {broadcastLocation}
                  </span>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-slate-500 text-[10px] uppercase font-bold block">Target Assembly</span>
                  <span className="font-bold text-emerald-700">
                    Safe Assembly Point 3
                  </span>
                </div>
              </div>

              {/* Origin attribution */}
              <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1 border-t border-red-100">
                <span>Broadcast Author: <strong className="text-slate-800">{broadcastAuthor}</strong></span>
                <span className="font-mono text-[10px] text-slate-500">
                  {currentSos?.created_at ? new Date(currentSos.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Real-time'}
                </span>
              </div>
            </div>

            {/* 2. IMMEDIATE LIFE-SAFETY PROTOCOLS */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-2">
              <span className="font-bold text-slate-900 uppercase tracking-wider block flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Immediate Life-Safety Protocols</span>
              </span>
              <ul className="list-disc list-inside space-y-1 text-slate-600 leading-relaxed">
                <li>Follow the primary highlighted green evacuation route on your campus map.</li>
                <li>Stay low to the ground where breathable air settles if smoke is encountered.</li>
                <li>Do <strong>NOT</strong> attempt to use elevators under any circumstances.</li>
                <li>Proceed directly to Safe Assembly Point 3 (North Campus Plaza) for headcount check-in.</li>
              </ul>
            </div>

            {/* 3. SAFETY OFFICER CONTROLS (IF SAFETY OFFICER) */}
            {isSafetyOfficer && (
              <div className="bg-amber-50/80 border border-amber-200 p-3 rounded-xl flex items-center justify-between gap-2 text-xs">
                <div className="space-y-0.5">
                  <span className="font-bold text-amber-900 block">Safety Officer Incident Controls</span>
                  <span className="text-amber-700 text-[11px]">You have authorization to broadcast or resolve campus SOS alerts.</span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setModalMode('broadcast')}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-xs shadow-xs transition-colors cursor-pointer flex items-center space-x-1"
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span>Broadcast New S.O.S.</span>
                  </button>
                  {currentSos?.id && currentSos.status !== 'resolved' && (
                    <button
                      onClick={async () => {
                        try {
                          await resolveSosRequest(currentSos.id);
                          handleClose();
                        } catch (e) {
                          console.warn('Could not resolve SOS:', e);
                          handleClose();
                        }
                      }}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-xs transition-colors cursor-pointer"
                    >
                      Resolve S.O.S.
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* 4. EMERGENCY DISPATCH HOTLINE & FIRST RESPONDERS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
              <a
                href="tel:+918027577198"
                className="flex items-center justify-center space-x-2 p-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition-colors cursor-pointer shadow-xs"
              >
                <PhoneCall className="w-4 h-4" />
                <span>Call Safety Dispatch</span>
              </a>
              <a
                href="tel:100"
                className="flex items-center justify-center space-x-2 p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition-colors cursor-pointer shadow-xs"
              >
                <PhoneCall className="w-4 h-4" />
                <span>Emergency Services (100)</span>
              </a>
            </div>

            {/* Footer Close */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-[11px] text-slate-500">
                EvacRoute Campus Life-Safety Dispatch Network
              </span>
              <button
                onClick={handleClose}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs cursor-pointer transition-colors"
              >
                Close Window
              </button>
            </div>
          </div>
        ) : (
          /* ================= MODAL MODE: BROADCAST NEW S.O.S. ================= */
          <div className="py-4 space-y-4">
            
            {/* Originating Incident Location with Room Number Input */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 rounded-md bg-red-100 text-red-700 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-slate-800 text-xs font-bold uppercase tracking-wider">
                    Originating Incident Location
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setModalMode('view')}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center space-x-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Message</span>
                </button>
              </div>

              {/* Room Number & Floor Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-0.5">
                {/* 1. Room Number Input */}
                <div className="sm:col-span-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-700">
                      Room Number:
                    </label>
                    <span className="text-[10px] text-slate-400">e.g. 205, 208, 214, Lab</span>
                  </div>
                  <input
                    type="text"
                    required
                    value={customRoom}
                    onChange={handleRoomChange}
                    placeholder="Enter room number (e.g. 208, 205)..."
                    className="w-full bg-white border border-slate-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 font-semibold outline-none transition-colors shadow-2xs"
                  />
                </div>

                {/* 2. Floor Selector */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    Floor:
                  </label>
                  <select
                    value={customFloor}
                    onChange={(e) => setCustomFloor(e.target.value)}
                    className="w-full bg-white border border-slate-200 focus:border-red-500 rounded-lg px-2.5 py-2 text-xs sm:text-sm text-slate-900 font-semibold outline-none transition-colors shadow-2xs cursor-pointer"
                  >
                    {['Ground', 'Floor 1', 'Floor 2', 'Floor 3', 'Floor 4'].map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Broadcast Target Summary Pill */}
              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/80">
                <span>Broadcasting Alert Origin:</span>
                <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
                  {customFloor} • {deduceFloorAndLocation(customRoom, customFloor).label}
                </span>
              </div>
            </div>

            {/* Emergency Situation Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                Select Emergency Situation:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {situationOptions.map(opt => {
                  const Icon = opt.icon;
                  const isSelected = situation === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSituation(opt.id)}
                      className={`p-3 rounded-xl border text-left transition-colors flex items-start space-x-2.5 cursor-pointer ${
                        isSelected
                          ? 'bg-red-50 border-red-500 text-red-950 ring-1 ring-red-400'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isSelected ? 'text-red-600' : 'text-slate-400'}`} />
                      <div>
                        <div className="font-bold text-xs">{opt.label}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">{opt.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Optional Short Description */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Custom Broadcast Directives / Details (Optional):
              </label>
              <input
                type="text"
                placeholder="e.g., Heavy smoke in corridor, avoid east staircase, assemble at North Plaza"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-red-500"
              />
            </div>

            {/* Large Red Transmit Button */}
            <div className="pt-2">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full py-3 bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:opacity-50 text-white rounded-xl font-bold text-xs tracking-wider uppercase shadow-xs flex items-center justify-center space-x-2 transition-colors cursor-pointer"
              >
                <AlertOctagon className="w-4 h-4" />
                <span>{submitting ? 'Broadcasting S.O.S. Signal...' : 'TRANSMIT CAMPUS S.O.S. BROADCAST NOW'}</span>
              </button>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={() => setModalMode('view')}
                className="text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <span className="text-[11px] text-slate-400">
                Broadcasts immediately update all connected occupant maps.
              </span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
