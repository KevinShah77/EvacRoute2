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
  const { user } = useAuth();
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

  // Current room label resolution (clean, no F2- prefix)
  const roomNode = topology?.nodes?.find(n => n.id === userLocationNode);
  const rawLabel = roomNode?.label || userLocationNode || '208';
  const roomLabel = cleanRoomNumber(rawLabel) || 'Room 208';

  if (!modalOpen) return null;

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setSubmitting(true);
    try {
      await sendSosSignal({
        floor: selectedFloor || 'Floor 2',
        location: roomLabel,
        node_id: userLocationNode || 'F2-208',
        situation: situation || 'fire',
        details: details.trim() || undefined,
        user_name: user?.full_name || 'Campus Occupant',
        user_role: user?.role || 'student',
        contact: user?.phone || '+1-555-014-STUD'
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
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border-2 border-red-600 max-w-lg w-full rounded-2xl shadow-2xl overflow-hidden p-6 relative animate-in zoom-in-95 duration-200 text-slate-100">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-red-800/50">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-red-600 text-white animate-pulse">
              <AlertOctagon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-white tracking-tight">
                CAMPUS EMERGENCY S.O.S.
              </h3>
              <p className="text-xs text-red-300">
                Immediate distress broadcast for active fire or structural damage
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="text-slate-400 hover:text-white p-1">
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
                    ? `Safety Command "${activeSos.acknowledged_by || 'Campus Security'}" has acknowledged your distress signal. Rescue team is advancing to your location.`
                    : 'Your distress signal and GPS/room coordinates have been broadcast to the Security Operations Center. Stand by.'
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

            {/* Location Snapshot */}
            <div className="flex items-center justify-between text-xs bg-slate-800/80 p-3 rounded-xl border border-slate-700">
              <span className="text-slate-400">Transmitted Location:</span>
              <span className="font-bold text-white">{activeSos.floor} • {activeSos.location}</span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleClose}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Close Window
                </button>
                <button
                  onClick={() => {
                    if (setActiveSos) setActiveSos(null);
                    localStorage.removeItem('evacroute_active_sos');
                  }}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl text-xs font-semibold flex items-center space-x-1"
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
                    alert('Error cancelling SOS');
                  }
                }}
                className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-md"
              >
                Mark Rescued / Cancel
              </button>
            </div>
          </div>
        ) : (
          /* ================= INITIAL QUICK-SUBMIT FORM ================= */
          <div className="py-4 space-y-4">
            
            {/* Auto-detected location summary pill */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
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
                      className={`p-3 rounded-xl border text-left transition-all flex items-start space-x-2.5 ${
                        isSelected
                          ? 'bg-red-950/80 border-red-500 shadow-md shadow-red-950/50 text-white ring-1 ring-red-500'
                          : 'bg-slate-800/80 border-slate-700/80 text-slate-300 hover:bg-slate-800'
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
                placeholder="e.g., 2 students trapped, heavy black smoke near door"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
              />
            </div>

            {/* Large Red Transmit Button */}
            <div className="pt-2">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full py-3.5 bg-red-600 hover:bg-red-500 active:bg-red-700 disabled:opacity-50 text-white rounded-xl font-extrabold text-sm tracking-wider uppercase shadow-xl shadow-red-600/40 flex items-center justify-center space-x-2 transition-all animate-bounce"
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
        )}

      </div>
    </div>
  );
}
