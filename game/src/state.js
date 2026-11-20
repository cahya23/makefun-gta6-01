// Shared game state for Solmar Bay: one plain object every system reads and writes.
// Keeping it in one place means the HUD, minimap, police and missions always agree.
export function createGameState() {
  return {
    screen: 'start', // start | play | pause | busted | wasted
    time: 9 * 3600, // seconds since midnight, game clock
    day: 1,
    money: 250,
    respect: 0,
    health: 100,
    maxHealth: 100,
    ammo: 24,
    wanted: 0, // 0..5 stars
    wantedHeat: 0, // 0..100, decays when hidden
    missionIndex: 0, // next mission to play (0..4), 5 = story done
    missionActive: null, // { id, step, title, text, target:{x,z}, reward }
    missionDone: [false, false, false, false, false],
    player: {
      x: 0, z: 28, y: 0, angle: 0, speed: 0,
      onFoot: true, car: null, // car object when driving
      punchCooldown: 0, shootCooldown: 0, hurtFlash: 0,
    },
    cars: [], // all drivable cars (parked + traffic + police are separate lists)
    traffic: [],
    pedestrians: [],
    police: [],
    enemies: [],
    pickups: [],
    bullets: [],
    particles: [],
    cameraYaw: 0.6,
    cameraPitch: 0.42,
    cameraDistance: 9,
    message: '',
    messageUntil: 0,
    stats: { carsStolen: 0, missionsDone: 0, arrests: 0, knockouts: 0 },
    shotMode: null,
    elapsed: 0,
  };
}

/** Clamp a number into [lo, hi]. */
export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

/** Wrap an angle into [-PI, PI]. */
export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/** Smallest signed turn from angle a to angle b. */
export function angleDiff(a, b) { return wrapAngle(b - a); }

/** Distance on the ground plane between two points. */
export function dist2d(ax, az, bx, bz) {
  const dx = ax - bx, dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

/** Deterministic seeded random generator (mulberry32) for the city layout. */
export function createSeededRandom(seed) {
  let s = seed >>> 0;
  return function next() {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Format dollars like $1,250. */
export function formatMoney(n) {
  return '$' + Math.floor(n).toLocaleString('en-US');
}

/** Format the game clock like 14:05. */
export function formatClock(seconds) {
  const h = Math.floor(seconds / 3600) % 24;
  const m = Math.floor(seconds / 60) % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

/** City bounds: the drivable/walkable square, half-size in metres. */
export const CITY_HALF = 132;
/** South edge is the beach; the sea starts beyond this z. */
export const BEACH_Z = 132;
