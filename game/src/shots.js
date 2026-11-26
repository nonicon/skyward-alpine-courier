// Screenshot staging: deterministic setups for the entry's screenshots.
// `?shot=cover` flies the plane through a ring, `?shot=approach` puts it on
// final, `?shot=title` shows the title screen over the parked aircraft and
// `?shot=complete` shows a finished sortie. Each run is seeded, so the same
// URL always renders the same frame. The autopilot here only flies the
// screenshot setups — the player flies the real game.

import { WORLD } from './config.js';
import { clamp } from './random.js';

export function parseShotParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    shot: params.get('shot') || null,
    seed: Number(params.get('seed') || WORLD.seed),
  };
}

// A simple proportional autopilot: point the nose at a target, level the
// wings when the target is straight ahead, hold a steady throttle.
export function autopilotTo(flight, target, speed = 62) {
  const dx = target.x - flight.position.x;
  const dy = target.y - flight.position.y;
  const dz = target.z - flight.position.z;
  const dist = Math.hypot(dx, dy, dz);
  const desiredYaw = Math.atan2(dx, dz);
  let yawError = desiredYaw - flight.yaw;
  while (yawError > Math.PI) yawError -= Math.PI * 2;
  while (yawError < -Math.PI) yawError += Math.PI * 2;
  const desiredPitch = clamp(Math.atan2(dy, Math.hypot(dx, dz)), -0.4, 0.4);
  return {
    pitch: clamp((desiredPitch - flight.pitch) * 2.2, -1, 1),
    roll: clamp(yawError * 1.6 - flight.roll * 0.8, -1, 1),
    throttle: (0.45 + (speed - flight.speed) * 0.02) > flight.throttle ? 1 : -1,
    dist,
  };
}

// Where each screenshot starts: the aircraft's position, heading and speed,
// which mission is loaded, and what the camera should do.
export function shotPlan(mode) {
  const field = WORLD.airfield;
  switch (mode) {
    case 'cover':
      return {
        mission: 0,
        place: { x: -190, y: 128, z: 150, yaw: Math.PI, speed: 62, throttle: 0.7 },
        target: 'ring',
        camera: 'chase',
        holdSeconds: 2.9,
      };
    case 'approach':
      return {
        mission: 0,
        place: { x: 0, y: 60, z: -300, yaw: 0, speed: 55, throttle: 0.5 },
        target: 'runway',
        camera: 'chase',
        holdSeconds: 6.0,
      };
    case 'title':
      return {
        mission: 0,
        place: { x: field.x, y: 1.6, z: field.z + 150, yaw: Math.PI, speed: 0, throttle: 0 },
        target: null,
        camera: 'parked',
        holdSeconds: 1.2,
        overlay: 'title',
      };
    case 'complete':
      return {
        mission: 0,
        place: { x: field.x, y: 1.6, z: field.z + 60, yaw: Math.PI, speed: 0, throttle: 0 },
        target: null,
        camera: 'parked',
        holdSeconds: 1.2,
        overlay: 'complete',
      };
    default:
      return null;
  }
}
