// Google Maps Style Voice Assistant Speech Service (English & Hindi Support)

export function translateInstructionToHindi(text) {
  if (!text) return '';
  let hi = text;

  // Key life-safety phrases from Section 2.D
  hi = hi.replace(/Campus Advisory: All evacuation corridors are clear\. Normal operations remain in effect\./gi, 'परिसर सूचना: सभी निकासी मार्ग सुरक्षित हैं। सामान्य संचालन जारी है।');
  hi = hi.replace(/Emergency Alert: An active ([^ ]+) has been reported at ([^.]+)\. Please avoid that area and follow the designated evacuation route\./gi, 'आपातकालीन चेतावनी: $2 पर $1 की पुष्टि हुई है। कृपया उस क्षेत्र से बचें और सुरक्षित मार्ग से निकलें।');
  hi = hi.replace(/All clear\. There is no active emergency\./gi, 'सब ठीक है। कोई आपात स्थिति नहीं है।');
  hi = hi.replace(/There is an emergency: ([^ ]+) at ([^.]+)\. You should avoid that route\./gi, 'आपातकाल है: $2 पर $1। उस मार्ग से बचें।');
  hi = hi.replace(/There is an emergency\. You should avoid that route\./gi, 'आपातकाल है। आपको उस मार्ग से बचना चाहिए।');
  hi = hi.replace(/Emergency evacuation activated\. Please remain calm\./gi, 'आपातकालीन निकासी सक्रिय हो गई है। कृपया शांत रहें।');
  hi = hi.replace(/The previous route is blocked\. Finding another route\./gi, 'पिछला मार्ग अवरुद्ध है। दूसरा सुरक्षित मार्ग खोजा जा रहा है।');
  hi = hi.replace(/Move straight through the corridor\./gi, 'गलियारे में सीधे आगे बढ़ें।');
  hi = hi.replace(/Use the staircase on your right\./gi, 'अपनी दाईं ओर की सीढ़ियों का उपयोग करें।');
  hi = hi.replace(/Use the staircase on your left\./gi, 'अपनी बाईं ओर की सीढ़ियों का उपयोग करें।');
  hi = hi.replace(/Turn right near ([^.]+)\./gi, '$1 के पास दाएं मुड़ें।');
  hi = hi.replace(/Turn left near ([^.]+)\./gi, '$1 के पास बाएं मुड़ें।');
  hi = hi.replace(/Turn right into ([^.]+)\./gi, '$1 की ओर दाएं मुड़ें।');
  hi = hi.replace(/Turn left into ([^.]+)\./gi, '$1 की ओर बाएं मुड़ें।');
  hi = hi.replace(/Proceed straight along ([^.]+)\./gi, '$1 के साथ सीधे आगे बढ़ें।');
  hi = hi.replace(/Proceed downstairs via ([^ ]+) to ([^.]+)\./gi, '$1 के रास्ते नीचे $2 की ओर जाएं।');
  hi = hi.replace(/Proceed upstairs via ([^ ]+) to ([^.]+)\./gi, '$1 के रास्ते ऊपर $2 की ओर जाएं।');
  hi = hi.replace(/Exit the building through ([^ ]+) immediately\./gi, '$1 से तुरंत इमारत से बाहर निकलें।');
  hi = hi.replace(/Proceed to designated assembly area:? ([^.]+)\./gi, 'नामित सुरक्षित सभा स्थल की ओर बढ़ें: $1।');
  hi = hi.replace(/Report to the safety officer\./gi, 'सुरक्षा अधिकारी को अपनी सुरक्षित उपस्थिति दर्ज कराएं।');
  hi = hi.replace(/You have safely arrived at the designated emergency assembly point\. Report your status to the campus safety officer\./gi, 'आप सुरक्षित रूप से सभा स्थल पर पहुंच गए हैं। सुरक्षा अधिकारी को अपनी उपस्थिति दर्ज कराएं।');
  hi = hi.replace(/Floor 1/gi, 'पहली मंजिल');
  hi = hi.replace(/Floor 2/gi, 'दूसरी मंजिल');
  hi = hi.replace(/Floor 3/gi, 'तीसरी मंजिल');
  hi = hi.replace(/Floor 4/gi, 'चौथी मंजिल');
  hi = hi.replace(/Ground/gi, 'भूतल');
  hi = hi.replace(/North Perimeter Exit/gi, 'उत्तरी निकास द्वार');
  hi = hi.replace(/West Perimeter Exit/gi, 'पश्चिमी निकास द्वार');
  hi = hi.replace(/Main Campus Exit/gi, 'मुख्य निकास द्वार');
  hi = hi.replace(/Safe Assembly Point/gi, 'सुरक्षित सभा स्थल');

  return hi;
}

class VoiceAssistant {
  constructor() {
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.isMuted = false;
    this.language = 'en'; // 'en' | 'hi'
    this.rate = 1.0;
    this.pitch = 1.0;
    this.currentUtterance = null;
    this.preferredVoiceEn = null;
    this.preferredVoiceHi = null;
    this._initVoice();
  }

  _initVoice() {
    if (!this.synth) return;
    const setVoices = () => {
      const voices = this.synth.getVoices();
      
      // Preferred English voice
      this.preferredVoiceEn = voices.find(v => (v.name.includes('Google') || v.name.includes('Natural')) && v.lang.startsWith('en'))
        || voices.find(v => v.lang.startsWith('en'))
        || voices[0];

      // Preferred Hindi voice
      this.preferredVoiceHi = voices.find(v => v.lang.startsWith('hi'))
        || voices.find(v => v.name.toLowerCase().includes('hindi'))
        || this.preferredVoiceEn;
    };

    setVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = setVoices;
    }
  }

  setLanguage(lang = 'en') {
    this.language = lang === 'hi' ? 'hi' : 'en';
  }

  getLanguage() {
    return this.language;
  }

  speak(text, onEndCallback = null, langOverride = null) {
    if (!this.synth || this.isMuted || !text) return;

    // Avoid overlapping speech
    this.stop();

    const targetLang = langOverride || this.language;
    const spokenText = targetLang === 'hi' ? translateInstructionToHindi(text) : text;

    const utterance = new SpeechSynthesisUtterance(spokenText);
    utterance.lang = targetLang === 'hi' ? 'hi-IN' : 'en-US';

    const chosenVoice = targetLang === 'hi' ? this.preferredVoiceHi : this.preferredVoiceEn;
    if (chosenVoice) {
      utterance.voice = chosenVoice;
    }

    utterance.rate = this.rate;
    utterance.pitch = this.pitch;

    utterance.onend = () => {
      this.currentUtterance = null;
      if (onEndCallback) onEndCallback();
    };

    utterance.onerror = (e) => {
      // Ignore normal cancel/pause interruptions
      if (e.error !== 'interrupted' && e.error !== 'canceled') {
        console.warn('[VoiceAssistant] Speech synthesis error:', e);
      }
      this.currentUtterance = null;
    };

    this.currentUtterance = utterance;
    this.synth.speak(utterance);
  }

  stop() {
    if (this.synth) {
      this.synth.cancel();
      this.currentUtterance = null;
    }
  }

  pause() {
    if (this.synth) {
      this.synth.pause();
    }
  }

  resume() {
    if (this.synth) {
      this.synth.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stop();
    }
    return this.isMuted;
  }

  setMuted(muted) {
    this.isMuted = muted;
    if (this.isMuted) {
      this.stop();
    }
  }
}

export const voiceAssistant = new VoiceAssistant();
