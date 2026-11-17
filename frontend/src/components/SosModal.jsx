import React, { useState, useEffect } from 'react';
import { 
  AlertOctagon, 
  AlertTriangle,
  X, 
  Send, 
  CheckCircle2, 
  Clock, 
  UserCheck, 
  ShieldAlert, 
  PhoneCall, 
  Flame, 
  Accessibility, 
  HeartPulse, 
  Wind,
  RotateCcw
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useEmergency } from '../context/EmergencyContext';
import { cleanRoomNumber } from '../context/VoiceNavigationContext';
import { emergencyWS } from '../services/websocket';
import { playEmergencySirenTone } from '../services/audioChime';

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
    sendSosSignal,
    resolveSosRequest
  } = useEmergency();

  const modalOpen = isOpen !== undefined ? isOpen : isSosModalOpen;
  const handleClose = onClose || closeSosModal;

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

  if (!modalOpen) return null;

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!isSafetyOfficer) {
      console.warn('Unauthorized SOS transmission attempt blocked. Only Safety Officers can broadcast SOS.');
      return;
    }
    setSubmitting(true);
    try {
      await sendSosSignal({
        floor: selectedFloor || 'Floor 2',
        location: roomLabel,
        node_id: userLocationNode || 'F2-208',
        situation: situation || 'fire',
        details: details.trim() || undefined,
        user_name: user?.full_name || 'Chief Safety Officer Sarah Jenkins',
        user_role: 'admin',
        contact: user?.phone || '+1-555-019-SAFE'
      });
    } catch (err) {
      alert(`Error transmitting SOS: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // SOS alerts strictly for Fire or Structural Damage
  const situationOptions = [
    { 
      id: 'fire', 
      label: 'Active Fire Emergency', 
      icon: Flame, 
      desc: 'Active flames, heat, or spreading fire in this sector' 
    },
    { 
      id: 'structural', 
      label: 'Structural Damage / Collapse', 
      icon: AlertTriangle, 
      desc: 'Wall breach, ceiling collapse, or structural integrity failure' 
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="evac-card max-w-lg w-full rounded-2xl border border-red-500/40 shadow-[0_0_50px_rgba(239,68,68,0.25)] overflow-hidden p-6 relative animate-in zoom-in-95 duration-200 text-slate-100">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-red-500/20">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-red-600 text-white animate-pulse shadow-md shadow-red-600/40">
              <AlertOctagon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-white tracking-tight">
                {isSafetyOfficer ? 'CAMPUS EMERGENCY S.O.S.' : 'CAMPUS S.O.S. MONITOR'}
              </h3>
              <p className="text-xs text-red-300">
                {isSafetyOfficer 
                  ? 'Immediate distress broadcast for active fire or structural damage'
                  : 'Broadcasts reserved for Safety Officers • Monitored life-safety channel'}
              </p>
            </div>
          </div>
          <button onClick={handleClose} title="Close SOS Modal" aria-label="Close SOS Modal" className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/[0.06] transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ================= ACTIVE TRANSMITTED STATE ================= */}
        {activeSos ? (
          <div className="py-6 space-y-5">
            <div className={`p-4 rounded-xl border text-sm flex items-start space-x-3 ${
              activeSos.status === 'acknowledged'
                ? 'bg-emerald-950 border-emerald-500 text-emerald-200'
                : 'bg-red-950/80 border-red-500 text-red-200 animate-pulse'
            }`}>
              {activeSos.status === 'acknowledged' ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-0.5" />
              ) : (
                <Clock className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5 animate-spin" />
              )}
              <div>
                <h4 className="font-bold text-base text-white">
                  {activeSos.status === 'acknowledged' 
                    ? 'SOS ACKNOWLEDGED – RESCUE EN ROUTE' 
                    : 'SOS TRANSMITTED – DISPATCHING FIRST RESPONDERS'}
                </h4>
                <p className="text-xs mt-1 leading-relaxed">
                  {activeSos.status === 'acknowledged' 
                    ? `Safety Command "${activeSos.acknowledged_by || 'Campus Security'}" has acknowledged the distress signal. Rescue units are advancing to the coordinates.`
                    : 'Distress signal and room coordinates are broadcast to Security Operations Center. First responders are actively en route.'
                  }
                </p>
              </div>
            </div>

            {/* Life-Safety Advice Box */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs space-y-2">
              <span className="font-bold text-amber-400 uppercase tracking-wider block">Immediate Life-Safety Instructions:</span>
              <ul className="list-disc list-inside space-y-1 text-slate-300">
                <li>Stay low to the ground where breathable air settles.</li>
                <li>Seal door cracks with clothing or damp fabrics to block smoke.</li>
                <li>Do NOT open doors if the knob feels hot to the touch.</li>
                <li>Wave a bright object or phone flashlight at any exterior window.</li>
              </ul>
            </div>

            {/* Location & Details Snapshot */}
            <div className="space-y-2 text-xs bg-slate-900/80 p-3.5 rounded-xl border border-slate-700/80">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Emergency Situation:</span>
                <span className="font-bold text-red-400 uppercase tracking-wide">
                  {activeSos.situation === 'structural' 
                    ? 'Structural Damage / Collapse' 
                    : activeSos.situation === 'BLOCKED' || activeSos.situation === 'trapped'
                      ? 'Trapped in Room'
                      : 'Active Fire Emergency'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Transmitted Location:</span>
                <span className="font-bold text-white">{activeSos.floor} • {activeSos.location}</span>
              </div>
              {activeSos.user_name && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Transmitted By:</span>
                  <span className="font-semibold text-blue-300">{activeSos.user_name}</span>
                </div>
              )}
              {activeSos.details && (
                <div className="pt-1 border-t border-white/[0.06] text-slate-300 text-[11px]">
                  <span className="text-slate-400">Details: </span>{activeSos.details}
                </div>
              )}
            </div>

            {isSafetyOfficer ? (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleClose}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Close Window
                  </button>
                  <button
                    onClick={() => {
                      if (setActiveSos) setActiveSos(null);
                      localStorage.removeItem('evacroute_active_sos');
                    }}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl text-xs font-semibold flex items-center space-x-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Send New SOS</span>
                  </button>
                </div>

                <button
                  onClick={async () => {
                    try {
                      await resolveSosRequest(activeSos.id);
                      handleClose();
                    } catch (e) {
                      console.warn('Could not resolve SOS:', e);
                      handleClose();
                    }
                  }}
                  className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
                >
                  Mark Rescued / Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 pt-2">
                <span className="text-xs text-slate-400">
                  Viewing active emergency SOS status broadcast by Campus Safety Command.
                </span>
                <button
                  onClick={handleClose}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Close Window
                </button>
              </div>
            )}
          </div>
        ) : isSafetyOfficer ? (
          /* ================= SAFETY OFFICER TRANSMIT SOS FORM ================= */
          <div className="py-4 space-y-4">
            
            {/* Auto-detected location summary pill */}
            <div className="bg-slate-950/80 p-3 rounded-xl border border-white/[0.08] flex items-center justify-between text-xs">
              <span className="text-slate-400">Current Fixed Location:</span>
              <span className="font-bold text-blue-400">{selectedFloor} • {roomLabel}</span>
            </div>

            {/* 1-Click Situation Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Select Your Emergency Situation (1-Click):
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
                      className={`p-3 rounded-xl border text-left transition-all flex items-start space-x-2.5 cursor-pointer ${
                        isSelected
                          ? 'bg-red-950/80 border-red-500 shadow-md shadow-red-950/50 text-white ring-1 ring-red-500 evac-btn-inset'
                          : 'bg-white/[0.03] border-white/[0.08] text-slate-300 hover:bg-white/[0.06]'
                      }`}
                    >
                      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isSelected ? 'text-red-400' : 'text-slate-400'}`} />
                      <div>
                        <div className="font-bold text-xs">{opt.label}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">{opt.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Optional Short Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Additional Details (Optional - do not delay sending):
              </label>
              <input
                type="text"
                placeholder="e.g., 2 occupants trapped, heavy black smoke near door"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-white/[0.1] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
              />
            </div>

            {/* Large Red Transmit Button */}
            <div className="pt-2">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full py-3.5 bg-red-600 hover:bg-red-500 active:bg-red-700 disabled:opacity-50 text-white rounded-xl font-extrabold text-sm tracking-wider uppercase shadow-xl shadow-red-600/40 flex items-center justify-center space-x-2 transition-all evac-btn-inset cursor-pointer"
              >
                <AlertOctagon className="w-5 h-5" />
                <span>{submitting ? 'Transmitting Distress Signal...' : 'TRANSMIT EMERGENCY SOS NOW'}</span>
              </button>
            </div>

            {/* Direct 24/7 Phone Fallback */}
            <div className="flex items-center justify-center space-x-2 text-[11px] text-slate-400 pt-1">
              <PhoneCall className="w-3.5 h-3.5 text-red-400" />
              <span>Campus Police Emergency Dispatch: <strong>+1-555-019-SAFE</strong></span>
            </div>

          </div>
        ) : (
          /* ================= STUDENT VIEW-ONLY S.O.S. STATUS PANEL ================= */
          <div className="py-4 space-y-4">
            <div className="bg-slate-950/80 p-4 rounded-xl border border-white/[0.08] space-y-2.5">
              <div className="flex items-center space-x-2 text-blue-400 font-bold text-sm">
                <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                <span>Campus SOS Monitor</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Campus SOS broadcasts are reserved for Safety Officers. To report immediate life safety hazards, contact Campus Security at <strong className="text-red-300 font-mono">+1-555-019-SAFE</strong>. If you are trapped in a room, submit an Occupant Distress Signal in the sidebar.
              </p>
            </div>

            {/* Location snapshot */}
            <div className="bg-slate-900/60 p-3 rounded-xl border border-white/[0.06] flex items-center justify-between text-xs">
              <span className="text-slate-400">Your Current Monitored Location:</span>
              <span className="font-bold text-blue-400">{selectedFloor} • {roomLabel}</span>
            </div>

            {/* Life safety guidance for occupants */}
            <div className="p-3.5 bg-red-950/30 border border-red-500/30 rounded-xl text-xs space-y-1.5 text-red-200">
              <span className="font-bold uppercase tracking-wider block text-red-300">If You Require Immediate Rescue:</span>
              <p className="text-slate-300 leading-relaxed">
                If you are trapped or in danger, immediately dial Campus Emergency Dispatch or pull the nearest wall fire alarm. Stay low to the floor and seal doors against smoke.
              </p>
            </div>

            {/* Direct Dispatch Phone Hotline */}
            <div className="flex items-center justify-center space-x-2 text-xs text-slate-300 py-1 bg-slate-900/80 border border-slate-700/60 rounded-xl p-3">
              <PhoneCall className="w-4 h-4 text-red-400 animate-pulse flex-shrink-0" />
              <span>Campus Emergency Dispatch: <strong className="text-white font-mono">+1-555-019-SAFE</strong></span>
            </div>

            {/* Close Action Button */}
            <div className="pt-2 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Switch to Command mode to test Safety Officer SOS transmission.
              </span>
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
              >
                Close Window
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
