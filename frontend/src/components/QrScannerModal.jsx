import React, { useState, useEffect } from 'react';
import { 
  X, 
  QrCode, 
  CheckCircle2, 
  AlertCircle, 
  Flag, 
  MapPin, 
  Users, 
  ShieldCheck,
  Building
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useEmergency } from '../context/EmergencyContext';
import { emergencyWS } from '../services/websocket';

export default function QrScannerModal({ isOpen, onClose }) {
  const { user } = useAuth();
  const { selectUserLocation } = useEmergency();

  const [activeTab, setActiveTab] = useState('checkin'); // 'checkin' | 'location'
  const [statusMessage, setStatusMessage] = useState(null);
  const [checkinStats, setCheckinStats] = useState({ total_checkins: 0, by_assembly: {} });
  const [submittingCheckin, setSubmittingCheckin] = useState(false);

  // Load check-in statistics
  const fetchCheckinStats = async () => {
    try {
      const data = await api.getCheckins();
      setCheckinStats(data);
    } catch (e) {
      console.warn('Could not load checkin stats:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchCheckinStats();
    }
  }, [isOpen]);

  // WebSocket checkin updates
  useEffect(() => {
    const unsub = emergencyWS.on('NEW_CHECKIN', (data) => {
      setCheckinStats(prev => ({
        ...prev,
        total_checkins: data.total_checkins,
      }));
    });
    return () => unsub();
  }, []);

  if (!isOpen) return null;

  // Assembly Point Check-in handler
  const handleAssemblyCheckin = async (assemblyPointId, assemblyPointName) => {
    setSubmittingCheckin(true);
    try {
      const res = await api.checkinAtAssembly({
        assembly_point_id: assemblyPointId,
        assembly_point_name: assemblyPointName,
        user_name: user?.full_name || 'Alex Chen',
        user_email: user?.email || 'student@evacroute.edu',
        floor: 'Ground'
      });

      setStatusMessage({
        success: true,
        text: `SAFE ARRIVAL CONFIRMED: ${res.assembly_point}. Status registered with Safety Dispatch. Total Checked-In: ${res.total_checkins}`
      });
      fetchCheckinStats();
    } catch (err) {
      setStatusMessage({
        success: false,
        text: `Check-in failed: ${err.message}`
      });
    } finally {
      setSubmittingCheckin(false);
    }
  };

  // Door QR Code scanner for location fixing
  const handleScanDoorCode = async (code) => {
    try {
      const data = await api.resolveQrLocation(code);
      if (data.success) {
        selectUserLocation(data.resolved_node_id);
        setStatusMessage({
          success: true,
          text: `Position fixed: ${data.label} (${data.floor})`
        });
        setTimeout(() => {
          setStatusMessage(null);
          onClose();
        }, 1200);
      }
    } catch (err) {
      setStatusMessage({
        success: false,
        text: `Invalid QR code: ${err.message}`
      });
    }
  };

  const assemblyPoints = [
    { id: 'ASSEMBLY-MAIN', name: 'Assembly Point A (East Lawn)', area: 'East Lawn Grounds', code: 'QR-ASSEMBLY-MAIN' },
    { id: 'ASSEMBLY-WEST', name: 'Assembly Point B (West Sports Field)', area: 'Athletic Field', code: 'QR-ASSEMBLY-WEST' },
    { id: 'ASSEMBLY-NORTH', name: 'Assembly Point C (North Plaza)', area: 'North Entrance Plaza', code: 'QR-ASSEMBLY-NORTH' },
  ];

  const doorQrs = [
    { code: 'F2-205', label: 'Door QR: Room 205 (Floor 2)' },
    { code: 'F2-208', label: 'Door QR: Room 208 (Floor 2)' },
    { code: 'F2-220', label: 'Door QR: Central Library' },
    { code: 'GF-011', label: 'Door QR: Chemistry Lab (Ground)' },
    { code: 'F1-105', label: 'Door QR: Computer Lab (Floor 1)' }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white max-w-lg w-full rounded-xl border border-slate-200 shadow-xl overflow-hidden p-5 sm:p-6 relative text-slate-900">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">QR Code Scanner & Safe Arrival</h3>
              <p className="text-xs text-slate-500">Indoor positioning & assembly area check-in</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 my-4 text-xs">
          <button
            onClick={() => { setActiveTab('checkin'); setStatusMessage(null); }}
            className={`flex-1 py-1.5 rounded-md font-bold transition-colors flex items-center justify-center space-x-2 ${
              activeTab === 'checkin'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Assembly Check-In</span>
          </button>
          <button
            onClick={() => { setActiveTab('location'); setStatusMessage(null); }}
            className={`flex-1 py-1.5 rounded-md font-bold transition-colors flex items-center justify-center space-x-2 ${
              activeTab === 'location'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Door Location QR</span>
          </button>
        </div>

        {/* Status Message Banner */}
        {statusMessage && (
          <div className={`p-3 rounded-lg mb-4 text-xs flex items-start space-x-2 ${
            statusMessage.success 
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-900' 
              : 'bg-red-50 border border-red-200 text-red-900'
          }`}>
            {statusMessage.success ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-600" />
            )}
            <span className="leading-snug">{statusMessage.text}</span>
          </div>
        )}

        {/* ================= TAB 1: ASSEMBLY CHECK-IN ================= */}
        {activeTab === 'checkin' && (
          <div className="space-y-3.5">
            
            {/* Live Check-in Stats Pill */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-emerald-600" />
                <span className="text-slate-600">Total Checked-In at Assembly Points:</span>
              </div>
              <span className="font-bold text-sm text-emerald-700 font-mono">
                {checkinStats.total_checkins} Occupants Safe
              </span>
            </div>

            {/* Instruction */}
            <p className="text-xs text-slate-600 leading-relaxed">
              When you safely exit the building and reach an outdoor assembly zone, scan or select the designated assembly QR code below to confirm your arrival:
            </p>

            {/* Assembly Point Buttons (Simulating QR scan at physical post) */}
            <div className="space-y-2">
              {assemblyPoints.map(ap => {
                const checkedCount = checkinStats.by_assembly?.[ap.name] || 0;
                return (
                  <button
                    key={ap.id}
                    onClick={() => handleAssemblyCheckin(ap.id, ap.name)}
                    disabled={submittingCheckin}
                    className="w-full p-3 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-colors flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800">
                        <Flag className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-xs text-slate-900 group-hover:text-blue-600 transition-colors">{ap.name}</div>
                        <div className="text-[11px] text-slate-500">{ap.area} • Post #{ap.code}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {checkedCount} Safe
                      </span>
                      <span className="text-xs text-slate-500 group-hover:text-blue-600 font-semibold">Check In →</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Disclaimer */}
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-500 leading-relaxed">
              <strong className="text-amber-800 block mb-0.5">Safety Protocol:</strong>
              An unconfirmed check-in does not automatically label someone as trapped or missing. Personnel will conduct physical sweeps.
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        )}

        {/* ================= TAB 2: DOOR LOCATION QR CODES ================= */}
        {activeTab === 'location' && (
          <div className="space-y-3.5">
            <p className="text-xs text-slate-600 leading-relaxed">
              Select or simulate scanning indoor door placards to fix your current floor position:
            </p>

            <div className="space-y-2">
              {doorQrs.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleScanDoorCode(item.code)}
                  className="w-full p-3 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-colors flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                      <Building className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-slate-900 group-hover:text-blue-600 transition-colors">{item.label}</div>
                      <div className="text-[10px] text-slate-500 font-mono">Code: {item.code}</div>
                    </div>
                  </div>
                  <span className="text-xs text-blue-600 font-semibold group-hover:underline">Fix Position →</span>
                </button>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
