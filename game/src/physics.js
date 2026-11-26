// The flight model: an arcade model with real trade-offs. Speed comes from
// the throttle, lift comes from speed, turns come from banking, and a slow
// wing stops flying. Landings are judged, crashes are final.

/* THREE comes from the vendored classic script game/vendor/three.min.js. */
import { PLANE, WORLD } from './config.js';
import { heightAt, isOnRunway } from './terrain.js';
import { clamp, lerp } from './random.js';

export function createFlight() {
  const state = {
    position: new THREE.Vector3(0, 12, WORLD.airfield.z + 150),
    yaw: Math.PI, // facing north, down the runway
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    fuel: PLANE.fuelCapacity,
    hull: PLANE.hull,
    verticalSpeed: 0,
    onGround: true,
    airborne: false,
    crashed: false,
    landed: false,
    landingQuality: null, // 'perfect' | 'good' | 'rough'
    crashReason: '',
  };

  function reset(mission, startOnRunway = true) {
    const x = WORLD.airfield.x;
    const z = WORLD.airfield.z + 150;
    state.position.set(x, heightAt(x, z) + 1.6, z);
    state.yaw = Math.PI;
    state.pitch = 0;
    state.roll = 0;
    state.speed = 0;
    state.throttle = 0;
    state.fuel = mission ? mission.fuel : PLANE.fuelCapacity;
    state.hull = PLANE.hull;
    state.verticalSpeed = 0;
    state.onGround = startOnRunway;
    state.airborne = false;
    state.crashed = false;
    state.landed = false;
    state.landingQuality = null;
    state.crashReason = '';
  }

  // Place the aircraft in the air for a screenshot or a mid-air restart.
  function placeInAir(x, y, z, yaw, speed, throttle) {
    state.position.set(x, y, z);
    state.yaw = yaw;
    state.pitch = 0;
    state.roll = 0;
    state.speed = speed;
    state.throttle = throttle;
    state.onGround = false;
    state.airborne = true;
    state.crashed = false;
    state.landed = false;
  }

  function update(dt, input, wind) {
    if (state.crashed || state.landed) return state;

    // Throttle and speed: the engine pulls toward its target speed, drag
    // pushes back, and a steep climb bleeds speed.
    state.throttle = clamp(state.throttle + input.throttle * PLANE.throttleAccel * dt, 0, 1);
    const targetSpeed = state.throttle * PLANE.maxSpeed;
    const climbPenalty = Math.max(0, Math.sin(state.pitch)) * 14;
    state.speed = lerp(state.speed, targetSpeed - climbPenalty, clamp(dt * 0.7, 0, 1));
    state.speed = Math.max(0, state.speed - PLANE.drag * state.speed * dt * 0.4);

    // Control authority fades as the wing slows towards the stall.
    const authority = clamp((state.speed - PLANE.stallSpeed * 0.4) / PLANE.cruiseSpeed, 0.15, 1);
    state.roll = clamp(state.roll + input.roll * PLANE.rollRate * authority * dt, -1.25, 1.25);
    // The wing levels itself gently when the stick is centred.
    if (Math.abs(input.roll) < 0.05) state.roll = lerp(state.roll, 0, clamp(dt * 0.55, 0, 1));
    state.pitch = clamp(
      state.pitch + input.pitch * PLANE.pitchRate * authority * dt,
      -0.55,
      0.55,
    );
    if (state.onGround) state.pitch = Math.max(0, state.pitch);

    // A banked wing turns the nose; the turn tightens with speed.
    state.yaw -= Math.sin(state.roll) * PLANE.turnRate * (0.35 + state.speed / PLANE.cruiseSpeed) * dt;

    // Velocity from heading and pitch, plus gravity's pull on a slow wing.
    const forward = new THREE.Vector3(
      Math.sin(state.yaw) * Math.cos(state.pitch),
      Math.sin(state.pitch),
      Math.cos(state.yaw) * Math.cos(state.pitch),
    );
    // Note: yaw = PI faces north (-z in world space) via the forward vector.
    const lift = clamp(state.speed / PLANE.stallSpeed, 0, 1.35);
    let vy = forward.y * state.speed;
    if (lift < 1 && !state.onGround) {
      vy -= (1 - lift) * 12; // sinking, then stalling
    }
    state.verticalSpeed = vy;
    const vx = forward.x * state.speed + wind;
    const vz = forward.z * state.speed;
    state.position.x += vx * dt;
    state.position.y += vy * dt;
    state.position.z += vz * dt;

    // Stay inside the valley.
    const bound = WORLD.size / 2 - 40;
    state.position.x = clamp(state.position.x, -bound, bound);
    state.position.z = clamp(state.position.z, -bound, bound);

    // Fuel: the engine drinks at full throttle and sips at idle.
    if (state.throttle > 0.02) {
      state.fuel -= PLANE.fuelBurn * (0.25 + state.throttle) * dt;
      if (state.fuel <= 0) {
        state.fuel = 0;
        state.throttle = 0; // flame-out: glide her home
      }
    }

    // Ground contact.
    const ground = heightAt(state.position.x, state.position.z);
    const gearHeight = 1.6;
    if (state.position.y <= ground + gearHeight) {
      state.position.y = ground + gearHeight;
      const hard = Math.abs(state.verticalSpeed);
      const runway = isOnRunway(state.position.x, state.position.z);
      const gentle = hard < 4 && Math.abs(state.pitch) < 0.25 && state.speed < 70;
      if (state.airborne && runway && gentle && state.speed > 12) {
        state.landed = true;
        state.onGround = true;
        state.landingQuality = hard < 1.8 && state.speed < 55 ? 'perfect' : 'good';
        state.speed *= 0.55;
      } else if (state.airborne) {
        if (hard < 2.5 && state.speed < 45 && Math.abs(state.pitch) < 0.3) {
          // A rough field landing: survivable, but it costs the airframe.
          state.hull -= 35;
          state.onGround = true;
          state.landed = true;
          state.landingQuality = 'rough';
          state.speed *= 0.4;
          if (state.hull <= 0) crash('The airframe broke apart on the rough ground.');
        } else {
          crash(runway ? 'You hit the runway too hard.' : 'You flew into the ground.');
        }
      } else {
        state.onGround = true;
      }
      if (state.onGround && !state.landed) {
        // Rolling on the ground: friction slows the aircraft.
        state.speed = Math.max(0, state.speed - 18 * dt);
        if (state.speed > PLANE.stallSpeed * 1.15 && state.pitch > 0.08) {
          state.airborne = true;
          state.onGround = false;
        }
      }
    } else if (state.position.y > ground + gearHeight + 0.5) {
      state.onGround = false;
      if (state.speed > PLANE.stallSpeed) state.airborne = true;
    }
    return state;
  }

  function crash(reason) {
    state.crashed = true;
    state.crashReason = reason;
    state.hull = 0;
    state.speed = 0;
  }

  function damage(amount, reason) {
    state.hull -= amount;
    if (state.hull <= 0) crash(reason);
  }

  return { state, reset, placeInAir, update, damage };
}
