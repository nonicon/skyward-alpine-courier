// The valley: a seeded heightfield with a lake, pine forests, a river road
// and the Alderfield airfield with its runway. Also answers heightAt(x, z),
// the single source of truth for ground height everywhere else.

/* THREE comes from the vendored classic script game/vendor/three.min.js. */
import { WORLD, PALETTE } from './config.js';
import { makeNoise2D, mulberry32, clamp } from './random.js';

const noise = makeNoise2D(WORLD.seed);
const field = WORLD.airfield;

function ridge(x, z) {
  // Mountains rise towards the edges; the valley floor runs north-south.
  const nx = x / WORLD.size;
  const nz = z / WORLD.size;
  const edge = Math.pow(Math.max(Math.abs(nx), Math.abs(nz)) * 2, 2.2);
  const hills = noise(x * 0.0016 + 11, z * 0.0016 + 7, 4);
  const detail = noise(x * 0.008 + 3, z * 0.008 + 9, 3);
  let h = edge * 0.75 + hills * 0.55 + detail * 0.12;
  // A valley floor along the north-south runway axis, so the airfield and
  // its approaches sit on low, flyable ground instead of a hillside.
  const corridor = Math.exp(-((x / 300) * (x / 300)));
  const inCorridor = z > -900 && z < 1000 ? 1 : 0;
  h *= 1 - 0.8 * corridor * inCorridor;
  // Flatten the airfield bowl so the runway sits on level ground: fully
  // flat out to 260 m (the whole strip, hangar and tower), then easing out
  // to the natural hills by 480 m.
  const dx = x - field.x;
  const dz = z - field.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  const t = clamp((d - 260) / 220, 0, 1);
  const w = 1 - t * t * (3 - 2 * t);
  h = h * (1 - w) + 0.01 * w;
  // Keep the lake basin low.
  const lx = x + 620;
  const lz = z + 480;
  const ld = Math.sqrt(lx * lx + lz * lz);
  const lake = clamp(1 - ld / 320, 0, 1);
  h = h * (1 - lake * 0.85);
  return h * WORLD.peakHeight;
}

export function heightAt(x, z) {
  const cx = clamp(x, -WORLD.size / 2, WORLD.size / 2);
  const cz = clamp(z, -WORLD.size / 2, WORLD.size / 2);
  return ridge(cx, cz);
}

export function isOnRunway(x, z) {
  const half = WORLD.runway.length / 2;
  const w = WORLD.runway.width / 2;
  return Math.abs(x - field.x) <= w + 6 && Math.abs(z - field.z) <= half + 6;
}

function terrainColor(height, slope, out, inBowl) {
  // Grassy valley, grey rock on steep ground, snow on the high peaks.
  // The airfield bowl is mowed grass; the lake shore is sand.
  if (inBowl) return out.setHex(0x69a24e);
  if (height > 185) return out.setHex(PALETTE.snow);
  if (slope > 0.55 || height > 130) return out.setHex(PALETTE.rock);
  if (height < 6) return out.setHex(PALETTE.sand);
  const mix = clamp(height / 90, 0, 1);
  out.setHex(PALETTE.grass).lerp(new THREE.Color(PALETTE.meadow), mix);
  return out;
}

export function buildTerrain(scene) {
  const size = WORLD.size;
  const seg = WORLD.segments;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const heights = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = ridge(x, z);
    pos.setY(i, h);
    heights[i] = h;
  }
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    const slope = 1 - nrm.getY(i);
    const inBowl = Math.hypot(pos.getX(i) - field.x, pos.getZ(i) - field.z) < 480;
    terrainColor(heights[i], slope, c, inBowl);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);

  // The lake: a flat, slightly glossy disc in the south-east basin.
  const lake = new THREE.Mesh(
    new THREE.CircleGeometry(300, 48),
    new THREE.MeshPhongMaterial({
      color: PALETTE.water,
      shininess: 120,
      specular: 0x99ccff,
      transparent: true,
      opacity: 0.92,
    }),
  );
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(-620, WORLD.waterLevel, -480);
  scene.add(lake);

  buildForest(scene);
  buildAirfield(scene);
  return { heightAt, isOnRunway };
}

function buildForest(scene) {
  // Instanced pines on the lower slopes: one trunk and one crown per tree.
  const rand = mulberry32(WORLD.seed + 41);
  const spots = [];
  for (let i = 0; i < 2600; i++) {
    const x = (rand() - 0.5) * WORLD.size * 0.94;
    const z = (rand() - 0.5) * WORLD.size * 0.94;
    const h = ridge(x, z);
    if (h < 8 || h > 110) continue;
    const dx = x - field.x;
    const dz = z - field.z;
    if (Math.sqrt(dx * dx + dz * dz) < 300) continue; // keep the airfield clear
    spots.push({ x, z, h, s: 0.7 + rand() * 0.9 });
  }
  const trunkGeo = new THREE.CylinderGeometry(0.5, 0.8, 5, 5);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5a4128 });
  const crownGeo = new THREE.ConeGeometry(3.4, 12, 7);
  const crownMat = new THREE.MeshLambertMaterial({ color: PALETTE.forest });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, spots.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();
  spots.forEach((t, i) => {
    q.setFromAxisAngle(v.set(0, 1, 0), rand() * Math.PI * 2);
    s.set(t.s, t.s, t.s);
    m.compose(new THREE.Vector3(t.x, t.h + 2.2 * t.s, t.z), q, s);
    trunks.setMatrixAt(i, m);
    m.compose(new THREE.Vector3(t.x, t.h + 8 * t.s, t.z), q, s);
    crowns.setMatrixAt(i, m);
  });
  trunks.castShadow = true;
  crowns.castShadow = true;
  scene.add(trunks);
  scene.add(crowns);
}

function buildAirfield(scene) {
  const g = new THREE.Group();
  const groundY = ridge(field.x, field.z);
  const runwayMat = new THREE.MeshLambertMaterial({ color: PALETTE.runway });
  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.runway.width, WORLD.runway.length),
    runwayMat,
  );
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(field.x, groundY + 0.15, field.z);
  strip.receiveShadow = true;
  g.add(strip);

  // Centreline dashes and threshold bars, as thin white boxes.
  const markMat = new THREE.MeshBasicMaterial({ color: 0xf5f5f0 });
  for (let z = -180; z <= 180; z += 40) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 14), markMat);
    dash.position.set(field.x, groundY + 0.25, field.z + z);
    g.add(dash);
  }
  for (const z of [-196, 196]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(26, 0.1, 5), markMat);
    bar.position.set(field.x, groundY + 0.25, field.z + z);
    g.add(bar);
  }
  // Runway edge lights: small amber posts.
  const lightGeo = new THREE.SphereGeometry(0.5, 6, 6);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffc860 });
  for (let z = -200; z <= 200; z += 40) {
    for (const x of [-16, 16]) {
      const lamp = new THREE.Mesh(lightGeo, lightMat);
      lamp.position.set(field.x + x, groundY + 0.8, field.z + z);
      g.add(lamp);
    }
  }

  // Hangar, tower and a fuel hut beside the strip.
  const wall = new THREE.MeshLambertMaterial({ color: 0xd8d2c4 });
  const roof = new THREE.MeshLambertMaterial({ color: 0x8a4a3a });
  const hangar = new THREE.Mesh(new THREE.BoxGeometry(46, 14, 30), wall);
  hangar.position.set(field.x + 52, groundY + 7, field.z + 120);
  hangar.castShadow = true;
  g.add(hangar);
  const hangarRoof = new THREE.Mesh(
    new THREE.CylinderGeometry(15, 15, 46, 12, 1, false, 0, Math.PI),
    roof,
  );
  hangarRoof.rotation.z = Math.PI / 2;
  hangarRoof.rotation.y = Math.PI / 2;
  hangarRoof.position.set(field.x + 52, groundY + 14, field.z + 120);
  g.add(hangarRoof);
  const tower = new THREE.Mesh(new THREE.BoxGeometry(10, 26, 10), wall);
  tower.position.set(field.x - 48, groundY + 13, field.z + 140);
  tower.castShadow = true;
  g.add(tower);
  const cab = new THREE.Mesh(
    new THREE.BoxGeometry(14, 6, 14),
    new THREE.MeshPhongMaterial({ color: 0x2e5f7a, shininess: 80 }),
  );
  cab.position.set(field.x - 48, groundY + 29, field.z + 140);
  g.add(cab);
  const hut = new THREE.Mesh(new THREE.BoxGeometry(12, 6, 10), roof);
  hut.position.set(field.x + 46, groundY + 3, field.z + 60);
  g.add(hut);

  // Windsock on a pole: orange cone that the wind bends.
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.25, 12, 6),
    new THREE.MeshLambertMaterial({ color: 0x666666 }),
  );
  pole.position.set(field.x - 30, groundY + 6, field.z - 150);
  g.add(pole);
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(1.6, 7, 8),
    new THREE.MeshLambertMaterial({ color: 0xff7f2a }),
  );
  sock.rotation.z = Math.PI / 2;
  sock.position.set(field.x - 26, groundY + 11.5, field.z - 150);
  sock.name = 'windsock';
  g.add(sock);

  scene.add(g);
  return g;
}
