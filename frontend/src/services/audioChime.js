// Web Audio API Synthesizer for Navigation and Emergency Alerts

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function playInstructionChime() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();

  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(587.33, now); // D5
  osc1.frequency.exponentialRampToValueAtTime(880.0, now + 0.12); // A5

  gain.gain.setValueAtTime(0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

  osc1.connect(gain);
  gain.connect(ctx.destination);

  osc1.start(now);
  osc1.stop(now + 0.35);
}

export function playHazardWarningTone() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(440, now);
  osc.frequency.setValueAtTime(330, now + 0.15);
  osc.frequency.setValueAtTime(440, now + 0.3);

  gain.gain.setValueAtTime(0.25, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.45);
}

export function playEmergencySirenTone() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(700, now);
  osc.frequency.linearRampToValueAtTime(1050, now + 0.25);
  osc.frequency.linearRampToValueAtTime(700, now + 0.5);

  gain.gain.setValueAtTime(0.3, now);
  gain.gain.linearRampToValueAtTime(0.01, now + 0.55);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.55);
}
