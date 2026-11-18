// SOLMAR HEAT — keyboard + mouse input. The live adapter reads the DOM; the
// step functions only ever talk to the small adapter interface below, which is
// also what headless tests drive (forward / strafe / run / firing / actions).
export const ACTION_ENTER = 1;
export const ACTION_CONFIRM = 2;
export const ACTION_PAUSE = 4;
export const ACTION_RESTART = 8;

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
  KeyF: 'fire',
  KeyE: 'enter',
  Space: 'confirm',
  KeyP: 'pause',
  Escape: 'pause',
  KeyR: 'restart',
  KeyM: 'mute',
  KeyC: 'continue',
};

export function createInput() {
  const keys = new Set();
  const input = {
    keys,
    mouse: { x: 0, y: 0, down: false },
    orbit: 0,
    _actions: 0,
    _pressed: new Set(),

    press(code) {
      const name = KEYMAP[code];
      if (!name) return;
      keys.add(name);
      if (!this._pressed.has(name)) {
        this._pressed.add(name);
        if (name === 'enter') this._actions |= ACTION_ENTER;
        if (name === 'confirm') this._actions |= ACTION_CONFIRM;
        if (name === 'pause') this._actions |= ACTION_PAUSE;
        if (name === 'restart') this._actions |= ACTION_RESTART;
      }
    },
    release(code) {
      const name = KEYMAP[code];
      if (!name) return;
      keys.delete(name);
      this._pressed.delete(name);
    },
    forward() {
      let f = 0;
      if (keys.has('up')) f += 1;
      if (keys.has('down')) f -= 1;
      return f;
    },
    strafe() {
      let s = 0;
      if (keys.has('right')) s += 1;
      if (keys.has('left')) s -= 1;
      return s;
    },
    run() {
      return keys.has('run');
    },
    firing() {
      return keys.has('fire') || this.mouse.down;
    },
    takeActions() {
      const a = this._actions;
      this._actions = 0;
      return a;
    },
    takeOrbit() {
      const o = this.orbit;
      this.orbit = 0;
      return o;
    },
    // Where the player is aiming on screen, for drive-by shots and the crosshair.
    aim() {
      return { x: this.mouse.x, y: this.mouse.y };
    },
    isDown(name) {
      return keys.has(name);
    },
  };
  return input;
}

export function attachInput(input, canvas) {
  const onKeyDown = (e) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
    if (e.repeat) return;
    input.press(e.code);
  };
  const onKeyUp = (e) => input.release(e.code);
  const onMouseMove = (e) => {
    const rect = canvas.getBoundingClientRect();
    input.mouse.x = e.clientX - rect.left;
    input.mouse.y = e.clientY - rect.top;
  };
  const onMouseDown = (e) => {
    onMouseMove(e);
    input.mouse.down = true;
  };
  const onMouseUp = () => { input.mouse.down = false; };
  let dragging = false;
  let lastX = 0;
  const onDragStart = (e) => { dragging = true; lastX = e.clientX; };
  const onDragMove = (e) => {
    if (!dragging) return;
    input.orbit += (e.clientX - lastX) * 0.005;
    lastX = e.clientX;
  };
  const onDragEnd = () => { dragging = false; };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', (e) => { onMouseDown(e); onDragStart(e); });
  window.addEventListener('mouseup', (e) => { onMouseUp(); onDragEnd(e); });
  canvas.addEventListener('mousemove', onDragMove);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  };
}
