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
  MapPin,
  ShieldCheck,
  Building2,
  Landmark,
  ChevronDown,
  Menu,
  X,
  HelpCircle,
  Settings,
  User,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useEmergency } from '../context/EmergencyContext';
import { requestNotificationPermissionAndSubscribe } from '../services/pushNotifications';

export default function Navbar({ onOpenCheckinModal }) {
  const { role, user, quickDemoLogin } = useAuth();
  const { activeEmergency, openSosModal, activeSos } = useEmergency();
  const isSafetyOfficer = role === 'admin' || user?.role === 'admin';
  const location = useLocation();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [campusDropdownOpen, setCampusDropdownOpen] = useState(false);
  const [selectedCampus, setSelectedCampus] = useState('Riverside University');
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

  const campuses = [
    'Riverside University',
    'Main Academic Complex',
    'Science & Engineering Hall',
    'West Campus Annex'
  ];

  // Primary sidebar navigation items matching reference design:
  // Emergency | Map View | Report Incident | My Location | Settings | Help & Support
  const sidebarLinks = [
    { to: '/emergency', label: 'Emergency', icon: AlertTriangle, activePrefix: '/emergency', badge: activeEmergency ? 'Active' : null, isEmergency: true },
    { to: '/emergency', label: 'Map View', icon: Map, activePrefix: '/emergency' },
    { label: 'Report Incident', icon: Flame, isAction: true, onClick: openSosModal },
    { to: '/emergency', label: 'My Location', icon: MapPin },
    { to: isSafetyOfficer ? '/admin' : '/emergency', label: 'Settings', icon: Settings },
    { to: '/emergency', label: 'Help & Support', icon: HelpCircle },
    { to: '/simulation', label: 'Simulation', icon: PlayCircle, activePrefix: '/simulation' },
    ...(isSafetyOfficer ? [
      { to: '/admin', label: 'Safety Command', icon: LayoutDashboard, activePrefix: '/admin', isCommand: true }
    ] : [])
  ];

  const userInitials = user?.full_name 
    ? user.full_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : (isSafetyOfficer ? 'SJ' : 'JD');

  const displayName = user?.full_name || (isSafetyOfficer ? 'Sarah Jenkins' : 'John Doe');

  return (
    <>
      {/* ============================================================== */}
      {/* 1. LEFT DESKTOP SIDEBAR (DEEP NAVY #0F172A)                     */}
      {/* ============================================================== */}
      <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 w-64 bg-[#0f172a] text-slate-300 z-40 border-r border-slate-800/80 shadow-md">
        
        {/* Brand Header */}
        <div className="h-16 flex items-center px-6 border-b border-slate-800/80 bg-[#0d1526]">
          <Link to="/emergency" className="flex items-center space-x-3 group">
            <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center shadow-xs">
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight text-white">
                EvacRoute
              </span>
              <span className="text-[10px] font-medium text-slate-400 -mt-0.5">
                Life-Safety Platform
              </span>
            </div>
          </Link>
        </div>

        {/* Sidebar Nav Items */}
        <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {sidebarLinks.map((item, idx) => {
            const Icon = item.icon;
            const isActive = item.to && location.pathname === item.activePrefix;

            if (item.isAction) {
              return (
                <button
                  key={idx}
                  onClick={item.onClick}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors text-left"
                >
                  <div className="flex items-center space-x-3">
                    <Icon className="w-4 h-4 text-red-400" />
                    <span>{item.label}</span>
                  </div>
                  <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-red-950 text-red-300 rounded border border-red-800/40">
                    SOS
                  </span>
                </button>
              );
            }

            return (
              <Link
                key={idx}
                to={item.to}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-slate-800/90 text-white font-semibold shadow-xs border-l-2 border-red-500 pl-3'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-red-600 text-white rounded">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Campus Safety Footer Banner (Matches Reference Image with Architectural Sketch) */}
        <div className="p-4 border-t border-slate-800/80">
          <div className="relative rounded-xl bg-slate-900/90 border border-slate-800 p-3.5 overflow-hidden">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-blue-900/50 border border-blue-700/50 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white leading-tight">Campus Safety</h4>
                <p className="text-[11px] text-slate-400">Our Priority</p>
              </div>
            </div>

            {/* Architectural Line-art Campus Building Sketch from Reference Image */}
            <div className="mt-2.5 pt-2 border-t border-slate-800/70">
              <svg className="w-full h-8 text-slate-700" viewBox="0 0 160 36" fill="none" stroke="currentColor" strokeWidth="1">
                <path d="M 10 34 L 150 34" />
                <path d="M 22 34 L 22 20 L 36 20 L 36 34" />
                <path d="M 124 34 L 124 20 L 138 20 L 138 34" />
                <path d="M 36 34 L 36 14 L 62 14 L 62 34" />
                <path d="M 98 34 L 98 14 L 124 14 L 124 34" />
                <path d="M 62 34 L 62 10 L 98 10 L 98 34" />
                <path d="M 60 10 L 80 3 L 100 10 Z" />
                <circle cx="80" cy="15" r="2.5" />
                <rect x="75" y="22" width="10" height="12" />
                <line x1="80" y1="22" x2="80" y2="34" />
              </svg>
            </div>

            <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
              <span>Security Line:</span>
              <span className="font-mono text-slate-300 font-semibold">+1-555-019-SAFE</span>
            </div>
          </div>
        </div>

      </aside>

      {/* ============================================================== */}
      {/* 2. TOP HEADER (CLEAN OFF-WHITE / CRISP LIGHT THEME)              */}
      {/* ============================================================== */}
      <header className="fixed top-0 right-0 left-0 md:left-64 h-16 bg-white border-b border-slate-200 z-30 flex items-center justify-between px-3 sm:px-6 shadow-xs">
        
        {/* Left: Mobile Menu Button & Campus / Facility Selector */}
        <div className="flex items-center space-x-3">
          
          {/* Mobile hamburger toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Organization / Campus Selector Dropdown (matches Reference Image) */}
          <div className="relative">
            <button
              onClick={() => setCampusDropdownOpen(!campusDropdownOpen)}
              className="flex items-center space-x-2 px-3 py-1.5 rounded-lg text-slate-800 hover:bg-slate-50 transition-colors text-sm font-semibold border border-transparent hover:border-slate-200"
            >
              <Landmark className="w-4 h-4 text-slate-700 flex-shrink-0" />
              <span className="truncate max-w-[140px] sm:max-w-none">{selectedCampus}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
            </button>

            {campusDropdownOpen && (
              <div className="absolute left-0 mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-50 text-xs">
                <div className="px-3 py-1.5 font-bold text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-100">
                  Select Campus Facility
                </div>
                {campuses.map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      setSelectedCampus(c);
                      setCampusDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2 hover:bg-slate-50 transition-colors flex items-center justify-between ${
                      c === selectedCampus ? 'font-bold text-blue-600 bg-blue-50/50' : 'text-slate-700'
                    }`}
                  >
                    <span>{c}</span>
                    {c === selectedCampus && <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Live System Status, Divider, SOS, and User Avatar (Exact Reference Image Style) */}
        <div className="flex items-center space-x-2 sm:space-x-4">
          
          {/* Live System Status (matches Reference Image: green dot + System Online) */}
          <div className="flex items-center space-x-1.5 text-xs font-medium text-slate-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="hidden sm:inline">System Online</span>
          </div>

          {/* Thin vertical divider (Reference image) */}
          <div className="hidden sm:block h-4 w-px bg-slate-200"></div>

          {/* Direct Emergency SOS Trigger Button */}
          <button
            onClick={openSosModal}
            className={`flex items-center space-x-1 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              isSafetyOfficer || activeSos
                ? 'bg-red-600 hover:bg-red-700 text-white shadow-xs'
                : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
            }`}
            title="Report Emergency / SOS"
          >
            <AlertOctagon className={`w-3.5 h-3.5 ${isSafetyOfficer || activeSos ? 'text-white' : 'text-red-500'}`} />
            <span>SOS</span>
          </button>

          {/* User Profile & Demo Role Switcher (matches reference image: JD avatar + John Doe + chevron) */}
          <div className="relative">
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex items-center space-x-2 pl-1 pr-1.5 py-1 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200"
            >
              {/* Dark Avatar Circle with Initials (Reference Image JD style) */}
              <div className="w-8 h-8 rounded-full bg-[#0f172a] text-white flex items-center justify-center text-xs font-bold shadow-xs">
                {userInitials}
              </div>
              <span className="hidden md:inline-block text-xs font-semibold text-slate-800 truncate max-w-[110px]">
                {displayName}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {userDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-60 bg-white border border-slate-200 rounded-xl shadow-lg p-2 z-50 text-xs">
                <div className="px-3 py-2 border-b border-slate-100 mb-1">
                  <div className="font-bold text-slate-900">{displayName}</div>
                  <div className="text-[11px] text-slate-500 capitalize">{role === 'admin' ? 'Safety Officer (Command)' : 'Campus Occupant'}</div>
                </div>

                <div className="px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Switch Operational Role:
                </div>
                
                <button
                  onClick={() => {
                    quickDemoLogin('student');
                    setUserDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between transition-colors ${
                    role !== 'admin' ? 'bg-slate-100 font-bold text-slate-900' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>Campus Occupant</span>
                  </div>
                  {role !== 'admin' && <span className="text-[10px] text-emerald-600 font-bold">Active</span>}
                </button>

                <button
                  onClick={() => {
                    quickDemoLogin('admin');
                    setUserDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between transition-colors ${
                    role === 'admin' ? 'bg-slate-100 font-bold text-slate-900' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                    <span>Safety Officer</span>
                  </div>
                  {role === 'admin' && <span className="text-[10px] text-blue-600 font-bold">Active</span>}
                </button>

                <div className="mt-2 pt-2 border-t border-slate-100">
                  <Link
                    to="/login"
                    onClick={() => setUserDropdownOpen(false)}
                    className="w-full block text-left px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-50 text-xs"
                  >
                    Account Login / Auth Details
                  </Link>
                </div>
              </div>
            )}
          </div>

        </div>

      </header>

      {/* ============================================================== */}
      {/* 3. MOBILE SLIDE-OUT DRAWER (FOR PHONES & SMALL TABLETS)         */}
      {/* ============================================================== */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div 
            className="w-72 max-w-[80vw] h-full bg-[#0f172a] text-slate-300 flex flex-col shadow-2xl p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <span className="font-bold text-white text-base">EvacRoute</span>
              </div>
              <button 
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 py-4 space-y-1">
              <Link
                to="/emergency"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-200 hover:bg-slate-800"
              >
                <Map className="w-4 h-4 text-blue-400" />
                <span>Emergency Map</span>
              </Link>
              <Link
                to="/simulation"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-200 hover:bg-slate-800"
              >
                <PlayCircle className="w-4 h-4 text-emerald-400" />
                <span>Escape Simulation</span>
              </Link>
              {isSafetyOfficer && (
                <Link
                  to="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-200 hover:bg-slate-800"
                >
                  <LayoutDashboard className="w-4 h-4 text-amber-400" />
                  <span>Safety Command</span>
                </Link>
              )}
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  openSosModal();
                }}
                className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-bold text-red-300 hover:bg-red-950/50"
              >
                <AlertOctagon className="w-4 h-4 text-red-400" />
                <span>Emergency S.O.S.</span>
              </button>
            </nav>

            <div className="pt-4 border-t border-slate-800 text-xs text-slate-400">
              <div className="flex items-center justify-between mb-2">
                <span>Active Mode:</span>
                <span className="font-bold text-white capitalize">{role}</span>
              </div>
              <button
                onClick={() => {
                  quickDemoLogin(role === 'admin' ? 'student' : 'admin');
                  setMobileMenuOpen(false);
                }}
                className="w-full py-2 bg-slate-800 text-slate-200 rounded-lg font-semibold hover:bg-slate-700 transition-colors"
              >
                Switch to {role === 'admin' ? 'Occupant' : 'Command'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. MOBILE BOTTOM BAR (QUICK FINGERTIP ACCESS ON PHONES)         */}
      {/* ============================================================== */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 py-1.5 px-3 flex items-center justify-around shadow-lg">
        <Link
          to="/emergency"
          className={`flex flex-col items-center py-1 px-2.5 rounded-lg text-[10px] font-semibold ${
            location.pathname === '/emergency' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Map className="w-4 h-4 mb-0.5" />
          <span>Map</span>
        </Link>
        <Link
          to="/simulation"
          className={`flex flex-col items-center py-1 px-2.5 rounded-lg text-[10px] font-semibold ${
            location.pathname === '/simulation' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <PlayCircle className="w-4 h-4 mb-0.5" />
          <span>Simulation</span>
        </Link>
        <button
          onClick={openSosModal}
          className="flex flex-col items-center py-1 px-2.5 rounded-lg text-[10px] font-bold text-red-600"
        >
          <AlertOctagon className="w-4 h-4 mb-0.5" />
          <span>S.O.S.</span>
        </button>
        {isSafetyOfficer && (
          <Link
            to="/admin"
            className={`flex flex-col items-center py-1 px-2.5 rounded-lg text-[10px] font-semibold ${
              location.pathname === '/admin' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 mb-0.5" />
            <span>Command</span>
          </Link>
        )}
      </nav>
    </>
  );
}
