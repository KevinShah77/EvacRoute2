import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  ShieldAlert, 
  Map, 
  LayoutDashboard, 
  PlayCircle, 
  Bell, 
  Radio,
  AlertOctagon,
  AlertTriangle,
  Flame,
  ShieldCheck,
  Building2,
  Landmark,
  ChevronDown,
  Menu,
  X,
  User,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useEmergency } from '../context/EmergencyContext';
import { requestNotificationPermissionAndSubscribe } from '../services/pushNotifications';

export default function Navbar() {
  const { role, user, quickDemoLogin } = useAuth();
  const { activeEmergency, openSosModal, activeSos } = useEmergency();
  const isSafetyOfficer = role === 'admin' || user?.role === 'admin';
  const location = useLocation();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const [pushStatus, setPushStatus] = useState(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );

  const handleEnablePush = async () => {
    setSubscribing(true);
    try {
      await requestNotificationPermissionAndSubscribe();
      setPushStatus(Notification.permission);
      alert('Emergency Push Notifications successfully enabled for this browser.');
    } catch (err) {
      alert(`Could not enable notifications: ${err.message}`);
    } finally {
      setSubscribing(false);
    }
  };

  // Overhead Navigation Links (merged into overhead header like previous design)
  const navLinks = [
    { to: '/emergency', label: 'Evacuation Map', icon: Map, activePrefix: '/emergency' },
    { to: '/simulation', label: 'Escape Simulation', icon: PlayCircle, activePrefix: '/simulation' },
    ...(isSafetyOfficer ? [
      { to: '/admin', label: 'Safety Command', icon: LayoutDashboard, activePrefix: '/admin', isCommand: true }
    ] : [])
  ];

  const userInitials = user?.full_name 
    ? user.full_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : (isSafetyOfficer ? 'SJ' : 'AC');

  const displayName = user?.full_name || (isSafetyOfficer ? 'Sarah Jenkins' : 'Alex Chen');

  return (
    <>
      {/* ============================================================== */}
      {/* OVERHEAD TOP NAVIGATION BAR (MERGED LIKE PREVIOUS DESIGN)        */}
      {/* ============================================================== */}
      <header className="fixed top-0 inset-x-0 h-16 bg-white border-b border-slate-200 z-50 shadow-xs flex items-center justify-between px-3 sm:px-6">
        
        {/* Left: Brand Logo, Name & Campus Selector */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          
          {/* EvacRoute Brand */}
          <Link to="/emergency" className="flex items-center space-x-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-sm shadow-red-600/30 group-hover:bg-red-700 transition-colors">
              <ShieldAlert className="w-5 h-5 drop-shadow-xs" />
            </div>
            <div className="flex flex-col">
              <span className="text-base sm:text-lg font-black tracking-tight text-slate-900 leading-none">
                Evac<span className="text-red-600">Route</span>
              </span>
              <span className="text-[10px] font-semibold text-slate-400 tracking-wide leading-tight mt-0.5 hidden sm:block">
                Life-Safety Platform
              </span>
            </div>
          </Link>

          {/* Thin vertical hairline divider */}
          <div className="hidden md:block h-5 w-px bg-slate-200"></div>

          {/* Institution / Campus Header Badge */}
          <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-lg text-slate-800 bg-slate-50 border border-slate-200/80 text-xs sm:text-sm font-semibold shadow-2xs">
            <Landmark className="w-4 h-4 text-slate-700 flex-shrink-0" />
            <span className="truncate">Jain (Deemed To Be) University</span>
          </div>
        </div>

        {/* Center: Merged Overhead Navigation Links (like previous design) */}
        <nav className="hidden lg:flex items-center space-x-1.5 bg-slate-100/80 p-1 rounded-xl border border-slate-200/80">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.activePrefix;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-white text-blue-600 shadow-sm border border-slate-200 font-extrabold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600' : 'text-slate-500'}`} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right: Live Status, SOS, Alerts, User Avatar & Role Switcher */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          
          {/* Live System Status */}
          <div className="hidden sm:flex items-center space-x-1.5 text-xs font-semibold text-slate-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>System Online</span>
          </div>

          <div className="hidden sm:block h-4 w-px bg-slate-200"></div>

          {/* Direct Emergency SOS Trigger Button */}
          <button
            onClick={openSosModal}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-xs ${
              isSafetyOfficer || activeSos
                ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/30'
                : 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/20'
            }`}
            title="Report Emergency / Broadcast SOS"
          >
            <AlertOctagon className="w-4 h-4 text-white" />
            <span>SOS</span>
          </button>

          {/* User Profile & Demo Role Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex items-center space-x-2 pl-1 pr-1.5 py-1 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200 cursor-pointer"
            >
              {/* Dark Avatar Circle with Initials */}
              <div className="w-8 h-8 rounded-full bg-[#0f172a] text-white flex items-center justify-center text-xs font-bold shadow-xs">
                {userInitials}
              </div>
              <span className="hidden xl:inline-block text-xs font-semibold text-slate-800 truncate max-w-[120px]">
                {displayName}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {userDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-xl p-2.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-2 border-b border-slate-100 mb-1.5">
                  <div className="font-bold text-slate-900 text-sm">{displayName}</div>
                  <div className="text-[11px] text-slate-500 capitalize">{role === 'admin' ? 'Chief Safety Officer' : 'Campus Occupant'}</div>
                </div>

                <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Switch Operational Role:
                </div>
                
                <div className="space-y-1 mt-1">
                  <button
                    onClick={() => {
                      quickDemoLogin('student');
                      setUserDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between transition-colors ${
                      role !== 'admin' ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span>Campus Occupant</span>
                    </div>
                    {role !== 'admin' && <span className="text-[10px] text-blue-600 font-bold bg-blue-100 px-1.5 py-0.5 rounded">Active</span>}
                  </button>

                  <button
                    onClick={() => {
                      quickDemoLogin('admin');
                      setUserDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between transition-colors ${
                      role === 'admin' ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                      <span>Safety Officer</span>
                    </div>
                    {role === 'admin' && <span className="text-[10px] text-blue-600 font-bold bg-blue-100 px-1.5 py-0.5 rounded">Active</span>}
                  </button>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-100">
                  <Link
                    to="/login"
                    onClick={() => setUserDropdownOpen(false)}
                    className="w-full block text-left px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-50 text-xs font-medium"
                  >
                    Account Login / Auth Details
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Mobile hamburger menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors ml-1"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Slide-down Navigation Panel */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed top-16 inset-x-0 bg-white border-b border-slate-200 shadow-xl z-40 p-4 animate-in slide-in-from-top-2 duration-150">
          <div className="space-y-1.5 mb-3">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.activePrefix;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center space-x-2.5 px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                    isActive ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Campus Facility:</span>
            <span className="text-xs font-bold text-slate-800">{selectedCampus}</span>
          </div>
        </div>
      )}
    </>
  );
}
