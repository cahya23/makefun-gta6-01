// Cars: building a car mesh, arcade driving physics, and entering / exiting.
// Every drivable car is one object { mesh, x, z, angle, speed, color, ... }.
import * as THREE from 'three';
import { clamp, wrapAngle, CITY_HALF } from './state.js';
import { resolveBuildingCollision } from './city.js';

const CAR_COLORS = [0xd23c2e, 0x2e7fd2, 0xf2c94c, 0x3dd68c, 0x9b59d0, 0xe8e8e8, 0x222831, 0xff8c42];
const CAR_NAMES = ['Comet', 'Sunrunner', 'Bayliner', 'Palm GT', 'Harbour LX', 'Coral Coupe', 'Dune Buggy', 'Marina S'];

let carCounter = 0;

/** Build the visible mesh for a car of the given colour. Returns { group, wheels, lightBar }. */
export function buildCarMesh(color, isPolice) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.62, 4.4), bodyMat);
  body.position.y = 0.55; body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.58, 2.1),
    new THREE.MeshLambertMaterial({ color: 0x1c2b3a }));
  cabin.position.set(0, 1.12, -0.25); cabin.castShadow = true;
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  const wheels = [];
  for (const [wx, wz] of [[-1.05, 1.45], [1.05, 1.45], [-1.05, -1.45], [1.05, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.38, wz);
    group.add(w); wheels.push(w);
  }
  // headlights + taillights so a car reads at a glance, day or night
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
  for (const sx of [-0.7, 0.7]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.1), headMat);
    h.position.set(sx, 0.55, 2.22); group.add(h);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
  for (const sx of [-0.7, 0.7]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.1), tailMat);
    t.position.set(sx, 0.55, -2.22); group.add(t);
  }
  let lightBar = null;
  if (isPolice) {
    lightBar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.x = -0.45; lightBar.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    blue.position.x = 0.45; lightBar.add(blue);
    lightBar.position.set(0, 1.55, -0.25);
    lightBar.userData = { red, blue };
    group.add(lightBar);
  }
  return { group, wheels, lightBar };
}

/** Create a drivable car at (x,z) facing `angle`, optionally a police car. */
export function createCar(scene, x, z, angle, opts) {
  const o = opts || {};
  const color = o.color !== undefined ? o.color : CAR_COLORS[carCounter % CAR_COLORS.length];
  const name = o.name || CAR_NAMES[carCounter % CAR_NAMES.length];
  carCounter++;
  const built = buildCarMesh(color, !!o.police);
  built.group.position.set(x, 0, z);
  built.group.rotation.y = angle;
  scene.add(built.group);
  const car = {
    id: carCounter,
    name,
    color,
    mesh: built.group,
    wheels: built.wheels,
    lightBar: built.lightBar,
    x, z, angle,
    speed: 0,
    steer: 0,
    police: !!o.police,
    parked: !!o.parked,
    traffic: !!o.traffic,
    health: 100,
    flash: 0,
    route: o.route || null, // traffic loop waypoints
    routeIndex: 0,
    wait: 0,
  };
  return car;
}

/** Sync a car's mesh with its physics state; spin wheels and flash the light bar. */
export function syncCarMesh(car, dt, time) {
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.angle;
  const spin = car.speed * dt * 2.2;
  for (const w of car.wheels) w.rotation.x += spin;
  if (car.lightBar) {
    const on = Math.floor(time * 4) % 2 === 0;
    car.lightBar.userData.red.material.color.setHex(on ? 0xff2222 : 0x661111);
    car.lightBar.userData.blue.material.color.setHex(on ? 0x112266 : 0x2244ff);
  }
}

/**
 * Arcade driving for the player's car: W/S throttle and brake/reverse, A/D steer
 * (steering weakens at speed), Space handbrake, drag, building and world bounds.
 * Returns true when the car scraped a building this frame.
 */
export function driveCar(car, axes, handbrake, dt, colliders, onCrash) {
  const maxForward = 34;
  const maxReverse = 12;
  const accel = 22;
  const brake = 34;
  if (axes.y > 0) car.speed += accel * axes.y * dt;
  else if (axes.y < 0) {
    if (car.speed > 0.5) car.speed -= brake * dt;
    else car.speed -= accel * 0.6 * dt;
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 9 * dt);
  }
  if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 30 * dt);
  car.speed = clamp(car.speed, -maxReverse, maxForward);
  const steerTarget = -axes.x * clamp(Math.abs(car.speed) / 8, 0, 1) * 1.9;
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  car.angle += car.steer * dt * Math.sign(car.speed || 1) * (car.speed >= 0 ? 1 : -1) * 0.9;
  const nx = car.x + Math.sin(car.angle) * car.speed * dt;
  const nz = car.z + Math.cos(car.angle) * car.speed * dt;
  const before = { x: car.x, z: car.z };
  car.x = clamp(nx, -CITY_HALF, CITY_HALF + 30);
  car.z = clamp(nz, -CITY_HALF, CITY_HALF + 40);
  const hit = resolveBuildingCollision(colliders, car, 2.3);
  if (hit) {
    const lost = Math.abs(car.speed);
    car.speed *= -0.25;
    if (lost > 9 && onCrash) onCrash(lost);
    car.x = before.x; car.z = before.z;
    resolveBuildingCollision(colliders, car, 2.3);
  }
  return hit;
}

/** Nearest drivable (non-police, non-traffic) car within `range` of (x,z). */
export function nearestStealableCar(cars, x, z, range) {
  let best = null, bestD = range;
  for (const car of cars) {
    if (car.police || car.traffic) continue;
    const d = Math.hypot(car.x - x, car.z - z);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

/** Put the player into a car: hide the on-foot figure, mark the car as driven. */
export function enterCar(state, car) {
  state.player.car = car;
  state.player.onFoot = false;
  car.parked = false;
  state.player.x = car.x;
  state.player.z = car.z;
  state.player.angle = car.angle;
  return car;
}

/** Step out of the car beside it; the car keeps rolling a little then stops. */
export function exitCar(state) {
  const car = state.player.car;
  if (!car) return null;
  state.player.car = null;
  state.player.onFoot = true;
  const side = 2.6;
  state.player.x = car.x + Math.cos(car.angle) * side;
  state.player.z = car.z - Math.sin(car.angle) * side;
  state.player.angle = car.angle;
  return car;
}
