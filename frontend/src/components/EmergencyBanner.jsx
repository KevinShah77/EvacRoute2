import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AlertCircle, Flame, AlertTriangle, ShieldCheck, X, Bell, ChevronRight } from 'lucide-react';
import { useEmergency } from '../context/EmergencyContext';
import { requestNotificationPermissionAndSubscribe } from '../services/pushNotifications';

export default function EmergencyBanner() {
  const { activeEmergency, notificationToast, setNotificationToast, announcement, setAnnouncement } = useEmergency();
  const location = useLocation();
  const isEmergencyPage = location.pathname === '/emergency';

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
      {/* Top Emergency Hero Bar when active (suppressed on /emergency to prevent duplicate alert banners) */}
      {activeEmergency && !isEmergencyPage && (
        <div className={`w-full py-2 px-3 sm:px-6 border-b transition-all ${
          activeEmergency.is_simulation
            ? 'bg-amber-50 border-amber-200 text-amber-950'
            : 'bg-red-50 border-red-200 text-red-950'
        }`}>
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-3">
            <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
              <div className="p-1.5 rounded-lg bg-red-600 text-white flex-shrink-0">
                <Flame className="w-4 h-4 sm:w-4 sm:h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-2 flex-wrap">
                  <span className="font-bold tracking-wide uppercase text-xs sm:text-sm truncate">
                    {activeEmergency.is_simulation ? 'SIMULATION: ' : 'CAMPUS ALERT: '}
                    {activeEmergency.emergency_type}
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase bg-red-600 text-white flex-shrink-0">
                    {activeEmergency.severity || 'CRITICAL'}
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-red-900/90 truncate">
                  Reported at <strong>{activeEmergency.location}</strong> ({activeEmergency.floor}). Follow highlighted evacuation path.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Safety Broadcast Announcement Pop-Up Modal */}
      {announcement && (
        <div 
          className="fixed inset-0 z-[75] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6"
          onClick={() => setAnnouncement(null)}
        >
          <div 
            className="bg-white max-w-lg w-full p-5 sm:p-6 rounded-xl shadow-xl border border-slate-200 text-slate-900 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top-Right Dismiss Cross Mark */}
            <button
              onClick={() => setAnnouncement(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              title="Dismiss Announcement (Esc)"
              aria-label="Dismiss Announcement"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-start space-x-3.5 min-w-0 pr-8">
              <div className="p-2.5 rounded-lg bg-blue-100 text-blue-700 flex-shrink-0 mt-0.5">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="min-w-0 space-y-1.5 flex-1">
                <div className="flex items-center space-x-2 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    Official Campus Broadcast
                  </span>
                  {announcement.priority && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      {announcement.priority}
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400">Just now</span>
                </div>
                <h4 className="font-bold text-base tracking-tight text-slate-900 leading-snug">
                  {announcement.title || 'Campus Safety Directive'}
                </h4>
                <p className="text-xs text-slate-600 font-medium">
                  Issued by <strong>{announcement.sender || 'Chief Safety Officer Sarah Jenkins'}</strong>
                </p>
                {announcement.message && (
                  <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-lg mt-2 text-xs text-slate-800 leading-relaxed font-normal">
                    {announcement.message}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setAnnouncement(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Understood / Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Emergency Toast Notification Pop-Up */}
      {notificationToast && (
        <div className="fixed bottom-4 left-3 right-3 sm:left-auto sm:right-5 sm:max-w-md z-50 p-3.5 sm:p-4 rounded-xl shadow-lg border bg-white border-slate-200 text-slate-900">
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex items-start space-x-2.5 sm:space-x-3 min-w-0">
              <div className={`p-2 rounded-lg mt-0.5 flex-shrink-0 ${
                notificationToast.type === 'danger' ? 'bg-red-600 text-white' :
                notificationToast.type === 'warning' ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white'
              }`}>
                {notificationToast.type === 'danger' && <Flame className="w-4 h-4 sm:w-5 sm:h-5" />}
                {notificationToast.type === 'warning' && <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />}
                {notificationToast.type === 'success' && <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />}
              </div>
              <div className="min-w-0 space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-red-600">Live Notification</span>
                  <span className="text-[10px] text-slate-400">Just now</span>
                </div>
                <h4 className="font-bold text-xs sm:text-sm tracking-tight text-slate-900 leading-snug">
                  {notificationToast.title}
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {notificationToast.message}
                </p>

                {/* Mobile Notification Push Permission Pill if not yet granted */}
                {pushPermission !== 'granted' && (
                  <div className="pt-1.5">
                    <button
                      onClick={handleEnablePush}
                      className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 transition-colors"
                    >
                      <Bell className="w-3 h-3 text-amber-500" />
                      <span>Enable Browser Alerts</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => setNotificationToast(null)}
              className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 flex-shrink-0 transition-colors"
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
