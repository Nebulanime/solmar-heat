// SOLMAR HEAT — input.mjs
// Keyboard + mouse state. The game polls `down(code)` each frame; edge
// presses (just pressed this frame) are exposed for one-shot actions
// like entering a car, punching or pausing.
import { KEYS } from './config.mjs';

export function createInput() {
  const held = new Set();
  const pressed = new Set();
  let mouse = { x: 0, y: 0, clicked: false };
  const input = {
    held, pressed, mouse,
    down(code) { return held.has(code); },
    // True when any bound key of an action is held.
    action(name) {
      return (KEYS[name] || []).some((c) => held.has(c));
    },
    // True only on the frame the key went down.
    actionPressed(name) {
      return (KEYS[name] || []).some((c) => pressed.has(c));
    },
    axis() {
      let x = 0, y = 0;
      if (input.action('left')) x -= 1;
      if (input.action('right')) x += 1;
      if (input.action('up')) y -= 1;
      if (input.action('down')) y += 1;
      return { x, y };
    },
    endFrame() { pressed.clear(); mouse.clicked = false; },
    // Feed a synthetic key event (used by the logic tests, not by players).
    press(code) { if (!held.has(code)) pressed.add(code); held.add(code); },
    release(code) { held.delete(code); },
    attach(canvas) {
      window.addEventListener('keydown', (e) => {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
        if (!held.has(e.code)) pressed.add(e.code);
        held.add(e.code);
      });
      window.addEventListener('keyup', (e) => held.delete(e.code));
      window.addEventListener('blur', () => { held.clear(); pressed.clear(); });
      canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        mouse.x = e.clientX - rect.left;
        mouse.y = e.clientY - rect.top;
      });
      canvas.addEventListener('mousedown', () => { mouse.clicked = true; });
    },
  };
  return input;
}
