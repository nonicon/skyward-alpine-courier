// Skyward — tuning constants, world layout and mission definitions.
// Every number that shapes how the game feels lives here, in one place.

export const WORLD = {
  seed: 7,
  size: 2400, // terrain spans -1200..1200 metres on x and z
  segments: 160, // terrain mesh resolution
  peakHeight: 260, // tallest mountain, metres above sea level
  valleyFloor: 0,
  waterLevel: 2.5, // the lake surface
  airfield: { x: 0, z: 320, heading: 0 }, // runway centre, runway runs north-south
  runway: { length: 420, width: 34 },
};

export const PLANE = {
  cruiseSpeed: 62, // m/s, comfortable cruise
  maxSpeed: 105,
  stallSpeed: 26, // below this the wing stops flying
  climbRate: 9,
  rollRate: 1.9, // rad/s at full deflection
  pitchRate: 1.1,
  turnRate: 0.55, // heading change per second at full bank
  throttleAccel: 0.55,
  drag: 0.012,
  fuelCapacity: 100,
  fuelBurn: 0.55, // units per second at full throttle
  hull: 100,
};

export const SCORING = {
  ring: 250,
  ringTimeBonus: 120, // bonus for a fast, centred pass, scaled by accuracy
  landingPerfect: 500,
  landingGood: 250,
  missionBonus: 1000,
};

// Missions: each is a courier sortie. Rings are waypoints in the sky; the
// sortie ends with a landing back on the Alderfield runway.
export const MISSIONS = [
  {
    id: 'first-flight',
    name: 'First Flight',
    briefing:
      'Warm up the engine and fly the valley course. Thread all five rings, then bring her home to the runway at Alderfield.',
    wind: 0,
    fuel: 100,
    rings: [
      { x: -40, z: 120, y: 95 },
      { x: -190, z: -60, y: 120 },
      { x: -260, z: -300, y: 150 },
      { x: -80, z: -520, y: 170 },
      { x: 120, z: -640, y: 140 },
    ],
  },
  {
    id: 'mountain-mail',
    name: 'Mountain Mail',
    briefing:
      'The mail must cross the ridge before dark. Six rings over the high pass, tighter turns, thinner air. Land clean at Alderfield.',
    wind: 4,
    fuel: 100,
    rings: [
      { x: 160, z: 60, y: 130 },
      { x: 380, z: -180, y: 190 },
      { x: 520, z: -460, y: 240 },
      { x: 340, z: -720, y: 260 },
      { x: 60, z: -820, y: 230 },
      { x: -160, z: -700, y: 190 },
    ],
  },
  {
    id: 'storm-run',
    name: 'Storm Run',
    briefing:
      'A storm is rolling in from the west and the parcel is urgent. Strong crosswind, low fuel, seven rings. Fly sharp, land gentle.',
    wind: 9,
    fuel: 70,
    rings: [
      { x: -220, z: 80, y: 110 },
      { x: -420, z: -220, y: 160 },
      { x: -360, z: -520, y: 210 },
      { x: -80, z: -760, y: 250 },
      { x: 240, z: -780, y: 240 },
      { x: 480, z: -560, y: 200 },
      { x: 420, z: -260, y: 160 },
    ],
  },
];

export const PALETTE = {
  skyTop: 0x2f6fb4,
  skyBottom: 0xcfe8f5,
  sun: 0xfff2c0,
  grass: 0x5d8a4a,
  meadow: 0x7fae5e,
  forest: 0x2f5d33,
  rock: 0x8a8578,
  snow: 0xf4f7fa,
  sand: 0xcbb27a,
  water: 0x2e6f9e,
  runway: 0x3a3d42,
  planeRed: 0xc0392b,
  planeWhite: 0xf2f0ea,
  ring: 0xffb020,
  ringDone: 0x2ecc71,
};
