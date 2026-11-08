/* Sound, all synthesized with Web Audio (no audio files):
   - ambience: a soft wind bed and birdsong, always on
   - crowd murmur: louder with more guests near the middle of the view, and when zoomed in
   - animal calls: now and then, from an animal near the middle of the view, panned left or right
   - short cues: placing and removing things, good and bad news
   Browsers only allow audio after the player touches the page, so it starts on the first tap.
   The ♪ button (or M) mutes; the choice is remembered on this device. */
let AC = null,
  master = null,
  crowdGain = null,
  noiseBuf = null,
  soundOn = true,
  nextCall = 0,
  nextBird = 0,
  lastSfx = 0;
try {
  soundOn = localStorage.getItem('wildgrove-sound') !== 'off';
} catch (e) {}

function startAudio() {
  if (AC || !soundOn) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  try {
    AC = new Ctx();
  } catch (e) {
    return;
  }
  master = AC.createGain();
  master.gain.value = 0.8;
  master.connect(AC.destination);
  // two seconds of white noise, reused by everything that hisses
  noiseBuf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  // wind: low rumbling noise that swells slowly
  const wind = noiseSrc(),
    wl = AC.createBiquadFilter(),
    wg = AC.createGain(),
    lfo = AC.createOscillator(),
    lg = AC.createGain();
  wl.type = 'lowpass';
  wl.frequency.value = 380;
  wg.gain.value = 0.035;
  lfo.frequency.value = 0.07;
  lg.gain.value = 0.02;
  lfo.connect(lg).connect(wg.gain);
  wind.connect(wl).connect(wg).connect(master);
  lfo.start();
  // crowd: speech-band noise with a fast flutter, so it reads as many voices
  const crowd = noiseSrc(),
    cb = AC.createBiquadFilter(),
    cb2 = AC.createBiquadFilter(),
    flutter = AC.createOscillator(),
    fg = AC.createGain();
  cb.type = 'bandpass';
  cb.frequency.value = 650;
  cb.Q.value = 0.9;
  cb2.type = 'lowpass';
  cb2.frequency.value = 1600;
  crowdGain = AC.createGain();
  crowdGain.gain.value = 0;
  const cmod = AC.createGain();
  cmod.gain.value = 1;
  flutter.frequency.value = 5.5;
  fg.gain.value = 0.35;
  flutter.connect(fg).connect(cmod.gain);
  crowd.connect(cb).connect(cb2).connect(cmod).connect(crowdGain).connect(master);
  flutter.start();
}
function noiseSrc() {
  const s = AC.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  s.start(0, Math.random() * 2);
  return s;
}
function setSound(on) {
  soundOn = on;
  try {
    localStorage.setItem('wildgrove-sound', on ? 'on' : 'off');
  } catch (e) {}
  if (on) {
    startAudio();
    if (AC && AC.state === 'suspended') AC.resume();
  } else if (AC) AC.suspend();
  const b = $('#snd');
  if (b) {
    b.setAttribute('aria-pressed', String(on));
    b.title = on ? 'Sound on (M to mute)' : 'Sound off (M to turn on)';
  }
}
// a gain envelope: quick attack, then fade out over `len` seconds
function env(peak, len, at = AC.currentTime) {
  const g = AC.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + Math.min(0.04, len / 4));
  g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  return g;
}
function tone(type, f0, f1, len, peak, out, at = AC.currentTime) {
  const o = AC.createOscillator(),
    g = env(peak, len, at);
  o.type = type;
  o.frequency.setValueAtTime(f0, at);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), at + len);
  o.connect(g).connect(out);
  o.start(at);
  o.stop(at + len + 0.05);
  return o;
}
function hiss(fType, freq, len, peak, out, at = AC.currentTime) {
  const s = AC.createBufferSource(),
    f = AC.createBiquadFilter(),
    g = env(peak, len, at);
  s.buffer = noiseBuf;
  f.type = fType;
  f.frequency.value = freq;
  s.connect(f).connect(g).connect(out);
  s.start(at, Math.random());
  s.stop(at + len + 0.05);
}
// short interface cues
function sfx(kind) {
  if (!AC || !soundOn) return;
  const now = AC.currentTime;
  if (now - lastSfx < 0.06) return; // dragging a path places many tiles: one tick is enough
  lastSfx = now;
  if (kind === 'place') {
    tone('sine', 220, 120, 0.12, 0.18, master);
    hiss('lowpass', 900, 0.08, 0.05, master);
  } else if (kind === 'remove') {
    hiss('bandpass', 500, 0.18, 0.12, master);
  } else if (kind === 'good') {
    tone('sine', 660, 660, 0.25, 0.07, master);
    tone('sine', 990, 990, 0.35, 0.06, master, now + 0.1);
  } else if (kind === 'bad') {
    tone('triangle', 200, 150, 0.25, 0.08, master);
  }
}
// which kind of call each animal makes
const CALLS = {
  lion: 'roar',
  tiger: 'roar',
  polar: 'roar',
  elephant: 'trumpet',
  zebra: 'bray',
  camel: 'grunt',
  bison: 'grunt',
  kangaroo: 'grunt',
  giraffe: 'grunt',
  monkey: 'whoop',
  gorilla: 'whoop',
  penguin: 'squawk',
  sealion: 'bark',
  fox: 'howl',
  dolphin: 'click',
  orca: 'click',
  turtle: 'splash',
  shark: 'splash',
};
function animalCall(sp, vol, pan) {
  const p = AC.createStereoPanner ? AC.createStereoPanner() : AC.createGain();
  if (p.pan) p.pan.value = pan;
  p.connect(master);
  const t = AC.currentTime,
    kind = CALLS[sp] || 'grunt';
  if (kind === 'roar') {
    tone('sawtooth', 95, 55, 1.3, 0.12 * vol, p);
    hiss('lowpass', 350, 1.2, 0.25 * vol, p);
  } else if (kind === 'trumpet') {
    const o = tone('sawtooth', 420, 520, 0.9, 0.08 * vol, p);
    o.frequency.setValueAtTime(420, t);
    o.frequency.linearRampToValueAtTime(760, t + 0.25);
    o.frequency.linearRampToValueAtTime(520, t + 0.9);
  } else if (kind === 'bray') {
    for (let k = 0; k < 4; k++) tone('square', k % 2 ? 320 : 720, k % 2 ? 280 : 650, 0.22, 0.04 * vol, p, t + k * 0.24);
  } else if (kind === 'grunt') {
    tone('sine', 130, 90, 0.35, 0.18 * vol, p);
  } else if (kind === 'whoop') {
    for (let k = 0; k < 3; k++) tone('sine', 320 + k * 90, 900 + k * 120, 0.28, 0.1 * vol, p, t + k * 0.3);
  } else if (kind === 'squawk') {
    for (let k = 0; k < 3; k++) tone('square', 780, 620, 0.12, 0.04 * vol, p, t + k * 0.16);
  } else if (kind === 'bark') {
    for (let k = 0; k < 2; k++) tone('sawtooth', 260, 170, 0.18, 0.07 * vol, p, t + k * 0.25);
  } else if (kind === 'howl') {
    const o = tone('sine', 420, 500, 1.4, 0.08 * vol, p);
    o.frequency.setValueAtTime(420, t);
    o.frequency.linearRampToValueAtTime(720, t + 0.5);
    o.frequency.linearRampToValueAtTime(500, t + 1.4);
  } else if (kind === 'click') {
    for (let k = 0; k < 6; k++) tone('square', 2400, 1800, 0.03, 0.04 * vol, p, t + k * 0.06);
    tone('sine', 1200, 2600, 0.4, 0.04 * vol, p, t + 0.4);
  } else if (kind === 'splash') hiss('highpass', 1200, 0.5, 0.12 * vol, p);
}
function birdSong() {
  const t = AC.currentTime,
    base = 2400 + Math.random() * 1600,
    n = 2 + ((Math.random() * 4) | 0),
    p = AC.createStereoPanner ? AC.createStereoPanner() : AC.createGain();
  if (p.pan) p.pan.value = Math.random() * 1.6 - 0.8;
  p.connect(master);
  for (let k = 0; k < n; k++) tone('sine', base, base * (1.2 + Math.random() * 0.3), 0.09, 0.025, p, t + k * 0.13);
}
// per frame: crowd level, birds, and the odd animal call
function syncSound(dt) {
  if (!AC || !soundOn || AC.state !== 'running') return;
  const now = AC.currentTime,
    near = Math.max(0, 1 - CAM.dist / 60), // zoomed in: louder
    r = Math.max(8, CAM.dist * 0.8);
  let g = 0;
  for (let k = 0; k < S.guests.length; k += 4) {
    const q = S.guests[k];
    if (Math.abs(q.x - CAM.tx) < r && Math.abs(q.y - CAM.tz) < r) g += 4;
  }
  const crowd = speed ? Math.min(0.09, (g / 60) * 0.09) * (0.4 + near) : 0;
  crowdGain.gain.setTargetAtTime(crowd, now, 0.4);
  if (now > nextBird) {
    nextBird = now + 2.5 + Math.random() * 7;
    if (speed) birdSong();
  }
  if (now > nextCall) {
    nextCall = now + 5 + Math.random() * 9;
    if (!speed || !S.animals.length) return;
    // try a few random animals for one near the middle of the view
    for (let k = 0; k < 12; k++) {
      const a = S.animals[(Math.random() * S.animals.length) | 0],
        dx = a.x - CAM.tx,
        dz = a.y - CAM.tz,
        d = Math.hypot(dx, dz);
      if (d > r * 1.2) continue;
      // left or right of the screen: rotate the offset by the camera's yaw
      const side = dx * Math.cos(CAM.yaw) - dz * Math.sin(CAM.yaw);
      animalCall(a.sp, (1 - d / (r * 1.3)) * (0.5 + near), clamp(side / r, -0.9, 0.9));
      break;
    }
  }
}
// audio may only start after a touch or click
window.addEventListener('pointerdown', () => {
  startAudio();
  if (AC && AC.state === 'suspended' && soundOn) AC.resume();
});
setTimeout(() => setSound(soundOn), 0);
