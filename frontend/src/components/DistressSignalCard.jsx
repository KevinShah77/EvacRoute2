import React, { useState, useEffect } from 'react';
import { 
  AlertOctagon, 
  Send, 
  CheckCircle2, 
  Clock, 
  RotateCcw, 
  User, 
  DoorClosed, 
  ShieldAlert, 
  PhoneCall,
  Flame,
  Radio
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useEmergency } from '../context/EmergencyContext';
import { cleanRoomNumber } from '../context/VoiceNavigationContext';

export default function DistressSignalCard() {
  const { user } = useAuth();
  const { 
    selectedFloor, 
    userLocationNode, 
    topology,
    sendSosSignal,
    activeSos,
    setActiveSos,
    resolveSosRequest
  } = useEmergency();

  // Pre-fill user name and room if available
  const [studentName, setStudentName] = useState(() => user?.full_name || 'Alex Chen');
  const [blockedRoom, setBlockedRoom] = useState(() => {
    if (userLocationNode) {
      return userLocationNode.replace(/^(F\d+|GF)[-_ ]+/i, '');
    }
    return '208';
  });
  const [situationType, setSituationType] = useState('BLOCKED'); // 'BLOCKED' | 'FIRE' | 'TRAPPED'
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Sync with user changes
  useEffect(() => {
    if (user?.full_name && (!studentName || studentName === 'Alex Chen')) {
      setStudentName(user.full_name);
    }
  }, [user]);

  // Sync with room selection if student hasn't typed their own
  useEffect(() => {
    if (userLocationNode && !blockedRoom) {
      setBlockedRoom(userLocationNode.replace(/^(F\d+|GF)[-_ ]+/i, ''));
    }
  }, [userLocationNode]);

  // Deduce floor from room input or topology node
  const deduceFloorAndLabel = (roomStr) => {
    const trimmed = (roomStr || '').trim();
    if (!trimmed) {
      return { floor: selectedFloor || 'Floor 2', label: 'Room 208', nodeId: null };
    }

    const allNodes = topology?.nodes || [];

    // Check exact node match
    const matchedNode = allNodes.find(n => {
      const cleanId = n.id.replace(/^(F\d+|GF)[-_ ]+/i, '').toLowerCase();
      const cleanLbl = (n.label || '').toLowerCase();
      return cleanId === trimmed.toLowerCase() || n.id.toLowerCase() === trimmed.toLowerCase() || cleanLbl.includes(trimmed.toLowerCase());
    });

    if (matchedNode) {
      return {
        floor: matchedNode.floor || selectedFloor || 'Floor 2',
        label: cleanRoomNumber(matchedNode.label) || `Room ${trimmed}`,
        nodeId: matchedNode.id
      };
    }

    // Heuristic floor parsing from room number
    let detectedFloor = selectedFloor || 'Floor 2';
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

  const handleSendDistress = async (e) => {
    e?.preventDefault();
    setSubmitError(null);

    const name = studentName.trim();
    const room = blockedRoom.trim();

    if (!name) {
      setSubmitError('Please enter your name.');
      return;
    }
    if (!room) {
      setSubmitError('Please enter the room number where you are blocked.');
      return;
    }

    setSubmitting(true);
    try {
      const { floor, label, nodeId } = deduceFloorAndLabel(room);
      const detailsMsg = additionalNotes.trim() 
        ? `BLOCKED OCCUPANT: ${additionalNotes.trim()}` 
        : `Student ${name} reported blocked in ${label} (${floor}). Emergency response requested.`;

      await sendSosSignal({
        user_name: name,
        user_role: 'student',
        floor: floor,
        location: label,
        node_id: nodeId,
        situation: situationType || 'BLOCKED',
        details: detailsMsg,
        contact: user?.phone || '+1-555-014-STUD'
      });

      setSubmitSuccess(true);
    } catch (err) {
      console.error('Error sending distress signal:', err);
      setSubmitError(err.message || 'Failed to dispatch distress signal. Please retry.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelDistress = async () => {
    if (activeSos?.id) {
      try {
        await resolveSosRequest(activeSos.id);
      } catch (e) {
        console.warn('Could not resolve SOS on backend:', e);
      }
    }
    if (setActiveSos) setActiveSos(null);
    localStorage.removeItem('evacroute_active_sos');
    setSubmitSuccess(false);
  };

  return (
    <div className="evac-card rounded-2xl p-4 sm:p-5 border border-red-500/30 shadow-[0_1px_2px_rgba(0,0,0,0.4),0_16px_36px_-12px_rgba(239,68,68,0.2)] space-y-4 relative overflow-hidden">
      
      {/* Decorative Red Ambient Glow */}
      <div className="absolute -top-12 -right-12 w-28 h-28 bg-red-600/15 rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between pb-1 relative z-10">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 shadow-sm animate-pulse">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-extrabold text-sm text-white tracking-tight">Distress Signal</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-600/90 text-white tracking-wider animate-pulse border border-red-400/30">
                Direct Dispatch
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Blocked or trapped? Alert Safety Command immediately
            </p>
          </div>
        </div>
      </div>

      {/* ================= ACTIVE TRANSMITTED STATE ================= */}
      {activeSos ? (
        <div className="space-y-3 relative z-10">
          <div className={`p-3.5 rounded-xl border text-xs space-y-2 ${
            activeSos.status === 'acknowledged'
              ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200'
              : 'bg-red-950/60 border-red-500/60 text-red-200 animate-pulse'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 font-black tracking-tight text-white text-xs sm:text-sm">
                {activeSos.status === 'acknowledged' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                ) : (
                  <Clock className="w-4 h-4 text-red-400 flex-shrink-0 animate-spin" />
                )}
                <span>
                  {activeSos.status === 'acknowledged' 
                    ? 'DISTRESS ACKNOWLEDGED – RESCUE EN ROUTE' 
                    : 'DISTRESS SIGNAL ACTIVE – DISPATCHING'}
                </span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                activeSos.status === 'acknowledged'
                  ? 'bg-emerald-900 text-emerald-200 border border-emerald-500/40'
                  : 'bg-red-900 text-red-200 border border-red-500/40'
              }`}>
                {activeSos.status}
              </span>
            </div>

            <div className="text-[11px] text-slate-300 space-y-1">
              <div>
                Occupant: <strong className="text-white">{studentName || 'Student'}</strong>
              </div>
              <div>
                Blocked Location: <strong className="text-white">{activeSos.floor} • {activeSos.location}</strong>
              </div>
              <p className="text-[10px] text-slate-300 leading-relaxed mt-1">
                {activeSos.status === 'acknowledged'
                  ? `Safety Officer acknowledged your alert. Rescue units are advancing to ${activeSos.location}. Keep calm and stay low.`
                  : 'Your distress signal has been broadcast directly to the Safety Officer’s console. Stand by.'
                }
              </p>
            </div>
          </div>

          {/* Quick Life Safety Advice Pill */}
          <div className="p-2.5 rounded-xl bg-slate-950/80 border border-white/[0.08] text-[11px] text-slate-400 flex items-center justify-between">
            <span>Keep doors sealed to block smoke</span>
            <span className="font-bold text-amber-400">Stay Low</span>
          </div>

          {/* Action Buttons: Cancel / Send New */}
          <div className="flex items-center space-x-2 pt-1">
            <button
              type="button"
              onClick={handleCancelDistress}
              className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center space-x-1 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Mark Rescued / Safe</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (setActiveSos) setActiveSos(null);
                localStorage.removeItem('evacroute_active_sos');
                setSubmitSuccess(false);
              }}
              className="px-3 py-2 bg-slate-900/80 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold border border-white/[0.08] transition-all flex items-center space-x-1 cursor-pointer"
              title="Send another distress update"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Update</span>
            </button>
          </div>
        </div>
      ) : (
        /* ================= FORM INPUT STATE ================= */
        <form onSubmit={handleSendDistress} className="space-y-3 relative z-10 text-xs">
          
          {submitError && (
            <div className="p-2.5 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-[11px] font-semibold">
              ⚠️ {submitError}
            </div>
          )}

          {/* 1. Student Name Box */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-300 flex items-center space-x-1.5">
              <User className="w-3.5 h-3.5 text-blue-400" />
              <span>Enter Your Name:</span>
            </label>
            <input
              type="text"
              required
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="e.g. Alex Chen"
              className="w-full bg-slate-950/80 border border-white/[0.1] focus:border-red-400 focus:ring-2 focus:ring-red-500/20 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 font-semibold outline-none transition-all shadow-inner"
            />
          </div>

          {/* 2. Blocked Room Box */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-slate-300 flex items-center space-x-1.5">
                <DoorClosed className="w-3.5 h-3.5 text-red-400" />
                <span>What room are you blocked in?</span>
              </label>
              <span className="text-[10px] text-slate-400">e.g. 208, 205, 310</span>
            </div>
            <input
              type="text"
              required
              value={blockedRoom}
              onChange={(e) => setBlockedRoom(e.target.value)}
              placeholder="Enter room number (e.g. 208, 205, 105)..."
              className="w-full bg-slate-950/80 border border-white/[0.1] focus:border-red-400 focus:ring-2 focus:ring-red-500/20 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 font-semibold outline-none transition-all shadow-inner"
            />
          </div>

          {/* 3. Emergency Condition Test Cases (2 options) */}
          <div className="space-y-1 pt-0.5">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Emergency Condition:
            </span>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'BLOCKED', label: 'Blocked in Room' },
                { id: 'FIRE', label: 'Active Fire / Smoke' },
              ].map(opt => {
                const isSelected = situationType === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSituationType(opt.id)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all truncate text-center ${
                      isSelected
                        ? 'bg-red-600 text-white shadow-md shadow-red-600/30 border border-red-400/50 evac-btn-inset'
                        : 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white border border-white/[0.08]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional Short Note */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-slate-400 block">
              Additional Details (Optional):
            </label>
            <input
              type="text"
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              placeholder="e.g. 2 occupants, heavy smoke outside door"
              className="w-full bg-slate-950/80 border border-white/[0.08] focus:border-red-400 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-600 outline-none transition-all"
            />
          </div>

          {/* 4. Large Distress Button */}
          <div className="pt-1.5">
            <button
              type="submit"
              disabled={submitting}
              className="evac-btn-inset w-full py-3 bg-red-600 hover:bg-red-500 active:bg-red-700 disabled:opacity-50 text-white font-extrabold text-xs sm:text-sm tracking-wider uppercase rounded-xl shadow-lg shadow-red-600/40 flex items-center justify-center space-x-2 transition-all cursor-pointer"
            >
              <AlertOctagon className="w-4 h-4 animate-pulse flex-shrink-0" />
              <span>{submitting ? 'Transmitting Distress Call...' : 'SEND DISTRESS SIGNAL'}</span>
            </button>
          </div>

          {/* Safety Dispatch Hotline */}
          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
            <span className="flex items-center space-x-1">
              <PhoneCall className="w-3 h-3 text-red-400" />
              <span>Campus Police Emergency:</span>
            </span>
            <strong className="text-red-300 font-mono">+1-555-019-SAFE</strong>
          </div>

        </form>
      )}

    </div>
  );
}
