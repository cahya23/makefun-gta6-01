// Traffic: cars that loop the road grid forever, slowing for the car ahead and
// for the player, so the streets always feel alive without any scripting.
import { createCar, syncCarMesh } from './vehicles.js';
import { ROAD_LINES, ROAD_HALF } from './city.js';
import { clamp, wrapAngle } from './state.js';

/** Build one rectangular loop on the road grid, as a list of waypoints. */
export function makeLoop(cx, cz, hw, hh) {
  return [
    { x: cx - hw, z: cz - hh }, { x: cx + hw, z: cz - hh },
    { x: cx + hw, z: cz + hh }, { x: cx - hw, z: cz + hh },
  ];
}

const LOOPS = [
  makeLoop(0, 0, 64, 64), makeLoop(0, 0, 96, 96), makeLoop(-48, -48, 32, 32),
  makeLoop(48, 48, 32, 32), makeLoop(0, -64, 64, 32), makeLoop(0, 64, 64, 32),
  makeLoop(-64, 0, 32, 64), makeLoop(64, 0, 32, 64),
];

export function spawnTraffic(scene, count) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const loop = LOOPS[i % LOOPS.length];
    const wp = loop[i % loop.length];
    const car = createCar(scene, wp.x, wp.z, 0, { traffic: true });
    car.route = loop;
    car.routeIndex = (i + 1) % loop.length;
    car.cruise = 9 + (i % 5) * 1.4;
    cars.push(car);
  }
  return cars;
}

/** Advance every traffic car toward its next waypoint; slow when blocked ahead. */
export function updateTraffic(cars, playerCar, dt, time) {
  for (const car of cars) {
    const target = car.route[car.routeIndex];
    const dx = target.x - car.x;
    const dz = target.z - car.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 4) {
      car.routeIndex = (car.routeIndex + 1) % car.route.length;
      continue;
    }
    const wantAngle = Math.atan2(dx, dz);
    const diff = wrapAngle(wantAngle - car.angle);
    car.angle += clamp(diff, -1.6 * dt, 1.6 * dt);
    // slow down for anything close ahead: the player, another traffic car
    let blocked = false;
    const aheadX = car.x + Math.sin(car.angle) * 7;
    const aheadZ = car.z + Math.cos(car.angle) * 7;
    if (playerCar && Math.hypot(playerCar.x - aheadX, playerCar.z - aheadZ) < 4) blocked = true;
    if (!blocked) {
      for (const other of cars) {
        if (other === car) continue;
        if (Math.hypot(other.x - aheadX, other.z - aheadZ) < 4.5) { blocked = true; break; }
      }
    }
    const targetSpeed = blocked ? 0 : car.cruise;
    car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 2.2);
    car.x += Math.sin(car.angle) * car.speed * dt;
    car.z += Math.cos(car.angle) * car.speed * dt;
    syncCarMesh(car, dt, time);
  }
}

/** A parked car the player can steal, placed beside a road. */
export function spawnParkedCars(scene, spots) {
  const cars = [];
  for (const [x, z, angle] of spots) {
    const car = createCar(scene, x, z, angle, { parked: true });
    cars.push(car);
  }
  return cars;
}

export { ROAD_LINES, ROAD_HALF };
