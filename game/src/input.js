// SOLMAR HEAT — input.js
// Keyboard state, tracked by physical code so WASD works on any layout.
// The game polls `isDown('KeyW')` etc. each frame; `pressed()` reports
// edge-triggered keys (E, M, P, C, R, N, Enter, Escape) that the game
// consumes once per keypress.

export class Input {
  constructor() {
    this.down = new Set();
    this.pressedQueue = [];
    this.anyKey = false;
    this._onDown = (e) => {
      if (e.repeat) return;
      this.down.add(e.code);
      this.pressedQueue.push(e.code);
      this.anyKey = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    };
    this._onUp = (e) => {
      this.down.delete(e.code);
    };
    this._onBlur = () => {
      this.down.clear();
    };
  }

  attach() {
    window.addEventListener('keydown', this._onDown);
    window.addEventListener('keyup', this._onUp);
    window.addEventListener('blur', this._onBlur);
  }

  detach() {
    window.removeEventListener('keydown', this._onDown);
    window.removeEventListener('keyup', this._onUp);
    window.removeEventListener('blur', this._onBlur);
  }

  isDown(code) {
    return this.down.has(code);
  }

  // True once per physical press; the game calls this every frame.
  pressed(code) {
    const i = this.pressedQueue.indexOf(code);
    if (i === -1) return false;
    this.pressedQueue.splice(i, 1);
    return true;
  }

  // Drain keys pressed since the last frame (for menu navigation).
  drainPressed() {
    const out = this.pressedQueue;
    this.pressedQueue = [];
    return out;
  }

  // WASD / arrows as a -1..1 pair: x = strafe/right, y = forward.
  moveAxes() {
    let x = 0;
    let y = 0;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) x -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) x += 1;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) y += 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) y -= 1;
    return { x, y };
  }
}

// ---- Gamepad-free mouse support note (second pass) -----------------------
// The game is keyboard-driven by design (the bounty is played with
// keyboard and mouse). The mouse is used for menus: clicking a title
// menu item activates it, and the canvas click focuses audio. Input.js
// stays keyboard-only; main.js wires the menu clicks separately.
export const MENU_KEYS = ['Enter', 'Space', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyS'];
