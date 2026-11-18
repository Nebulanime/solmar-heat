// Keyboard and pointer input. Held keys give movement axes; one-shot presses
// (confirm, pause, enter a car) are queued as bit flags and taken once by the
// loop, so a press between two frames is never lost and never counted twice.
// Dragging the mouse orbits the camera; the pointer's screen position aims the gun.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;

const FORWARD = new Set(['KeyW', 'ArrowUp']);
const BACK = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE']);
const SHOOT = new Set(['KeyF']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let shooting = false;
  let orbitDX = 0;
  let dragging = false;
  let lastX = 0;
  let mouseX = 0;
  let mouseY = 0;

  window.addEventListener('keydown', (event) => {
    if (FORWARD.has(event.code) || BACK.has(event.code) || LEFT.has(event.code)
      || RIGHT.has(event.code) || RUN.has(event.code) || SHOOT.has(event.code)) {
      held.add(event.code);
      if (SHOOT.has(event.code)) shooting = true;
      event.preventDefault();
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
      event.preventDefault();
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
      event.preventDefault();
    } else if (ENTER.has(event.code)) {
      if (!event.repeat) actions |= ACTION_ENTER;
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
    if (SHOOT.has(event.code)) shooting = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of
  // everything on blur, including any half-finished camera orbit.
  window.addEventListener('blur', () => {
    held.clear();
    shooting = false;
    dragging = false;
    orbitDX = 0;
  });

  canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    lastX = event.clientX;
    mouseX = event.clientX;
    mouseY = event.clientY;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointermove', (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
    if (dragging) {
      orbitDX += event.clientX - lastX;
      lastX = event.clientX;
    }
  });
  window.addEventListener('pointerup', () => {
    dragging = false;
  });

  function axis(positive, negative) {
    let value = 0;
    for (const code of positive) if (held.has(code)) value += 1;
    for (const code of negative) if (held.has(code)) value -= 1;
    return value;
  }

  return {
    /** -1..1 forward (W / up), -1..1 back. */
    forward() {
      return axis(FORWARD, BACK);
    },
    /** -1..1 right (D / right), -1..1 left. */
    strafe() {
      return axis(RIGHT, LEFT);
    },
    run() {
      for (const code of RUN) if (held.has(code)) return true;
      return false;
    },
    /** True while the fire key is held. */
    firing() {
      return shooting;
    },
    /** True when any movement key is held down. */
    moving() {
      return this.forward() !== 0 || this.strafe() !== 0;
    },
    /** Pixels the mouse orbited since the last call; resets to zero. */
    takeOrbit() {
      const dx = orbitDX;
      orbitDX = 0;
      return dx;
    },
    /** The pointer's last position in CSS pixels, relative to the viewport. */
    mouse() {
      return { x: mouseX, y: mouseY };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
