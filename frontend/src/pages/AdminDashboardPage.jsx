import React, { useState, useEffect } from 'react';
import { 
  Flame, 
  Wind, 
  AlertTriangle, 
  ShieldAlert, 
  Radio, 
  Bell, 
  CheckCircle2, 
  RotateCcw, 
  Users, 
  Layers, 
  Plus, 
  Trash2, 
  Cpu,
  Send,
  CheckCircle,
  Building2,
  Megaphone,
  History,
  DoorOpen,
  UserPlus,
  GitBranch,
  Search
} from 'lucide-react';
import MapCanvas from '../components/MapCanvas';
import { api } from '../services/api';
import { useEmergency } from '../context/EmergencyContext';
import { useAuth } from '../context/AuthContext';

export default function AdminDashboardPage() {
  const { 
    activeEmergency, 
    hazards, 
    refreshEmergencyState, 
    recalculateRoute, 
    topology, 
    loadTopology,
    sosRequests,
    loadSosRequests,
    acknowledgeSosRequest,
    resolveSosRequest
  } = useEmergency();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState('operations'); // 'operations', 'building', 'users', 'announcements', 'history'

  // Form states for activating emergency
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [emergencyType, setEmergencyType] = useState('fire');
  const [floor, setFloor] = useState('Floor 2');
  const [location, setLocation] = useState('Room 205');
  const [nodeId, setNodeId] = useState('F2-205');
  const [severity, setSeverity] = useState('critical');
  const [description, setDescription] = useState('Active fire detected near lecture podium');
  const [isSimulation, setIsSimulation] = useState(true);
  const [loading, setLoading] = useState(false);

  // Form for adding hazard
  const [hazardType, setHazardType] = useState('fire');
  const [hazardFloor, setHazardFloor] = useState('Floor 2');
  const [hazardNodeId, setHazardNodeId] = useState('F2-S-NW');

  // Resolution modal
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('Facility perimeter inspected. Fire suppressed and air quality verified safe.');

  // IoT Sensors
  const [sensors, setSensors] = useState([]);
  const [iotLoading, setIotLoading] = useState(false);

  // Stats & History
  const [notifStats, setNotifStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [userStats, setUserStats] = useState({ total_students: 0, total_staff: 0, total_admins: 0 });
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [operationalExits, setOperationalExits] = useState([]);

  // Announcement state
  const [announcementTitle, setAnnouncementTitle] = useState('EVACUATION INSTRUCTION');
  const [announcementMsg, setAnnouncementMsg] = useState('All occupants proceed to designated emergency assembly points immediately.');
  const [announcementSending, setAnnouncementSending] = useState(false);

  // Active Unresolved SOS Distress Signals
  const activeSosRequests = (sosRequests || []).filter(s => s.status !== 'resolved');

  // Building Management states
  const [buildingFloorFilter, setBuildingFloorFilter] = useState('all');
  const [newNode, setNewNode] = useState({
    id: '',
    label: '',
    floor: 'Floor 2',
    type: 'classroom',
    accessible: true,
    x: 50.0,
    y: 50.0
  });
  const [newEdge, setNewEdge] = useState({
    source: '',
    target: '',
    weight: 10.0,
    is_stairs: false
  });

  const loadData = async () => {
    try {
      await loadSosRequests();
    } catch (e) {
      console.warn('Failed to load SOS requests:', e);
    }

    try {
      const [sensorData, stats, hist, uStats, uList, exits] = await Promise.all([
        api.getSensors().catch(() => []),
        api.getNotificationStats().catch(() => null),
        api.getEmergencyHistory().catch(() => []),
        api.getUserStats().catch(() => ({ total_students: 0, total_staff: 0, checked_in: 0 })),
        api.listUsers().catch(() => []),
        api.getOperationalExits().catch(() => [])
      ]);
      setSensors(sensorData);
      setNotifStats(stats);
      setHistory(hist);
      setUserStats(uStats);
      setUsers(uList);
      setOperationalExits(exits);
    } catch (e) {
      console.warn('Failed to load admin stats:', e);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleActivateEmergency = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const cleanLoc = (location || '').replace(/^(F\d+|GF)[-_ ]+/i, '').trim();
      const formattedLoc = cleanLoc ? (/^\d+[A-Za-z]?$/.test(cleanLoc) ? `Room ${cleanLoc}` : cleanLoc) : 'Room 205';

      await api.activateEmergency({
        emergency_type: emergencyType,
        building_name: 'Main Academic Complex',
        floor,
        location: formattedLoc,
        node_id: nodeId,
        severity,
        description,
        is_simulation: isSimulation,
      });
      setShowActivateModal(false);
      await refreshEmergencyState();
      await recalculateRoute();
      await loadData();
    } catch (err) {
      alert(`Failed to activate emergency: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddHazard = async () => {
    try {
      await api.addHazard({
        hazard_type: hazardType,
        floor: hazardFloor,
        node_id: hazardNodeId,
        severity: 'critical',
        description: `Corridor blockage reported by Safety Command`,
      });
      await refreshEmergencyState();
      await recalculateRoute();
    } catch (err) {
      alert(`Error adding hazard: ${err.message}`);
    }
  };

  const handleClearHazard = async (id) => {
    try {
      await api.clearHazard(id);
      await refreshEmergencyState();
      await recalculateRoute();
    } catch (err) {
      alert(`Error clearing hazard: ${err.message}`);
    }
  };

  const handleResetAllHazards = async () => {
    if (confirm('Clear all hazards across the entire building?')) {
      await api.resetAllHazards();
      await refreshEmergencyState();
      await recalculateRoute();
    }
  };

  const handleResolveEmergency = async () => {
    if (!activeEmergency) return;
    try {
      await api.resolveEmergency({
        emergency_id: activeEmergency.id,
        resolution_notes: resolutionNotes,
      });
      setShowResolveModal(false);
      await refreshEmergencyState();
      await recalculateRoute();
      await loadData();
    } catch (err) {
      alert(`Error resolving emergency: ${err.message}`);
    }
  };

  const handleSimulateSensorSpike = async (sensorId) => {
    setIotLoading(true);
    try {
      await api.simulateSensorAlarm({
        sensor_id: sensorId,
        value: 85.0,
        auto_activate_emergency: true,
      });
      await refreshEmergencyState();
      await recalculateRoute();
      await loadData();
    } catch (err) {
      alert(`IoT simulation failed: ${err.message}`);
    } finally {
      setIotLoading(false);
    }
  };

  const handleResetSensors = async () => {
    await api.resetSensors();
    await loadData();
  };

  const handleSendAnnouncement = async (e) => {
    e.preventDefault();
    setAnnouncementSending(true);
    try {
      await api.broadcastAnnouncement({
        title: announcementTitle,
        message: announcementMsg,
        priority: 'urgent'
      });
      alert('Emergency announcement broadcast to all campus occupants!');
    } catch (err) {
      alert(`Failed to send announcement: ${err.message}`);
    } finally {
      setAnnouncementSending(false);
    }
  };

  const handleUpdateUserRole = async (userId, newRole) => {
    try {
      await api.updateUserRole(userId, newRole);
      await loadData();
    } catch (err) {
      alert(`Failed to update role: ${err.message}`);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (confirm('Are you sure you want to delete this user account?')) {
      try {
        await api.deleteUser(userId);
        await loadData();
      } catch (err) {
        alert(`Failed to delete user: ${err.message}`);
      }
    }
  };

  const handleCreateNode = async (e) => {
    e.preventDefault();
    if (!newNode.id.trim() || !newNode.label.trim()) {
      alert('Please provide node ID and label');
      return;
    }
    try {
      await api.createNode({
        ...newNode,
        x: parseFloat(newNode.x),
        y: parseFloat(newNode.y)
      });
      alert(`Node ${newNode.id} added to building model!`);
      setNewNode({
        id: '',
        label: '',
        floor: newNode.floor,
        type: 'classroom',
        accessible: true,
        x: 50.0,
        y: 50.0
      });
      await loadTopology();
      await recalculateRoute();
    } catch (err) {
      alert(`Failed to create node: ${err.message}`);
    }
  };

  const handleDeleteNode = async (nodeId) => {
    if (confirm(`Delete node ${nodeId} and all connected corridor connections?`)) {
      try {
        await api.deleteNode(nodeId);
        await loadTopology();
        await recalculateRoute();
      } catch (err) {
        alert(`Failed to delete node: ${err.message}`);
      }
    }
  };

  const handleCreateEdge = async (e) => {
    e.preventDefault();
    if (!newEdge.source || !newEdge.target) {
      alert('Select source and target nodes');
      return;
    }
    try {
      await api.createEdge({
        source: newEdge.source,
        target: newEdge.target,
        weight: parseFloat(newEdge.weight),
        is_stairs: newEdge.is_stairs
      });
      alert(`Corridor connection ${newEdge.source} <-> ${newEdge.target} added!`);
      await loadTopology();
      await recalculateRoute();
    } catch (err) {
      alert(`Failed to connect nodes: ${err.message}`);
    }
  };

  const handleResetBuilding = async () => {
    if (confirm('Reset building topology to original campus architectural floor plans?')) {
      try {
        await api.resetTopology();
        await loadTopology();
        await recalculateRoute();
        alert('Building topology reset to default.');
      } catch (err) {
        alert(`Reset failed: ${err.message}`);
      }
    }
  };

  const filteredUsers = users.filter(u => 
    u.full_name?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.role?.toLowerCase().includes(userSearch.toLowerCase())
  );

  const displayedNodes = (topology?.nodes || []).filter(n => 
    buildingFloorFilter === 'all' || n.floor === buildingFloorFilter
  );

  const safeExitsCount = operationalExits.filter(ex => ex.status === 'OPERATIONAL').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-5 text-slate-900">
      
      {/* Header & Command Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Safety Command Center
            </h1>
            <span className="text-[11px] bg-slate-900 text-white px-2 py-0.5 rounded font-bold uppercase tracking-wider">
              Admin
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Campus incident dispatch, corridor hazard controls, building model, and broadcast directives.
          </p>
        </div>

        {/* Primary Emergency Action Buttons */}
        <div className="flex items-center space-x-2.5">
          {activeEmergency ? (
            <button
              onClick={() => setShowResolveModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Resolve Emergency (All Clear)</span>
            </button>
          ) : (
            <button
              onClick={() => setShowActivateModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Flame className="w-4 h-4 fill-white" />
              <span>Activate Emergency Protocol</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveTab('operations')}
          className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'operations'
              ? 'bg-[#0f172a] text-white shadow-xs'
              : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          <span>Operations & Hazards</span>
          {activeSosRequests.length > 0 && (
            <span className="bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
              {activeSosRequests.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('building')}
          className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'building'
              ? 'bg-[#0f172a] text-white shadow-xs'
              : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Building & Graph Management</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'users'
              ? 'bg-[#0f172a] text-white shadow-xs'
              : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>User Directory ({userStats.total_students + userStats.total_staff})</span>
        </button>

        <button
          onClick={() => setActiveTab('announcements')}
          className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'announcements'
              ? 'bg-[#0f172a] text-white shadow-xs'
              : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
          }`}
        >
          <Megaphone className="w-3.5 h-3.5" />
          <span>Broadcast Directives</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'history'
              ? 'bg-[#0f172a] text-white shadow-xs'
              : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Incident History ({history.length})</span>
        </button>
      </div>

      {/* Quick Statistics KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">
            <span>Protocol</span>
            <Radio className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="mt-1.5 text-base sm:text-lg font-bold text-slate-900 uppercase truncate">
            {activeEmergency ? activeEmergency.emergency_type : 'Normal'}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 truncate">
            {activeEmergency ? `Floor: ${activeEmergency.floor}` : 'Operations Clear'}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">
            <span>Active Hazards</span>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="mt-1.5 text-lg sm:text-xl font-bold text-slate-900">
            {hazards.length}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Compromised sectors
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">
            <span>Students</span>
            <Users className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="mt-1.5 text-lg sm:text-xl font-bold text-slate-900">
            {userStats.total_students}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Registered occupants
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">
            <span>Staff</span>
            <ShieldAlert className="w-3.5 h-3.5 text-purple-600" />
          </div>
          <div className="mt-1.5 text-lg sm:text-xl font-bold text-slate-900">
            {userStats.total_staff}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Safety marshals
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">
            <span>Safe Exits</span>
            <DoorOpen className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="mt-1.5 text-lg sm:text-xl font-bold text-emerald-700">
            {safeExitsCount} / {operationalExits.length || 3}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Operational portals
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">
            <span>Alert Clients</span>
            <Bell className="w-3.5 h-3.5 text-cyan-600" />
          </div>
          <div className="mt-1.5 text-lg sm:text-xl font-bold text-slate-900">
            {notifStats?.registered_devices_count || 1}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Active push clients
          </div>
        </div>
      </div>

      {/* Tab 1: Operations & Live Hazards */}
      {activeTab === 'operations' && (
        <div className="space-y-4">
          
          {/* Active SOS Distress Signals Card */}
          {activeSosRequests.length > 0 ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-red-950 font-bold text-sm">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span>Incoming SOS Distress Calls ({activeSosRequests.length})</span>
                </div>
                <span className="text-[10px] bg-red-600 text-white font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                  Action Required
                </span>
              </div>

              <div className="space-y-2">
                {activeSosRequests.map((sos) => (
                  <div key={sos.id} className="bg-white border border-red-200 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
                    <div>
                      <div className="font-bold text-slate-900 flex items-center space-x-2">
                        <span className="text-sm">{sos.user_name || 'Occupant'}</span>
                        <span className="text-[10px] bg-red-100 text-red-800 px-2 py-0.5 rounded font-mono uppercase font-bold">
                          {sos.situation}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                          sos.status === 'acknowledged' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {sos.status}
                        </span>
                      </div>
                      <div className="text-slate-600 text-xs mt-1">
                        Location: <strong className="text-slate-900">{sos.floor} • {sos.location}</strong> {sos.contact && `• Contact: ${sos.contact}`}
                      </div>
                      {sos.details && <div className="text-slate-600 text-[11px] mt-1 italic bg-slate-50 p-1.5 px-2.5 rounded border border-slate-100">"{sos.details}"</div>}
                    </div>

                    <div className="flex items-center space-x-2">
                      {sos.status !== 'acknowledged' && (
                        <button
                          onClick={() => acknowledgeSosRequest(sos.id, user?.full_name || 'Safety Command')}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
                        >
                          Acknowledge
                        </button>
                      )}
                      <button
                        onClick={() => resolveSosRequest(sos.id)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
                      >
                        Mark Resolved
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800">
                  <CheckCircle className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-slate-900 text-sm">Incoming Distress Signals (0)</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">All campus sectors clear. No active occupant distress reported.</p>
                </div>
              </div>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded font-bold uppercase tracking-wider">
                All Clear
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Interactive Map (7 cols) */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <span>Interactive Building Safety Graph</span>
                </h3>
                <button
                  onClick={handleResetAllHazards}
                  className="text-xs text-slate-600 hover:text-slate-900 flex items-center space-x-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 font-medium transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset All Hazards</span>
                </button>
              </div>
              <MapCanvas adminHazardMode={true} />
            </div>

            {/* Active Hazards Table */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm text-slate-900">
                  Active Campus Hazards ({hazards.length})
                </h3>
                <span className="text-xs text-slate-500 font-normal">Recalculates route automatically</span>
              </div>

              {hazards.length === 0 ? (
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-100 text-center text-xs text-slate-500">
                  No active hazards recorded. All corridors open and passable.
                </div>
              ) : (
                <div className="space-y-2">
                  {hazards.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="p-1.5 rounded-lg bg-red-100 border border-red-200 text-red-700">
                          <Flame className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 capitalize">
                            {h.hazard_type} Hazard ({h.severity})
                          </div>
                          <div className="text-slate-500 text-[11px] mt-0.5">
                            Location: <strong className="text-slate-800">{h.node_id || `${h.edge_source} ↔ ${h.edge_target}`}</strong> ({h.floor})
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleClearHazard(h.id)}
                        className="px-2.5 py-1 text-xs text-red-600 hover:text-white hover:bg-red-600 rounded-lg transition-colors border border-red-200 hover:border-red-600 flex items-center space-x-1 cursor-pointer font-semibold"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Clear</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Controls & IoT Simulation (5 cols) */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-4">
            
            {/* Dynamic Hazard Injector Panel */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                <Plus className="w-4 h-4 text-emerald-600" />
                <span>Inject Real-Time Hazard / Blockage</span>
              </h3>
              
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-700 text-xs font-semibold mb-1">Hazard Type</label>
                  <select
                    value={hazardType}
                    onChange={(e) => setHazardType(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="fire">Fire (Impassable - Blocks corridor)</option>
                    <option value="smoke">Heavy Smoke (5x traversal penalty)</option>
                    <option value="gas">Toxic Gas Leak (Impassable)</option>
                    <option value="structural">Structural Debris (Impassable)</option>
                    <option value="blocked">Corridor Blockage / Collapse</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-700 text-xs font-semibold mb-1">Floor</label>
                    <select
                      value={hazardFloor}
                      onChange={(e) => setHazardFloor(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="Ground">Ground</option>
                      <option value="Floor 1">Floor 1</option>
                      <option value="Floor 2">Floor 2</option>
                      <option value="Floor 3">Floor 3</option>
                      <option value="Floor 4">Floor 4</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 text-xs font-semibold mb-1">Target Node ID</label>
                    <input
                      type="text"
                      value={hazardNodeId}
                      onChange={(e) => setHazardNodeId(e.target.value)}
                      placeholder="e.g. F2-S-NW, F2-C-EAST"
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <button
                  onClick={handleAddHazard}
                  className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-xs transition-colors text-xs flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <Flame className="w-4 h-4" />
                  <span>Inject Hazard & Trigger Recalculation</span>
                </button>
              </div>
            </div>

            {/* IoT Sensor Gateway Simulation */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                  <Cpu className="w-4 h-4 text-cyan-600" />
                  <span>IoT Sensor Telemetry Gateway</span>
                </h3>
                <button
                  onClick={handleResetSensors}
                  className="text-[11px] text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
                >
                  Reset Sensors
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Click 'Simulate Spike' to simulate physical smoke/temperature threshold spike triggering emergency broadcast.
              </p>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {sensors.map((s) => (
                  <div
                    key={s.sensor_id}
                    className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                      s.status === 'alert'
                        ? 'bg-red-50 border-red-200 text-red-950'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                        <span>{s.sensor_id}</span>
                        <span className="text-[10px] uppercase font-normal text-slate-500">({s.sensor_type})</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {s.floor} • Room {s.room_id} • Value: <strong className={s.status === 'alert' ? 'text-red-600' : 'text-emerald-700'}>{s.current_value} {s.unit}</strong>
                      </div>
                    </div>

                    <button
                      onClick={() => handleSimulateSensorSpike(s.sensor_id)}
                      disabled={iotLoading}
                      className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold shadow-xs cursor-pointer"
                    >
                      Simulate Spike
                    </button>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
        </div>
      )}

      {/* Tab 2: Building & Floor Management (Section 10) */}
      {activeTab === 'building' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <span>Campus Architectural Model & Evacuation Graph Management</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Manage buildings, floors, rooms, staircases, ramps, corridors, exits, assembly points, and graph connections.
                </p>
              </div>

              <button
                onClick={handleResetBuilding}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 flex items-center space-x-1.5 self-start cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Seed Topology</span>
              </button>
            </div>

            {/* Forms Grid: Add Node & Add Corridor Connection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              {/* Add Room/Node Form */}
              <form onSubmit={handleCreateNode} className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-3">
                <h3 className="font-bold text-slate-900 text-xs flex items-center space-x-2">
                  <Plus className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Add Room / Location / Exit / Assembly Point</span>
                </h3>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-700 text-xs font-semibold mb-1">Node ID (e.g. F2-230)</label>
                    <input
                      type="text"
                      required
                      value={newNode.id}
                      onChange={(e) => setNewNode({ ...newNode, id: e.target.value })}
                      placeholder="e.g. F2-230"
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 text-xs font-semibold mb-1">Label (Display Name)</label>
                    <input
                      type="text"
                      required
                      value={newNode.label}
                      onChange={(e) => setNewNode({ ...newNode, label: e.target.value })}
                      placeholder="e.g. Room 230 (Seminar)"
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-700 text-xs font-semibold mb-1">Floor</label>
                    <select
                      value={newNode.floor}
                      onChange={(e) => setNewNode({ ...newNode, floor: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="Ground">Ground</option>
                      <option value="Floor 1">Floor 1</option>
                      <option value="Floor 2">Floor 2</option>
                      <option value="Floor 3">Floor 3</option>
                      <option value="Floor 4">Floor 4</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 text-xs font-semibold mb-1">Node Type</label>
                    <select
                      value={newNode.type}
                      onChange={(e) => setNewNode({ ...newNode, type: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="classroom">Classroom / Office</option>
                      <option value="corridor">Corridor Junction</option>
                      <option value="staircase">Staircase</option>
                      <option value="elevator">Evacuation Lift</option>
                      <option value="ramp">Accessible Ramp</option>
                      <option value="exit">Exterior Exit Door</option>
                      <option value="assembly_point">Assembly Point</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-700 text-xs font-semibold mb-1">X Coordinate (0-100)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={newNode.x}
                      onChange={(e) => setNewNode({ ...newNode, x: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 text-xs font-semibold mb-1">Y Coordinate (0-100)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={newNode.y}
                      onChange={(e) => setNewNode({ ...newNode, y: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow-xs transition-colors cursor-pointer"
                >
                  Create Node & Refresh Graph
                </button>
              </form>

              {/* Add Corridor Connection Form */}
              <form onSubmit={handleCreateEdge} className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-3">
                <h3 className="font-bold text-slate-900 text-xs flex items-center space-x-2">
                  <GitBranch className="w-3.5 h-3.5 text-purple-600" />
                  <span>Connect Corridors / Graph Edge</span>
                </h3>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-700 text-xs font-semibold mb-1">Source Node ID</label>
                    <input
                      type="text"
                      required
                      value={newEdge.source}
                      onChange={(e) => setNewEdge({ ...newEdge, source: e.target.value })}
                      placeholder="e.g. F2-230"
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 text-xs font-semibold mb-1">Target Node ID</label>
                    <input
                      type="text"
                      required
                      value={newEdge.target}
                      onChange={(e) => setNewEdge({ ...newEdge, target: e.target.value })}
                      placeholder="e.g. F2-C-EAST"
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-700 text-xs font-semibold mb-1">Length / Weight (meters)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={newEdge.weight}
                      onChange={(e) => setNewEdge({ ...newEdge, weight: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex items-center pt-5 space-x-2">
                    <input
                      type="checkbox"
                      id="isStairs"
                      checked={newEdge.is_stairs}
                      onChange={(e) => setNewEdge({ ...newEdge, is_stairs: e.target.checked })}
                      className="rounded text-blue-600 border-slate-300"
                    />
                    <label htmlFor="isStairs" className="text-slate-700 font-medium">
                      Contains Stairs (Exclude in ADA)
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-xs shadow-xs transition-colors cursor-pointer"
                >
                  Add Corridor Connection
                </button>
              </form>

            </div>

            {/* Existing Nodes Table */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-xs">
                  Configured Building Locations ({displayedNodes.length} nodes)
                </h3>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-500">Filter Floor:</span>
                  <select
                    value={buildingFloorFilter}
                    onChange={(e) => setBuildingFloorFilter(e.target.value)}
                    className="bg-white border border-slate-200 text-xs rounded-lg px-2 py-1 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="all">All Floors</option>
                    <option value="Ground">Ground</option>
                    <option value="Floor 1">Floor 1</option>
                    <option value="Floor 2">Floor 2</option>
                    <option value="Floor 3">Floor 3</option>
                    <option value="Floor 4">Floor 4</option>
                  </select>
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0 font-semibold">
                    <tr>
                      <th className="p-3">Node ID</th>
                      <th className="p-3">Label</th>
                      <th className="p-3">Floor</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Coordinates</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                    {displayedNodes.map((n) => (
                      <tr key={n.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-mono font-bold text-slate-900">{n.id}</td>
                        <td className="p-3">{n.label}</td>
                        <td className="p-3">{n.floor}</td>
                        <td className="p-3 capitalize">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            n.type === 'exit' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            n.type === 'assembly_point' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            n.type === 'staircase' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                            'bg-slate-100 text-slate-700 border-slate-200'
                          }`}>
                            {n.type}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-[11px] text-slate-500">({n.x}, {n.y})</td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleDeleteNode(n.id)}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                            title="Delete Node"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Tab 3: User Management (Section 3 & 10) */}
      {activeTab === 'users' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span>Campus Occupant & Role Authorization Management</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage registered students, staff, and safety officers with role-based access control.
              </p>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by name, email, role..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="bg-white border border-slate-200 text-xs rounded-lg pl-9 pr-3 py-2 text-slate-900 w-64 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                <tr>
                  <th className="p-3">User</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Department</th>
                  <th className="p-3">Current Role</th>
                  <th className="p-3">Change Role</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-semibold text-slate-900">{u.full_name}</td>
                    <td className="p-3 text-slate-600">{u.email}</td>
                    <td className="p-3 text-slate-500">{u.department || 'General'}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                        u.role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                        u.role === 'staff' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                        'bg-blue-50 text-blue-700 border-blue-200'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="p-3">
                      <select
                        value={u.role}
                        onChange={(e) => handleUpdateUserRole(u.id, e.target.value)}
                        className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="student">Student</option>
                        <option value="staff">Staff</option>
                        <option value="admin">Safety Officer (Admin)</option>
                      </select>
                    </td>
                    <td className="p-3 text-right">
                      {u.id !== user?.id && (
                        <button
                          onClick={() => handleDeleteUser(u.id)}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                          title="Delete User"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Announcements & Notification Delivery Logs */}
      {activeTab === 'announcements' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* Announcement Creator (5 cols) */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <h2 className="font-bold text-sm text-slate-900 flex items-center space-x-2 border-b border-slate-200 pb-3">
              <Megaphone className="w-4 h-4 text-amber-600" />
              <span>Broadcast Safety Announcement</span>
            </h2>

            <form onSubmit={handleSendAnnouncement} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 text-xs font-semibold mb-1">Announcement Title</label>
                <input
                  type="text"
                  required
                  value={announcementTitle}
                  onChange={(e) => setAnnouncementTitle(e.target.value)}
                  placeholder="e.g. Evacuation Protocol Update"
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 text-xs font-semibold mb-1">Announcement Message</label>
                <textarea
                  required
                  rows="4"
                  value={announcementMsg}
                  onChange={(e) => setAnnouncementMsg(e.target.value)}
                  placeholder="Type urgent directive here..."
                  className="w-full bg-white border border-slate-200 rounded-lg p-3 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={announcementSending}
                className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs shadow-xs transition-colors flex items-center justify-center space-x-2 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>{announcementSending ? 'Broadcasting...' : 'Broadcast Immediate Announcement'}</span>
              </button>
            </form>
          </div>

          {/* Delivery Statistics Logs (7 cols) */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <h2 className="font-bold text-sm text-slate-900 flex items-center space-x-2 border-b border-slate-200 pb-3">
              <Bell className="w-4 h-4 text-blue-600" />
              <span>Push Notification Delivery Logs</span>
            </h2>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                  <tr>
                    <th className="p-3">Alert Title</th>
                    <th className="p-3">Recipients</th>
                    <th className="p-3">Delivered</th>
                    <th className="p-3">Sent At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                  {(notifStats?.recent_logs || []).length === 0 ? (
                    <tr>
                      <td colSpan="4" className="p-4 text-center text-slate-500">
                        No notification logs recorded yet.
                      </td>
                    </tr>
                  ) : (
                    notifStats.recent_logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-semibold text-slate-900">{log.title}</td>
                        <td className="p-3 text-blue-600 font-bold">{log.recipients}</td>
                        <td className="p-3 text-emerald-700 font-bold">{log.delivered}</td>
                        <td className="p-3 text-slate-500">{log.sent_at ? new Date(log.sent_at).toLocaleTimeString() : 'Recent'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* Tab 5: Emergency History (Section 10) */}
      {activeTab === 'history' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h2 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
              <History className="w-4 h-4 text-emerald-600" />
              <span>Historical Emergency Event Audit Trail</span>
            </h2>
            <span className="text-xs text-slate-500">Total Recorded Incidents: {history.length}</span>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                <tr>
                  <th className="p-3">ID</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Floor / Location</th>
                  <th className="p-3">Severity</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Activated At</th>
                  <th className="p-3">Resolution Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                {history.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-6 text-center text-slate-500">
                      No historical emergency events in system database.
                    </td>
                  </tr>
                ) : (
                  history.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-mono text-slate-500">#{h.id}</td>
                      <td className="p-3 font-bold text-slate-900 capitalize">{h.emergency_type}</td>
                      <td className="p-3 text-slate-700">{h.floor}, {h.location}</td>
                      <td className="p-3 uppercase">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          h.severity === 'critical' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}>
                          {h.severity}
                        </span>
                      </td>
                      <td className="p-3 capitalize font-semibold text-slate-800">{h.status}</td>
                      <td className="p-3 text-slate-500">
                        {h.activated_at ? new Date(h.activated_at).toLocaleString() : 'N/A'}
                      </td>
                      <td className="p-3 text-slate-600 max-w-xs truncate">{h.resolution_notes || h.description || 'N/A'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Emergency Activation Modal */}
      {showActivateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 max-w-lg w-full rounded-xl p-6 shadow-xl relative animate-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2 mb-4">
              <Flame className="w-5 h-5 text-red-600" />
              <span>Activate Campus Emergency Protocol</span>
            </h3>

            <form onSubmit={handleActivateEmergency} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Emergency Type</label>
                <select
                  value={emergencyType}
                  onChange={(e) => setEmergencyType(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="fire">Fire Emergency</option>
                  <option value="smoke">Heavy Smoke / Fumes</option>
                  <option value="gas">Hazardous Gas Leakage</option>
                  <option value="structural">Structural Damage / Collapse</option>
                  <option value="blocked">Blocked Corridor / Egress Obstacle</option>
                  <option value="general">General Building Evacuation</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Floor</label>
                  <select
                    value={floor}
                    onChange={(e) => setFloor(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="Ground">Ground</option>
                    <option value="Floor 1">Floor 1</option>
                    <option value="Floor 2">Floor 2</option>
                    <option value="Floor 3">Floor 3</option>
                    <option value="Floor 4">Floor 4</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Room or Exact Location</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="e.g. Room 205"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Exact Node ID (Optional)</label>
                <input
                  type="text"
                  value={nodeId}
                  onChange={(e) => setNodeId(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g. F2-205"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Severity</label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="critical">Critical (Immediate Evacuation)</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Incident Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows="2"
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                ></textarea>
              </div>

              {/* Simulation Mode Toggle */}
              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="simCheck"
                  checked={isSimulation}
                  onChange={(e) => setIsSimulation(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 border-slate-300"
                />
                <label htmlFor="simCheck" className="text-amber-800 font-semibold text-xs">
                  Academic Simulation Mode (Clearly labeled drill)
                </label>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowActivateModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-xs shadow-xs transition-colors cursor-pointer"
                >
                  {loading ? 'Activating...' : 'Confirm & Dispatch Alerts'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Emergency Resolution Modal */}
      {showResolveModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 max-w-md w-full rounded-xl p-6 shadow-xl relative animate-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2 mb-2">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              <span>Confirm Emergency Resolution</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Resolving will clear all active hazards across the building, dispatch the All-Clear push broadcast, and return the system to normal operations.
            </p>

            <div className="space-y-2 text-xs mb-4">
              <label className="block text-slate-700 font-semibold">Resolution Notes & Safety Debrief:</label>
              <textarea
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                rows="3"
                placeholder="Incident successfully resolved. Building safe for re-entry."
                className="w-full bg-white border border-slate-200 rounded-lg p-3 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
              ></textarea>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowResolveModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleResolveEmergency}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-xs transition-colors cursor-pointer"
              >
                Mark Campus All-Clear
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
