import React, { useState, useEffect } from 'react';
import { 
  Volume2, 
  VolumeX, 
  Square,
  AlertTriangle, 
  ShieldCheck, 
  Clock, 
  Footprints, 
  Radio,
  DoorOpen,
  Flame,
  Settings2
} from 'lucide-react';
import { useVoiceNavigation } from '../context/VoiceNavigationContext';
import { useEmergency } from '../context/EmergencyContext';
import { useAuth } from '../context/AuthContext';

export default function VoiceNavPanel() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const { 
    isMuted, 
    language,
    setLanguage,
    assistantStatus,
    getShortHazardWarning,
    speakHazardWarning,
    stopNavigation,
    toggleMute 
  } = useVoiceNavigation();

  const { 
    routeResult, 
    accessibleMode, 
    activeEmergency, 
    hazards,
    updateEmergencyIncident 
  } = useEmergency();

  const [incidentCause, setIncidentCause] = useState(() => {
    return activeEmergency?.emergency_type || 'fire';
  });

  const [incidentRoom, setIncidentRoom] = useState(() => {
    const raw = activeEmergency?.location || '205';
    const match = String(raw).match(/\b(\d+[A-Za-z]?)\b/);
    return match ? match[1] : raw.replace(/^(F\d+|GF)[-_ ]+/i, '').replace(/^room\s*/i, '').trim();
  });

  // Only sync if activeEmergency changed from an external source
  const prevEmergencyLocRef = React.useRef(activeEmergency?.location);
  useEffect(() => {
    if (activeEmergency?.emergency_type) {
      setIncidentCause(activeEmergency.emergency_type);
    }
    if (activeEmergency?.location && activeEmergency.location !== prevEmergencyLocRef.current) {
      prevEmergencyLocRef.current = activeEmergency.location;
      const match = String(activeEmergency.location).match(/\b(\d+[A-Za-z]?)\b/);
      const clean = match ? match[1] : activeEmergency.location.replace(/^(F\d+|GF)[-_ ]+/i, '').replace(/^room\s*/i, '').trim();
      setIncidentRoom(clean);
    }
  }, [activeEmergency]);

  const commitIncidentAlert = (causeVal, roomVal) => {
    const finalCause = causeVal !== undefined ? causeVal : incidentCause;
    const finalRoom = (roomVal !== undefined ? roomVal : incidentRoom).trim();
    if (!finalRoom) return;
    if (updateEmergencyIncident) {
      prevEmergencyLocRef.current = `Room ${finalRoom}`;
      updateEmergencyIncident({ emergencyType: finalCause, roomInput: finalRoom });
    }
  };

  const handleCauseChange = (e) => {
    const newCause = e.target.value;
    setIncidentCause(newCause);
    commitIncidentAlert(newCause, incidentRoom);
  };

  const handleIncidentRoomChange = (e) => {
    setIncidentRoom(e.target.value);
  };

  const handleIncidentRoomKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitIncidentAlert(incidentCause, incidentRoom);
    }
  };

  if (!routeResult) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center text-slate-400">
        <Radio className="w-6 h-6 mx-auto mb-2 text-slate-500 animate-spin" />
        <p className="text-xs">Calculating evacuation route...</p>
      </div>
    );
  }

  if (!routeResult.safe_route_found) {
    return (
      <div className="bg-red-950/80 border border-red-600 rounded-2xl p-4 shadow-xl text-red-100 space-y-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-red-600 text-white animate-bounce flex-shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-white">ALL EXITS BLOCKED</h3>
            <p className="text-xs text-red-300">Corridors obstructed. Shelter in place & await rescue.</p>
          </div>
        </div>
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={speakHazardWarning}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold shadow flex items-center space-x-1.5"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Play Warning</span>
          </button>
          <span className="text-xs text-red-300 font-bold">RESCUE DISPATCHED</span>
        </div>
      </div>
    );
  }

  const warningText = getShortHazardWarning 
    ? getShortHazardWarning() 
    : 'All clear. There is no active emergency.';
  const hasEmergency = Boolean(activeEmergency || (hazards && hazards.length > 0));

  return (
    <div className="evac-card overflow-hidden flex flex-col shadow-xl">
      
      {/* Short Voice Hazard Warning Card */}
      <div className={`p-4 sm:p-5 border-b transition-all ${
        hasEmergency 
          ? 'bg-gradient-to-br from-red-950/80 to-slate-900 border-red-500/30 text-red-100' 
          : 'bg-gradient-to-br from-emerald-950/50 to-slate-900 border-emerald-500/20 text-emerald-100'
      }`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start space-x-3 min-w-0">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white flex-shrink-0 mt-0.5 shadow-md ${
              hasEmergency ? 'bg-red-600 animate-pulse shadow-red-600/40' : 'bg-emerald-600 shadow-emerald-600/40'
            }`}>
              {hasEmergency ? <AlertTriangle className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Life-Safety Voice Advisory
              </div>
              <p className="text-xs sm:text-sm font-bold text-white mt-0.5 leading-snug">
                {warningText}
              </p>
            </div>
          </div>
        </div>

        {/* Audio Action Buttons */}
        <div className="flex items-center justify-between gap-2 mt-3.5 pt-3 border-t border-white/[0.08]">
          <div className="flex items-center space-x-2">
            {assistantStatus === 'SPEAKING' ? (
              <button
                onClick={stopNavigation}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-full text-xs font-bold border border-white/[0.1] flex items-center space-x-1.5 transition-all shadow-sm"
              >
                <Square className="w-3.5 h-3.5" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                onClick={speakHazardWarning}
                className={`px-4 py-1.5 rounded-full text-xs font-bold shadow flex items-center space-x-1.5 transition-all evac-btn-inset ${
                  hasEmergency 
                    ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-red-600/30' 
                    : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/30'
                }`}
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Play Voice Alert</span>
              </button>
            )}

            {/* Language Toggle: EN / हिन्दी */}
            <div className="flex items-center bg-slate-950/80 border border-white/[0.08] rounded-full p-0.5 text-xs">
              <button
                onClick={() => setLanguage('en')}
                className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] transition-all ${
                  language === 'en'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage('hi')}
                className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] transition-all ${
                  language === 'hi'
                    ? 'bg-orange-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                हिन्दी
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={toggleMute}
              className={`p-1.5 rounded-full border text-xs transition-all ${
                isMuted
                  ? 'bg-red-900/40 text-red-400 border-red-700/50'
                  : 'bg-slate-900 text-slate-300 border-white/[0.08] hover:text-white hover:bg-slate-800'
              }`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
              assistantStatus === 'SPEAKING' ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 animate-pulse shadow-sm shadow-emerald-500/20' :
              'bg-slate-950/80 border-white/[0.08] text-slate-400'
            }`}>
              {assistantStatus}
            </span>
          </div>
        </div>

        {/* Dynamic Incident Notification Controls: ONLY FOR ADMIN */}
        {isAdmin && (
          <div className="mt-3.5 pt-3.5 border-t border-red-800/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-300 flex items-center space-x-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>Admin Incident Alert Settings</span>
              </span>
              <span className="text-[10px] text-amber-400/90 font-mono bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-500/30">Admin Only</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-semibold text-slate-400 block mb-1">
                  Cause:
                </label>
                <select
                  value={incidentCause}
                  onChange={handleCauseChange}
                  className="w-full bg-slate-950/90 border border-white/[0.1] focus:border-red-500 rounded-xl px-2.5 py-1.5 text-xs text-white font-medium outline-none transition-colors"
                >
                  <option value="fire">Fire Emergency</option>
                  <option value="smoke">Heavy Smoke</option>
                  <option value="gas">Gas Leakage</option>
                  <option value="structural">Structural Damage</option>
                  <option value="blocked">Blocked Corridor</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-400 block mb-1">
                  Room Number:
                </label>
                <div className="flex items-center space-x-1.5">
                  <input
                    type="text"
                    value={incidentRoom}
                    onChange={handleIncidentRoomChange}
                    onKeyDown={handleIncidentRoomKeyDown}
                    placeholder="e.g. 205, 208, 420..."
                    className="flex-1 bg-slate-950/90 border border-white/[0.1] focus:border-red-500 rounded-xl px-2.5 py-1.5 text-xs text-white font-medium placeholder-slate-500 outline-none shadow-inner transition-colors"
                  />
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      commitIncidentAlert(incidentCause, incidentRoom);
                    }}
                    onClick={() => commitIncidentAlert(incidentCause, incidentRoom)}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex-shrink-0 cursor-pointer"
                    title="Apply Incident Room"
                  >
                    Set
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Concise Route Overview */}
      <div className="p-4 sm:p-5 bg-slate-900/60 text-xs space-y-3">
        <div className="flex items-center justify-between text-slate-300">
          <div className="flex items-center space-x-2">
            <DoorOpen className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-400">Target Exit:</span>
            <strong className="text-white">{routeResult.destination_node?.label || 'Safe Exit'}</strong>
          </div>
          {accessibleMode && (
            <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-600 text-cyan-300 font-semibold text-[10px]">
              ADA Route
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800 text-slate-300">
          <div className="flex items-center space-x-2 bg-slate-950 p-2 rounded-xl border border-slate-800/80">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            <div>
              <div className="text-[10px] text-slate-400">Est. Time</div>
              <div className="font-mono font-bold text-white text-xs">{routeResult.rset_formatted}</div>
            </div>
          </div>
          <div className="flex items-center space-x-2 bg-slate-950 p-2 rounded-xl border border-slate-800/80">
            <Footprints className="w-3.5 h-3.5 text-blue-400" />
            <div>
              <div className="text-[10px] text-slate-400">Distance</div>
              <div className="font-mono font-bold text-white text-xs">{routeResult.total_distance_meters} m</div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
