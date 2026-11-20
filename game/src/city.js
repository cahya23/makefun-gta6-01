// Solmar Bay itself: a sun-soaked coastal city built from boxes, planes and
// cylinders — roads on a grid, towers downtown, low houses by the beach, palms,
// lamps, a harbour pier and the sea. All geometry is procedural, no assets.
import * as THREE from 'three';
import { createSeededRandom, CITY_HALF } from './state.js';

/** Road centre lines (both directions), spaced across the city grid. */
export const ROAD_LINES = [-96, -64, -32, 0, 32, 64, 96];
/** Half-width of a road surface. */
export const ROAD_HALF = 5;

const BUILDING_COLORS = [0xffe0b3, 0xffc9a3, 0xa8d8e8, 0xf7f3e8, 0xffb3a7, 0xc9e6c9, 0xe8d5f2, 0xfff2cc];
const GLASS_COLORS = [0x2e6f8e, 0x3a8fb7, 0x1f4e79, 0x5b8fb9];

export function buildCity(scene) {
  const rand = createSeededRandom(20261120);
  const colliders = []; // {minX,maxX,minZ,maxZ} building footprints for collision
  const group = new THREE.Group();
  group.name = 'SolmarBayCity';

  // --- sky, sun, fog -------------------------------------------------------
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x9fd4e8, 180, 420);
  const sun = new THREE.DirectionalLight(0xfff2cc, 2.4);
  sun.position.set(90, 140, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -160; sun.shadow.camera.right = 160;
  sun.shadow.camera.top = 160; sun.shadow.camera.bottom = -160;
  sun.shadow.camera.far = 420;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfe3ff, 0x8a7a5a, 1.1));
  const sunBall = new THREE.Mesh(
    new THREE.SphereGeometry(9, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xfff6c9, fog: false }));
  sunBall.position.set(180, 150, -220);
  scene.add(sunBall);

  // --- ground: grass base, road grid, beach and sea ------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2 + 260, CITY_HALF * 2 + 260),
    new THREE.MeshLambertMaterial({ color: 0x7fb069 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  const roadMat = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
  const walkMat = new THREE.MeshLambertMaterial({ color: 0xb8b0a0 });
  for (const c of ROAD_LINES) {
    const roadNS = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, CITY_HALF * 2), roadMat);
    roadNS.rotation.x = -Math.PI / 2; roadNS.position.set(c, 0.02, 0);
    roadNS.receiveShadow = true; group.add(roadNS);
    const roadEW = new THREE.Mesh(new THREE.PlaneGeometry(CITY_HALF * 2, ROAD_HALF * 2), roadMat);
    roadEW.rotation.x = -Math.PI / 2; roadEW.position.set(0, 0.02, c);
    roadEW.receiveShadow = true; group.add(roadEW);
    // sidewalks: pale strips flanking each road
    for (const off of [-7.2, 7.2]) {
      const w1 = new THREE.Mesh(new THREE.PlaneGeometry(2.6, CITY_HALF * 2), walkMat);
      w1.rotation.x = -Math.PI / 2; w1.position.set(c + off, 0.03, 0); group.add(w1);
      const w2 = new THREE.Mesh(new THREE.PlaneGeometry(CITY_HALF * 2, 2.6), walkMat);
      w2.rotation.x = -Math.PI / 2; w2.position.set(0, 0.03, c + off); group.add(w2);
    }
    // dashed centre line, small pale boxes along each road
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5d76e });
    for (let t = -CITY_HALF + 6; t < CITY_HALF; t += 12) {
      const d1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 3), dashMat);
      d1.position.set(c, 0.05, t); group.add(d1);
      const d2 = new THREE.Mesh(new THREE.BoxGeometry(3, 0.05, 0.5), dashMat);
      d2.position.set(t, 0.05, c); group.add(d2);
    }
  }

  // beach sand + sea to the south
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2 + 120, 46),
    new THREE.MeshLambertMaterial({ color: 0xf2dd9e }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.04, CITY_HALF + 18);
  sand.receiveShadow = true; group.add(sand);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2 + 260, 120),
    new THREE.MeshLambertMaterial({ color: 0x1e90c8 }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(0, 0.02, CITY_HALF + 96);
  group.add(sea);

  // --- buildings: one per block, taller downtown ---------------------------
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const glassGeo = new THREE.BoxGeometry(1, 1, 1);
  for (let gx = 0; gx < ROAD_LINES.length - 1; gx++) {
    for (let gz = 0; gz < ROAD_LINES.length - 1; gz++) {
      const cx = (ROAD_LINES[gx] + ROAD_LINES[gx + 1]) / 2;
      const cz = (ROAD_LINES[gz] + ROAD_LINES[gz + 1]) / 2;
      // keep the central plaza and the harbour approach open
      if (Math.abs(cx) < 20 && Math.abs(cz) < 20) continue;
      if (cz > 100) continue; // beachfront stays low / open
      const downtown = Math.abs(cx) < 50 && Math.abs(cz) < 50;
      const h = downtown ? 14 + rand() * 34 : 5 + rand() * 9;
      const w = 13 + rand() * 7;
      const d = 13 + rand() * 7;
      const color = BUILDING_COLORS[Math.floor(rand() * BUILDING_COLORS.length)];
      const b = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color }));
      b.scale.set(w, h, d);
      b.position.set(cx, h / 2, cz);
      b.castShadow = true; b.receiveShadow = true;
      group.add(b);
      // glass band near the top so towers read as offices at a glance
      const glass = new THREE.Mesh(glassGeo,
        new THREE.MeshLambertMaterial({ color: GLASS_COLORS[Math.floor(rand() * GLASS_COLORS.length)] }));
      glass.scale.set(w * 0.92, Math.min(3.5, h * 0.22), d * 0.92);
      glass.position.set(cx, h - glass.scale.y / 2 - 0.6, cz);
      group.add(glass);
      // lit window strips on the street-facing sides so walls are not blank
      const winMat = new THREE.MeshLambertMaterial({ color: 0x2c4a63 });
      const floors = Math.max(1, Math.floor(h / 6));
      for (let f = 0; f < floors; f++) {
        const wy = 3 + f * 5.2;
        if (wy > h - 2) break;
        for (const sx of [-w * 0.28, 0, w * 0.28]) {
          const win = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.9, 0.15), winMat);
          win.position.set(cx + sx, wy, cz + d / 2 + 0.08);
          group.add(win);
        }
      }
      // rooftop box (AC unit / sign base) on taller towers
      if (h > 24) {
        const roof = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x8a7f70 }));
        roof.scale.set(4, 2, 4);
        roof.position.set(cx + w * 0.2, h + 1, cz);
        group.add(roof);
      }
      colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
    }
  }

  // --- central plaza: fountain + "SOLMAR BAY" gateway arch -----------------
  const plaza = new THREE.Mesh(new THREE.CylinderGeometry(7, 8, 1.2, 24),
    new THREE.MeshLambertMaterial({ color: 0x9fd8e8 }));
  plaza.position.set(0, 0.6, 0); plaza.castShadow = true; group.add(plaza);
  const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.4, 5, 10),
    new THREE.MeshLambertMaterial({ color: 0xd6f2ff }));
  jet.position.set(0, 3.4, 0); group.add(jet);
  const archMat = new THREE.MeshLambertMaterial({ color: 0xff8c42 });
  for (const sx of [-6, 6]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 12, 1.6), archMat);
    pillar.position.set(sx, 6, -16); pillar.castShadow = true; group.add(pillar);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(14.5, 1.8, 1.6), archMat);
  beam.position.set(0, 12.6, -16); beam.castShadow = true; group.add(beam);

  // --- harbour pier + crates, at the south-east ----------------------------
  const pier = new THREE.Mesh(new THREE.BoxGeometry(10, 1, 42),
    new THREE.MeshLambertMaterial({ color: 0x9a7b4f }));
  pier.position.set(96, 0.5, 148); pier.castShadow = true; group.add(pier);
  const crateMat = new THREE.MeshLambertMaterial({ color: 0xc98f2e });
  const crateMat2 = new THREE.MeshLambertMaterial({ color: 0x4a7a9e });
  for (let i = 0; i < 8; i++) {
    const crate = new THREE.Mesh(boxGeo, i % 2 ? crateMat : crateMat2);
    crate.scale.set(3, 3, 3);
    crate.position.set(92 + (i % 2) * 7, 1.5 + Math.floor(i / 4) * 3.1, 138 + (i % 4) * 5);
    crate.castShadow = true; group.add(crate);
  }

  // --- palms along the beachfront and lamps along the roads ----------------
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6b42 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2fae5f });
  function palm(x, z) {
    const p = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 7, 8), trunkMat);
    trunk.position.y = 3.5; trunk.castShadow = true; p.add(trunk);
    for (let i = 0; i < 5; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.1, 4.4, 4), leafMat);
      const a = (i / 5) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 1.4, 7.4, Math.sin(a) * 1.4);
      leaf.rotation.z = Math.cos(a) * 0.9;
      leaf.rotation.x = -Math.sin(a) * 0.9;
      p.add(leaf);
    }
    p.position.set(x, 0, z);
    group.add(p);
  }
  for (let x = -120; x <= 120; x += 16) palm(x, 122);
  for (let x = -112; x <= 112; x += 32) { palm(x, -16); palm(x + 16, 48); }

  const lampMat = new THREE.MeshLambertMaterial({ color: 0x44484e });
  const lampGlow = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const c of ROAD_LINES) {
    for (let t = -112; t <= 112; t += 32) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 6, 6), lampMat);
      pole.position.set(c + 6.4, 3, t); group.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8), lampGlow);
      bulb.position.set(c + 6.4, 6.1, t); group.add(bulb);
    }
  }

  scene.add(group);
  return { group, colliders };
}

/** True when the point (x,z) with radius r hits a building footprint. */
export function hitsBuilding(colliders, x, z, r) {
  for (const c of colliders) {
    if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) return c;
  }
  return null;
}

/** Push a circle out of a building AABB; returns true when a push happened. */
export function resolveBuildingCollision(colliders, pos, r) {
  const c = hitsBuilding(colliders, pos.x, pos.z, r);
  if (!c) return false;
  const dxl = pos.x + r - c.minX, dxr = c.maxX - (pos.x - r);
  const dzl = pos.z + r - c.minZ, dzr = c.maxZ - (pos.z - r);
  const m = Math.min(dxl, dxr, dzl, dzr);
  if (m === dxl) pos.x = c.minX - r;
  else if (m === dxr) pos.x = c.maxX + r;
  else if (m === dzl) pos.z = c.minZ - r;
  else pos.z = c.maxZ + r;
  return true;
}
