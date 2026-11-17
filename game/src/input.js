// Keyboard + mouse input. Keys are tracked by code so layouts do not matter,
// and the camera can be orbited by dragging with the mouse.

export const ACTION_CONFIRM = 'confirm';
export const ACTION_PAUSE = 'pause';
export const ACTION_ENTER_CAR = 'enterCar';
export const ACTION_PUNCH = 'punch';
export const ACTION_SHOOT = 'shoot';
export const ACTION_RUN = 'run';
export const ACTION_HORN = 'horn';

const KEY_ACTIONS = {
  Enter: ACTION_CONFIRM,
  Space: ACTION_CONFIRM,
  KeyE: ACTION_ENTER_CAR,
  KeyF: ACTION_SHOOT,
  KeyQ: ACTION_PUNCH,
  Escape: ACTION_PAUSE,
  KeyP: ACTION_PAUSE,
  ShiftLeft: ACTION_RUN,
  ShiftRight: ACTION_RUN,
  KeyH: ACTION_HORN,
};

export function createInput(canvas) {
  const down = new Set();
  const pressed = new Set();
  let dragDX = 0;
  let dragging = false;
  let lastX = 0;

  function onKeyDown(event) {
    if (event.repeat) return;
    down.add(event.code);
    pressed.add(event.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      event.preventDefault();
    }
  }
  function onKeyUp(event) {
    down.delete(event.code);
  }
  function onMouseDown(event) {
    dragging = true;
    lastX = event.clientX;
  }
  function onMouseMove(event) {
    if (!dragging) return;
    dragDX += event.clientX - lastX;
    lastX = event.clientX;
  }
  function onMouseUp() {
    dragging = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('blur', () => {
    down.clear();
    dragging = false;
  });

  return {
    axis() {
      let x = 0;
      let y = 0;
      if (down.has('KeyA') || down.has('ArrowLeft')) x -= 1;
      if (down.has('KeyD') || down.has('ArrowRight')) x += 1;
      if (down.has('KeyW') || down.has('ArrowUp')) y += 1;
      if (down.has('KeyS') || down.has('ArrowDown')) y -= 1;
      return { x, y };
    },
    held(code) {
      return down.has(code);
    },
    actionPressed(action) {
      for (const code of pressed) {
        if (KEY_ACTIONS[code] === action) return true;
      }
      return false;
    },
    consumeDrag() {
      const d = dragDX;
      dragDX = 0;
      return d;
    },
    endFrame() {
      pressed.clear();
    },
  };
}
