// Sky, sun and drifting clouds: a gradient dome, a warm sun disc and soft
// billboard clouds made from a canvas texture — no image files needed.

/* THREE comes from the vendored classic script game/vendor/three.min.js. */
import { WORLD, PALETTE } from './config.js';
import { mulberry32 } from './random.js';

function cloudTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const rand = mulberry32(99);
  for (let i = 0; i < 14; i++) {
    const x = 40 + rand() * 176;
    const y = 45 + rand() * 40;
    const r = 22 + rand() * 30;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.85)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

export function buildSky(scene) {
  // Gradient dome: vertex colours from horizon pale to zenith blue.
  const geo = new THREE.SphereGeometry(WORLD.size * 2.2, 24, 12);
  const top = new THREE.Color(PALETTE.skyTop);
  const bottom = new THREE.Color(PALETTE.skyBottom);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(0, pos.getY(i) / (WORLD.size * 2.2));
    c.copy(bottom).lerp(top, Math.pow(t, 0.7));
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const dome = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.BackSide,
      fog: false,
    }),
  );
  scene.add(dome);

  // Sun disc with a soft halo, placed low in the west.
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(70, 32),
    new THREE.MeshBasicMaterial({ color: PALETTE.sun, fog: false }),
  );
  sun.position.set(-2600, 620, -1400);
  sun.lookAt(0, 0, 0);
  scene.add(sun);

  // Lights: warm sun plus a cool sky fill.
  const sunLight = new THREE.DirectionalLight(0xfff1cf, 1.5);
  sunLight.position.set(-900, 700, -500);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -260;
  sunLight.shadow.camera.right = 260;
  sunLight.shadow.camera.top = 260;
  sunLight.shadow.camera.bottom = -260;
  sunLight.shadow.camera.far = 2600;
  scene.add(sunLight);
  scene.add(new THREE.HemisphereLight(0xbfd9ee, 0x6f7f56, 0.75));
  scene.fog = new THREE.Fog(0xd8e8f2, 700, 2600);

  // Clouds: billboards that drift slowly with the wind.
  const tex = cloudTexture();
  const clouds = [];
  const rand = mulberry32(WORLD.seed + 7);
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    fog: false,
  });
  for (let i = 0; i < 26; i++) {
    const sprite = new THREE.Sprite(mat);
    const s = 180 + rand() * 260;
    sprite.scale.set(s, s * 0.45, 1);
    sprite.position.set(
      (rand() - 0.5) * WORLD.size * 1.8,
      260 + rand() * 160,
      (rand() - 0.5) * WORLD.size * 1.8,
    );
    sprite.userData.drift = 1.5 + rand() * 2.5;
    scene.add(sprite);
    clouds.push(sprite);
  }
  return {
    update(dt, wind) {
      for (const cloud of clouds) {
        cloud.position.x += (cloud.userData.drift + wind) * dt;
        if (cloud.position.x > WORLD.size) cloud.position.x = -WORLD.size;
      }
    },
  };
}
