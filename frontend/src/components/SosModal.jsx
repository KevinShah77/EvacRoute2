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
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white max-w-lg w-full rounded-xl border border-slate-200 shadow-xl overflow-hidden p-5 sm:p-6 relative text-slate-900">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-red-100 text-red-700">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 tracking-tight">
                {isSafetyOfficer ? 'Campus Emergency S.O.S.' : 'Campus S.O.S. Monitor'}
              </h3>
              <p className="text-xs text-slate-500">
                {isSafetyOfficer 
                  ? 'Immediate distress broadcast for active fire or structural damage'
                  : 'Broadcasts reserved for Safety Officers • Monitored life-safety channel'}
              </p>
            </div>
          </div>
          <button onClick={handleClose} title="Close SOS Modal" aria-label="Close SOS Modal" className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ================= ACTIVE TRANSMITTED STATE ================= */}
        {activeSos ? (
          <div className="py-4 space-y-4">
            <div className={`p-3.5 rounded-lg border text-sm flex items-start space-x-3 ${
              activeSos.status === 'acknowledged'
                ? 'bg-emerald-50 border-emerald-200 text-slate-800'
                : 'bg-red-50 border-red-200 text-slate-800'
            }`}>
              {activeSos.status === 'acknowledged' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              ) : (
                <Clock className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5 animate-spin" />
              )}
              <div>
                <h4 className="font-bold text-sm text-slate-900">
                  {activeSos.status === 'acknowledged' 
                    ? 'SOS ACKNOWLEDGED – RESCUE EN ROUTE' 
                    : 'SOS TRANSMITTED – DISPATCHING FIRST RESPONDERS'}
                </h4>
                <p className="text-xs mt-1 leading-relaxed text-slate-600">
                  {activeSos.status === 'acknowledged' 
                    ? `Safety Command "${activeSos.acknowledged_by || 'Campus Security'}" has acknowledged the distress signal. Rescue units are advancing to the coordinates.`
                    : 'Distress signal and room coordinates are broadcast to Security Operations Center. First responders are actively en route.'
                  }
                </p>
              </div>
            </div>

            {/* Life-Safety Advice Box */}
            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs space-y-2">
              <span className="font-bold text-amber-800 uppercase tracking-wider block">Immediate Life-Safety Instructions:</span>
              <ul className="list-disc list-inside space-y-1 text-slate-600">
                <li>Stay low to the ground where breathable air settles.</li>
                <li>Seal door cracks with clothing or damp fabrics to block smoke.</li>
                <li>Do NOT open doors if the knob feels hot to the touch.</li>
                <li>Wave a bright object or phone flashlight at any exterior window.</li>
              </ul>
            </div>

            {/* Location & Details Snapshot */}
            <div className="space-y-1.5 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Emergency Situation:</span>
                <span className="font-bold text-red-700 uppercase tracking-wide">
                  {activeSos.situation === 'structural' 
                    ? 'Structural Damage / Collapse' 
                    : activeSos.situation === 'BLOCKED' || activeSos.situation === 'trapped'
                      ? 'Trapped in Room'
                      : 'Active Fire Emergency'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Transmitted Location:</span>
                <span className="font-bold text-slate-900">{activeSos.floor} • {activeSos.location}</span>
              </div>
              {activeSos.user_name && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Transmitted By:</span>
                  <span className="font-semibold text-blue-700">{activeSos.user_name}</span>
                </div>
              )}
              {activeSos.details && (
                <div className="pt-1 border-t border-slate-200 text-slate-600 text-[11px]">
                  <span className="text-slate-500">Details: </span>{activeSos.details}
                </div>
              )}
            </div>

            {isSafetyOfficer ? (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleClose}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Close Window
                  </button>
                  <button
                    onClick={() => {
                      if (setActiveSos) setActiveSos(null);
                      localStorage.removeItem('evacroute_active_sos');
                    }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-amber-700 rounded-lg text-xs font-semibold flex items-center space-x-1 cursor-pointer"
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
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                >
                  Mark Rescued / Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-xs text-slate-500">
                  Viewing active emergency SOS status broadcast by Campus Safety Command.
                </span>
                <button
                  onClick={handleClose}
                  className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Close Window
                </button>
              </div>
            )}
          </div>
        ) : isSafetyOfficer ? (
          /* ================= SAFETY OFFICER TRANSMIT SOS FORM ================= */
          <div className="py-3.5 space-y-3.5">
            
            {/* Auto-detected location summary pill */}
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-500">Current Fixed Location:</span>
              <span className="font-bold text-slate-900">{selectedFloor} • {roomLabel}</span>
            </div>

            {/* 1-Click Situation Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Select Your Emergency Situation:
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
                      className={`p-3 rounded-lg border text-left transition-colors flex items-start space-x-2.5 cursor-pointer ${
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Additional Details (Optional):
              </label>
              <input
                type="text"
                placeholder="e.g., 2 occupants trapped, heavy smoke near door"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-red-500"
              />
            </div>

            {/* Large Red Transmit Button */}
            <div className="pt-1">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:opacity-50 text-white rounded-lg font-bold text-xs tracking-wider uppercase shadow-xs flex items-center justify-center space-x-2 transition-colors cursor-pointer"
              >
                <AlertOctagon className="w-4 h-4" />
                <span>{submitting ? 'Transmitting Distress Signal...' : 'TRANSMIT EMERGENCY SOS NOW'}</span>
              </button>
            </div>

            {/* Direct 24/7 Phone Fallback */}
            <div className="flex items-center justify-center space-x-2 text-[11px] text-slate-500 pt-0.5">
              <PhoneCall className="w-3.5 h-3.5 text-red-500" />
              <span>Campus Police Emergency Dispatch: <strong className="text-slate-800">+1-555-019-SAFE</strong></span>
            </div>

          </div>
        ) : (
          /* ================= STUDENT VIEW-ONLY S.O.S. STATUS PANEL ================= */
          <div className="py-3.5 space-y-3.5">
            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2">
              <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
                <ShieldAlert className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span>Campus SOS Monitor</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Campus SOS broadcasts are reserved for Safety Officers. To report immediate life safety hazards, contact Campus Security at <strong className="text-slate-900 font-mono">+1-555-019-SAFE</strong>. If you are trapped in a room, submit an Occupant Distress Signal in the sidebar.
              </p>
            </div>

            {/* Location snapshot */}
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-500">Your Current Monitored Location:</span>
              <span className="font-bold text-slate-900">{selectedFloor} • {roomLabel}</span>
            </div>

            {/* Life safety guidance for occupants */}
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs space-y-1 text-red-950">
              <span className="font-bold uppercase tracking-wider block text-red-800">If You Require Immediate Rescue:</span>
              <p className="text-red-900/90 leading-relaxed">
                If you are trapped or in danger, immediately dial Campus Emergency Dispatch or pull the nearest wall fire alarm. Stay low to the floor and seal doors against smoke.
              </p>
            </div>

            {/* Direct Dispatch Phone Hotline */}
            <div className="flex items-center justify-center space-x-2 text-xs text-slate-700 py-1 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
              <PhoneCall className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span>Campus Emergency Dispatch: <strong className="text-slate-900 font-mono">+1-555-019-SAFE</strong></span>
            </div>

            {/* Close Action Button */}
            <div className="pt-1 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Switch to Command mode to test Safety Officer SOS transmission.
              </span>
              <button
                onClick={handleClose}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer"
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
