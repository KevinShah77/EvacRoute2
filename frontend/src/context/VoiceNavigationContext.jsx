import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { voiceAssistant } from '../services/speechSynthesis';
import { playInstructionChime, playHazardWarningTone } from '../services/audioChime';
import { useEmergency } from './EmergencyContext';

const VoiceNavigationContext = createContext(null);

export function cleanRoomNumber(raw) {
  if (!raw) return '';
  let cleaned = String(raw).trim();
  // Strip prefixes like "F2-", "F1-", "F3-", "F4-", "GF-", "F2 ", "GF "
  cleaned = cleaned.replace(/^(F\d+|GF)[-_ ]+/i, '');
  cleaned = cleaned.replace(/^Floor\s*\d+[:\s-]*/i, '');
  cleaned = cleaned.replace(/^Ground(\s*Floor)?[:\s-]*/i, '');
  cleaned = cleaned.trim();
  if (/^\d+[A-Za-z]?$/.test(cleaned)) {
    return `Room ${cleaned}`;
  }
  if (/^room\s*/i.test(cleaned)) {
    return cleaned.replace(/^room\s*/i, 'Room ');
  }
  return cleaned;
}

export function formatRoomLocation(rawLocation, rawFloor) {
  if (!rawLocation) {
    return rawFloor ? `corridor area, ${rawFloor}` : 'the designated evacuation area';
  }

  const cleaned = cleanRoomNumber(rawLocation);

  // If floor is specified and not already in cleaned string
  if (rawFloor && !cleaned.toLowerCase().includes(rawFloor.toLowerCase())) {
    return `${cleaned}, ${rawFloor}`;
  }
  return cleaned;
}

export function VoiceNavigationProvider({ children }) {
  const { routeResult, hazards, isRecalculating, activeEmergency } = useEmergency();
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [language, setLanguageState] = useState(() => {
    return localStorage.getItem('evacroute_voice_lang') || 'en';
  });
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [assistantStatus, setAssistantStatus] = useState('IDLE');

  const getShortHazardWarning = () => {
    const hasActive = Boolean(activeEmergency);
    const hasHazard = Boolean(hazards && hazards.length > 0);

    if (!hasActive && !hasHazard) {
      if (language === 'hi') {
        return 'परिसर सूचना: सभी निकासी मार्ग सुरक्षित हैं। सामान्य संचालन जारी है।';
      }
      return 'Campus Advisory: All evacuation corridors are clear. Normal operations remain in effect.';
    }

    const rawType = (activeEmergency?.emergency_type || hazards[0]?.hazard_type || 'fire').toLowerCase();
    const typeLabel = rawType === 'gas' ? 'gas leak' : 
                      rawType === 'structural' ? 'structural damage' : 
                      rawType === 'smoke' ? 'heavy smoke' : 
                      rawType === 'blocked' ? 'corridor blockage' : 
                      rawType === 'general' ? 'emergency' : rawType;
                      
    const rawLoc = activeEmergency?.location || (hazards && hazards[0] ? hazards[0].node_id : '205');
    const rawFloor = activeEmergency?.floor || (hazards && hazards[0] ? hazards[0].floor : 'Floor 2');
    const loc = formatRoomLocation(rawLoc, rawFloor);
    
    if (language === 'hi') {
      return `आपातकालीन चेतावनी: ${loc} पर ${typeLabel} की पुष्टि हुई है। कृपया उस क्षेत्र से बचें और सुरक्षित मार्ग से निकलें।`;
    }
    return `Emergency Alert: An active ${typeLabel} has been reported at ${loc}. Please avoid that area and follow the designated evacuation route.`;
  };

  const speakHazardWarning = () => {
    clearTimer();
    if (isMuted) {
      setAssistantStatus('IDLE');
      return;
    }
    setAssistantStatus('SPEAKING');
    playHazardWarningTone();
    const text = getShortHazardWarning();
    voiceAssistant.speak(text, () => {
      setAssistantStatus('IDLE');
    });
  };

  const setLanguage = (lang) => {
    const chosen = lang === 'hi' ? 'hi' : 'en';
    setLanguageState(chosen);
    localStorage.setItem('evacroute_voice_lang', chosen);
    voiceAssistant.setLanguage(chosen);
    if (isNavigatingRef.current) {
      voiceAssistant.stop();
      speakHazardWarning();
    }
  };

  useEffect(() => {
    voiceAssistant.setLanguage(language);
  }, [language]);

  const prevPathRef = useRef(null);
  const autoAdvanceTimerRef = useRef(null);
  const isNavigatingRef = useRef(isNavigating);
  isNavigatingRef.current = isNavigating;

  const steps = routeResult?.steps || [];
  const currentStep = steps[currentStepIndex] || null;
  const nextStep = steps[currentStepIndex + 1] || null;

  const clearTimer = () => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
  };

  // Speak short emergency warning strictly adhering to requirement
  const speakCurrentStep = () => {
    speakHazardWarning();
  };

  // Start voice guidance: Only tells emergency, location, and avoid that route
  const startNavigation = () => {
    clearTimer();
    setIsNavigating(true);
    setIsPaused(false);
    speakHazardWarning();
  };

  // Stop guidance
  const stopNavigation = () => {
    clearTimer();
    setIsNavigating(false);
    setIsPaused(false);
    setAssistantStatus('IDLE');
    voiceAssistant.stop();
  };

  // Pause
  const pauseNavigation = () => {
    clearTimer();
    setIsPaused(true);
    setAssistantStatus('PAUSED');
    voiceAssistant.pause();
  };

  // Resume
  const resumeNavigation = () => {
    setIsPaused(false);
    setAssistantStatus('IDLE');
    voiceAssistant.resume();
    speakHazardWarning();
  };

  // Next step
  const goToNextStep = () => {
    clearTimer();
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    }
    speakHazardWarning();
  };

  // Previous step
  const goToPrevStep = () => {
    clearTimer();
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
    speakHazardWarning();
  };

  // Repeat current step
  const repeatCurrentStep = () => {
    speakHazardWarning();
  };

  // Toggle mute
  const toggleMute = () => {
    const muted = voiceAssistant.toggleMute();
    setIsMuted(muted);
  };

  const toggleAutoAdvance = () => {
    setAutoAdvance(prev => !prev);
  };

  // Detect dynamic route recalculation mid-navigation
  useEffect(() => {
    if (!isNavigating) {
      prevPathRef.current = routeResult?.path_node_ids;
      return;
    }

    const currentPath = routeResult?.path_node_ids || [];
    const prevPath = prevPathRef.current || [];

    if (prevPath.length > 0 && JSON.stringify(currentPath) !== JSON.stringify(prevPath)) {
      // Route has changed dynamically!
      clearTimer();
      setAssistantStatus('RECALCULATING');
      playHazardWarningTone();
      voiceAssistant.stop();
      speakHazardWarning();
    }

    prevPathRef.current = currentPath;
  }, [routeResult, isNavigating, steps]);

  return (
    <VoiceNavigationContext.Provider
      value={{
        isNavigating,
        isPaused,
        isMuted,
        language,
        setLanguage,
        autoAdvance,
        toggleAutoAdvance,
        assistantStatus: isRecalculating ? 'RECALCULATING' : assistantStatus,
        currentStepIndex,
        steps,
        currentStep,
        nextStep,
        getShortHazardWarning,
        speakHazardWarning,
        startNavigation,
        stopNavigation,
        pauseNavigation,
        resumeNavigation,
        goToNextStep,
        goToPrevStep,
        repeatCurrentStep,
        toggleMute,
      }}
    >
      {children}
    </VoiceNavigationContext.Provider>
  );
}

export function useVoiceNavigation() {
  const context = useContext(VoiceNavigationContext);
  if (!context) {
    throw new Error('useVoiceNavigation must be used within a VoiceNavigationProvider');
  }
  return context;
}
