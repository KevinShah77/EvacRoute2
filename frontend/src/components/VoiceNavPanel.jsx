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
      <div className="bg-white border border-slate-200 rounded-xl p-5 text-center text-slate-500 shadow-xs">
        <Radio className="w-5 h-5 mx-auto mb-2 text-slate-400 animate-spin" />
        <p className="text-xs font-medium">Calculating evacuation route...</p>
      </div>
    );
  }

  if (!routeResult.safe_route_found) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 shadow-xs text-red-950 space-y-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-red-600 text-white flex-shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-red-900">ALL EXITS BLOCKED</h3>
            <p className="text-xs text-red-800 mt-0.5">Corridors obstructed. Shelter in place & await rescue.</p>
          </div>
        </div>
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={speakHazardWarning}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center space-x-1.5"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Play Warning</span>
          </button>
          <span className="text-xs text-red-700 font-bold uppercase tracking-wider">Rescue Dispatched</span>
        </div>
      </div>
    );
  }

  const warningText = getShortHazardWarning 
    ? getShortHazardWarning() 
    : 'All clear. There is no active emergency.';
  const hasEmergency = Boolean(activeEmergency || (hazards && hazards.length > 0));

  return (
    <div className="flex flex-col space-y-3">
      
      {/* Short Voice Hazard Warning Card */}
      <div className={`p-3.5 rounded-lg border ${
        hasEmergency 
          ? 'bg-red-50/70 border-red-200 text-slate-900' 
          : 'bg-emerald-50/50 border-emerald-200 text-slate-900'
      }`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start space-x-3 min-w-0">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0 mt-0.5 shadow-xs ${
              hasEmergency ? 'bg-red-600' : 'bg-emerald-600'
            }`}>
              {hasEmergency ? <AlertTriangle className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Life-Safety Voice Advisory
              </div>
              <p className="text-xs sm:text-sm font-semibold text-slate-900 mt-0.5 leading-snug">
                {warningText}
              </p>
            </div>
          </div>
        </div>

        {/* Audio Action Buttons */}
        <div className="flex items-center justify-between gap-2 mt-3.5 pt-3 border-t border-slate-200/80">
          <div className="flex items-center space-x-2">
            {assistantStatus === 'SPEAKING' ? (
              <button
                onClick={stopNavigation}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs sm:text-sm font-bold flex items-center space-x-1.5 shadow-xs cursor-pointer"
              >
                <Square className="w-3.5 h-3.5" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                onClick={speakHazardWarning}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold shadow-xs flex items-center space-x-1.5 transition-colors cursor-pointer ${
                  hasEmergency 
                    ? 'bg-red-600 hover:bg-red-700 text-white' 
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                <Volume2 className="w-4 h-4" />
                <span>Play Voice Alert</span>
              </button>
            )}

            {/* Language Toggle: EN / हिन्दी */}
            <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg p-0.5 text-xs">
              <button
                onClick={() => setLanguage('en')}
                className={`px-2.5 py-1 rounded font-bold text-xs transition-colors cursor-pointer ${
                  language === 'en'
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage('hi')}
                className={`px-2.5 py-1 rounded font-bold text-xs transition-colors cursor-pointer ${
                  language === 'hi'
                    ? 'bg-white text-orange-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                हिन्दी
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={toggleMute}
              className={`p-2 rounded-lg border text-xs transition-colors cursor-pointer ${
                isMuted
                  ? 'bg-red-50 text-red-600 border-red-200'
                  : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900 hover:bg-slate-50'
              }`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
              assistantStatus === 'SPEAKING' ? 'bg-emerald-100 text-emerald-800 animate-pulse' :
              'bg-slate-100 text-slate-600'
            }`}>
              {assistantStatus}
            </span>
          </div>
        </div>

        {/* Dynamic Incident Notification Controls: ONLY FOR ADMIN */}
        {isAdmin && (
          <div className="mt-3.5 pt-3.5 border-t border-slate-200/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-800 flex items-center space-x-1.5">
                <Flame className="w-3.5 h-3.5 text-red-500" />
                <span>Admin Incident Alert Settings</span>
              </span>
              <span className="text-[10px] text-amber-700 font-mono bg-amber-50 px-2 py-0.5 rounded border border-amber-200">Admin Only</span>
            </div>

            <div className="space-y-2">
              <div>
                <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                  Cause:
                </label>
                <select
                  value={incidentCause}
                  onChange={handleCauseChange}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-red-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium outline-none transition-colors"
                >
                  <option value="fire">Fire Emergency</option>
                  <option value="smoke">Heavy Smoke</option>
                  <option value="gas">Gas Leakage</option>
                  <option value="structural">Structural Damage</option>
                  <option value="blocked">Blocked Corridor</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                  Room Number:
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={incidentRoom}
                    onChange={handleIncidentRoomChange}
                    onKeyDown={handleIncidentRoomKeyDown}
                    placeholder="e.g. 205, 208, 420..."
                    className="flex-1 min-w-0 bg-slate-50 border border-slate-200 focus:border-red-500 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-800 font-semibold placeholder-slate-400 outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      commitIncidentAlert(incidentCause, incidentRoom);
                    }}
                    onClick={() => commitIncidentAlert(incidentCause, incidentRoom)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs sm:text-sm font-bold shadow-xs transition-colors flex-shrink-0 cursor-pointer"
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
      <div className="p-4 bg-slate-50/50 text-xs space-y-2.5">
        <div className="flex items-center justify-between text-slate-700">
          <div className="flex items-center space-x-2">
            <DoorOpen className="w-4 h-4 text-emerald-600" />
            <span className="text-slate-500">Target Exit:</span>
            <strong className="text-slate-900">{routeResult.destination_node?.label || 'Safe Exit'}</strong>
          </div>
          {accessibleMode && (
            <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 font-semibold text-[10px]">
              ADA Route
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/80 text-slate-700">
          <div className="flex items-center space-x-2 bg-white p-2 rounded-lg border border-slate-200 shadow-xs">
            <Clock className="w-3.5 h-3.5 text-emerald-600" />
            <div>
              <div className="text-[10px] text-slate-500">Est. Time</div>
              <div className="font-mono font-bold text-slate-900 text-xs">{routeResult.rset_formatted}</div>
            </div>
          </div>
          <div className="flex items-center space-x-2 bg-white p-2 rounded-lg border border-slate-200 shadow-xs">
            <Footprints className="w-3.5 h-3.5 text-blue-600" />
            <div>
              <div className="text-[10px] text-slate-500">Distance</div>
              <div className="font-mono font-bold text-slate-900 text-xs">{routeResult.total_distance_meters} m</div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
