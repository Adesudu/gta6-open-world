// Boot and the one loop: input is read every frame, the game advances
// in fixed 1/60 s steps (several in a slow frame, none in a fast one),
// and the renderer paints what is there. The game moves between five
// screens: title, play, paused, busted and wasted.
//
// ?seed=N fixes the city. ?shot=start|drive|chase|mission (with &seed=N)
// stages that scene instead of running the loop, paints it twice and
// sets window.__shotReady for a screenshot.
import { STEP, VIEW } from './config.js';
import { createGame } from './game.js';
import { createInput } from './input.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createHud } from './hud.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const game = createGame(seed);
// Exposed for live play-testing and debugging (read-only from the console).
window.__game = game;
const hud = createHud();
const renderer = createRenderer(canvas, hud);

function runShot(name) {
  const scene = stageShot(name, game);
  let painted = 0;
  function paint() {
    renderer.draw(game, scene.screen);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();

  function announce(message) { status.textContent = message; }

  function startStory() {
    game.reset();
    game.audio.unlock();
    screen = SCREEN_PLAY;
    const def = game.missions.currentDef();
    announce(def ? `Playing Palmera Bay. Mission ${def.id}: ${def.title}.` : 'Playing Palmera Bay. Free roam.');
  }

  function endGame(kind) {
    screen = kind === 'busted' ? SCREEN_BUSTED : SCREEN_OVER;
    if (game.player.score > game.best) {
      game.best = game.player.score;
      game.save();
    }
    game.audio.playBusted();
    announce(kind === 'busted' ? 'Busted by the police.' : 'Wasted. Game over.');
  }

  /** Build the frame's controls from the keyboard and mouse. */
  function readControls() {
    const up = input.is('up'), down = input.is('down');
    const left = input.is('left'), right = input.is('right');
    const aim = renderer.screenToWorld(input.mouse.x, input.mouse.y);
    return {
      moveX: (right ? 1 : 0) - (left ? 1 : 0),
      moveY: (down ? 1 : 0) - (up ? 1 : 0),
      run: input.is('run'),
      // In a car: up = gas, down = brake/reverse, left/right = steer.
      throttle: (up ? 1 : 0) - (down ? 0.8 : 0),
      steer: (right ? 1 : 0) - (left ? 1 : 0),
      handbrake: input.is('brake'),
      enterPressed: input.wasPressed('enter'),
      attackPressed: input.wasPressed('attack'),
      shootHeld: input.mouse.down || input.mouse.clicked,
      aimX: aim.x,
      aimY: aim.y,
    };
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;

    if (input.wasPressed('mute')) {
      const muted = game.audio.toggleMute();
      announce(muted ? 'Sound muted.' : 'Sound on.');
    }

    if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_BUSTED) {
      if (input.wasPressed('confirm') || input.mouse.clicked) startStory();
    } else if (screen === SCREEN_PLAY) {
      if (input.wasPressed('pause')) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      }
    } else if (screen === SCREEN_PAUSED) {
      if (input.wasPressed('pause') || input.wasPressed('confirm')) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }

    if (screen === SCREEN_PLAY) {
      const controls = readControls();
      while (accumulator >= STEP) {
        const result = game.step(STEP, controls);
        accumulator -= STEP;
        if (result === 'busted') { endGame('busted'); break; }
        if (result === 'wasted') { endGame('wasted'); break; }
        // Edge presses are consumed on the first step of the frame.
        controls.enterPressed = false;
        controls.attackPressed = false;
      }
    } else {
      accumulator = 0;
    }
    input.endFrame();
    renderer.draw(game, screen);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Palmera Bay. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
