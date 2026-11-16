// EvacRoute API Client

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

export function getToken() {
  return localStorage.getItem('evacroute_token');
}

export function setToken(token) {
  if (token) {
    localStorage.setItem('evacroute_token', token);
  } else {
    localStorage.removeItem('evacroute_token');
  }
}

async function request(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = `Request failed: ${response.statusText}`;
    try {
      const errJson = await response.json();
      errorDetail = errJson.detail || errJson.message || errorDetail;
    } catch (e) {
      // ignore
    }
    const err = new Error(errorDetail);
    err.status = response.status;
    throw err;
  }

  return response.json();
}

export const api = {
  // Auth & User Management
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (userData) => request('/auth/register', { method: 'POST', body: JSON.stringify(userData) }),
  quickDemoLogin: (role) => request(`/auth/quick-demo-login?role=${role}`, { method: 'POST' }),
  getCurrentUser: () => request('/auth/me'),
  listUsers: () => request('/auth/users'),
  getUserStats: () => request('/auth/stats'),
  updateUserRole: (userId, role) => request(`/auth/users/${userId}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),
  deleteUser: (userId) => request(`/auth/users/${userId}`, { method: 'DELETE' }),

  // Emergency
  getActiveEmergency: () => request('/emergency/active'),
  activateEmergency: (payload) => request('/emergency/activate', { method: 'POST', body: JSON.stringify(payload) }),
  reportEmergency: (payload) => request('/emergency/report', { method: 'POST', body: JSON.stringify(payload) }),
  getReports: (statusFilter) => request(`/emergency/reports${statusFilter ? `?status_filter=${statusFilter}` : ''}`),
  verifyReport: (reportId, payload) => request(`/emergency/reports/${reportId}/verify`, { method: 'POST', body: JSON.stringify(payload) }),
  resolveEmergency: (payload) => request('/emergency/resolve', { method: 'POST', body: JSON.stringify(payload) }),
  getEmergencyHistory: () => request('/emergency/history'),
  broadcastAnnouncement: (payload) => request('/emergency/announcement', { method: 'POST', body: JSON.stringify(payload) }),

  // SOS Emergency Requests
  sendSOS: (payload) => request('/emergency/sos', { method: 'POST', body: JSON.stringify(payload) }),
  getSOSRequests: (statusFilter) => request(`/emergency/sos${statusFilter ? `?status_filter=${statusFilter}` : ''}`),
  acknowledgeSOS: (sosId, payload) => request(`/emergency/sos/${sosId}/acknowledge`, { method: 'POST', body: JSON.stringify(payload || {}) }),
  resolveSOS: (sosId) => request(`/emergency/sos/${sosId}/resolve`, { method: 'POST' }),

  // Safe Arrival Check-in
  checkinAtAssembly: (payload) => request('/emergency/checkin', { method: 'POST', body: JSON.stringify(payload) }),
  getCheckins: () => request('/emergency/checkins'),

  // Hazards
  getActiveHazards: (floor) => request(`/hazards${floor ? `?floor=${encodeURIComponent(floor)}` : ''}`),
  addHazard: (payload) => request('/hazards', { method: 'POST', body: JSON.stringify(payload) }),
  clearHazard: (hazardId) => request(`/hazards/${hazardId}`, { method: 'DELETE' }),
  resetAllHazards: () => request('/hazards/reset', { method: 'POST' }),

  // Routing
  calculateEvacuationRoute: (startNodeId, targetExitId = null, accessibleMode = false) =>
    request('/routing/evacuate', {
      method: 'POST',
      body: JSON.stringify({
        start_node_id: startNodeId,
        target_exit_id: targetExitId,
        accessible_mode: accessibleMode,
      }),
    }),
  getOperationalExits: () => request('/routing/exits'),

  // Building Management & Topology
  getTopology: () => request('/building/topology'),
  getFloors: () => request('/building/floors'),
  getNodes: (floor, type) => {
    const params = new URLSearchParams();
    if (floor) params.append('floor', floor);
    if (type) params.append('node_type', type);
    const qs = params.toString();
    return request(`/building/nodes${qs ? `?${qs}` : ''}`);
  },
  createNode: (nodeData) => request('/building/nodes', { method: 'POST', body: JSON.stringify(nodeData) }),
  updateNode: (nodeId, nodeData) => request(`/building/nodes/${nodeId}`, { method: 'PUT', body: JSON.stringify(nodeData) }),
  deleteNode: (nodeId) => request(`/building/nodes/${nodeId}`, { method: 'DELETE' }),
  getEdges: () => request('/building/edges'),
  createEdge: (edgeData) => request('/building/edges', { method: 'POST', body: JSON.stringify(edgeData) }),
  deleteEdge: (source, target) => request('/building/edges', { method: 'DELETE', body: JSON.stringify({ source, target }) }),
  resetTopology: () => request('/building/reset', { method: 'POST' }),
  resolveQrLocation: (roomId) => request(`/building/qr/${encodeURIComponent(roomId)}`),

  // Notifications
  getVapidPublicKey: () => request('/notifications/vapid-public-key'),
  subscribePush: (subscriptionData) => request('/notifications/subscribe', { method: 'POST', body: JSON.stringify(subscriptionData) }),
  sendTestNotification: (payload) => request('/notifications/test', { method: 'POST', body: JSON.stringify(payload || {}) }),
  getNotificationStats: () => request('/notifications/stats'),
  getRecentDispatches: () => request('/notifications/recent-dispatches'),

  // IoT
  getSensors: () => request('/iot/sensors'),
  simulateSensorAlarm: (payload) => request('/iot/simulate-alarm', { method: 'POST', body: JSON.stringify(payload) }),
  resetSensors: () => request('/iot/reset', { method: 'POST' }),

  // Analytics
  getAnalyticsSummary: (floor, entrance, emergencyId) => {
    const params = new URLSearchParams();
    if (floor && floor !== 'all') params.append('floor', floor);
    if (entrance && entrance !== 'all') params.append('entrance', entrance);
    if (emergencyId && emergencyId !== 'all') params.append('emergency_id', emergencyId);
    const qs = params.toString();
    return request(`/analytics/summary${qs ? `?${qs}` : ''}`);
  },
};
