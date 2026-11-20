// Combat: fists on foot, a pistol with ammo, rival crew enemies who shoot back,
// and the tracer bullets that fly between them. All hits are distance checks.
import * as THREE from 'three';
import { buildPedestrianMesh } from './pedestrians.js';
import { dist2d } from './state.js';

const BULLET_SPEED = 55;
const BULLET_RANGE = 70;

/** Spawn a rival crew member at (x,z) who hunts the player. */
export function spawnEnemy(scene, x, z, name) {
  const mesh = buildPedestrianMesh(0x8e2f2f, 0xe8b88a);
  // a dark vest over the shirt so rivals read as a gang at a glance
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.5, 0.42),
    new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
  vest.position.y = 1.15; mesh.add(vest);
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  return {
    mesh, x, z, name: name || 'Rival',
    health: 60, angle: 0, shootCooldown: 1 + Math.random(),
    speed: 3.4, alive: true, walkPhase: 0,
  };
}

/** Fire a bullet from (x,z) along `angle`; returns the bullet or null (no ammo). */
export function fireBullet(state, x, z, angle, fromPlayer) {
  if (fromPlayer) {
    if (state.ammo <= 0) return null;
    state.ammo -= 1;
  }
  const bullet = {
    x, z, y: 1.3, angle,
    vx: Math.sin(angle) * BULLET_SPEED,
    vz: Math.cos(angle) * BULLET_SPEED,
    travelled: 0, fromPlayer,
  };
  state.bullets.push(bullet);
  return bullet;
}

/** Punch: damage the nearest pedestrian / enemy / police car within 2.2 m. */
export function punch(state, hooks) {
  const p = state.player;
  const range = 2.4;
  for (const e of state.enemies) {
    if (!e.alive) continue;
    if (dist2d(p.x, p.z, e.x, e.z) < range) {
      damageEnemy(state, e, 25, hooks);
      return 'enemy';
    }
  }
  for (const ped of state.pedestrians) {
    if (!ped.alive) continue;
    if (dist2d(p.x, p.z, ped.x, ped.z) < range) {
      if (hooks && hooks.onKnockPed) hooks.onKnockPed(ped);
      return 'ped';
    }
  }
  return null;
}

export function damageEnemy(state, enemy, dmg, hooks) {
  enemy.health -= dmg;
  if (enemy.health <= 0 && enemy.alive) {
    enemy.alive = false;
    enemy.mesh.rotation.x = Math.PI / 2;
    enemy.mesh.position.y = 0.3;
    state.stats.knockouts += 1;
    if (hooks && hooks.onEnemyDown) hooks.onEnemyDown(enemy);
  }
}

/** Move bullets, test hits against enemies (player bullets) and the player. */
export function updateBullets(state, dt, hooks) {
  const p = state.player;
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    b.x += b.vx * dt;
    b.z += b.vz * dt;
    b.travelled += BULLET_SPEED * dt;
    let dead = b.travelled > BULLET_RANGE;
    if (!dead && b.fromPlayer) {
      for (const e of state.enemies) {
        if (!e.alive) continue;
        if (dist2d(b.x, b.z, e.x, e.z) < 1.1) {
          damageEnemy(state, e, 20, hooks);
          dead = true;
          break;
        }
      }
    }
    if (!dead && !b.fromPlayer && p.onFoot) {
      if (dist2d(b.x, b.z, p.x, p.z) < 1.0) {
        if (hooks && hooks.onPlayerShot) hooks.onPlayerShot(8);
        dead = true;
      }
    }
    if (dead) state.bullets.splice(i, 1);
  }
}

/** Enemies chase the player and shoot when close enough; they never enter cars. */
export function updateEnemies(state, dt, hooks) {
  const p = state.player;
  for (const e of state.enemies) {
    if (!e.alive) continue;
    const d = dist2d(e.x, e.z, p.x, p.z);
    const want = Math.atan2(p.x - e.x, p.z - e.z);
    e.angle += (want - e.angle) * Math.min(1, dt * 5);
    if (d > 3.5) {
      e.x += Math.sin(e.angle) * e.speed * dt;
      e.z += Math.cos(e.angle) * e.speed * dt;
      e.walkPhase += dt * 8;
    }
    e.shootCooldown -= dt;
    if (d < 26 && e.shootCooldown <= 0) {
      e.shootCooldown = 1.4 + Math.random() * 0.8;
      fireBullet(state, e.x, e.z, want + (Math.random() - 0.5) * 0.16, false);
      if (hooks && hooks.onEnemyShot) hooks.onEnemyShot(e);
    }
    e.mesh.position.set(e.x, 0, e.z);
    e.mesh.rotation.y = e.angle;
    const swing = Math.sin(e.walkPhase) * 0.5;
    e.mesh.userData.legL.rotation.x = swing;
    e.mesh.userData.legR.rotation.x = -swing;
  }
}

/** A small glowing pickup: cash or ammo, floating and spinning. */
export function spawnPickup(scene, x, z, kind, amount) {
  const color = kind === 'ammo' ? 0x9b59d0 : 0x2ecc71;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9),
    new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.5 }));
  mesh.position.set(x, 1.1, z);
  scene.add(mesh);
  const pick = { mesh, x, z, kind, amount, spin: 0 };
  return pick;
}

/** Collect pickups the player walks or drives over. Returns the collected one. */
export function updatePickups(state, dt) {
  const p = state.player;
  for (let i = state.pickups.length - 1; i >= 0; i--) {
    const pk = state.pickups[i];
    pk.spin += dt * 3;
    pk.mesh.rotation.y = pk.spin;
    pk.mesh.position.y = 1.1 + Math.sin(pk.spin * 1.4) * 0.18;
    if (dist2d(p.x, p.z, pk.x, pk.z) < 2.4) {
      state.pickups.splice(i, 1);
      return pk;
    }
  }
  return null;
}
