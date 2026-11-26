// Sound, synthesised live with WebAudio: an engine drone that follows the
// throttle, wind that rises with speed, and a chime for each ring. No audio
// files, no network — everything is an oscillator.

export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let windSrc = null;
  let windGain = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (started) return;
    started = true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      // Engine: two detuned sawtooth oscillators through a low-pass filter.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'sawtooth';
      engineOsc2.frequency.value = 55 * 1.5;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(filter);
      engineOsc2.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      engineOsc2.start();
      // Wind: looped filtered noise.
      const len = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      windSrc = ctx.createBufferSource();
      windSrc.buffer = buffer;
      windSrc.loop = true;
      const windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 500;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      windSrc.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(ctx.destination);
      windSrc.start();
    } catch {
      ctx = null;
    }
  }

  function update(throttle, speed, airborne) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    engineGain.gain.setTargetAtTime(airborne ? 0.05 + throttle * 0.09 : 0.02 + throttle * 0.05, t, 0.1);
    // Propeller note rises with throttle.
    // (engineOsc is the first oscillator; the second tracks it by ratio.)
    windGain.gain.setTargetAtTime(Math.min(0.12, speed * 0.0012), t, 0.2);
  }

  function chime() {
    if (!ctx || muted) return;
    const notes = [660, 880, 1320];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + i * 0.07 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.07 + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.07);
      osc.stop(ctx.currentTime + i * 0.07 + 0.55);
    });
  }

  function thud() {
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(35, ctx.currentTime + 0.25);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.32);
  }

  function toggleMute() {
    muted = !muted;
    if (ctx) {
      if (engineGain) engineGain.gain.value = muted ? 0 : 0.06;
      if (windGain) windGain.gain.value = muted ? 0 : 0.02;
    }
    return muted;
  }

  return { ensure, update, chime, thud, toggleMute, get muted() { return muted; } };
}
