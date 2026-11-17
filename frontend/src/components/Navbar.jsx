import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  ShieldAlert, 
  Map, 
  LayoutDashboard, 
  PlayCircle, 
  Bell, 
  Radio,
  AlertOctagon
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useEmergency } from '../context/EmergencyContext';
import { requestNotificationPermissionAndSubscribe } from '../services/pushNotifications';

export default function Navbar() {
  const { role, quickDemoLogin } = useAuth();
  const { activeEmergency, openSosModal } = useEmergency();
  const location = useLocation();
  const [subscribing, setSubscribing] = useState(false);
  const [pushStatus, setPushStatus] = useState(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );

  const handleEnablePush = async () => {
    setSubscribing(true);
    try {
      await requestNotificationPermissionAndSubscribe();
      setPushStatus(Notification.permission);
      alert('Emergency Push Notifications successfully enabled for this browser!');
    } catch (err) {
      alert(`Could not enable notifications: ${err.message}`);
    } finally {
      setSubscribing(false);
    }
  };

  // Streamlined Control Panel Navigation (Safety Command restricted strictly to admin)
  const navLinks = [
    { to: '/emergency', label: 'Evacuation Map', icon: Map },
    { to: '/simulation', label: 'Escape Simulation', icon: PlayCircle },
    { to: '/admin', label: 'Safety Command', icon: LayoutDashboard, adminOnly: true },
  ];

  const visibleNavLinks = navLinks.filter(link => !link.adminOnly || role === 'admin');

  return (
    <>
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/[0.07] shadow-lg shadow-black/20">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Logo & Emergency Pulse */}
            <div className="flex items-center space-x-3">
              <Link to="/emergency" className="flex items-center space-x-2.5 group">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                  activeEmergency 
                    ? 'bg-gradient-to-br from-red-500 to-red-700 text-white shadow-lg shadow-red-500/40 animate-pulse ring-1 ring-red-400/50' 
                    : 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/25 ring-1 ring-white/10'
                }`}>
                  <ShieldAlert className="w-5 h-5 drop-shadow" />
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-lg font-extrabold tracking-tight text-white group-hover:text-blue-400 transition-colors">
                    Evac<span className="text-red-500">Route</span>
                  </span>
                  <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold text-slate-400 bg-slate-900 border border-white/[0.08]">
                    Control Panel
                  </span>
                </div>
              </Link>

              {/* Live Status Pill */}
              <div className="hidden lg:flex items-center ml-3">
                {activeEmergency ? (
                  <div className="flex items-center space-x-2 px-3 py-1 bg-red-950/60 border border-red-500/40 text-red-300 rounded-full text-xs font-semibold shadow-inner">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                    <Radio className="w-3.5 h-3.5 animate-spin text-red-400" />
                    <span>EMERGENCY PROTOCOL: {activeEmergency.emergency_type.toUpperCase()} ({activeEmergency.floor})</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 px-3 py-1 bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 rounded-full text-xs font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span>NORMAL CAMPUS OPERATIONS</span>
                  </div>
                )}
              </div>
            </div>

            {/* Nav Links (Desktop) - Sleek Mallow-style Pills */}
            <nav className="hidden md:flex items-center space-x-1 bg-slate-900/60 p-1 rounded-full border border-white/[0.07] backdrop-blur-md">
              {visibleNavLinks.map((link) => {
                const Icon = link.icon;
                const isActive = location.pathname === link.to;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30 font-bold'
                        : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Right Actions: Direct SOS Trigger & Alerts */}
            <div className="flex items-center space-x-2 sm:space-x-2.5">
              
              {/* Prominent Emergency SOS button in header */}
              <button
                onClick={openSosModal}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 active:from-red-700 active:to-rose-700 text-white rounded-full text-xs font-black uppercase tracking-wider shadow-lg shadow-red-600/30 evac-btn-inset ring-1 ring-red-400/40"
                title="Immediate Emergency SOS Distress Alert"
              >
                <AlertOctagon className="w-3.5 h-3.5 fill-white text-red-600 flex-shrink-0" />
                <span className="hidden sm:inline">EMERGENCY SOS</span>
                <span className="sm:hidden font-extrabold">SOS</span>
              </button>

              {/* Push Notifications Button */}
              <button
                onClick={handleEnablePush}
                disabled={subscribing || pushStatus === 'granted'}
                title={pushStatus === 'granted' ? 'Emergency alerts enabled' : 'Click to enable emergency push alerts'}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                  pushStatus === 'granted'
                    ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30 cursor-default'
                    : 'bg-amber-950/40 text-amber-300 border-amber-500/40 hover:bg-amber-900/50'
                }`}
              >
                <Bell className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {pushStatus === 'granted' ? 'Alerts On' : 'Alerts'}
                </span>
              </button>

              {/* Role Toggle: Campus Occupant vs Officer */}
              <button
                onClick={() => quickDemoLogin(role === 'admin' ? 'student' : 'admin')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
                  role === 'admin' 
                    ? 'bg-purple-950/50 border-purple-500/40 text-purple-300 shadow-sm' 
                    : 'bg-slate-900 border-white/[0.08] text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
                title="Toggle Mode (Campus Occupant vs Safety Command)"
              >
                <span className={`w-2 h-2 rounded-full ${role === 'admin' ? 'bg-purple-400' : 'bg-emerald-400'}`}></span>
                <span className="capitalize">{role === 'admin' ? 'Command' : 'Occupant'}</span>
              </button>

            </div>

          </div>
        </div>

        {/* Mobile Control Panel Navigation Bar */}
        <div className="flex md:hidden items-center justify-around bg-slate-950/95 border-t border-white/[0.06] py-1.5 px-2">
          {visibleNavLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  isActive ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{link.label.replace('Evacuation ', '').replace('Safety ', '')}</span>
              </Link>
            );
          })}
        </div>

      </header>
    </>
  );
}
