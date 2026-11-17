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
    <div className="space-y-3.5">
      
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <div className="flex items-center space-x-2">
          <MapPin className="w-4 h-4 text-slate-700" />
          <div>
            <h3 className="font-bold text-sm text-slate-900">Your Location</h3>
          </div>
        </div>
        
        {/* QR Code indoor positioning button */}
        <button
          onClick={onOpenQrModal}
          className="flex items-center space-x-1.5 px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold shadow-xs transition-colors"
        >
          <QrCode className="w-3.5 h-3.5 text-emerald-600" />
          <span>Scan QR</span>
        </button>
      </div>

      {/* Direct Room Number Text Box Input */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-700">
            Write Room Number:
          </label>
          <span className="text-[10px] text-slate-400">e.g. 208, 205, 420</span>
        </div>
        <div className="relative flex items-center space-x-2">
          <input
            type="text"
            value={roomInput}
            onChange={handleRoomInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type room number (e.g. 208)..."
            className="flex-1 bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-lg px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 font-semibold outline-none transition-colors"
          />
          {roomInput && (
            <button
              type="button"
              onClick={() => setRoomInput('')}
              className="text-xs text-slate-400 hover:text-slate-600 px-1.5 py-1"
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
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-xs transition-colors cursor-pointer"
            title="Set Location"
          >
            Set
          </button>
        </div>
        {feedbackMsg && (
          <div className={`text-[11px] font-medium flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border transition-all ${
            feedbackMsg.type === 'success' 
              ? 'text-emerald-800 bg-emerald-50 border-emerald-200' 
              : 'text-amber-800 bg-amber-50 border-amber-200'
          }`}>
            {feedbackMsg.type === 'success' ? <Check className="w-3.5 h-3.5 flex-shrink-0 text-emerald-600" /> : <span className="flex-shrink-0">⚠️</span>}
            <span>{feedbackMsg.type === 'success' ? `Location set to: ${feedbackMsg.text}` : feedbackMsg.text}</span>
          </div>
        )}
      </div>

      {/* Room Dropdown */}
      <div className="space-y-1">
        <label className="text-[11px] font-semibold text-slate-600 block">
          Or Select From Building List:
        </label>
        <div className="relative">
          <select
            value={userLocationNode}
            onChange={(e) => selectUserLocation(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 appearance-none font-medium cursor-pointer"
          >
            {filteredRooms.map(r => (
              <option key={r.id} value={r.id} className="bg-white text-slate-900">
                {r.floor}: {cleanNodeLabel(r.id, r.label)}
              </option>
            ))}
          </select>
          <span className="absolute right-3 top-2 text-slate-400 pointer-events-none text-xs">▼</span>
        </div>
      </div>

      {/* Quick Select Room Chips */}
      <div>
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
          Quick Select:
        </div>
        <div className="flex flex-wrap gap-1.5">
          {quickRooms.map(qr => {
            const isSelected = userLocationNode === qr.id;
            return (
              <button
                key={qr.id}
                onClick={() => selectUserLocation(qr.id)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  isSelected
                    ? 'bg-[#0f172a] text-white font-semibold shadow-xs'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {qr.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ADA Accessibility Toggle */}
      <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
            accessibleMode ? 'bg-cyan-50 text-cyan-700 border border-cyan-200' : 'bg-slate-50 text-slate-500 border border-slate-200'
          }`}>
            <Accessibility className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900">Wheelchair / ADA Mode</div>
            <div className="text-[10px] text-slate-500">Prioritize elevators & ramps</div>
          </div>
        </div>

        <button
          onClick={() => setAccessibleMode(!accessibleMode)}
          aria-label="Toggle ADA Accessibility Mode"
          className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 ease-in-out relative ${
            accessibleMode ? 'bg-blue-600' : 'bg-slate-300'
          }`}
        >
          <div
            className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform duration-200 ease-in-out ${
              accessibleMode ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

    </div>
  );
}
