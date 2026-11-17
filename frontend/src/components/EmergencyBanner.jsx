import React, { useEffect, useState } from 'react';
import { AlertCircle, Flame, AlertTriangle, ShieldCheck, X, Bell, ChevronRight } from 'lucide-react';
import { useEmergency } from '../context/EmergencyContext';
import { requestNotificationPermissionAndSubscribe } from '../services/pushNotifications';

export default function EmergencyBanner() {
  const { activeEmergency, notificationToast, setNotificationToast, announcement, setAnnouncement } = useEmergency();
  const [pushPermission, setPushPermission] = useState(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );

  // Auto-dismiss toast after 8 seconds
  useEffect(() => {
    if (!notificationToast) return;
    const timer = setTimeout(() => {
      setNotificationToast(null);
    }, 8000);
    return () => clearTimeout(timer);
  }, [notificationToast, setNotificationToast]);

  // Keyboard shortcut listener to dismiss announcement with Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && announcement) {
        setAnnouncement(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [announcement, setAnnouncement]);

  // Audio & vibration alert + native browser notification pop-up
  useEffect(() => {
    if (!notificationToast) return;

    // Trigger phone vibration if supported
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([200, 100, 200]);
      } catch (e) {}
    }

    // Trigger native browser notification if granted
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(notificationToast.title, {
          body: notificationToast.message,
          icon: '/shield-alert.svg',
          badge: '/shield-alert.svg',
          tag: 'evacroute-toast-alert',
          renotify: true
        });
      } catch (e) {
        console.warn('Native notification trigger failed:', e);
      }
    }
  }, [notificationToast]);

  const handleEnablePush = async () => {
    try {
      await requestNotificationPermissionAndSubscribe();
      setPushPermission(Notification.permission);
    } catch (e) {
      console.warn('Notification permission request failed:', e);
    }
  };

  return (
    <>
      {/* Top Emergency Hero Bar when active */}
      {activeEmergency && (
        <div className={`w-full py-2.5 sm:py-3 px-3 sm:px-4 border-b transition-all ${
          activeEmergency.is_simulation
            ? 'bg-amber-950/90 border-amber-600 text-amber-200'
            : 'bg-red-950/95 border-red-600 text-red-100 shadow-xl shadow-red-900/40'
        }`}>
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-3">
            <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
              <div className="p-1.5 sm:p-2 rounded-xl bg-red-600 text-white animate-bounce flex-shrink-0">
                <Flame className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-2 flex-wrap">
                  <span className="font-extrabold tracking-wide uppercase text-xs sm:text-sm truncate">
                    {activeEmergency.is_simulation ? '🚨 SIMULATION: ' : '🚨 CAMPUS ALERT: '}
                    {activeEmergency.emergency_type}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-red-700 text-white flex-shrink-0">
                    {activeEmergency.severity || 'CRITICAL'}
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-red-200/90 truncate">
                  Reported at <strong>{activeEmergency.location}</strong> ({activeEmergency.floor}). Follow highlighted evacuation path.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Safety Broadcast Announcement Pop-Up Modal (Centered at the Centre of the Screen with Top-Right 'X') */}
      {announcement && (
        <div 
          className="fixed inset-0 z-[75] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200"
          onClick={() => setAnnouncement(null)}
        >
          <div 
            className="evac-card max-w-lg w-full p-5 sm:p-6 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.85),0_0_40px_rgba(59,130,246,0.35)] border border-blue-500/60 bg-slate-950/95 backdrop-blur-2xl text-slate-100 ring-1 ring-blue-400/40 relative animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top-Right Dismiss Cross Mark */}
            <button
              onClick={() => setAnnouncement(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800/80 transition-colors cursor-pointer"
              title="Dismiss Announcement (Esc)"
              aria-label="Dismiss Announcement"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-start space-x-3.5 min-w-0 pr-8">
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/40 flex-shrink-0 mt-0.5 animate-pulse">
                <AlertCircle className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0 space-y-1.5 flex-1">
                <div className="flex items-center space-x-2 flex-wrap">
                  <span className="text-[10px] font-black uppercase tracking-wider text-blue-400 bg-blue-950/80 px-2.5 py-0.5 rounded-full border border-blue-500/30">
                    Official Campus Broadcast
                  </span>
                  {announcement.priority && (
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 bg-amber-950/80 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                      {announcement.priority}
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400">Just now</span>
                </div>
                <h4 className="font-black text-base sm:text-lg tracking-tight text-white leading-snug">
                  {announcement.title || 'Campus Safety Directive'}
                </h4>
                <p className="text-xs text-blue-300/90 font-medium">
                  Issued by <strong>{announcement.sender || 'Chief Safety Officer Sarah Jenkins'}</strong>
                </p>
                {announcement.message && (
                  <div className="p-3.5 bg-blue-950/40 border border-blue-500/25 rounded-xl mt-3 text-xs sm:text-sm text-slate-200 leading-relaxed font-normal">
                    {announcement.message}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setAnnouncement(null)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
              >
                Understood / Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Emergency Toast Notification Pop-Up (Fully responsive on phone & desktop) */}
      {notificationToast && (
        <div className="fixed bottom-4 left-3 right-3 sm:left-auto sm:right-5 sm:max-w-md z-50 p-3.5 sm:p-4 rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.4),0_16px_36px_-12px_rgba(0,0,0,0.6)] border backdrop-blur-xl animate-in slide-in-from-bottom duration-300 evac-card border-red-500/50 text-slate-100 ring-1 ring-red-500/30">
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex items-start space-x-2.5 sm:space-x-3 min-w-0">
              <div className={`p-2 rounded-xl mt-0.5 flex-shrink-0 ${
                notificationToast.type === 'danger' ? 'bg-red-600 text-white shadow-lg shadow-red-600/40' :
                notificationToast.type === 'warning' ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/40' : 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/40'
              }`}>
                {notificationToast.type === 'danger' && <Flame className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />}
                {notificationToast.type === 'warning' && <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />}
                {notificationToast.type === 'success' && <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />}
              </div>
              <div className="min-w-0 space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-red-400">Live Notification</span>
                  <span className="text-[10px] text-slate-400">Just now</span>
                </div>
                <h4 className="font-black text-xs sm:text-sm tracking-tight text-white leading-snug">
                  {notificationToast.title}
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {notificationToast.message}
                </p>

                {/* Mobile Notification Push Permission Pill if not yet granted */}
                {pushPermission !== 'granted' && (
                  <div className="pt-1.5">
                    <button
                      onClick={handleEnablePush}
                      className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-[11px] font-semibold text-amber-300 transition-all"
                    >
                      <Bell className="w-3 h-3 text-amber-400" />
                      <span>Enable Native Phone Alerts</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => setNotificationToast(null)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 flex-shrink-0 transition-colors"
              title="Close Notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
