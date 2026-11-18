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
  const { user, role } = useAuth();
  const isSafetyOfficer = role === 'admin' || user?.role === 'admin';
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
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3 overflow-hidden">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-center justify-center flex-shrink-0">
            <Radio className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-sm text-slate-900 tracking-tight">Distress Signal</h3>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-red-100 text-red-800 tracking-wider">
                Direct Dispatch
              </span>
            </div>
            <p className="text-[11px] text-slate-500 truncate">
              Blocked or trapped? Alert Safety Command
            </p>
          </div>
        </div>
      </div>

      {/* ================= ACTIVE TRANSMITTED STATE ================= */}
      {activeSos ? (
        <div className="space-y-3">
          <div className={`p-3.5 rounded-lg border text-xs space-y-2 ${
            activeSos.status === 'acknowledged'
              ? 'bg-emerald-50 border-emerald-200 text-slate-800'
              : 'bg-red-50 border-red-200 text-slate-800'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 font-bold text-xs sm:text-sm text-slate-900">
                {activeSos.status === 'acknowledged' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                ) : (
                  <Clock className="w-4 h-4 text-red-600 flex-shrink-0 animate-spin" />
                )}
                <span>
                  {activeSos.status === 'acknowledged' 
                    ? 'DISTRESS ACKNOWLEDGED – RESCUE EN ROUTE' 
                    : 'DISTRESS SIGNAL ACTIVE – DISPATCHING'}
                </span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                activeSos.status === 'acknowledged'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {activeSos.status}
              </span>
            </div>

            <div className="text-[11px] text-slate-700 space-y-1">
              <div>
                Occupant: <strong className="text-slate-900">{studentName || 'Student'}</strong>
              </div>
              <div>
                Blocked Location: <strong className="text-slate-900">{activeSos.floor} • {activeSos.location}</strong>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed mt-1">
                {activeSos.status === 'acknowledged'
                  ? `Safety Officer acknowledged your alert. Rescue units are advancing to ${activeSos.location}. Keep calm and stay low.`
                  : 'Your distress signal has been broadcast directly to the Safety Officer’s console. Stand by.'
                }
              </p>
            </div>
          </div>

          {/* Quick Life Safety Advice Pill */}
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
            <span>Keep doors sealed to block smoke</span>
            <span className="font-bold text-amber-700">Stay Low</span>
          </div>

          {/* Action Buttons: Cancel / Send New */}
          <div className="flex items-center space-x-2 pt-1">
            <button
              type="button"
              onClick={handleCancelDistress}
              className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs sm:text-sm font-bold transition-colors shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Mark Rescued / Safe</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (setActiveSos) setActiveSos(null);
                localStorage.removeItem('evacroute_active_sos');
                setSubmitSuccess(false);
              }}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs sm:text-sm font-bold border border-slate-200 transition-colors flex items-center space-x-1.5 cursor-pointer"
              title="Send another distress update"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Update</span>
            </button>
          </div>
        </div>
      ) : (
        /* ================= OCCUPANT ROOM-TRAPPED DISTRESS DISPATCH FORM ================= */
        <form onSubmit={handleSendDistress} className="space-y-3.5 text-xs">
          
          {submitError && (
            <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs font-semibold">
              ⚠️ {submitError}
            </div>
          )}

          {/* 1. Occupant Name Box */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1.5">
              <User className="w-3.5 h-3.5 text-blue-600" />
              <span>{isSafetyOfficer ? 'Occupant / Reporter Name:' : 'Your Name:'}</span>
            </label>
            <input
              type="text"
              required
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="e.g. Alex Chen"
              className="w-full bg-slate-50 border border-slate-200 focus:border-red-500 focus:bg-white rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 font-semibold outline-none transition-colors"
            />
          </div>

          {/* 2. Blocked Room Box */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1.5">
                <DoorClosed className="w-3.5 h-3.5 text-red-600" />
                <span>{isSafetyOfficer ? 'Blocked Room Number:' : 'What room are you in?'}</span>
              </label>
              <span className="text-[11px] text-slate-400">e.g. 208, 205</span>
            </div>
            <input
              type="text"
              required
              value={blockedRoom}
              onChange={(e) => setBlockedRoom(e.target.value)}
              placeholder="Enter room number (e.g. 208)..."
              className="w-full bg-slate-50 border border-slate-200 focus:border-red-500 focus:bg-white rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 font-semibold outline-none transition-colors"
            />
          </div>

          {/* 3. Emergency Condition Test Cases */}
          <div className="space-y-1.5 pt-0.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
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
                    className={`py-2 px-3 rounded-lg text-xs sm:text-sm font-bold transition-colors truncate text-center cursor-pointer ${
                      isSelected
                        ? 'bg-red-600 text-white shadow-xs'
                        : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
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
            <label className="text-[11px] font-semibold text-slate-500 block">
              Additional Details (Optional):
            </label>
            <input
              type="text"
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              placeholder="e.g. 2 occupants, heavy smoke"
              className="w-full bg-slate-50 border border-slate-200 focus:border-red-500 focus:bg-white rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors"
            />
          </div>

          {/* 4. Large Distress Button */}
          <div className="pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 sm:py-3 bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:opacity-50 text-white font-bold text-xs sm:text-sm tracking-wider uppercase rounded-lg shadow-sm flex items-center justify-center space-x-2 transition-colors cursor-pointer"
            >
              <AlertOctagon className="w-4 h-4 flex-shrink-0" />
              <span>{submitting ? 'Transmitting Distress Call...' : 'SEND DISTRESS SIGNAL'}</span>
            </button>
          </div>

          {/* Safety Dispatch Hotline */}
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1.5 border-t border-slate-100">
            <span className="flex items-center space-x-1">
              <PhoneCall className="w-3 h-3 text-red-500" />
              <span>Police Emergency:</span>
            </span>
            <strong className="text-slate-800 font-mono">100</strong>
          </div>

        </form>
      )}

    </div>
  );
}
