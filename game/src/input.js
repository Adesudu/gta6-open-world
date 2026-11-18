// Keyboard + mouse input. Keys are tracked by code so WASD and arrows
// both work; mouse position is kept in screen pixels and converted by
// the game when aiming. Edge-triggered actions (pressed this frame)
// are consumed by the game loop each step.
const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'brake',
  KeyE: 'enter',
  KeyF: 'attack',
  KeyP: 'pause',
  KeyM: 'mute',
  Enter: 'confirm',
  ShiftLeft: 'run', ShiftRight: 'run',
  Escape: 'pause',
};

export const ACTION_CONFIRM = 'confirm';
export const ACTION_PAUSE = 'pause';
export const ACTION_ENTER = 'enter';
export const ACTION_ATTACK = 'attack';
export const ACTION_MUTE = 'mute';
export const ACTION_BRAKE = 'brake';

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  const mouse = { x: 640, y: 360, down: false, clicked: false };

  function onKeyDown(event) {
    const action = KEYMAP[event.code];
    if (!action) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
    if (!held.has(action)) pressed.add(action);
    held.add(action);
  }
  function onKeyUp(event) {
    const action = KEYMAP[event.code];
    if (action) held.delete(action);
  }
  function onBlur() { held.clear(); }
  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  }
  function onMouseDown(event) {
    if (event.button === 0) { mouse.down = true; mouse.clicked = true; }
  }
  function onMouseUp(event) {
    if (event.button === 0) mouse.down = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    held,
    mouse,
    is(action) { return held.has(action); },
    wasPressed(action) { return pressed.has(action); },
    /** Call once per frame after the game has read the edge presses. */
    endFrame() { pressed.clear(); mouse.clicked = false; },
  };
}
