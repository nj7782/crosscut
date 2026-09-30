"use client";

/**
 * CrossCut SFX — must start inside a user-gesture turn (no await before play).
 * Web Audio primary; short WAV data-URI fallback for stubborn browsers.
 */

const MUTE_KEY = "crosscut-mute";

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

/** Kick the audio engine during a click/tap — never await this before playing. */
export function unlockAudio() {
  const ac = getCtx();
  if (!ac) return;
  if (ac.state === "suspended") {
    void ac.resume();
  }
  // Silent buffer tick helps Safari/iOS treat the context as unlocked.
  try {
    const buffer = ac.createBuffer(1, 1, ac.sampleRate);
    const src = ac.createBufferSource();
    src.buffer = buffer;
    src.connect(ac.destination);
    src.start(0);
  } catch {
    /* ignore */
  }
}

export function isMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function beep(
  freq: number,
  duration: number,
  type: OscillatorType,
  volume: number,
  when = 0,
) {
  const ac = getCtx();
  if (!ac) return;

  if (ac.state === "suspended") {
    void ac.resume();
  }

  const t0 = ac.currentTime + when;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);

  const peak = Math.min(Math.max(volume, 0.05), 0.55);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + 0.015);
  g.gain.linearRampToValueAtTime(0.0001, t0 + duration);

  osc.connect(g);
  g.connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.04);
}

/** Tiny PCM WAV as a data URI — works with HTMLAudioElement.play() in gesture. */
function wavDataUri(freq: number, ms: number, volume = 0.45): string {
  const sampleRate = 22050;
  const samples = Math.floor((sampleRate * ms) / 1000);
  const data = new Int16Array(samples);
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    const env = Math.min(1, i / 200) * Math.min(1, (samples - i) / 400);
    const sample = Math.sin(2 * Math.PI * freq * t) * volume * env;
    data[i] = Math.max(-1, Math.min(1, sample)) * 0x7fff;
  }

  const buffer = new ArrayBuffer(44 + data.byteLength);
  const view = new DataView(buffer);
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + data.byteLength, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, data.byteLength, true);
  new Uint8Array(buffer, 44).set(new Uint8Array(data.buffer));

  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return `data:audio/wav;base64,${btoa(binary)}`;
}

function playWav(freq: number, ms: number, volume = 0.5) {
  try {
    const audio = new Audio(wavDataUri(freq, ms, volume));
    audio.volume = 1;
    void audio.play().catch(() => undefined);
  } catch {
    /* ignore */
  }
}

function play(builder: () => void, wav?: { freq: number; ms: number }) {
  if (typeof window === "undefined") return;
  if (isMuted()) return;

  unlockAudio();
  builder();

  // Dual-path: WAV catches environments where oscillators stay silent.
  if (wav) playWav(wav.freq, wav.ms);
}

export const sfx = {
  click() {
    play(() => beep(620, 0.09, "triangle", 0.35), { freq: 620, ms: 90 });
  },
  roll() {
    play(
      () => {
        beep(160, 0.1, "sawtooth", 0.32, 0);
        beep(260, 0.1, "square", 0.28, 0.07);
        beep(400, 0.12, "square", 0.3, 0.14);
      },
      { freq: 280, ms: 140 },
    );
  },
  place() {
    play(() => beep(520, 0.11, "triangle", 0.38), { freq: 520, ms: 110 });
  },
  bust() {
    play(
      () => {
        beep(110, 0.24, "sawtooth", 0.4, 0);
        beep(70, 0.3, "sawtooth", 0.32, 0.1);
      },
      { freq: 90, ms: 220 },
    );
  },
  win() {
    play(
      () => {
        beep(523, 0.14, "triangle", 0.36, 0);
        beep(659, 0.16, "triangle", 0.34, 0.12);
        beep(784, 0.22, "triangle", 0.38, 0.24);
      },
      { freq: 660, ms: 180 },
    );
  },
  react() {
    play(() => beep(740, 0.1, "sine", 0.32), { freq: 740, ms: 100 });
  },
  /** Confirmation chirp when enabling sound. Respects mute. */
  test() {
    if (typeof window === "undefined" || isMuted()) return;
    unlockAudio();
    beep(440, 0.14, "triangle", 0.45, 0);
    beep(660, 0.18, "triangle", 0.42, 0.12);
    playWav(523, 200, 0.55);
    window.setTimeout(() => {
      if (!isMuted()) playWav(784, 220, 0.55);
    }, 160);
  },
};
