// Programová syntéza zvuků přes Web Audio API – žádné externí soubory.

type AudioCtor = typeof AudioContext;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor: AudioCtor | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Odemkne audio na mobilech – volat z uživatelské interakce. */
export function unlockAudio(): void {
  getCtx();
}

export function setSoundEnabled(value: boolean): void {
  enabled = value;
}

export function isSoundEnabled(): boolean {
  return enabled;
}

function noiseBuffer(ac: AudioContext, seconds: number): AudioBuffer {
  const length = Math.max(1, Math.floor(ac.sampleRate * seconds));
  const buffer = ac.createBuffer(1, length, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/** Krátký perkusivní „klik“ – filtrovaný šum s rychlým útlumem. */
function click(ac: AudioContext, at: number, freq: number, gain: number, dur = 0.05): void {
  if (!master) return;
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac, dur);
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq;
  bp.Q.value = 3.5;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(bp).connect(g).connect(master);
  src.start(at);
  src.stop(at + dur + 0.02);
}

function tone(
  ac: AudioContext,
  at: number,
  freq: number,
  dur: number,
  gain: number,
  type: OscillatorType = 'sine',
  glideTo?: number,
): void {
  if (!master) return;
  const osc = ac.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, at + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g).connect(master);
  osc.start(at);
  osc.stop(at + dur + 0.05);
}

function play(fn: (ac: AudioContext, now: number) => void): void {
  if (!enabled) return;
  const ac = getCtx();
  if (!ac) return;
  try {
    fn(ac, ac.currentTime + 0.01);
  } catch {
    /* audio není kritické */
  }
}

/** Štěrchání kostek v kelímku + dopad na plátno. */
export function playDiceRoll(count = 1): void {
  play((ac, now) => {
    const rattles = 9 + count * 3;
    for (let i = 0; i < rattles; i++) {
      const t = now + i * 0.035 + Math.random() * 0.02;
      click(ac, t, 1800 + Math.random() * 2600, 0.12 + Math.random() * 0.1, 0.035);
    }
    const land = now + rattles * 0.035 + 0.05;
    for (let i = 0; i < count; i++) {
      const t = land + i * 0.07;
      click(ac, t, 900 + Math.random() * 400, 0.35, 0.07);
      click(ac, t + 0.06, 1400, 0.12, 0.04);
      tone(ac, t, 160, 0.09, 0.12, 'triangle', 90);
    }
  });
}

/** Cinknutí žetonu. */
export function playChip(): void {
  play((ac, now) => {
    tone(ac, now, 2400, 0.12, 0.12, 'sine');
    tone(ac, now, 3650, 0.08, 0.07, 'sine');
    click(ac, now, 5200, 0.15, 0.03);
    tone(ac, now + 0.05, 2600, 0.1, 0.06, 'sine');
  });
}

/** Odkrytí kelímku. */
export function playReveal(): void {
  play((ac, now) => {
    tone(ac, now, 300, 0.25, 0.12, 'triangle', 700);
    click(ac, now + 0.18, 1100, 0.25, 0.06);
  });
}

export function playWin(): void {
  play((ac, now) => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(ac, now + i * 0.09, f, 0.32, 0.16, 'triangle'));
  });
}

export function playDiceJack(): void {
  play((ac, now) => {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568];
    notes.forEach((f, i) => {
      tone(ac, now + i * 0.075, f, 0.45, 0.14, 'square');
      tone(ac, now + i * 0.075, f * 2, 0.3, 0.05, 'sine');
    });
    for (let i = 0; i < 10; i++) tone(ac, now + 0.5 + i * 0.05, 2000 + Math.random() * 2500, 0.15, 0.04, 'sine');
  });
}

export function playLose(): void {
  play((ac, now) => {
    tone(ac, now, 392, 0.3, 0.14, 'sawtooth', 370);
    tone(ac, now + 0.25, 330, 0.3, 0.12, 'sawtooth', 311);
    tone(ac, now + 0.5, 262, 0.6, 0.12, 'sawtooth', 196);
  });
}

export function playBust(): void {
  play((ac, now) => {
    tone(ac, now, 220, 0.45, 0.2, 'square', 70);
    click(ac, now, 400, 0.3, 0.12);
  });
}

export function playPush(): void {
  play((ac, now) => {
    tone(ac, now, 440, 0.18, 0.1, 'sine');
    tone(ac, now + 0.16, 440, 0.22, 0.1, 'sine');
  });
}

export function playButton(): void {
  play((ac, now) => {
    tone(ac, now, 900, 0.05, 0.05, 'sine', 600);
  });
}
