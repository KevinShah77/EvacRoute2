import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';
import { emergencyWS } from '../services/websocket';
import { playEmergencySirenTone, playHazardWarningTone } from '../services/audioChime';

const EmergencyContext = createContext(null);

export const DEFAULT_ACTIVE_EMERGENCY = {
  id: 1,
  emergency_type: 'fire',
  building_name: 'Main Academic Complex',
  floor: 'Floor 2',
  location: 'Room 205',
  node_id: 'F2-205',
  severity: 'critical',
  status: 'active',
  description: 'Active fire emergency reported in Room 205 on Floor 2. Evacuate immediately.'
};

export const DEFAULT_ACTIVE_HAZARDS = [
  {
    id: 1,
    hazard_type: 'fire',
    floor: 'Floor 2',
    node_id: 'F2-205',
    severity: 'critical',
    description: 'Active flames and smoke in Room 205',
    is_active: true
  }
];

export function EmergencyProvider({ children }) {
  const [topology, setTopology] = useState(() => {
    try {
      const cached = localStorage.getItem('evacroute_offline_topology');
      return cached ? JSON.parse(cached) : { nodes: [], edges: [], floors: [], building: {} };
    } catch {
      return { nodes: [], edges: [], floors: [], building: {} };
    }
  });

  const [activeEmergency, setActiveEmergency] = useState(() => {
    try {
      const cached = localStorage.getItem('evacroute_offline_emergency');
      return cached ? JSON.parse(cached) : DEFAULT_ACTIVE_EMERGENCY;
    } catch {
      return DEFAULT_ACTIVE_EMERGENCY;
    }
  });

  const [hazards, setHazards] = useState(() => {
    try {
      const cached = localStorage.getItem('evacroute_offline_hazards');
      return cached ? JSON.parse(cached) : DEFAULT_ACTIVE_HAZARDS;
    } catch {
      return DEFAULT_ACTIVE_HAZARDS;
    }
  });
  const [selectedFloor, setSelectedFloor] = useState('Floor 2');
  const [userLocationNode, setUserLocationNode] = useState('F2-208'); // default location
  const [accessibleMode, setAccessibleMode] = useState(false);
  const [routeResult, setRouteResult] = useState(() => {
    try {
      const cached = localStorage.getItem('evacroute_offline_route');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [selectedRoute, setSelectedRoute] = useState('primary'); // 'primary' | 'backup'
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [notificationToast, setNotificationToast] = useState(null);
  const [announcement, setAnnouncement] = useState(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const initialToastShownRef = useRef(false);

  // Global SOS Management State
  const [isSosModalOpen, setIsSosModalOpen] = useState(false);
  const [activeSos, setActiveSos] = useState(() => {
    try {
      const cached = localStorage.getItem('evacroute_active_sos');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [sosRequests, setSosRequests] = useState([]);

  const openSosModal = useCallback(() => setIsSosModalOpen(true), []);
  const closeSosModal = useCallback(() => setIsSosModalOpen(false), []);

  // Online / Offline state listener
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load Building Topology on boot
  const loadTopology = useCallback(async () => {
    try {
      const topo = await api.getTopology();
      setTopology(topo);
      localStorage.setItem('evacroute_offline_topology', JSON.stringify(topo));
    } catch (e) {
      console.warn('Failed to load live building topology, using cached offline topology:', e);
      setIsOffline(true);
    }
  }, []);

  useEffect(() => {
    loadTopology();
  }, [loadTopology]);

  // Fetch active emergency and hazards
  const refreshEmergencyState = useCallback(async () => {
    try {
      const data = await api.getActiveEmergency();
      if (data.active) {
        setActiveEmergency(data.emergency);
        setHazards(data.hazards || []);
        localStorage.setItem('evacroute_offline_emergency', JSON.stringify(data.emergency));
        if (data.emergency.floor) {
          setSelectedFloor(data.emergency.floor);
        }
        if (!initialToastShownRef.current) {
          initialToastShownRef.current = true;
          setNotificationToast({
            id: Date.now(),
            type: 'danger',
            title: `EMERGENCY ALERT: ${data.emergency.emergency_type?.toUpperCase() || 'ACTIVE PROTOCOL'}`,
            message: `Emergency reported at ${data.emergency.location} (${data.emergency.floor}). Follow safe evacuation route.`,
          });
        }
      } else {
        setActiveEmergency(null);
        setHazards([]);
        localStorage.removeItem('evacroute_offline_emergency');
      }
    } catch (e) {
      console.warn('Failed to fetch emergency status (offline fallback):', e);
      setIsOffline(true);
    }
  }, []);

  // Calculate evacuation route
  const recalculateRoute = useCallback(async (startNode = userLocationNode, ada = accessibleMode) => {
    if (!startNode) return;
    setIsRecalculating(true);
    try {
      const result = await api.calculateEvacuationRoute(startNode, null, ada);
      setRouteResult(result);
      if (result && result.safe_route_found) {
        localStorage.setItem('evacroute_offline_route', JSON.stringify(result));
      }
    } catch (e) {
      console.warn('Failed to calculate live evacuation route, using cached route fallback:', e);
      setIsOffline(true);
    } finally {
      setIsRecalculating(false);
    }
  }, [userLocationNode, accessibleMode]);

  // Initial load
  useEffect(() => {
    refreshEmergencyState();
    recalculateRoute('F2-208', false);
  }, [refreshEmergencyState]);

  // When userLocationNode or accessibleMode changes, re-run route calculation
  useEffect(() => {
    if (userLocationNode) {
      recalculateRoute(userLocationNode, accessibleMode);
    }
  }, [userLocationNode, accessibleMode, recalculateRoute]);

  // Real-time WebSocket Listeners
  useEffect(() => {
    emergencyWS.connect();

    const unsubEmergency = emergencyWS.on('EMERGENCY_ACTIVATED', (data) => {
      console.log('[Emergency Alert] Activated:', data);
      playEmergencySirenTone();
      setActiveEmergency(data);
      if (data.floor) setSelectedFloor(data.floor);
      setNotificationToast({
        id: Date.now(),
        type: 'danger',
        title: `EMERGENCY ALERT: ${data.emergency_type.toUpperCase()}`,
        message: `Reported on ${data.floor}, ${data.location}. Immediate evacuation protocol initiated.`,
      });
      refreshEmergencyState().then(() => {
        recalculateRoute();
      });
    });

    const unsubHazard = emergencyWS.on('HAZARD_UPDATED', (hazard) => {
      console.log('[Hazard Alert] Updated:', hazard);
      playHazardWarningTone();
      setHazards((prev) => [...prev.filter((h) => h.id !== hazard.id), hazard]);
      setNotificationToast({
        id: Date.now(),
        type: 'warning',
        title: `HAZARD UPDATE: ${hazard.hazard_type.toUpperCase()}`,
        message: `New hazard reported on ${hazard.floor}. Evacuation paths dynamically updating.`,
      });
      recalculateRoute();
    });

    const unsubReroute = emergencyWS.on('ROUTE_RECALCULATION_NEEDED', (info) => {
      console.log('[Route Recalculation Triggered]:', info);
      recalculateRoute();
    });

    const unsubBuilding = emergencyWS.on('BUILDING_UPDATED', (info) => {
      console.log('[Building Topology Updated]:', info);
      loadTopology().then(() => {
        recalculateRoute();
      });
    });

    const unsubResolved = emergencyWS.on('EMERGENCY_RESOLVED', (data) => {
      console.log('[Emergency Resolved]:', data);
      setActiveEmergency(null);
      setHazards([]);
      setNotificationToast({
        id: Date.now(),
        type: 'success',
        title: 'EMERGENCY RESOLVED – ALL CLEAR',
        message: data.resolution_notes || 'All safety zones inspected and cleared by Safety Officer.',
      });
      refreshEmergencyState().then(() => {
        recalculateRoute();
      });
    });

    const unsubAnnouncement = emergencyWS.on('ANNOUNCEMENT', (data) => {
      setAnnouncement(data);
    });

    const unsubNewSos = emergencyWS.on('NEW_SOS_REQUEST', (data) => {
      console.log('[SOS Alert] New distress call received:', data);
      try { playEmergencySirenTone(); } catch {}
      setSosRequests(prev => [data, ...prev.filter(s => s.id !== data.id)]);
      setNotificationToast({
        id: Date.now(),
        type: 'danger',
        title: `EMERGENCY SOS: ${data.user_name || 'Occupant'}`,
        message: `${data.situation?.toUpperCase() || 'TRAPPED'} at ${data.location} (${data.floor}).`,
      });
    });

    const unsubSosStatus = emergencyWS.on('SOS_STATUS_UPDATED', (data) => {
      console.log('[SOS Status Update]:', data);
      setActiveSos(prev => {
        if (prev && prev.id === data.id) {
          const updated = {
            ...prev,
            status: data.status,
            acknowledged_by: data.acknowledged_by,
            acknowledged_at: data.acknowledged_at,
          };
          if (data.status === 'resolved') {
            localStorage.removeItem('evacroute_active_sos');
            return null;
          }
          localStorage.setItem('evacroute_active_sos', JSON.stringify(updated));
          return updated;
        }
        return prev;
      });

      setSosRequests(prev => prev.map(s => {
        if (s.id === data.id) {
          return {
            ...s,
            status: data.status,
            acknowledged_by: data.acknowledged_by,
            acknowledged_at: data.acknowledged_at,
            resolved_at: data.resolved_at
          };
        }
        return s;
      }));
    });

    return () => {
      unsubEmergency();
      unsubHazard();
      unsubReroute();
      unsubBuilding();
      unsubResolved();
      unsubAnnouncement();
      unsubNewSos();
      unsubSosStatus();
    };
  }, [refreshEmergencyState, recalculateRoute, loadTopology]);

  // Load SOS requests for control panel
  const loadSosRequests = useCallback(async () => {
    try {
      const data = await api.getSOSRequests();
      setSosRequests(data);
    } catch (e) {
      console.warn('Could not load SOS requests:', e);
    }
  }, []);

  const sendSosSignal = useCallback(async (payload) => {
    try {
      const res = await api.sendSOS(payload);
      if (res && res.success) {
        try { playEmergencySirenTone(); } catch {}
        const sosData = {
          id: res.sos_id,
          status: 'pending',
          floor: res.floor || payload.floor,
          location: res.location || payload.location,
          situation: payload.situation,
          details: payload.details,
          created_at: new Date().toISOString()
        };
        setActiveSos(sosData);
        localStorage.setItem('evacroute_active_sos', JSON.stringify(sosData));
        setNotificationToast({
          id: Date.now(),
          type: 'danger',
          title: 'EMERGENCY SOS DISPATCHED',
          message: `Distress signal sent for ${payload.situation?.toUpperCase() || 'EMERGENCY'} at ${payload.location} (${payload.floor}). Responders alerted.`
        });
        return res;
      }
    } catch (e) {
      console.warn('API sendSOS error, using local distress fallback:', e);
      try { playEmergencySirenTone(); } catch {}
      const fallbackSos = {
        id: Date.now(),
        status: 'pending',
        floor: payload.floor,
        location: payload.location,
        situation: payload.situation,
        details: payload.details,
        created_at: new Date().toISOString(),
        offline: true
      };
      setActiveSos(fallbackSos);
      localStorage.setItem('evacroute_active_sos', JSON.stringify(fallbackSos));
      setNotificationToast({
        id: Date.now(),
        type: 'danger',
        title: 'EMERGENCY SOS DISPATCHED (DIRECT)',
        message: `Distress signal sent for ${payload.situation?.toUpperCase() || 'EMERGENCY'} at ${payload.location}.`
      });
      return { success: true, sos_id: fallbackSos.id, floor: payload.floor, location: payload.location };
    }
  }, []);

  const acknowledgeSosRequest = useCallback(async (sosId, responderName = 'Safety Officer') => {
    const res = await api.acknowledgeSOS(sosId, { acknowledged_by: responderName });
    await loadSosRequests();
    return res;
  }, [loadSosRequests]);

  const resolveSosRequest = useCallback(async (sosId) => {
    const res = await api.resolveSOS(sosId);
    setActiveSos(prev => {
      if (prev && prev.id === sosId) {
        localStorage.removeItem('evacroute_active_sos');
        return null;
      }
      return prev;
    });
    await loadSosRequests();
    return res;
  }, [loadSosRequests]);

  const selectUserLocation = (nodeId) => {
    setUserLocationNode(nodeId);
    const node = topology.nodes.find((n) => n.id === nodeId);
    if (node && node.floor) {
      setSelectedFloor(node.floor);
    }
  };

  // Dynamic incident updater: Updates Cause & Room Number in Emergency Alert and Map Hazards
  const updateEmergencyIncident = useCallback(async ({ emergencyType, roomInput, floor }) => {
    const rawRoom = roomInput !== undefined ? String(roomInput).trim() : '205';
    // Clean any prefix (e.g. "F2-", "F1-", "GF-", "Room ")
    let cleanNum = rawRoom.replace(/^(F\d+|GF)[-_ ]+/i, '').replace(/^room\s*/i, '').trim();
    if (!cleanNum) cleanNum = '205';
    const formattedLocation = /^\d+[A-Za-z]?$/.test(cleanNum) ? `Room ${cleanNum}` : `Room ${cleanNum}`;

    // Find node in topology
    let targetNode = null;
    if (topology?.nodes && topology.nodes.length > 0) {
      targetNode = topology.nodes.find(n => {
        const idClean = n.id.replace(/^(F\d+|GF)-/i, '').toLowerCase();
        return idClean === cleanNum.toLowerCase() || 
               n.id.toLowerCase() === rawRoom.toLowerCase() || 
               n.label.toLowerCase().includes(cleanNum.toLowerCase());
      });
    }

    const resolvedFloor = floor || (targetNode ? targetNode.floor : (
      cleanNum.startsWith('4') ? 'Floor 4' : 
      cleanNum.startsWith('3') ? 'Floor 3' : 
      cleanNum.startsWith('1') ? 'Floor 1' : 
      cleanNum.startsWith('0') ? 'Ground' : 'Floor 2'
    ));
    const resolvedNodeId = targetNode ? targetNode.id : (
      resolvedFloor === 'Floor 4' ? `F4-${cleanNum}` : 
      resolvedFloor === 'Floor 1' ? `F1-${cleanNum}` : 
      resolvedFloor === 'Ground' ? `GF-${cleanNum}` : `F2-${cleanNum}`
    );

    const newCause = emergencyType || activeEmergency?.emergency_type || 'fire';

    const updatedEmergency = {
      id: activeEmergency?.id || 1,
      emergency_type: newCause,
      building_name: 'Main Academic Complex',
      floor: resolvedFloor,
      location: formattedLocation,
      node_id: resolvedNodeId,
      severity: 'critical',
      status: 'active',
      description: `Active ${newCause} emergency reported at ${formattedLocation} on ${resolvedFloor}. Evacuate immediately.`
    };

    const updatedHazard = {
      id: 1,
      hazard_type: newCause,
      floor: resolvedFloor,
      node_id: resolvedNodeId,
      severity: 'critical',
      description: `Active ${newCause} hazard at ${formattedLocation}`,
      is_active: true
    };

    setActiveEmergency(updatedEmergency);
    setHazards([updatedHazard]);
    setSelectedFloor(resolvedFloor);
    localStorage.setItem('evacroute_offline_emergency', JSON.stringify(updatedEmergency));
    localStorage.setItem('evacroute_offline_hazards', JSON.stringify([updatedHazard]));

    // Notify backend if reachable
    try {
      await api.activateEmergency({
        emergency_type: newCause,
        building_name: 'Main Academic Complex',
        floor: resolvedFloor,
        location: formattedLocation,
        node_id: resolvedNodeId,
        severity: 'critical',
        description: `Emergency activated at ${formattedLocation}`,
        is_simulation: true
      });
    } catch (e) {
      console.warn('Backend emergency update fallback to client state:', e);
    }

    // Recalculate route away from new hazard
    recalculateRoute(userLocationNode, accessibleMode);
  }, [topology, activeEmergency, recalculateRoute, userLocationNode, accessibleMode]);

  return (
    <EmergencyContext.Provider
      value={{
        topology,
        activeEmergency,
        hazards,
        selectedFloor,
        setSelectedFloor,
        userLocationNode,
        selectUserLocation,
        updateEmergencyIncident,
        accessibleMode,
        setAccessibleMode,
        routeResult,
        selectedRoute,
        setSelectedRoute,
        isRecalculating,
        recalculateRoute,
        refreshEmergencyState,
        loadTopology,
        notificationToast,
        setNotificationToast,
        announcement,
        setAnnouncement,
        isOffline,
        isSosModalOpen,
        setIsSosModalOpen,
        openSosModal,
        closeSosModal,
        activeSos,
        setActiveSos,
        sosRequests,
        loadSosRequests,
        sendSosSignal,
        acknowledgeSosRequest,
        resolveSosRequest,
      }}
    >
      {children}
    </EmergencyContext.Provider>
  );
}

export function useEmergency() {
  const context = useContext(EmergencyContext);
  if (!context) {
    throw new Error('useEmergency must be used within an EmergencyProvider');
  }
  return context;
}
