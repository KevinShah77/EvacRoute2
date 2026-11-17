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
            <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
              
              <Navbar />
              
              {/* Full-width content area with overhead top header (h-16) */}
              <div className="flex flex-col flex-1 min-h-screen pt-16">
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
                    
                    {/* Redirect legacy removed routes to evacuation map */}
                    <Route path="/responder" element={<Navigate to="/emergency" replace />} />
                    <Route path="/report" element={<Navigate to="/emergency" replace />} />
                    <Route path="/analytics" element={<Navigate to="/emergency" replace />} />
                    <Route path="*" element={<Navigate to="/emergency" replace />} />
                  </Routes>
                </main>

                {/* Professional Clean Footer */}
                <footer className="border-t border-slate-200 bg-white py-3 px-4 sm:px-6 text-xs text-slate-500">
                  <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <span>EvacRoute Campus Emergency Management Platform</span>
                    <span className="font-mono text-[11px] text-emerald-600 flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      <span>System Online</span>
                    </span>
                  </div>
                </footer>
              </div>

            </div>
          </VoiceNavigationProvider>
        </EmergencyProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
