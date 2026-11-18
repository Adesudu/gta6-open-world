// The screenshot scenes behind ?shot=start|drive|chase|mission. Each one
// plays the real rules forward from a fresh game for a fixed number of
// steps, steered by a simple driving autopilot (steer toward the target,
// full throttle), so the frame is what real play looks like and the
// same seed always gives the same frame.
import { AVENUES, STEP, STREETS } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

function nearestLine(value, lines) {
  let best = lines[0];
  for (const line of lines) if (Math.abs(line - value) < Math.abs(best - value)) best = line;
  return best;
}

/** Road-following route: along the nearest avenue to the target street,
 * then along that street to the target avenue, then to the point. */
function routeWaypoints(fromX, fromY, toX, toY) {
  const avenue = nearestLine(fromX, AVENUES);
  const targetStreet = nearestLine(toY, STREETS);
  const targetAvenue = nearestLine(toX, AVENUES);
  return [
    { x: avenue, y: fromY },
    { x: avenue, y: targetStreet },
    { x: targetAvenue, y: targetStreet },
    { x: toX, y: toY },
  ];
}

/** Drive the player's car toward a world point for `seconds`, following
 * the road grid, then return. */
function autopilotDrive(game, seconds, target) {
  const car = game.player.inCar;
  if (!car) return;
  const waypoints = routeWaypoints(car.x, car.y, target.x, target.y);
  let wp = 0;
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const c = game.player.inCar;
    if (!c) break;
    while (wp < waypoints.length - 1 && Math.hypot(c.x - waypoints[wp].x, c.y - waypoints[wp].y) < 70) wp += 1;
    const dest = waypoints[wp];
    const want = Math.atan2(dest.y - c.y, dest.x - c.x);
    let diff = want - c.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const dist = Math.hypot(dest.x - c.x, dest.y - c.y);
    game.step(STEP, {
      moveX: 0, moveY: 0, run: false,
      throttle: dist < 120 ? 0.5 : 1, steer: Math.max(-1, Math.min(1, diff * 2.5)),
      handbrake: false, enterPressed: false, attackPressed: false,
      shootHeld: false, aimX: c.x, aimY: c.y,
    });
    if (game.player.health <= 0) break;
  }
}

/** Put the player in a nearby parked car, the way a real player would. */
function stealNearestCar(game) {
  const player = game.player;
  let bestCar = null, bestD = 1e9;
  for (const car of game.traffic.cars) {
    if (car.kind !== 'parked' && car.kind !== 'traffic') continue;
    const d = Math.hypot(car.x - player.x, car.y - player.y);
    if (d < bestD) { bestD = d; bestCar = car; }
  }
  if (!bestCar) return;
  player.x = bestCar.x - 40; player.y = bestCar.y;
  game.step(STEP, {
    moveX: 0, moveY: 0, run: false, throttle: 0, steer: 0,
    handbrake: false, enterPressed: true, attackPressed: false,
    shootHeld: false, aimX: player.x, aimY: player.y,
  });
}

/**
 * Set `game` to the named scene and return the screen to draw over it.
 * start: title screen over a living city. drive: cruising through
 * traffic. chase: 3-star police chase with the HUD and minimap.
 * mission: a mission in progress with its marker and objective.
 */
export function stageShot(name, game) {
  game.reset();
  if (name === 'start') {
    // Let traffic and pedestrians move for a few seconds behind the title.
    for (let i = 0; i < 5 / STEP; i += 1) {
      game.traffic.step(STEP, game.player, null, null);
    }
    return { screen: SCREEN_TITLE };
  }
  if (name === 'drive') {
    stealNearestCar(game);
    autopilotDrive(game, 7, { x: 3900, y: 900 });
    return { screen: SCREEN_PLAY };
  }
  if (name === 'chase') {
    stealNearestCar(game);
    game.police.stars = 3;
    game.missions.start();
    autopilotDrive(game, 6, { x: 900, y: 2100 });
    return { screen: SCREEN_PLAY };
  }
  // mission (and any unknown name): mission 2, the package run.
  game.missions.index = 1;
  game.missions.completed = 1;
  game.missions.start();
  stealNearestCar(game);
  autopilotDrive(game, 8, { x: 4500, y: 3000 });
  return { screen: SCREEN_PLAY };
}
