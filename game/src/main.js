// Solmar Bay — Sunport Heist: boot, the one game loop, and every system wired
// together. The city, traffic, pedestrians, police, missions, combat, HUD and
// minimap all advance here; nothing else owns the frame.
import * as THREE from 'three';
import { createGameState, clamp, wrapAngle, dist2d, CITY_HALF } from './state.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { buildCity, resolveBuildingCollision } from './city.js';
import { createCar, syncCarMesh, driveCar, nearestStealableCar, enterCar, exitCar } from './vehicles.js';
import { spawnTraffic, updateTraffic, spawnParkedCars } from './traffic.js';
import { spawnPedestrians, updatePedestrians, knockPedestrian, buildPedestrianMesh } from './pedestrians.js';
import { addWanted, updatePolice, clearPolice } from './police.js';
import { startNextMission, updateMission, missionTarget, MISSIONS } from './missions.js';
import { spawnEnemy, fireBullet, punch, updateBullets, updateEnemies, spawnPickup, updatePickups } from './combat.js';
import { createHud } from './hud.js';
import { createMinimap } from './minimap.js';
import { saveGame, loadGame, hasSave, applySave, clearSave } from './save.js';
import { createEffects } from './effects.js';
import { parseShot, stageShotScene } from './shots.js';

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);

const state = createGameState();
const input = createInput(canvas);
const audio = createAudio();
const hud = createHud();
const minimap = createMinimap();
const effects = createEffects(scene);
const { colliders } = buildCity(scene);

// --- the player figure ------------------------------------------------------
const playerMesh = buildPedestrianMesh(0xff7a1a, 0xe8b88a);
playerMesh.scale.set(1.15, 1.15, 1.15);
scene.add(playerMesh);

// --- world population -------------------------------------------------------
state.traffic = spawnTraffic(scene, 10);
state.pedestrians = spawnPedestrians(scene, 22);
state.cars = spawnParkedCars(scene, [
  [10, 26, 0.4], [-10, 40, -0.3], [40, 10, 1.57], [-40, -10, -1.57],
  [70, -40, 0.2], [-70, 70, 1.2], [26, -70, 0], [104, 40, 1.57],
  [-26, 104, 0.6], [40, 104, -0.4], [-104, -40, 1.57], [64, 64, 0.9],
]);
const starterCar = createCar(scene, 4, 34, 0.2, { parked: true, name: 'Raka’s Comet', color: 0xff7a1a });
state.cars.push(starterCar);
// cash and ammo pickups scattered around the city
for (const [x, z, kind, amount] of [
  [20, -20, 'cash', 150], [-48, 48, 'cash', 120], [64, -64, 'ammo', 24],
  [-20, -64, 'cash', 100], [96, 96, 'ammo', 24], [-96, 20, 'cash', 180],
]) {
  state.pickups.push(spawnPickup(scene, x, z, kind, amount));
}

// bullet meshes, kept parallel to state.bullets
const bulletGroup = new THREE.Group();
scene.add(bulletGroup);
const bulletMeshes = [];
const bulletGeo = new THREE.SphereGeometry(0.16, 8, 8);
const bulletMat = new THREE.MeshBasicMaterial({ color: 0xffe27a });

function syncBulletMeshes() {
  while (bulletMeshes.length < state.bullets.length) {
    const m = new THREE.Mesh(bulletGeo, bulletMat);
    bulletGroup.add(m);
    bulletMeshes.push(m);
  }
  while (bulletMeshes.length > state.bullets.length) {
    const m = bulletMeshes.pop();
    bulletGroup.remove(m);
  }
  for (let i = 0; i < state.bullets.length; i++) {
    bulletMeshes[i].position.set(state.bullets[i].x, 1.3, state.bullets[i].z);
  }
}

// --- helpers the shot stager and the loop both use ---------------------------
function placePlayerOnFoot(x, z, angle) {
  state.player.x = x; state.player.z = z; state.player.angle = angle;
  state.player.onFoot = true; state.player.car = null;
  playerMesh.visible = true;
}
function placePlayerInCar(x, z, angle) {
  let car = nearestStealableCar(state.cars, x, z, 12);
  if (!car) car = state.cars[0];
  car.x = x; car.z = z; car.angle = angle; car.speed = 0;
  enterCar(state, car);
  playerMesh.visible = false;
}
function spawnPoliceNow(n) {
  state.wanted = Math.max(state.wanted, n);
  state.wantedHeat = 90;
}
function spawnEnemiesNow(n) {
  const spots = [[100, 132], [90, 146], [104, 138], [86, 128]];
  for (let i = 0; i < n; i++) {
    const s = spots[i % spots.length];
    state.enemies.push(spawnEnemy(scene, s[0], s[1], 'Rival ' + (i + 1)));
  }
}
function setPlayerSpeed(v) {
  if (state.player.car) state.player.car.speed = v;
}

const game = {
  state, startGame, placePlayerInCar, placePlayerOnFoot,
  spawnPoliceNow, spawnEnemiesNow, setPlayerSpeed,
};

// --- screens -----------------------------------------------------------------
function startGame(fromShot) {
  state.screen = 'play';
  hud.showGame();
  audio.unlock();
  audio.startMusic();
  if (!fromShot) {
    state.message = 'Welcome to Solmar Bay. Press M for your first mission.';
    state.messageUntil = state.elapsed + 5;
  }
}
function endDay(title, text) {
  state.screen = title === 'BUSTED' ? 'busted' : 'wasted';
  state.stats.arrests += title === 'BUSTED' ? 1 : 0;
  audio.stopEngine();
  audio.updateSiren(false);
  if (title === 'BUSTED') audio.playBusted();
  hud.showEnd(title, text);
  clearPolice(state, scene);
}
function damagePlayer(amount, reason) {
  if (state.screen !== 'play') return;
  state.health -= amount;
  state.player.hurtFlash = 0.4;
  if (reason) { state.message = reason; state.messageUntil = state.elapsed + 2.5; }
  if (state.health <= 0) {
    state.health = 0;
    endDay('WASTED', 'Raka went down in Solmar Bay. The crew will remember him — try again.');
  }
}

// --- buttons -----------------------------------------------------------------
document.getElementById('play-btn').addEventListener('click', () => {
  audio.unlock(); audio.playClick();
  state.money = 250; state.respect = 0; state.missionIndex = 0;
  state.missionDone = [false, false, false, false, false];
  state.health = 100; state.ammo = 24; state.wanted = 0; state.wantedHeat = 0;
  placePlayerOnFoot(0, 28, 0);
  startGame(false);
});
document.getElementById('continue-btn').addEventListener('click', () => {
  audio.unlock(); audio.playClick();
  const saved = loadGame();
  if (saved) {
    applySave(state, saved);
    placePlayerOnFoot(state.player.x, state.player.z, state.player.angle);
    state.message = 'Save loaded. Welcome back to Solmar Bay.';
    state.messageUntil = state.elapsed + 4;
  } else {
    placePlayerOnFoot(0, 28, 0);
    state.message = 'No save found — starting a fresh day.';
    state.messageUntil = state.elapsed + 4;
  }
  startGame(false);
});
document.getElementById('how-btn').addEventListener('click', () => {
  audio.unlock(); audio.playClick();
  const keys = document.querySelector('.keys');
  keys.style.outline = '3px solid #ffd23e';
  setTimeout(() => { keys.style.outline = ''; }, 900);
});
document.getElementById('resume-btn').addEventListener('click', () => {
  audio.playClick(); state.screen = 'play'; hud.showGame();
});
document.getElementById('save-btn').addEventListener('click', () => {
  audio.playClick();
  saveGame(state);
  state.message = 'Game saved.'; state.messageUntil = state.elapsed + 3;
});
document.getElementById('restart-btn').addEventListener('click', () => {
  audio.playClick(); clearSave(); window.location.reload();
});
document.getElementById('retry-btn').addEventListener('click', () => {
  audio.playClick();
  state.health = 100; state.wanted = 0; state.wantedHeat = 0;
  placePlayerOnFoot(0, 28, 0);
  state.screen = 'play'; hud.showGame();
});
document.getElementById('end-menu-btn').addEventListener('click', () => {
  audio.playClick(); state.screen = 'start'; hud.showStart();
});

// --- on-foot movement ---------------------------------------------------------
function updateOnFoot(dt, axes) {
  const p = state.player;
  const camAngle = state.cameraYaw;
  // movement is relative to the camera: W walks away from the camera
  const mx = Math.sin(camAngle) * -axes.y + Math.cos(camAngle) * axes.x;
  const mz = Math.cos(camAngle) * -axes.y - Math.sin(camAngle) * axes.x;
  const moving = Math.hypot(mx, mz) > 0.05;
  const speed = input.sprint() ? 10 : 6;
  if (moving) {
    const targetAngle = Math.atan2(mx, mz);
    p.angle += wrapAngle(targetAngle - p.angle) * Math.min(1, dt * 12);
    p.x += mx * speed * dt;
    p.z += mz * speed * dt;
    p.speed = speed;
    p.walkPhase = (p.walkPhase || 0) + dt * 10;
  } else {
    p.speed = 0;
  }
  p.x = clamp(p.x, -CITY_HALF, CITY_HALF + 30);
  p.z = clamp(p.z, -CITY_HALF, CITY_HALF + 40);
  resolveBuildingCollision(colliders, p, 0.9);
  // bumping a pedestrian knocks them over and draws a little heat
  for (const ped of state.pedestrians) {
    if (!ped.alive) continue;
    if (dist2d(p.x, p.z, ped.x, ped.z) < 1.1) {
      knockPedestrian(ped);
      addWanted(state, 1, 'You knocked a pedestrian down!');
      audio.playCrash();
    }
  }
  playerMesh.position.set(p.x, 0, p.z);
  playerMesh.rotation.y = p.angle;
  const swing = moving ? Math.sin(p.walkPhase || 0) * 0.5 : 0;
  playerMesh.userData.legL.rotation.x = swing;
  playerMesh.userData.legR.rotation.x = -swing;
}

// --- camera -------------------------------------------------------------------
function updateCamera(dt) {
  const p = state.player;
  const dist = p.onFoot ? 8.5 : 12;
  const height = p.onFoot ? 3.6 : 4.6;
  const cx = p.x - Math.sin(state.cameraYaw) * dist;
  const cz = p.z - Math.cos(state.cameraYaw) * dist;
  const targetY = 1.6;
  camera.position.x += (cx - camera.position.x) * Math.min(1, dt * 6);
  camera.position.y += (height - camera.position.y) * Math.min(1, dt * 6);
  camera.position.z += (cz - camera.position.z) * Math.min(1, dt * 6);
  camera.lookAt(p.x + Math.sin(state.cameraYaw) * 2, targetY, p.z + Math.cos(state.cameraYaw) * 2);
  // menu backdrop: slow orbit around the plaza
  if (state.screen === 'start') {
    const t = state.elapsed * 0.08;
    camera.position.set(Math.sin(t) * 55, 26, Math.cos(t) * 55);
    camera.lookAt(0, 4, 0);
  }
}

// --- the frame -----------------------------------------------------------------
let last = performance.now();
let shotReadyAt = null;
const shotName = parseShot();
if (shotName) {
  state.shotMode = shotName;
  // let the world settle one frame before staging, so meshes exist
  requestAnimationFrame(() => {
    stageShotScene(game, shotName);
    if (shotName === 'start') { hud.showStart(); shotReadyAt = 1.2; }
    else shotReadyAt = 2.8;
  });
}
window.__game = game;
window.__shotReady = false;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  state.elapsed += dt;

  // camera drag always works, even on menus
  const drag = input.takeDrag();
  if (drag.dx || drag.dy) {
    state.cameraYaw -= drag.dx * 0.005;
    state.cameraPitch = clamp(state.cameraPitch + drag.dy * 0.003, 0.15, 1.1);
  }

  if (state.screen === 'play') {
    const actions = input.takeActions();
    let axes = input.moveAxes();
    // chase screenshot staging: the car drives itself down the avenue so the
    // frame shows a moving chase, not a parked car
    if (state.shotMode === 'chase' && state.player.car) {
      const car = state.player.car;
      axes = { x: clamp(car.x * 0.08, -0.6, 0.6), y: 1 };
      // rear chase camera: straight behind the car, avenue and sea ahead
      state.cameraYaw += wrapAngle(car.angle - state.cameraYaw) * Math.min(1, dt * 3);
    }
    state.time += dt * 60; // one game minute per real second
    if (state.time >= 86400) { state.time -= 86400; state.day += 1; }
    if (state.player.hurtFlash > 0) state.player.hurtFlash -= dt;
    if (state.player.punchCooldown > 0) state.player.punchCooldown -= dt;
    if (state.player.shootCooldown > 0) state.player.shootCooldown -= dt;

    if (actions.pause) { state.screen = 'pause'; hud.showPause(true); }
    if (actions.mission && !state.missionActive) {
      const def = startNextMission(state, audio);
      if (def && def.id === 3) spawnEnemiesNow(2);
      if (def && def.id === 5) spawnEnemiesNow(3);
      if (!def) { state.message = 'Story complete! Free roam Solmar Bay.'; state.messageUntil = state.elapsed + 3; }
    }
    if (actions.respawn && state.player.car) {
      state.player.car.x = 0; state.player.car.z = 32; state.player.car.speed = 0;
    }

    // enter / exit cars
    if (actions.enterCar) {
      if (state.player.onFoot) {
        const car = nearestStealableCar(state.cars, state.player.x, state.player.z, 4.5);
        if (car) {
          enterCar(state, car);
          playerMesh.visible = false;
          state.stats.carsStolen += 1;
          addWanted(state, 2, 'Car stolen! The Bay Police are after you!');
          audio.playHorn();
        } else {
          state.message = 'No car close enough — walk up to a parked car.';
          state.messageUntil = state.elapsed + 2;
        }
      } else {
        exitCar(state);
        playerMesh.visible = true;
      }
    }

    // driving or walking
    if (state.player.onFoot) {
      updateOnFoot(dt, axes);
      if (actions.punch && state.player.punchCooldown <= 0) {
        state.player.punchCooldown = 0.5;
        audio.playPunch();
        punch(state, {
          onKnockPed: (ped) => { knockPedestrian(ped); addWanted(state, 1, 'You attacked a pedestrian!'); },
          onEnemyDown: () => { state.money += 50; audio.playCash(); },
        });
      }
      if (actions.shoot && state.player.shootCooldown <= 0) {
        state.player.shootCooldown = 0.3;
        const b = fireBullet(state, state.player.x, state.player.z, state.player.angle, true);
        if (b) { audio.playGunshot(); effects.muzzle(state.player.x, state.player.z, state.player.angle); addWanted(state, 1, 'Shots fired!'); }
        else { state.message = 'Out of ammo — find a purple pickup.'; state.messageUntil = state.elapsed + 2; }
      }
    } else if (state.player.car) {
      const car = state.player.car;
      const crashed = driveCar(car, axes, input.isDown('Space'), dt, colliders, (lost) => {
        audio.playCrash(); effects.burstSparks(car.x, car.z);
        damagePlayer(Math.min(12, lost * 0.5), 'You crashed!');
      });
      if (Math.abs(car.speed) > 18 && Math.abs(axes.x) > 0.5 && Math.random() < dt * 6) {
        effects.addSkid(car.x - Math.sin(car.angle) * 1.5, car.z - Math.cos(car.angle) * 1.5, car.angle);
      }
      state.player.x = car.x; state.player.z = car.z; state.player.angle = car.angle;
      syncCarMesh(car, dt, state.elapsed);
      audio.updateEngine(Math.abs(car.speed) / 34, true);
      // traffic collision: bump traffic cars aside, slow down
      for (const t of state.traffic) {
        if (dist2d(car.x, car.z, t.x, t.z) < 3.6) {
          t.speed *= 0.4;
          car.speed *= 0.85;
          if (Math.abs(car.speed) > 8) { audio.playCrash(); effects.burstSparks(car.x, car.z); }
        }
      }
    }
    if (state.player.onFoot) audio.updateEngine(0, false);

    // living city
    updateTraffic(state.traffic, state.player.car, dt, state.elapsed);
    // a traffic car that runs the player down on foot hurts — with a short
    // invulnerability window so one bump is not an instant death
    if (state.player.onFoot && state.player.hurtFlash <= 0) {
      for (const t of state.traffic) {
        if (t.speed > 2 && dist2d(t.x, t.z, state.player.x, state.player.z) < 2.2) {
          t.speed = 0;
          damagePlayer(10, 'A traffic car hit you!');
          break;
        }
      }
    }
    updatePedestrians(state.pedestrians, dt, state.player.x, state.player.z, 0);
    updatePolice(state, scene, dt, state.elapsed,
      () => endDay('BUSTED', 'The Bay Police boxed you in. Bail is $500 — your money is gone, but the story goes on.'),
      (dmg, reason) => damagePlayer(dmg, reason));
    // chase screenshot staging: hold the police cars in a visible formation
    // ahead of the player. In real play they chase from behind, so the chase
    // camera never sees them; here the pack stays glued to the player's speed
    // and angle, staggered across the avenue's lanes.
    if (state.shotMode === 'chase' && state.player.car) {
      const lead = state.player.car;
      const spots = [[-3.5, 8], [3.5, 13], [-3.5, 18]];
      const fx = Math.sin(lead.angle), fz = Math.cos(lead.angle);
      const rx = Math.cos(lead.angle), rz = -Math.sin(lead.angle);
      state.police.forEach((unit, i) => {
        const s = spots[i % spots.length];
        unit.car.x = lead.x + rx * s[0] + fx * s[1];
        unit.car.z = lead.z + rz * s[0] + fz * s[1];
        unit.car.angle = lead.angle;
        unit.car.speed = lead.speed;
        syncCarMesh(unit.car, dt, state.elapsed);
      });
    }
    audio.updateSiren(state.police.length > 0);
    updateEnemies(state, dt, {
      onEnemyShot: () => audio.playGunshot(),
      onPlayerShot: (dmg) => damagePlayer(dmg, 'A rival shot you!'),
      onEnemyDown: () => { state.money += 50; audio.playCash(); effects.burstCash(state.player.x, state.player.z); },
    });
    updateBullets(state, dt, {
      onPlayerShot: (dmg) => damagePlayer(dmg, 'A rival shot you!'),
    });
    syncBulletMeshes();

    // pickups
    const got = updatePickups(state, dt);
    if (got) {
      if (got.kind === 'cash') { state.money += got.amount; audio.playCash(); effects.burstCash(got.x, got.z); state.message = 'Picked up $' + got.amount; state.messageUntil = state.elapsed + 2; }
      else { state.ammo += got.amount; audio.playPickup(); state.message = 'Picked up ' + got.amount + ' ammo'; state.messageUntil = state.elapsed + 2; }
      scene.remove(got.mesh);
    }

    // missions
    const prevStep = state.missionActive ? state.missionActive.step : -1;
    const prevId = state.missionActive ? state.missionActive.id : -1;
    const result = updateMission(state, dt, {
      onStep: () => audio.playPickup(),
      onComplete: (def) => {
        audio.playMissionDone();
        saveGame(state);
        if (def.id === 4) clearPolice(state, scene);
      },
    });
    if (result === 'step' && state.missionActive) {
      if (prevId === 3 && state.missionActive.step === 1) spawnEnemiesNow(2);
      if (prevId === 5 && state.missionActive.step === 2) addWanted(state, 3, 'Alarm tripped! The whole Bay Police force is coming!');
    }
    if (prevStep >= 0 && state.missionActive && state.missionActive.step !== prevStep) {
      // step text already updated by the mission module
    }

    // slow health regen out of combat
    if (state.wanted === 0 && state.health < state.maxHealth) state.health = Math.min(state.maxHealth, state.health + dt * 1.5);

    effects.setBeacon(missionTarget(state), state.elapsed);
    effects.update(dt);
    hud.update(state);
    minimap.draw(state);
  } else if (state.screen === 'pause') {
    const actions = input.takeActions();
    if (actions.pause || actions.confirm) { state.screen = 'play'; hud.showGame(); }
  } else {
    // start / busted / wasted: the city still lives behind the overlay
    updateTraffic(state.traffic, null, dt, state.elapsed);
    updatePedestrians(state.pedestrians, dt, 0, 0, 0);
    effects.update(dt);
  }

  // parked cars always sync their meshes (they never move on their own)
  for (const car of state.cars) {
    if (car !== state.player.car) syncCarMesh(car, dt, state.elapsed);
  }
  updateCamera(dt);
  renderer.render(scene, camera);

  // screenshot readiness: shot scenes run live, then flag ready
  if (shotReadyAt !== null && state.elapsed >= shotReadyAt) {
    window.__shotReady = true;
    shotReadyAt = null;
  }
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

hud.showStart();
if (!shotName) {
  // idle attract mode: keep the city moving behind the start screen
  state.screen = 'start';
}
requestAnimationFrame(frame);
