import React, { useState, useEffect } from 'react';
import { 
  X, 
  QrCode, 
  Camera, 
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
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 max-w-lg w-full rounded-2xl shadow-2xl overflow-hidden p-6 relative animate-in zoom-in-95 duration-200 text-slate-100">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">QR Code Scanner & Safe Arrival</h3>
              <p className="text-xs text-slate-400">Indoor positioning & assembly area check-in</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 my-4 text-xs">
          <button
            onClick={() => { setActiveTab('checkin'); setStatusMessage(null); }}
            className={`flex-1 py-2 rounded-lg font-bold transition-all flex items-center justify-center space-x-2 ${
              activeTab === 'checkin'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Assembly Check-In</span>
          </button>
          <button
            onClick={() => { setActiveTab('location'); setStatusMessage(null); }}
            className={`flex-1 py-2 rounded-lg font-bold transition-all flex items-center justify-center space-x-2 ${
              activeTab === 'location'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Door Location QR</span>
          </button>
        </div>

        {/* Status Message Banner */}
        {statusMessage && (
          <div className={`p-3 rounded-xl mb-4 text-xs flex items-start space-x-2 ${
            statusMessage.success 
              ? 'bg-emerald-950/90 border border-emerald-500 text-emerald-200' 
              : 'bg-red-950/90 border border-red-500 text-red-200'
          }`}>
            {statusMessage.success ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-400" />
            )}
            <span className="leading-snug">{statusMessage.text}</span>
          </div>
        )}

        {/* ================= TAB 1: ASSEMBLY CHECK-IN ================= */}
        {activeTab === 'checkin' && (
          <div className="space-y-4">
            
            {/* Live Check-in Stats Pill */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <span className="text-slate-300">Total Checked-In at Assembly Points:</span>
              </div>
              <span className="font-extrabold text-base text-emerald-400 font-mono">
                {checkinStats.total_checkins} Occupants Safe
              </span>
            </div>

            {/* Instruction */}
            <p className="text-xs text-slate-300 leading-relaxed">
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
                    className="w-full p-3 rounded-xl bg-slate-800/80 hover:bg-slate-750 border border-slate-700 text-left transition-all flex items-center justify-between group"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-2 rounded-lg bg-emerald-950 border border-emerald-600/40 text-emerald-400 group-hover:scale-105 transition-transform">
                        <Flag className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-xs text-white">{ap.name}</div>
                        <div className="text-[11px] text-slate-400">{ap.area} • Post #{ap.code}</div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/50">
                        {checkedCount} Safe
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-600 group-hover:bg-emerald-500 text-white font-bold text-xs shadow-sm">
                        Confirm Arrival
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Critical Section 2.F Disclaimer */}
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 leading-relaxed">
              <strong className="text-amber-400 block mb-0.5">Important Safety Protocol:</strong>
              An unconfirmed check-in does <span className="underline">NOT</span> automatically label someone as trapped or missing. Personnel will conduct roll-call sweeps.
            </div>

          </div>
        )}

        {/* ================= TAB 2: INDOOR DOOR LOCATION FIX ================= */}
        {activeTab === 'location' && (
          <div className="space-y-4">
            
            {/* Camera Reticle Viewport */}
            <div className="relative w-full h-36 bg-slate-950 rounded-xl border-2 border-dashed border-blue-500/40 flex flex-col items-center justify-center overflow-hidden">
              <div className="w-24 h-24 border-2 border-blue-400 rounded-lg relative flex items-center justify-center animate-pulse">
                <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-white"></div>
                <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 border-white"></div>
                <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 border-white"></div>
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-white"></div>
                <Camera className="w-8 h-8 text-blue-400/80" />
              </div>
              <span className="text-[10px] text-blue-400 mt-1.5 font-mono">SCAN ROOM / CORRIDOR DOOR QR CODE</span>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">
                Simulate Scanning Door Badges (No Indoor GPS Required):
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {doorQrs.map(item => (
                  <button
                    key={item.code}
                    onClick={() => handleScanDoorCode(item.code)}
                    className="text-left px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-xs font-medium text-slate-200 transition-colors flex items-center justify-between"
                  >
                    <span>{item.label}</span>
                    <QrCode className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 ml-1" />
                  </button>
                ))}
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
