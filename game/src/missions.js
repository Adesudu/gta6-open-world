// Missions and side work. A mission is a small story beat made of
// steps: go to a place, pick something up, deliver it, lose the cops,
// or beat a clock. Completing one pays cash, unlocks the next, and is
// saved. A taxi fare is the free-roam side activity: pick a passenger
// up, drop them off, get paid.
import { WORLD } from './config.js';

export const MISSION_DEFS = [
  {
    id: 1, title: 'First Wheels',
    giver: 'Lena Ortiz', brief: 'Lena needs wheels. Grab any car on the street and bring it to the Sunset Garage.',
    steps: [
      { type: 'steal', text: 'Steal a car (walk up to one and press E)' },
      { type: 'goto', place: 'garage', text: 'Drive the car to the Sunset Garage' },
    ],
    reward: 200,
  },
  {
    id: 2, title: 'The Package',
    giver: 'Lena Ortiz', brief: 'A package is waiting at the Harbor Docks. Pick it up and take it to Club Neon Palm. No cops.',
    steps: [
      { type: 'goto', place: 'docks', text: 'Go to the Harbor Docks' },
      { type: 'pickup', place: 'docks', text: 'Pick up the package (walk over it)' },
      { type: 'goto', place: 'club', text: 'Deliver the package to Club Neon Palm' },
    ],
    reward: 350,
  },
  {
    id: 3, title: 'Hot Pursuit',
    giver: 'Marco "Fingers" Doyle', brief: 'The crew tipped off the cops. Lose a 2-star wanted level — stay out of sight until the heat dies down.',
    steps: [
      { type: 'evade', stars: 2, text: 'Lose the cops — wanted level must fall back to 0' },
    ],
    reward: 400,
  },
  {
    id: 4, title: 'Timed Delivery',
    giver: 'Lena Ortiz', brief: 'The Diner ordered fresh catch from the docks. 75 seconds, or the fish — and the money — is gone.',
    steps: [
      { type: 'goto', place: 'docks', text: 'Pick up the delivery at the Harbor Docks', timeLimit: 75 },
      { type: 'goto', place: 'diner', text: 'Deliver to the Palm Diner before time runs out', timeLimit: 75 },
    ],
    reward: 500,
  },
  {
    id: 5, title: 'The Getaway',
    giver: 'Marco "Fingers" Doyle', brief: 'One last job: hit the Bayfront Mall, then the Airfield, then vanish at Palmera Beach. Three stops, one clock: 120 seconds.',
    steps: [
      { type: 'goto', place: 'mall', text: 'Stop 1 of 3: Bayfront Mall', timeLimit: 120 },
      { type: 'goto', place: 'airport', text: 'Stop 2 of 3: Bay Airfield', timeLimit: 120 },
      { type: 'goto', place: 'beach', text: 'Stop 3 of 3: vanish at Palmera Beach', timeLimit: 120 },
    ],
    reward: 800,
  },
];

export function createMissions(city) {
  let index = 0; // index into MISSION_DEFS of the active mission
  let completed = 0;
  let stepIndex = 0;
  let stepTimer = 0;
  let active = false;
  let failed = false;
  let done = false;
  let toast = '';
  let toastTimer = 0;
  let packageOnGround = null; // { x, y } when a pickup step is live

  function currentDef() { return MISSION_DEFS[index] || null; }
  function currentStep() {
    const def = currentDef();
    return def ? def.steps[stepIndex] : null;
  }

  function targetOf(step) {
    if (!step) return null;
    if (step.place) {
      const p = city.places[step.place];
      return { x: p.x, y: p.y, name: p.name, radius: 90 };
    }
    return null;
  }

  function showToast(message, seconds) {
    toast = message; toastTimer = seconds || 3;
  }

  function start() {
    const def = currentDef();
    if (!def) { active = false; return false; }
    active = true; failed = false; done = false;
    stepIndex = 0;
    stepTimer = 0;
    packageOnGround = null;
    showToast(`Mission: ${def.title} — ${def.brief}`, 4);
    return true;
  }

  function advance(game) {
    const def = currentDef();
    stepIndex += 1;
    stepTimer = 0;
    if (stepIndex >= def.steps.length) {
      active = false; done = true; completed += 1;
      game.player.cash += def.reward;
      game.player.score += def.reward;
      showToast(`Mission complete: ${def.title}! +$${def.reward}`, 4);
      game.audio.playMissionComplete();
      index = Math.min(index + 1, MISSION_DEFS.length);
      game.save();
    } else {
      showToast(`Next: ${currentStep().text}`, 3);
    }
  }

  function fail(game, reason) {
    active = false; failed = true;
    showToast(`Mission failed: ${reason}. Talk to Lena to retry.`, 4);
    game.audio.playFail();
  }

  /**
   * Advance the mission state one step. `game` carries player, police,
   * audio and save; returns nothing — completion is read from state.
   */
  function step(dt, game) {
    if (toastTimer > 0) toastTimer -= dt;
    if (!active) return;
    const def = currentDef();
    const st = currentStep();
    if (!st) return;
    if (st.timeLimit) {
      stepTimer += dt;
      if (stepTimer > st.timeLimit) { fail(game, 'Out of time'); return; }
    }
    const player = game.player;
    const px = player.inCar ? player.inCar.x : player.x;
    const py = player.inCar ? player.inCar.y : player.y;

    if (st.type === 'steal') {
      if (player.inCar) advance(game);
    } else if (st.type === 'goto') {
      const t = targetOf(st);
      if (t && Math.hypot(px - t.x, py - t.y) < t.radius) advance(game);
    } else if (st.type === 'pickup') {
      const t = targetOf(st);
      if (!packageOnGround && t) packageOnGround = { x: t.x, y: t.y };
      if (packageOnGround && !player.inCar && Math.hypot(player.x - packageOnGround.x, player.y - packageOnGround.y) < 40) {
        packageOnGround = null;
        advance(game);
      }
    } else if (st.type === 'evade') {
      if (game.police.stars >= st.stars && !st.triggered) {
        st.triggered = true;
        showToast('The heat is on! Lose them!', 3);
      }
      if (st.triggered && game.police.stars === 0) advance(game);
    }
  }

  function retry() {
    if (currentDef()) { start(); failed = false; }
  }

  // --- Taxi fares: the free-roam side activity ---
  const fare = { active: false, phase: 'idle', x: 0, y: 0, dx: 0, dy: 0, timer: 0, passenger: null };

  function offerFare(game) {
    if (fare.active || active) return;
    const p = game.randomPed();
    if (!p) return;
    fare.active = true; fare.phase = 'pickup';
    fare.x = p.x; fare.y = p.y; fare.passenger = p;
    fare.timer = 60;
    showToast('Taxi fare: pick up the passenger at the yellow marker!', 3);
  }

  function stepFare(dt, game) {
    if (!fare.active) return;
    fare.timer -= dt;
    const player = game.player;
    const px = player.inCar ? player.inCar.x : player.x;
    const py = player.inCar ? player.inCar.y : player.y;
    if (fare.timer <= 0) { fare.active = false; showToast('Fare cancelled — too slow.', 3); return; }
    if (fare.phase === 'pickup') {
      if (Math.hypot(px - fare.x, py - fare.y) < 70 && player.inCar) {
        fare.phase = 'dropoff';
        const dest = game.randomPlace();
        fare.dx = dest.x; fare.dy = dest.y; fare.destName = dest.name;
        fare.timer = 75;
        showToast(`Passenger aboard! Take them to ${dest.name}.`, 3);
      }
    } else if (Math.hypot(px - fare.dx, py - fare.dy) < 90) {
      const pay = 120;
      player.cash += pay; player.score += pay;
      fare.active = false;
      showToast(`Fare complete! +$${pay}`, 3);
      game.audio.playCash();
      game.save();
    }
  }

  return {
    get index() { return index; },
    set index(v) { index = v; },
    get completed() { return completed; },
    set completed(v) { completed = v; },
    get active() { return active; },
    get failed() { return failed; },
    get done() { return done; },
    get toast() { return toast; },
    get toastTimer() { return toastTimer; },
    get packageOnGround() { return packageOnGround; },
    currentDef, currentStep, targetOf, start, step, retry, showToast,
    fare, offerFare, stepFare,
    get timeLeft() {
      const st = currentStep();
      return st && st.timeLimit ? Math.max(0, st.timeLimit - stepTimer) : null;
    },
    get allDone() { return index >= MISSION_DEFS.length; },
  };
}
