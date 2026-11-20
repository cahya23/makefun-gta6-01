// Keyboard + mouse input: one place that owns every key, the drag camera and
// the edge-triggered "just pressed" actions the game loop consumes each frame.
export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set(); // keys pressed since last takeActions()
  let mouseDown = false;
  let mouseClicked = false;
  let dragDx = 0;
  let dragDy = 0;
  let lastX = 0;
  let lastY = 0;

  function keyName(e) {
    return e.code || e.key || '';
  }

  window.addEventListener('keydown', (e) => {
    const k = keyName(e);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
    if (!keys.has(k)) pressed.add(k);
    keys.add(k);
  });
  window.addEventListener('keyup', (e) => keys.delete(keyName(e)));
  window.addEventListener('blur', () => { keys.clear(); mouseDown = false; });

  canvas.addEventListener('mousedown', (e) => {
    mouseDown = true; mouseClicked = true;
    lastX = e.clientX; lastY = e.clientY;
  });
  window.addEventListener('mouseup', () => { mouseDown = false; });
  window.addEventListener('mousemove', (e) => {
    if (!mouseDown) return;
    dragDx += e.clientX - lastX;
    dragDy += e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    /** True while the key is held. Accepts one code or an array of codes. */
    isDown(code) {
      if (Array.isArray(code)) return code.some((c) => keys.has(c));
      return keys.has(code);
    },
    /** WASD / arrows as a -1..1 pair, already normalised. */
    moveAxes() {
      let x = 0, y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
      const len = Math.hypot(x, y);
      if (len > 1) { x /= len; y /= len; }
      return { x, y };
    },
    /** True while Shift (sprint / boost) is held. */
    sprint() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    /** Consume edge-triggered actions pressed since the last call. */
    takeActions() {
      const out = {
        enterCar: pressed.has('KeyE'),
        punch: pressed.has('KeyF'),
        mission: pressed.has('KeyM'),
        pause: pressed.has('KeyP') || pressed.has('Escape'),
        respawn: pressed.has('KeyR'),
        confirm: pressed.has('Enter') || pressed.has('Space'),
        shoot: mouseClicked,
      };
      pressed.clear();
      mouseClicked = false;
      return out;
    },
    /** Consume accumulated mouse-drag deltas (pixels) since the last call. */
    takeDrag() {
      const d = { dx: dragDx, dy: dragDy };
      dragDx = 0; dragDy = 0;
      return d;
    },
    mouseHeld() { return mouseDown; },
    /** Forget every held key (used when the game pauses or the tab hides). */
    reset() { keys.clear(); pressed.clear(); mouseDown = false; },
  };
}
