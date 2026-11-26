// The aircraft: a low-poly bush plane built from primitives — red fuselage,
// white wings with a red stripe, a tinted canopy, a spinning propeller and
// navigation lights. No model files, so it renders anywhere.

/* THREE comes from the vendored classic script game/vendor/three.min.js. */
import { PALETTE } from './config.js';

export function buildAircraft(scene) {
  const plane = new THREE.Group();

  const red = new THREE.MeshLambertMaterial({ color: PALETTE.planeRed });
  const white = new THREE.MeshLambertMaterial({ color: PALETTE.planeWhite });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2c2f33 });
  const glass = new THREE.MeshPhongMaterial({
    color: 0x9fd4e8,
    shininess: 140,
    specular: 0xffffff,
    transparent: true,
    opacity: 0.85,
  });

  // Fuselage: a tapered cylinder pointing forward (-z is forward here).
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.55, 6.4, 10), red);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.castShadow = true;
  plane.add(fuselage);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.4, 10), white);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -3.9;
  plane.add(nose);

  // Canopy over the cockpit.
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.85, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    glass,
  );
  canopy.scale.set(1, 0.75, 1.6);
  canopy.position.set(0, 0.55, -0.4);
  plane.add(canopy);

  // Main wing with a red stripe, plus tailplane and fin.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(11, 0.22, 1.9), white);
  wing.position.set(0, 0.1, -0.6);
  wing.castShadow = true;
  plane.add(wing);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(11.05, 0.24, 0.35), red);
  stripe.position.set(0, 0.1, -1.3);
  plane.add(stripe);
  const tailplane = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.16, 1.2), white);
  tailplane.position.set(0, 0.25, 3.0);
  plane.add(tailplane);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.7, 1.4), red);
  fin.position.set(0, 0.9, 3.0);
  plane.add(fin);

  // Fixed landing gear with two wheels.
  for (const x of [-0.9, 0.9]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 6), dark);
    strut.position.set(x, -0.9, -0.8);
    plane.add(strut);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, -1.45, -0.8);
    plane.add(wheel);
  }

  // Propeller: hub plus two blades, spun by the flight model.
  const prop = new THREE.Group();
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.5, 8), dark);
  hub.rotation.x = Math.PI / 2;
  prop.add(hub);
  for (const a of [0, Math.PI]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.4, 0.12), dark);
    blade.rotation.z = a;
    prop.add(blade);
  }
  prop.position.z = -4.7;
  plane.add(prop);

  // Navigation lights: red on the left wing, green on the right.
  const lampGeo = new THREE.SphereGeometry(0.14, 8, 8);
  const leftLamp = new THREE.Mesh(lampGeo, new THREE.MeshBasicMaterial({ color: 0xff2222 }));
  leftLamp.position.set(-5.5, 0.1, -0.6);
  plane.add(leftLamp);
  const rightLamp = new THREE.Mesh(lampGeo, new THREE.MeshBasicMaterial({ color: 0x22ff66 }));
  rightLamp.position.set(5.5, 0.1, -0.6);
  plane.add(rightLamp);

  scene.add(plane);
  return {
    group: plane,
    propeller: prop,
    setPose(position, yaw, pitch, roll) {
      plane.position.copy(position);
      plane.rotation.order = 'YXZ';
      // The mesh nose points along local -z; physics forward is
      // (sin yaw, cos yaw), so the visual yaw needs a half-turn offset,
      // and a positive (right) bank drops the right wing.
      plane.rotation.y = yaw + Math.PI;
      plane.rotation.x = pitch;
      plane.rotation.z = -roll;
    },
  };
}
