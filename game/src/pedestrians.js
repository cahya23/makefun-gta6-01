// Pedestrians: colourful walkers who stroll the sidewalks, cross at corners,
// panic and run when a gun goes off nearby, and react when the player bumps them.
import * as THREE from 'three';
import { createSeededRandom, CITY_HALF } from './state.js';
import { ROAD_LINES } from './city.js';

const SHIRT_COLORS = [0xff6b6b, 0x4ecdc4, 0xffe66d, 0x95e1d3, 0xf38181, 0xaa96da, 0xfcbad3, 0xa8e6cf];
const SKIN_COLORS = [0xf2c89b, 0xc98d5e, 0x8d5a3b, 0xe8b88a];

/** Build one pedestrian figure (body, head, legs that swing while walking). */
export function buildPedestrianMesh(shirt, skin) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 0.36),
    new THREE.MeshLambertMaterial({ color: shirt }));
  body.position.y = 1.05; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 10),
    new THREE.MeshLambertMaterial({ color: skin }));
  head.position.y = 1.72; head.castShadow = true; g.add(head);
  const legMat = new THREE.MeshLambertMaterial({ color: 0x2b3a55 });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.62, 0.24), legMat);
  legL.position.set(-0.16, 0.31, 0); g.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.62, 0.24), legMat);
  legR.position.set(0.16, 0.31, 0); g.add(legR);
  g.userData = { legL, legR };
  return g;
}

export function spawnPedestrians(scene, count) {
  const rand = createSeededRandom(777);
  const peds = [];
  for (let i = 0; i < count; i++) {
    const road = ROAD_LINES[Math.floor(rand() * ROAD_LINES.length)];
    const along = (rand() * 2 - 1) * (CITY_HALF - 8);
    const side = rand() > 0.5 ? 1 : -1;
    const vertical = rand() > 0.5;
    const x = vertical ? road + side * 7.2 : along;
    const z = vertical ? along : road + side * 7.2;
    const mesh = buildPedestrianMesh(
      SHIRT_COLORS[Math.floor(rand() * SHIRT_COLORS.length)],
      SKIN_COLORS[Math.floor(rand() * SKIN_COLORS.length)]);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    peds.push({
      mesh, x, z,
      angle: rand() * Math.PI * 2,
      speed: 1.1 + rand() * 0.9,
      walkPhase: rand() * Math.PI * 2,
      panic: 0,
      vertical,
      dir: rand() > 0.5 ? 1 : -1,
      alive: true,
    });
  }
  return peds;
}

/** Walk the sidewalks; a panicking pedestrian runs away from (px,pz). */
export function updatePedestrians(peds, dt, px, pz, scare) {
  for (const p of peds) {
    if (!p.alive) continue;
    if (scare > 0 && Math.hypot(p.x - px, p.z - pz) < 26) p.panic = 2.5;
    if (p.panic > 0) {
      p.panic -= dt;
      const away = Math.atan2(p.x - px, p.z - pz);
      p.angle += (away - p.angle) * Math.min(1, dt * 4);
      p.x += Math.sin(p.angle) * 4.2 * dt;
      p.z += Math.cos(p.angle) * 4.2 * dt;
    } else {
      // stroll along the sidewalk; turn around at the city edge
      const step = p.speed * p.dir * dt;
      if (p.vertical) {
        p.z += step;
        if (Math.abs(p.z) > CITY_HALF - 4) p.dir *= -1;
        p.angle = p.dir > 0 ? 0 : Math.PI;
      } else {
        p.x += step;
        if (Math.abs(p.x) > CITY_HALF - 4) p.dir *= -1;
        p.angle = p.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
    }
    p.walkPhase += dt * (p.panic > 0 ? 14 : 7);
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.angle;
    const swing = Math.sin(p.walkPhase) * 0.5;
    p.mesh.userData.legL.rotation.x = swing;
    p.mesh.userData.legR.rotation.x = -swing;
    // keep pedestrians out of the sea
    if (p.z > CITY_HALF + 20) p.z = CITY_HALF + 20;
  }
}

/** Knock a pedestrian down (they stay down, then get back up after a while). */
export function knockPedestrian(ped) {
  if (!ped.alive) return;
  ped.alive = false;
  ped.mesh.rotation.x = Math.PI / 2;
  ped.mesh.position.y = 0.3;
  setTimeout(() => {
    ped.alive = true;
    ped.mesh.rotation.x = 0;
    ped.mesh.position.y = 0;
    ped.panic = 3;
  }, 4000);
}
