// Effects: skid marks, impact sparks, cash sparkles and muzzle flashes —
// small pooled meshes that appear, fade and vanish, plus the mission beacon.
import * as THREE from 'three';

export function createEffects(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const particles = [];
  const skidGeo = new THREE.PlaneGeometry(0.5, 1.6);
  const skidMat = new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.55 });

  // mission beacon: a tall glowing cylinder + a ring on the ground at the target
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 60, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
  beacon.visible = false;
  scene.add(beacon);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(3.4, 4.4, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  scene.add(ring);

  function spawnBurst(x, y, z, color, count, speed) {
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.22, 0.22),
        new THREE.MeshBasicMaterial({ color }));
      m.position.set(x, y, z);
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * 3 + 1;
      particles.push({
        mesh: m, life: 0.6 + Math.random() * 0.4, age: 0,
        vx: Math.cos(a) * speed, vy: up, vz: Math.sin(a) * speed,
      });
      group.add(m);
    }
  }

  return {
    burstSparks(x, z) { spawnBurst(x, 0.8, z, 0xffcc33, 10, 4); },
    burstCash(x, z) { spawnBurst(x, 1.4, z, 0x7dff9b, 14, 2.5); },
    burstBlood(x, z) { spawnBurst(x, 1.0, z, 0xdd2222, 8, 3); },
    muzzle(x, z, angle) {
      spawnBurst(x + Math.sin(angle) * 1.2, 1.3, z + Math.cos(angle) * 1.2, 0xffe27a, 4, 2);
    },
    addSkid(x, z, angle) {
      const s = new THREE.Mesh(skidGeo, skidMat);
      s.rotation.x = -Math.PI / 2;
      s.rotation.z = -angle;
      s.position.set(x, 0.06, z);
      group.add(s);
      particles.push({ mesh: s, life: 6, age: 0, vx: 0, vy: 0, vz: 0, skid: true });
      if (particles.length > 220) {
        const old = particles.shift();
        group.remove(old.mesh);
      }
    },
    setBeacon(target, time) {
      if (!target) { beacon.visible = false; ring.visible = false; return; }
      beacon.visible = true; ring.visible = true;
      beacon.position.set(target.x, 30, target.z);
      beacon.material.opacity = 0.2 + Math.sin(time * 3) * 0.08;
      ring.position.set(target.x, 0.08, target.z);
      const s = 1 + Math.sin(time * 3) * 0.12;
      ring.scale.set(s, s, 1);
    },
    update(dt) {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.age += dt;
        if (p.age >= p.life) {
          group.remove(p.mesh);
          particles.splice(i, 1);
          continue;
        }
        if (!p.skid) {
          p.vy -= 9 * dt;
          p.mesh.position.x += p.vx * dt;
          p.mesh.position.y += p.vy * dt;
          p.mesh.position.z += p.vz * dt;
          p.mesh.material.opacity = 1 - p.age / p.life;
          p.mesh.rotation.x += dt * 5;
          p.mesh.rotation.y += dt * 5;
        }
      }
    },
  };
}
