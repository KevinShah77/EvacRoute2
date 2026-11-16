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
      <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Logo & Emergency Pulse */}
            <div className="flex items-center space-x-3">
              <Link to="/emergency" className="flex items-center space-x-2.5 group">
                <div className={`p-2 rounded-xl transition-all ${
                  activeEmergency 
                    ? 'bg-red-600 text-white shadow-lg shadow-red-500/50 animate-pulse' 
                    : 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                }`}>
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-lg font-bold tracking-tight text-white group-hover:text-blue-400 transition-colors">
                    Evac<span className="text-red-500">Route</span>
                  </span>
                  <span className="hidden sm:inline-block ml-2 text-xs font-medium text-slate-400 border border-slate-700 rounded px-1.5 py-0.5">
                    Control Panel
                  </span>
                </div>
              </Link>

              {/* Live Status Pill */}
              <div className="hidden md:flex items-center ml-4">
                {activeEmergency ? (
                  <div className="flex items-center space-x-2 px-3 py-1 bg-red-950/80 border border-red-600 text-red-400 rounded-full text-xs font-semibold animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                    <Radio className="w-3.5 h-3.5 animate-spin" />
                    <span>EMERGENCY ACTIVE: {activeEmergency.emergency_type.toUpperCase()} ({activeEmergency.floor})</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 px-3 py-1 bg-emerald-950/60 border border-emerald-600/40 text-emerald-400 rounded-full text-xs font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>NORMAL CAMPUS OPERATION</span>
                  </div>
                )}
              </div>
            </div>

            {/* Nav Links (Desktop) */}
            <nav className="hidden md:flex items-center space-x-1.5">
              {visibleNavLinks.map((link) => {
                const Icon = link.icon;
                const isActive = location.pathname === link.to;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-sm font-bold'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Right Actions: Direct SOS Trigger & Alerts */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              {/* Prominent Emergency SOS button in header */}
              <button
                onClick={openSosModal}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-red-600/40 animate-pulse transition-all ring-1 ring-red-400"
                title="Immediate Emergency SOS Distress Alert"
              >
                <AlertOctagon className="w-4 h-4 fill-white text-red-600" />
                <span className="hidden sm:inline">EMERGENCY SOS</span>
                <span className="sm:hidden font-extrabold">SOS</span>
              </button>

              {/* Push Notifications Button */}
              <button
                onClick={handleEnablePush}
                disabled={subscribing || pushStatus === 'granted'}
                title={pushStatus === 'granted' ? 'Emergency alerts enabled' : 'Click to enable emergency push alerts'}
                className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  pushStatus === 'granted'
                    ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-700/50 cursor-default'
                    : 'bg-amber-900/30 text-amber-300 border border-amber-600/50 hover:bg-amber-800/40'
                }`}
              >
                <Bell className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">
                  {pushStatus === 'granted' ? 'Alerts On' : 'Alerts'}
                </span>
              </button>

              {/* Role Toggle: Campus Occupant vs Officer */}
              <button
                onClick={() => quickDemoLogin(role === 'admin' ? 'student' : 'admin')}
                className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                  role === 'admin' 
                    ? 'bg-purple-950/60 border-purple-600/50 text-purple-300' 
                    : 'bg-slate-800 border-slate-700 text-slate-300'
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
        <div className="flex md:hidden items-center justify-around bg-slate-950/90 border-t border-slate-800/80 py-1.5 px-2">
          {visibleNavLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-semibold ${
                  isActive ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
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
