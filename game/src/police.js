// The Bay Police: wanted stars, patrol cars that spawn at the wanted level,
// chase and ram the player, foot officers who chase on foot, and the heat that
// cools off when the player hides. Getting caught ends the day.
import { createCar, syncCarMesh } from './vehicles.js';
import { clamp, wrapAngle, dist2d } from './state.js';

export const MAX_WANTED = 5;

/** Raise the wanted level by `stars` (capped at 5) and add heat. */
export function addWanted(state, stars, reason) {
  const before = state.wanted;
  state.wanted = clamp(state.wanted + stars, 0, MAX_WANTED);
  state.wantedHeat = clamp(state.wantedHeat + stars * 22, 0, 100);
  if (state.wanted > before) {
    state.message = reason || 'The Bay Police are after you!';
    state.messageUntil = state.elapsed + 3;
  }
}

/** How many police cars the current wanted level should have on the road. */
export function wantedCarCount(wanted) {
  return [0, 1, 2, 3, 4, 5][wanted] || 0;
}

/** Spawn (or despawn) police cars until the count matches the wanted level. */
export function syncPoliceCars(state, scene, dt) {
  const want = wantedCarCount(state.wanted);
  while (state.police.length < want) {
    const p = state.player;
    const a = Math.random() * Math.PI * 2;
    const x = p.x + Math.cos(a) * 42;
    const z = p.z + Math.sin(a) * 42;
    const car = createCar(scene, x, z, 0, { police: true, color: 0x111418, name: 'Bay Police' });
    state.police.push({ car, ramCooldown: 0, stuck: 0 });
  }
  while (state.police.length > want) {
    const gone = state.police.pop();
    scene.remove(gone.car.mesh);
  }
}

/** Chase the player: steer toward them, ram on contact, give up when far away. */
export function updatePolice(state, scene, dt, time, onBusted, onDamage) {
  syncPoliceCars(state, scene, dt);
  const p = state.player;
  const px = p.x, pz = p.z;
  const playerSpeed = p.onFoot ? 0 : Math.abs(p.car ? p.car.speed : 0);
  for (const unit of state.police) {
    const car = unit.car;
    const dx = px - car.x, dz = pz - car.z;
    const dist = Math.hypot(dx, dz);
    const wantAngle = Math.atan2(dx, dz);
    const diff = wrapAngle(wantAngle - car.angle);
    const topSpeed = 26 + state.wanted * 1.6;
    car.angle += clamp(diff, -2.4 * dt, 2.4 * dt);
    // slow down to turn sharply, speed up on a straight chase
    const cornering = Math.abs(diff) > 0.6 ? 0.45 : 1;
    car.speed += ((topSpeed * cornering) - car.speed) * Math.min(1, dt * 1.4);
    car.x += Math.sin(car.angle) * car.speed * dt;
    car.z += Math.cos(car.angle) * car.speed * dt;
    unit.ramCooldown = Math.max(0, unit.ramCooldown - dt);
    if (dist < 3.4 && unit.ramCooldown <= 0) {
      unit.ramCooldown = 1.1;
      if (p.onFoot) {
        onDamage(14, 'A police cruiser clipped you!');
      } else if (p.car) {
        // a ram shoves the player's car and slows it hard
        p.car.speed *= 0.55;
        p.car.x += Math.sin(car.angle) * 1.6;
        p.car.z += Math.cos(car.angle) * 1.6;
        onDamage(6, 'Police rammed your car!');
      }
    }
    // busted: a police car sits on top of a slow player for a moment
    if (dist < 3.0 && playerSpeed < 2 && state.wanted >= 1) {
      unit.stuck += dt;
      if (unit.stuck > 1.6) { onBusted(); return; }
    } else {
      unit.stuck = Math.max(0, unit.stuck - dt * 2);
    }
    syncCarMesh(car, dt, time);
  }

  // heat cools when the player is out of sight of every police car
  if (state.police.length === 0) {
    state.wantedHeat = Math.max(0, state.wantedHeat - dt * 2.5);
  } else {
    let nearest = 999;
    for (const u of state.police) nearest = Math.min(nearest, dist2d(u.car.x, u.car.z, px, pz));
    if (nearest > 55) state.wantedHeat = Math.max(0, state.wantedHeat - dt * 6);
  }
  if (state.wanted > 0 && state.wantedHeat <= 0) {
    state.wanted = 0;
    state.message = 'You lost the police. Heat is off.';
    state.messageUntil = state.elapsed + 3;
  }
}

/** Remove every police car (used when a mission ends or the player is busted). */
export function clearPolice(state, scene) {
  for (const u of state.police) scene.remove(u.car.mesh);
  state.police = [];
  state.wanted = 0;
  state.wantedHeat = 0;
}
