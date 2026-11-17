import React, { useState, useEffect, useMemo } from 'react';
import { MapPin, QrCode, Accessibility, Search, Check, Sparkles } from 'lucide-react';
import { useEmergency } from '../context/EmergencyContext';

// Helper to format clean room names without "F2-", "F1-", "GF-" prefixes
function cleanNodeLabel(id, label) {
  const cleanId = id.replace(/^(F\d+|GF)[-_ ]+/i, '');
  let cleanLabel = (label || '').replace(/^(F\d+|GF)[-_ ]+/i, '');
  if (/^\d+[A-Za-z]?$/.test(cleanId) && !cleanLabel.toLowerCase().includes('room')) {
    cleanLabel = `Room ${cleanId} (${cleanLabel})`;
  }
  return cleanLabel;
}

export default function LocationSelector({ onOpenQrModal }) {
  const { 
    topology, 
    userLocationNode, 
    selectUserLocation, 
    accessibleMode, 
    setAccessibleMode 
  } = useEmergency();

  const [searchTerm, setSearchTerm] = useState('');
  // Direct room number text box state (uncontrolled during active typing)
  const [roomInput, setRoomInput] = useState(() => {
    return userLocationNode ? userLocationNode.replace(/^(F\d+|GF)[-_ ]+/i, '') : '208';
  });
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  // Only sync roomInput when userLocationNode changes externally (via dropdown or quick select)
  const prevLocationRef = React.useRef(userLocationNode);
  useEffect(() => {
    if (userLocationNode !== prevLocationRef.current) {
      prevLocationRef.current = userLocationNode;
      const clean = userLocationNode.replace(/^(F\d+|GF)[-_ ]+/i, '');
      setRoomInput(clean);
      const currNode = (topology?.nodes || []).find(n => n.id === userLocationNode);
      if (currNode) {
        setFeedbackMsg({ type: 'success', text: cleanNodeLabel(currNode.id, currNode.label) });
      }
    }
  }, [userLocationNode, topology]);

  const rooms = useMemo(() => {
    return (topology?.nodes || [])
      .filter(n => n.type === 'classroom' || n.type === 'exit' || n.type === 'corridor')
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [topology]);

  const filteredRooms = useMemo(() => {
    if (!searchTerm) return rooms;
    return rooms.filter(r => 
      r.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.floor.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [rooms, searchTerm]);

  // Robust room finder
  const findMatchingNode = (inputVal) => {
    if (!inputVal) return null;
    const trimmed = inputVal.trim().toLowerCase();
    if (!trimmed) return null;

    const allNodes = topology?.nodes || [];

    // 1. Direct ID match or clean ID match (e.g. "220", "f2-220")
    let match = allNodes.find(n => {
      const cleanId = n.id.replace(/^(F\d+|GF)[-_ ]+/i, '').toLowerCase();
      return cleanId === trimmed || n.id.toLowerCase() === trimmed;
    });
    if (match) return match;

    // 2. Extracted room number digits (e.g. "Room 220" -> "220")
    const num = trimmed.match(/\b\d+[a-z]?\b/i)?.[0]?.toLowerCase();
    if (num) {
      match = allNodes.find(n => {
        const cleanId = n.id.replace(/^(F\d+|GF)[-_ ]+/i, '').toLowerCase();
        const labelNum = (n.label || '').replace(/^(F\d+|GF)[-_ ]+/i, '').match(/\b\d+[a-z]?\b/i)?.[0]?.toLowerCase();
        return cleanId === num || labelNum === num;
      });
      if (match) return match;
    }

    // 3. Keyword in label (e.g. "library", "admin")
    if (trimmed.length >= 3) {
      match = allNodes.find(n => (n.label || '').toLowerCase().includes(trimmed));
      if (match) return match;
    }

    return null;
  };

  // Apply the typed room number
  const applyRoomNumber = (inputVal) => {
    const trimmed = (inputVal !== undefined ? inputVal : roomInput).trim();
    if (!trimmed) return;

    const matched = findMatchingNode(trimmed);
    if (matched) {
      prevLocationRef.current = matched.id;
      selectUserLocation(matched.id);
      setFeedbackMsg({ type: 'success', text: cleanNodeLabel(matched.id, matched.label) });
    } else {
      setFeedbackMsg({ type: 'error', text: `Room "${trimmed}" not found` });
    }
  };

  const handleRoomInputChange = (e) => {
    const val = e.target.value;
    setRoomInput(val);
    const trimmed = val.trim();
    if (!trimmed) {
      setFeedbackMsg(null);
      return;
    }

    // Instant match on complete room number (e.g. 220, 208, 205, 420, 105, 120)
    const exactMatch = findMatchingNode(trimmed);
    if (exactMatch) {
      prevLocationRef.current = exactMatch.id;
      selectUserLocation(exactMatch.id);
      setFeedbackMsg({ type: 'success', text: cleanNodeLabel(exactMatch.id, exactMatch.label) });
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      applyRoomNumber(roomInput);
    }
  };

  const quickRooms = [
    { id: 'F2-208', label: 'Room 208 (Floor 2)' },
    { id: 'F2-205', label: 'Room 205 (Floor 2)' },
    { id: 'F2-220', label: 'Library (Floor 2)' },
    { id: 'GF-001', label: 'Admin (Ground)' },
    { id: 'F1-105', label: 'Comp Lab (Floor 1)' }
  ];

  return (
    <div className="evac-card rounded-2xl p-4 sm:p-5 space-y-4">
      
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-400/20 flex items-center justify-center text-blue-400 shadow-sm">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-slate-100 tracking-tight">Your Location</h3>
            <p className="text-[11px] text-slate-400">Set current indoor point</p>
          </div>
        </div>
        
        {/* QR Code indoor positioning button */}
        <button
          onClick={onOpenQrModal}
          className="evac-pill evac-btn-inset flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-white/[0.08] rounded-full text-xs font-semibold shadow-sm transition-all"
        >
          <QrCode className="w-3.5 h-3.5 text-emerald-400" />
          <span>Scan QR</span>
        </button>
      </div>

      {/* Direct Room Number Text Box Input */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-300">
            Write Room Number:
          </label>
          <span className="text-[10px] text-slate-400">e.g. 208, 205, 420, 105</span>
        </div>
        <div className="relative flex items-center space-x-2">
          <input
            type="text"
            value={roomInput}
            onChange={handleRoomInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type room number (e.g. 208, 205)..."
            className="flex-1 bg-slate-950/80 border border-white/[0.1] focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 font-semibold outline-none transition-all shadow-inner"
          />
          {roomInput && (
            <button
              type="button"
              onClick={() => setRoomInput('')}
              className="text-xs text-slate-400 hover:text-white px-2 py-2"
              title="Clear text box"
            >
              ✕
            </button>
          )}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              applyRoomNumber(roomInput);
            }}
            onClick={() => applyRoomNumber(roomInput)}
            className="evac-btn-inset px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
            title="Set Location"
          >
            Set
          </button>
        </div>
        {feedbackMsg && (
          <div className={`text-[11px] font-semibold flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border backdrop-blur-md transition-all ${
            feedbackMsg.type === 'success' 
              ? 'text-emerald-300 bg-emerald-950/40 border-emerald-500/30' 
              : 'text-amber-300 bg-amber-950/40 border-amber-500/30'
          }`}>
            {feedbackMsg.type === 'success' ? <Check className="w-3.5 h-3.5 flex-shrink-0 text-emerald-400" /> : <span className="flex-shrink-0">⚠️</span>}
            <span>{feedbackMsg.type === 'success' ? `Location set to: ${feedbackMsg.text}` : feedbackMsg.text}</span>
          </div>
        )}
      </div>

      {/* Room Dropdown */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-slate-400 block">
          Or Select From Building List:
        </label>
        <div className="relative">
          <select
            value={userLocationNode}
            onChange={(e) => selectUserLocation(e.target.value)}
            className="w-full bg-slate-950/80 border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 appearance-none font-medium cursor-pointer shadow-inner"
          >
            {filteredRooms.map(r => (
              <option key={r.id} value={r.id} className="bg-slate-900 text-white">
                {r.floor}: {cleanNodeLabel(r.id, r.label)}
              </option>
            ))}
          </select>
          <span className="absolute right-3.5 top-3.5 text-slate-400 pointer-events-none text-xs">▼</span>
        </div>
      </div>

      {/* Quick Select Room Chips */}
      <div>
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Quick Select:
        </div>
        <div className="flex flex-wrap gap-1.5">
          {quickRooms.map(qr => {
            const isSelected = userLocationNode === qr.id;
            return (
              <button
                key={qr.id}
                onClick={() => selectUserLocation(qr.id)}
                className={`evac-pill px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-1 ring-blue-400/50 evac-btn-inset font-semibold'
                    : 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white border border-white/[0.08]'
                }`}
              >
                {qr.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ADA Accessibility Toggle */}
      <div className="pt-3.5 border-t border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
            accessibleMode ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'bg-white/[0.04] text-slate-400 border border-white/[0.06]'
          }`}>
            <Accessibility className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-white">Wheelchair / ADA Mode</div>
            <div className="text-[10px] text-slate-400">Prioritize elevators & ramps</div>
          </div>
        </div>

        <button
          onClick={() => setAccessibleMode(!accessibleMode)}
          aria-label="Toggle ADA Accessibility Mode"
          className={`w-12 h-6 rounded-full p-0.5 transition-colors duration-200 ease-in-out border border-white/[0.1] relative ${
            accessibleMode ? 'bg-cyan-600' : 'bg-slate-800'
          }`}
        >
          <div
            className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out ${
              accessibleMode ? 'translate-x-6' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

    </div>
  );
}
