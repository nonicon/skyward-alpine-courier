// Skyward — entry point. Boots the renderer, owns the game state machine
// (title → briefing → flying → paused → ended), runs the flight loop and
// drives the chase camera. Screenshot mode (`?shot=…`) stages a seeded,
// autopilot-flown scene and raises window.__shotReady when the frame is set.

/* THREE comes from the vendored classic script game/vendor/three.min.js. */
import { WORLD, MISSIONS, SCORING } from './config.js';
import { buildTerrain } from './terrain.js';
import { buildSky } from './sky.js';
import { buildAircraft } from './aircraft.js';
import { createFlight } from './physics.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { parseShotParams, autopilotTo, shotPlan } from './shots.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 6000);

buildTerrain(scene);
const sky = buildSky(scene);
const aircraft = buildAircraft(scene);
const flight = createFlight();
const missions = createMissions(scene);
const hud = createHud();
const audio = createAudio();
const input = createInput();

let state = 'title'; // title | briefing | flying | paused | ended
let missionIndex = 0;
let elapsed = 0;
let totalScore = 0;
let shotMode = null;
let shotHold = 0;
let shotReady = false;
let prevPause = false;
let prevRestart = false;
let prevMute = false;
const cameraPos = new THREE.Vector3(0, 40, 520);
const cameraTarget = new THREE.Vector3();

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', resize);

function startMission(index) {
  missionIndex = index;
  const mission = MISSIONS[index];
  missions.start(mission);
  flight.reset(mission, true);
  totalScore = 0;
  elapsed = 0;
  hud.showBriefing(mission, () => {
    state = 'flying';
    hud.showOnly(null);
    hud.setHudVisible(true);
    audio.ensure();
  });
  state = 'briefing';
}

function endSortie(title, text, extraScore = 0) {
  state = 'ended';
  totalScore += extraScore;
  audio.thud();
  hud.showEnd(
    { title, text, score: totalScore },
    () => startMission(missionIndex),
    () => {
      state = 'title';
      hud.showTitle((i) => startMission(i));
    },
  );
}

function finishFlight() {
  const f = flight.state;
  if (f.crashed) {
    endSortie('Crashed', f.crashReason || 'The aircraft was lost.', 0);
    return;
  }
  if (!f.landed) return;
  if (missions.allRingsDone()) {
    const landingPts = f.landingQuality === 'perfect' ? SCORING.landingPerfect
      : f.landingQuality === 'good' ? SCORING.landingGood : 0;
    const bonus = SCORING.missionBonus;
    totalScore += landingPts + bonus;
    endSortie(
      'Sortie Complete',
      `All rings flown and a ${f.landingQuality} landing at Alderfield. Landing ${landingPts} pts, mission bonus ${bonus} pts.`,
      0,
    );
  } else {
    endSortie(
      'Landed Early',
      `You put her down with ${missions.ringsLeft()} ring(s) still to fly. The sortie is incomplete — fly the full course for the mission bonus.`,
      0,
    );
  }
}

function updateChaseCamera(dt) {
  const f = flight.state;
  const forward = new THREE.Vector3(
    Math.sin(f.yaw) * Math.cos(f.pitch),
    Math.sin(f.pitch),
    Math.cos(f.yaw) * Math.cos(f.pitch),
  );
  const desired = new THREE.Vector3()
    .copy(f.position)
    .addScaledVector(forward, -12)
    .add(new THREE.Vector3(0, 3.8, 0));
  // Keep the camera out of the terrain.
  const ground = 6;
  desired.y = Math.max(desired.y, ground);
  cameraPos.lerp(desired, 1 - Math.pow(0.0001, dt));
  camera.position.copy(cameraPos);
  cameraTarget.copy(f.position).addScaledVector(forward, 26);
  camera.lookAt(cameraTarget);
  camera.fov = 62 + clampSpeedFov(f.speed);
  camera.updateProjectionMatrix();
}

function clampSpeedFov(speed) {
  return Math.min(14, Math.max(0, (speed - 50) * 0.22));
}

function updateParkedCamera() {
  const f = flight.state;
  // A three-quarter front view of the parked aircraft, runway behind it.
  // The camera aims slightly west of the aircraft so it sits right of the
  // centred menu card instead of hiding behind it.
  camera.position.set(
    WORLD.airfield.x + 26,
    9,
    WORLD.airfield.z + 120,
  );
  camera.lookAt(f.position.x - 10, f.position.y + 1, f.position.z);
  camera.fov = 55;
  camera.updateProjectionMatrix();
}

function tick(time) {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, (time - (tick.last ?? time)) / 1000 || 0.016);
  tick.last = time;
  const now = time / 1000;

  const raw = input.read();
  // Edge-triggered keys.
  if (raw.pause && !prevPause) {
    if (state === 'flying') {
      state = 'paused';
      hud.showPause(
        () => {
          state = 'flying';
          hud.showOnly(null);
        },
        () => {
          state = 'title';
          hud.showTitle((i) => startMission(i));
        },
      );
    } else if (state === 'paused') {
      state = 'flying';
      hud.showOnly(null);
    }
  }
  if (raw.restart && !prevRestart && (state === 'flying' || state === 'paused' || state === 'ended')) {
    startMission(missionIndex);
  }
  if (raw.mute && !prevMute) {
    const muted = audio.toggleMute();
    hud.toast(muted ? 'Sound off' : 'Sound on');
  }
  prevPause = raw.pause;
  prevRestart = raw.restart;
  prevMute = raw.mute;

  // Once a screenshot is staged, freeze the flight so the frame holds still
  // while the browser takes the picture.
  if (state === 'flying' && !shotReady) {
    // Screenshot mode runs many fixed physics substeps per rendered frame,
    // so a staged scene reaches its moment even on a slow software renderer.
    const substeps = shotMode ? 20 : 1;
    const stepDt = shotMode ? 1 / 60 : dt;
    for (let s = 0; s < substeps; s++) {
      let control = raw;
      if (shotMode) {
        // Autopilot flies the screenshot setups.
        const plan = shotPlan(shotMode);
        let target = null;
        if (plan.target === 'ring') {
          const ring = missions.nextRing();
          if (ring) target = ring.def;
        } else if (plan.target === 'runway') {
          target = { x: WORLD.airfield.x, y: 35, z: WORLD.airfield.z - 20 };
        }
        if (target) control = autopilotTo(flight.state, target);
        shotHold -= stepDt;
        if (shotHold <= 0 && !shotReady) {
          shotReady = true;
          window.__shotReady = true;
        }
      }
      flight.update(stepDt, control, MISSIONS[missionIndex].wind);
      elapsed += stepDt;
      const earned = missions.checkPass(flight.state.position, flight.state.speed);
      if (earned > 0) {
        totalScore += earned;
        audio.chime();
        hud.toast(`Ring clear! +${earned} pts`);
        if (missions.allRingsDone()) hud.toast('All rings clear — land on the runway!');
      }
      if (flight.state.crashed || flight.state.landed) finishFlight();
    }
  }
  if (state === 'flying') {
    audio.update(flight.state.throttle, flight.state.speed, flight.state.airborne);
    hud.update(flight.state, missions, elapsed);
  }

  // Propeller spin follows throttle.
  aircraft.propeller.rotation.z += (2 + flight.state.throttle * 28) * dt;
  aircraft.setPose(flight.state.position, flight.state.yaw, flight.state.pitch, flight.state.roll);

  const wind = MISSIONS[missionIndex].wind;
  sky.update(dt, wind);
  missions.update(dt, now);

  if (shotMode === 'title' || shotMode === 'complete') {
    updateParkedCamera();
  } else {
    updateChaseCamera(dt);
  }

  // The windsock bends with the mission wind.
  const sock = scene.getObjectByName('windsock');
  if (sock) sock.rotation.z = Math.PI / 2 - wind * 0.02;

  renderer.render(scene, camera);
}

// Boot: title screen, or a staged screenshot when ?shot= is present.
const params = parseShotParams();
if (params.shot && shotPlan(params.shot)) {
  const plan = shotPlan(params.shot);
  shotMode = params.shot;
  shotHold = plan.holdSeconds;
  missionIndex = plan.mission;
  missions.start(MISSIONS[plan.mission]);
  if (plan.target === 'ring') missions.skipTo(1);
  flight.placeInAir(plan.place.x, plan.place.y, plan.place.z, plan.place.yaw, plan.place.speed, plan.place.throttle);
  if (plan.place.speed === 0) flight.reset(MISSIONS[plan.mission], true);
  state = 'flying';
  hud.setHudVisible(true);
  hud.showOnly(null);
  hud.update(flight.state, missions, 0);
  if (plan.overlay === 'title') {
    state = 'title';
    hud.showTitle((i) => startMission(i));
    shotReady = true;
    window.__shotReady = true;
  }
  if (plan.overlay === 'complete') {
    state = 'ended';
    totalScore = 2840;
    hud.showEnd(
      {
        title: 'Sortie Complete',
        text: 'All rings flown and a perfect landing at Alderfield. Landing 500 pts, mission bonus 1000 pts.',
        score: totalScore,
      },
      () => startMission(0),
      () => {
        state = 'title';
        hud.showTitle((i) => startMission(i));
      },
    );
    shotReady = true;
    window.__shotReady = true;
  }
  if (plan.overlay) {
    // Parked shots are ready once the first frames settle.
    setTimeout(() => {
      shotReady = true;
      window.__shotReady = true;
    }, 900);
  }
} else {
  hud.showTitle((i) => startMission(i));
  // Park the aircraft on the runway behind the title screen.
  flight.reset(MISSIONS[0], true);
  aircraft.setPose(flight.state.position, flight.state.yaw, 0, 0);
}

window.__game = { flight, missions, hud, startMission };
window.__shotReady = window.__shotReady || false;
requestAnimationFrame(tick);
