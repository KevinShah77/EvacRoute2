import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Lock, Mail, UserCheck, ArrowRight, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login, register, quickDemoLogin } = useAuth();
  const navigate = useNavigate();

  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('student@evacroute.edu');
  const [password, setPassword] = useState('student123');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('student');
  const [department, setDepartment] = useState('Computer Engineering');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isRegistering) {
        await register({ email, password, full_name: fullName, role, department });
      } else {
        await login(email, password);
      }
      navigate('/emergency');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (selectedRole) => {
    try {
      await quickDemoLogin(selectedRole);
      navigate(selectedRole === 'admin' ? '/admin' : '/emergency');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        
        {/* Subtle decorative glow */}
        <div className="absolute -top-16 -right-16 w-32 h-32 bg-blue-600/20 rounded-full blur-2xl pointer-events-none"></div>

        <div className="text-center mb-6">
          <div className="inline-flex p-3 rounded-2xl bg-blue-600/20 border border-blue-500/30 text-blue-400 mb-3">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">
            Evac<span className="text-red-500">Route</span> Access
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Emergency Response Control Panel
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/80 border border-red-600 text-red-200 text-xs">
            {error}
          </div>
        )}

        {/* 1-Click Evaluation Login Buttons */}
        <div className="mb-6 pb-6 border-b border-slate-800">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5 text-center">
            One-Click Login:
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleQuickLogin('student')}
              className="px-3 py-2.5 rounded-xl bg-blue-950/80 hover:bg-blue-900 border border-blue-600/40 text-blue-200 text-xs font-semibold flex items-center justify-center space-x-2 transition-all shadow"
            >
              <User className="w-4 h-4 text-blue-400" />
              <span>Campus Occupant</span>
            </button>
            <button
              onClick={() => handleQuickLogin('admin')}
              className="px-3 py-2.5 rounded-xl bg-purple-950/80 hover:bg-purple-900 border border-purple-600/40 text-purple-200 text-xs font-semibold flex items-center justify-center space-x-2 transition-all shadow"
            >
              <ShieldAlert className="w-4 h-4 text-purple-400" />
              <span>Safety Officer</span>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {isRegistering && (
            <div>
              <label className="block text-slate-400 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white"
                placeholder="e.g. Alex Chen"
              />
            </div>
          )}

          <div>
            <label className="block text-slate-400 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {isRegistering && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                >
                  <option value="student">Campus Occupant</option>
                  <option value="admin">Safety Officer</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Department</label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-bold shadow-lg shadow-blue-600/30 flex items-center justify-center space-x-2 transition-all mt-2"
          >
            <span>{loading ? 'Authenticating...' : isRegistering ? 'Register Account' : 'Sign In'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-center mt-4">
          <button
            type="button"
            onClick={() => setIsRegistering(!isRegistering)}
            className="text-xs text-slate-400 hover:text-white"
          >
            {isRegistering ? 'Already have credentials? Sign In' : 'New campus occupant? Register account'}
          </button>
        </div>

      </div>
    </div>
  );
}
