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
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-8">
      <div className="max-w-md w-full bg-white rounded-xl p-7 sm:p-8 border border-slate-200 shadow-sm relative text-slate-900">

        <div className="text-center mb-6">
          <div className="inline-flex p-2.5 rounded-xl bg-slate-900 text-white mb-3 shadow-xs">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Evac<span className="text-red-600">Route</span> Access
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Campus Emergency Management Platform
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs font-medium">
            {error}
          </div>
        )}

        {/* 1-Click Evaluation Login Buttons */}
        <div className="mb-6 pb-6 border-b border-slate-100">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5 text-center">
            One-Click Evaluation Login:
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => handleQuickLogin('student')}
              className="px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center space-x-2 transition-colors cursor-pointer"
            >
              <User className="w-4 h-4 text-slate-600" />
              <span>Campus Occupant</span>
            </button>
            <button
              onClick={() => handleQuickLogin('admin')}
              className="px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center space-x-2 transition-colors cursor-pointer"
            >
              <ShieldAlert className="w-4 h-4 text-blue-600" />
              <span>Safety Officer</span>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {isRegistering && (
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 placeholder-slate-400 outline-none focus:border-blue-600 transition-colors"
                placeholder="e.g. Alex Chen"
              />
            </div>
          )}

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-slate-900 placeholder-slate-400 outline-none focus:border-blue-600 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-slate-900 placeholder-slate-400 outline-none focus:border-blue-600 transition-colors"
              />
            </div>
          </div>

          {isRegistering && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 outline-none focus:border-blue-600 transition-colors"
                >
                  <option value="student">Campus Occupant</option>
                  <option value="admin">Safety Officer</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Department</label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 outline-none focus:border-blue-600 transition-colors"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg font-bold shadow-xs flex items-center justify-center space-x-2 transition-colors mt-2 cursor-pointer"
          >
            <span>{loading ? 'Authenticating...' : isRegistering ? 'Register Account' : 'Sign In'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-center mt-4 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setIsRegistering(!isRegistering)}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
          >
            {isRegistering ? 'Already have credentials? Sign In' : 'New campus occupant? Register account'}
          </button>
        </div>

      </div>
    </div>
  );
}
