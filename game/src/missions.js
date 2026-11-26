// Missions and rings: a sortie is a course of glowing rings across the
// valley, then a landing. Rings are toruses that light up as you pass them,
// and each pass is scored on speed and centring.

/* THREE comes from the vendored classic script game/vendor/three.min.js. */
import { WORLD, PALETTE, SCORING } from './config.js';

export function createMissions(scene) {
  let active = null; // { mission, rings: [{mesh, passed, ...}], index, score }
  let ringGroup = null;

  function clearRings() {
    if (ringGroup) {
      scene.remove(ringGroup);
      ringGroup.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
      ringGroup = null;
    }
  }

  function start(mission) {
    clearRings();
    ringGroup = new THREE.Group();
    // Each ring faces the course: its opening points along the flight path
    // from the previous waypoint, so the pilot sees a circle, not an edge.
    let prev = { x: WORLD.airfield.x, z: WORLD.airfield.z + 150 };
    const rings = mission.rings.map((def, i) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(16, 1.6, 12, 40),
        new THREE.MeshBasicMaterial({ color: PALETTE.ring, transparent: true, opacity: 0.95 }),
      );
      ring.position.set(def.x, def.y, def.z);
      ring.rotation.y = Math.atan2(def.x - prev.x, def.z - prev.z);
      prev = def;
      ringGroup.add(ring);
      // A small beacon light above each ring, visible from far away.
      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(2.2, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffd27a }),
      );
      beacon.position.set(def.x, def.y + 22, def.z);
      ringGroup.add(beacon);
      return { def, mesh: ring, beacon, passed: false, index: i };
    });
    scene.add(ringGroup);
    active = { mission, rings, index: 0, score: 0, startTime: performance.now() };
    return active;
  }

  function nextRing() {
    if (!active) return null;
    return active.rings[active.index] ?? null;
  }

  function ringsLeft() {
    if (!active) return 0;
    return active.rings.length - active.index;
  }

  function allRingsDone() {
    return active !== null && active.index >= active.rings.length;
  }

  // Returns the points earned, or 0 when the aircraft is not inside a ring.
  function checkPass(position, speed) {
    const ring = nextRing();
    if (!ring) return 0;
    const d = position.distanceTo(ring.mesh.position);
    if (d > 15) return 0;
    ring.passed = true;
    active.index += 1;
    ring.mesh.material.color.setHex(PALETTE.ringDone);
    ring.beacon.material.color.setHex(PALETTE.ringDone);
    // Centre the pass for the full bonus: dead centre earns the most.
    const accuracy = Math.max(0, 1 - d / 15);
    const timeBonus = Math.round(SCORING.ringTimeBonus * accuracy);
    const speedBonus = Math.round(Math.min(60, Math.max(0, speed - 40)));
    const points = SCORING.ring + timeBonus + speedBonus;
    active.score += points;
    return points;
  }

  // Mark the first `count` rings as already flown (used by screenshot setups
  // that start mid-course).
  function skipTo(count) {
    if (!active) return;
    for (let i = 0; i < count && i < active.rings.length; i++) {
      active.rings[i].passed = true;
      active.rings[i].mesh.material.color.setHex(PALETTE.ringDone);
      active.rings[i].beacon.material.color.setHex(PALETTE.ringDone);
    }
    active.index = Math.min(count, active.rings.length);
  }

  function update(dt, time) {
    if (!ringGroup) return;
    for (const ring of active.rings) {
      if (ring.passed) continue;
      // Unpassed rings breathe gently so the pilot can spot them.
      const s = 1 + Math.sin(time * 2.2 + ring.index) * 0.04;
      ring.mesh.scale.setScalar(s);
      ring.beacon.position.y = ring.def.y + 22 + Math.sin(time * 1.6 + ring.index) * 1.5;
    }
  }

  function dispose() {
    clearRings();
    active = null;
  }

  return { start, nextRing, ringsLeft, allRingsDone, checkPass, skipTo, update, dispose, get active() { return active; } };
}
