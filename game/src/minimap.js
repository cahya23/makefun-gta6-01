// Minimap: a live top-down canvas in the HUD corner — roads, beach, sea,
// the player arrow, traffic, police, pedestrians and the mission target.
import { CITY_HALF } from './state.js';
import { ROAD_LINES } from './city.js';

export function createMinimap() {
  const canvas = document.getElementById('minimap');
  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  const scale = size / (CITY_HALF * 2 + 60);

  function toMap(x, z) {
    return {
      x: size / 2 + x * scale,
      y: size / 2 + z * scale,
    };
  }

  function draw(state) {
    ctx.clearRect(0, 0, size, size);
    // sea (south) and land
    ctx.fillStyle = '#1e90c8';
    ctx.fillRect(0, size / 2 + CITY_HALF * scale, size, size);
    ctx.fillStyle = '#f2dd9e';
    ctx.fillRect(0, size / 2 + (CITY_HALF - 14) * scale, size, 14 * scale);
    ctx.fillStyle = '#2c5a2e';
    ctx.fillRect(0, 0, size, size / 2 + (CITY_HALF - 14) * scale);
    // roads
    ctx.strokeStyle = '#3a3f46';
    ctx.lineWidth = 10 * scale;
    for (const c of ROAD_LINES) {
      const a = toMap(c, -CITY_HALF), b = toMap(c, CITY_HALF);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      const c2 = toMap(-CITY_HALF, c), d2 = toMap(CITY_HALF, c);
      ctx.beginPath(); ctx.moveTo(c2.x, c2.y); ctx.lineTo(d2.x, d2.y); ctx.stroke();
    }
    // mission target blip (pulsing gold diamond)
    if (state.missionActive && state.missionActive.target) {
      const t = toMap(state.missionActive.target.x, state.missionActive.target.z);
      const pulse = 6 + Math.sin(state.elapsed * 5) * 2;
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath();
      ctx.moveTo(t.x, t.y - pulse); ctx.lineTo(t.x + pulse, t.y);
      ctx.lineTo(t.x, t.y + pulse); ctx.lineTo(t.x - pulse, t.y);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    // pickups
    for (const pk of state.pickups) {
      const q = toMap(pk.x, pk.z);
      ctx.fillStyle = pk.kind === 'ammo' ? '#c77dff' : '#2ecc71';
      ctx.fillRect(q.x - 3, q.y - 3, 6, 6);
    }
    // traffic (grey) and police (flashing blue/red)
    for (const car of state.traffic) {
      const q = toMap(car.x, car.z);
      ctx.fillStyle = '#d8d8d8';
      ctx.fillRect(q.x - 2, q.y - 2, 4, 4);
    }
    const flashBlue = Math.floor(state.elapsed * 4) % 2 === 0;
    for (const u of state.police) {
      const q = toMap(u.car.x, u.car.z);
      ctx.fillStyle = flashBlue ? '#2244ff' : '#ff2222';
      ctx.beginPath(); ctx.arc(q.x, q.y, 4, 0, Math.PI * 2); ctx.fill();
    }
    // enemies (red)
    for (const e of state.enemies) {
      if (!e.alive) continue;
      const q = toMap(e.x, e.z);
      ctx.fillStyle = '#ff4444';
      ctx.beginPath(); ctx.arc(q.x, q.y, 3, 0, Math.PI * 2); ctx.fill();
    }
    // player arrow (white, pointing along the facing angle)
    const p = toMap(state.player.x, state.player.z);
    const a = state.player.angle;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(p.x + Math.sin(a) * 8, p.y + Math.cos(a) * 8);
    ctx.lineTo(p.x + Math.sin(a + 2.6) * 6, p.y + Math.cos(a + 2.6) * 6);
    ctx.lineTo(p.x + Math.sin(a - 2.6) * 6, p.y + Math.cos(a - 2.6) * 6);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // circular border ring
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2); ctx.stroke();
  }

  return { draw };
}
