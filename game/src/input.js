// Input: keyboard and mouse. The keyboard flies the aircraft — throttle,
// pitch and bank — and the mouse can steer too: drag to bank and pitch,
// wheel for throttle. Every key is listed on the title screen.

export function createInput() {
  const keys = new Set();
  const mouse = { active: false, dx: 0, dy: 0, x: 0, y: 0 };
  let wheelDelta = 0;

  const onKeyDown = (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }
    keys.add(e.code);
  };
  const onKeyUp = (e) => keys.delete(e.code);
  const onBlur = () => keys.clear();
  const onMouseDown = (e) => {
    mouse.active = true;
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.dx = 0;
    mouse.dy = 0;
  };
  const onMouseMove = (e) => {
    if (!mouse.active) return;
    mouse.dx = e.clientX - mouse.x;
    mouse.dy = e.clientY - mouse.y;
  };
  const onMouseUp = () => {
    mouse.active = false;
    mouse.dx = 0;
    mouse.dy = 0;
  };
  const onWheel = (e) => {
    wheelDelta += -Math.sign(e.deltaY);
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('wheel', onWheel, { passive: true });

  function pressed(...codes) {
    return codes.some((c) => keys.has(c));
  }

  // Returns the control input for this frame: pitch, roll and throttle
  // changes, each in -1..1, plus edge-triggered actions.
  function read() {
    const input = { pitch: 0, roll: 0, throttle: 0, pause: false, restart: false, mute: false };
    // Arrow keys fly: up climbs, down descends, left and right bank.
    // W / Shift add throttle, S / Ctrl cut it.
    if (pressed('ArrowUp')) input.pitch += 1;
    if (pressed('ArrowDown')) input.pitch -= 1;
    if (pressed('ArrowLeft', 'KeyA')) input.roll -= 1;
    if (pressed('ArrowRight', 'KeyD')) input.roll += 1;
    if (pressed('KeyW', 'ShiftLeft', 'ShiftRight')) input.throttle += 1;
    if (pressed('KeyS', 'ControlLeft', 'ControlRight')) input.throttle -= 1;
    // Mouse drag steers: sideways drag banks, vertical drag pitches.
    if (mouse.active) {
      input.roll += Math.max(-1, Math.min(1, mouse.dx / 120));
      input.pitch += Math.max(-1, Math.min(1, mouse.dy / 120));
    }
    if (wheelDelta !== 0) {
      input.throttle += Math.max(-1, Math.min(1, wheelDelta * 0.25));
      wheelDelta = 0;
    }
    if (pressed('KeyP', 'Escape')) input.pause = true;
    if (pressed('KeyR')) input.restart = true;
    if (pressed('KeyM')) input.mute = true;
    // Clamp combined inputs.
    input.pitch = Math.max(-1, Math.min(1, input.pitch));
    input.roll = Math.max(-1, Math.min(1, input.roll));
    input.throttle = Math.max(-1, Math.min(1, input.throttle));
    return input;
  }

  function consume(code) {
    keys.delete(code);
  }

  return { read, consume, pressed };
}
