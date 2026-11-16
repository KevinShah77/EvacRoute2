import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { EmergencyProvider } from './context/EmergencyContext';
import { VoiceNavigationProvider } from './context/VoiceNavigationContext';

import Navbar from './components/Navbar';
import EmergencyBanner from './components/EmergencyBanner';
import SosModal from './components/SosModal';

import EmergencyEvacuationPage from './pages/EmergencyEvacuationPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import SimulationDemoPage from './pages/SimulationDemoPage';
import LoginPage from './pages/LoginPage';

function ProtectedAdminRoute({ children }) {
  const { role } = useAuth();
  if (role !== 'admin') {
    return <Navigate to="/emergency" replace />;
  }
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <EmergencyProvider>
          <VoiceNavigationProvider>
            <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
              
              <Navbar />
              <EmergencyBanner />
              <SosModal />

              <main className="flex-1">
                <Routes>
                  <Route path="/" element={<Navigate to="/emergency" replace />} />
                  <Route path="/emergency" element={<EmergencyEvacuationPage />} />
                  <Route 
                    path="/admin" 
                    element={
                      <ProtectedAdminRoute>
                        <AdminDashboardPage />
                      </ProtectedAdminRoute>
                    } 
                  />
                  <Route path="/simulation" element={<SimulationDemoPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  
                  {/* Redirect legacy removed routes to evacuation map (Task 2 & 4) */}
                  <Route path="/responder" element={<Navigate to="/emergency" replace />} />
                  <Route path="/report" element={<Navigate to="/emergency" replace />} />
                  <Route path="/analytics" element={<Navigate to="/emergency" replace />} />
                  <Route path="*" element={<Navigate to="/emergency" replace />} />
                </Routes>
              </main>

              {/* Minimal Clean Footer (Task 9: unnecessary text removed) */}
              <footer className="border-t border-slate-900 bg-slate-950 py-3 px-4 text-center text-xs text-slate-500">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                  <span>EvacRoute Emergency Response</span>
                  <span className="font-mono text-[11px] text-emerald-400">● Online</span>
                </div>
              </footer>

            </div>
          </VoiceNavigationProvider>
        </EmergencyProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
