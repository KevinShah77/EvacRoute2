import React, { useState, useEffect, useMemo } from 'react';
import { MapPin, QrCode, Accessibility, Search, Check } from 'lucide-react';
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
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
      
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <MapPin className="w-5 h-5 text-blue-400" />
          <h3 className="font-bold text-sm text-white">Your Location</h3>
        </div>
        
        {/* QR Code indoor positioning button */}
        <button
          onClick={onOpenQrModal}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold shadow-sm transition-all"
        >
          <QrCode className="w-4 h-4 text-emerald-400" />
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
        <div className="relative flex items-center space-x-1.5">
          <input
            type="text"
            value={roomInput}
            onChange={handleRoomInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type room number (e.g. 208, 205)..."
            className="flex-1 bg-slate-950 border border-slate-700 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 font-semibold outline-none transition-all shadow-inner"
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
            className="px-3.5 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs rounded-xl shadow transition-all cursor-pointer"
            title="Set Location"
          >
            Set
          </button>
        </div>
        {feedbackMsg && (
          <div className={`text-[11px] font-semibold flex items-center space-x-1.5 px-2.5 py-1 rounded-lg ${
            feedbackMsg.type === 'success' 
              ? 'text-emerald-300 bg-emerald-950/50 border border-emerald-800/50' 
              : 'text-amber-300 bg-amber-950/50 border border-amber-800/50'
          }`}>
            {feedbackMsg.type === 'success' ? <Check className="w-3.5 h-3.5 flex-shrink-0 text-emerald-400" /> : <span className="flex-shrink-0">⚠️</span>}
            <span>{feedbackMsg.type === 'success' ? `Location set to: ${feedbackMsg.text}` : feedbackMsg.text}</span>
          </div>
        )}
      </div>

      {/* Room Dropdown (formatted with clean room names, no F2- prefixes) */}
      <div className="space-y-1">
        <label className="text-[11px] font-semibold text-slate-400 block">
          Or Select From Building List:
        </label>
        <div className="relative">
          <select
            value={userLocationNode}
            onChange={(e) => selectUserLocation(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 appearance-none font-medium"
          >
            {filteredRooms.map(r => (
              <option key={r.id} value={r.id}>
                {r.floor}: {cleanNodeLabel(r.id, r.label)}
              </option>
            ))}
          </select>
          <span className="absolute right-3.5 top-3.5 text-slate-400 pointer-events-none text-xs">▼</span>
        </div>
      </div>

      {/* Quick Jump Room Chips */}
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
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-400'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-750 hover:text-white border border-slate-700/60'
                }`}
              >
                {qr.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ADA Accessibility Toggle */}
      <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Accessibility className={`w-5 h-5 ${accessibleMode ? 'text-cyan-400' : 'text-slate-400'}`} />
          <div className="text-xs font-bold text-white">Wheelchair / ADA Mode</div>
        </div>

        <button
          onClick={() => setAccessibleMode(!accessibleMode)}
          className={`w-12 h-6 rounded-full p-1 transition-colors ${
            accessibleMode ? 'bg-cyan-600' : 'bg-slate-800'
          }`}
        >
          <div
            className={`w-4 h-4 rounded-full bg-white transition-transform ${
              accessibleMode ? 'translate-x-6' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

    </div>
  );
}
