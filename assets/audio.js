// Web Audio API Synthesizer & Procedural Chill Lo-Fi BGM Engine
// Menghasilkan efek suara interaktif dan musik santai tanpa dependensi file eksternal yang rawan 404.

const AudioManager = (function() {
  let audioCtx = null;
  let isMuted = false;
  let isBgmPlaying = false;
  let bgmInterval = null;
  let bgmGainNode = null;
  let bgmVolume = 0.25; // Volume default santai dan tidak mengganggu konsentrasi
  let currentChordIndex = 0;
  let bgmTrackMode = 'lofi'; // 'lofi', 'ambient', 'rain'
  let stateChangeListeners = [];

  // Lo-Fi & Chill Chord Progressions (Frekuensi Hz)
  // Progresi 1: Fmaj9 -> Em7 -> Dm9 -> Cmaj7 (Very soothing & mellow)
  const CHORDS_LOFI = [
    [174.61, 220.00, 261.63, 329.63, 392.00], // Fmaj9
    [164.81, 196.00, 246.94, 293.66],         // Em7
    [146.83, 174.61, 220.00, 261.63, 329.63], // Dm9
    [130.81, 164.81, 196.00, 246.94]          // Cmaj7
  ];

  // Progresi 2: Ambient Dreamy (Amaj9 -> F#m7 -> Dmaj7 -> E11)
  const CHORDS_AMBIENT = [
    [220.00, 277.18, 329.63, 415.30, 493.88], // Amaj9
    [185.00, 220.00, 277.18, 329.63],         // F#m7
    [146.83, 220.00, 277.18, 369.99],         // Dmaj7
    [164.81, 220.00, 293.66, 329.63, 440.00]  // E11
  ];

  function getContext() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playTone(freq, type = 'sine', duration = 0.15, gainVal = 0.1, delay = 0) {
    if (isMuted) return;
    try {
      const ctx = getContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = ctx.currentTime + delay;

      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(gainVal, startTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    } catch (e) {
      console.warn("Audio play error", e);
    }
  }

  // Sintesis Suara Akord Hangat (Warm Electric Piano / Synth Pad)
  function playChillChord(notes, duration = 3.6) {
    if (!isBgmPlaying || isMuted) return;
    try {
      const ctx = getContext();
      if (!ctx) return;

      if (!bgmGainNode) {
        bgmGainNode = ctx.createGain();
        bgmGainNode.connect(ctx.destination);
      }
      bgmGainNode.gain.setValueAtTime(bgmVolume, ctx.currentTime);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      // Lowpass filter 650Hz memberikan warna suara Lo-Fi hangat (mellow)
      filter.frequency.setValueAtTime(bgmTrackMode === 'ambient' ? 850 : 620, ctx.currentTime);
      filter.Q.setValueAtTime(1.2, ctx.currentTime);
      filter.connect(bgmGainNode);

      const now = ctx.currentTime;

      // Arpeggiasi halus antar not
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();

        osc.type = bgmTrackMode === 'ambient' ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        // Soft Attack & Smooth Release
        const noteStart = now + (idx * 0.08); // micro arpeggio delay
        const attack = 0.25;
        const decay = duration - 0.3;

        noteGain.gain.setValueAtTime(0.0001, noteStart);
        noteGain.gain.linearRampToValueAtTime(0.06, noteStart + attack);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, noteStart + decay);

        osc.connect(noteGain);
        noteGain.connect(filter);

        osc.start(noteStart);
        osc.stop(noteStart + duration);
      });

      // Tambahkan nada bass lembut di frekuensi rendah
      const bassFreq = notes[0] / 2;
      const bassOsc = ctx.createOscillator();
      const bassGain = ctx.createGain();
      bassOsc.type = 'sine';
      bassOsc.frequency.setValueAtTime(bassFreq, now);

      bassGain.gain.setValueAtTime(0.0001, now);
      bassGain.gain.linearRampToValueAtTime(0.07, now + 0.3);
      bassGain.gain.exponentialRampToValueAtTime(0.0001, now + duration - 0.2);

      bassOsc.connect(bassGain);
      bassGain.connect(filter);
      bassOsc.start(now);
      bassOsc.stop(now + duration);

    } catch (err) {
      console.warn("Error playing chill chord", err);
    }
  }

  function stepBGM() {
    if (!isBgmPlaying) return;
    const chords = bgmTrackMode === 'ambient' ? CHORDS_AMBIENT : CHORDS_LOFI;
    const currentChord = chords[currentChordIndex % chords.length];
    currentChordIndex++;
    playChillChord(currentChord, 3.8);
  }

  function notifyState() {
    stateChangeListeners.forEach(cb => {
      try { cb({ isPlaying: isBgmPlaying, isMuted: isMuted, volume: bgmVolume, mode: bgmTrackMode }); } catch(e){}
    });
  }

  return {
    // SFX Methods
    toggleMute() {
      isMuted = !isMuted;
      if (isMuted && isBgmPlaying) {
        if (bgmGainNode) bgmGainNode.gain.setValueAtTime(0, 0);
      } else if (!isMuted && isBgmPlaying && bgmGainNode) {
        bgmGainNode.gain.setValueAtTime(bgmVolume, 0);
      }
      notifyState();
      return isMuted;
    },
    isMuted() {
      return isMuted;
    },
    click() {
      playTone(600, 'triangle', 0.04, 0.05);
    },
    chime() {
      playTone(523.25, 'sine', 0.18, 0.12, 0);
      playTone(783.99, 'sine', 0.28, 0.12, 0.08);
    },
    success() {
      playTone(523.25, 'triangle', 0.15, 0.12, 0);
      playTone(659.25, 'triangle', 0.15, 0.12, 0.09);
      playTone(783.99, 'triangle', 0.18, 0.14, 0.18);
      playTone(1046.50, 'sine', 0.45, 0.18, 0.27);
    },
    tick() {
      playTone(800, 'square', 0.02, 0.03);
    },
    spinTick() {
      playTone(400 + Math.random() * 200, 'triangle', 0.03, 0.04);
    },
    alert() {
      playTone(350, 'sawtooth', 0.15, 0.08, 0);
      playTone(300, 'sawtooth', 0.25, 0.08, 0.12);
    },
    buzzer() {
      // Classic Game Show Wrong Buzzer
      playTone(180, 'sawtooth', 0.35, 0.15, 0);
      playTone(170, 'sawtooth', 0.35, 0.15, 0.02);
    },
    wrong() {
      this.buzzer();
    },
    correct() {
      this.success();
    },

    // BGM Chill Engine Methods
    startBGM() {
      getContext();
      if (isBgmPlaying) return;
      isBgmPlaying = true;
      stepBGM();
      bgmInterval = setInterval(stepBGM, 3900); // ganti akord tiap 3.9 detik
      notifyState();
    },

    stopBGM() {
      isBgmPlaying = false;
      if (bgmInterval) {
        clearInterval(bgmInterval);
        bgmInterval = null;
      }
      notifyState();
    },

    toggleBGM() {
      if (isBgmPlaying) {
        this.stopBGM();
      } else {
        this.startBGM();
      }
      return isBgmPlaying;
    },

    isBGMPlaying() {
      return isBgmPlaying;
    },

    setBGMVolume(val) {
      bgmVolume = Math.max(0, Math.min(1, parseFloat(val)));
      if (bgmGainNode && audioCtx && !isMuted) {
        bgmGainNode.gain.setValueAtTime(bgmVolume, audioCtx.currentTime);
      }
      notifyState();
    },

    getBGMVolume() {
      return bgmVolume;
    },

    setBGMTrack(mode) {
      if (['lofi', 'ambient'].includes(mode)) {
        bgmTrackMode = mode;
        currentChordIndex = 0;
        if (isBgmPlaying) {
          stepBGM();
        }
        notifyState();
      }
    },

    getBGMTrack() {
      return bgmTrackMode;
    },

    onBgmStateChange(callback) {
      if (typeof callback === 'function') {
        stateChangeListeners.push(callback);
      }
    }
  };
})();
