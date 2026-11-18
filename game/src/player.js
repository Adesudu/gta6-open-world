// The player on foot and in a car: walking, running, punching and
// shooting, entering and exiting cars, picking things up. The player
// object is plain state; this module owns how it moves each step.
import { CAR, PLAYER, WORLD } from './config.js';
import { carHitsPoint } from './vehicles.js';

export function createPlayer(x, y) {
  return {
    x, y, vx: 0, vy: 0, angle: -Math.PI / 2,
    health: PLAYER.health, cash: 0, score: 0,
    inCar: null, // the car object, or null when on foot
    ammo: 0, hasPistol: false,
    punchTimer: 0, shootTimer: 0, attacking: false,
    invulnerable: 0, hurtFlash: 0, hurtCooldown: 0,
  };
}

/** Walk/run on foot. Returns nothing; writes vx/vy so police can read speed. */
export function stepOnFoot(player, dt, moveX, moveY, running, city) {
  const speed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const len = Math.hypot(moveX, moveY);
  if (len > 0.01) {
    player.vx = (moveX / len) * speed;
    player.vy = (moveY / len) * speed;
    player.angle = Math.atan2(moveY, moveX);
  } else {
    player.vx = 0; player.vy = 0;
  }
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  player.x = Math.max(30, Math.min(WORLD.width - 30, player.x));
  player.y = Math.max(30, Math.min(WORLD.height - 30, player.y));
  city.pushOutOfBuildings(player, PLAYER.radius);
  if (player.punchTimer > 0) player.punchTimer -= dt;
  if (player.shootTimer > 0) player.shootTimer -= dt;
  if (player.invulnerable > 0) player.invulnerable -= dt;
  if (player.hurtFlash > 0) player.hurtFlash -= dt;
}

/** Punch: hits the nearest ped/officer in front of the player. Returns the victim or null. */
export function punch(player, targets) {
  if (player.punchTimer > 0) return null;
  player.punchTimer = 0.45;
  player.attacking = true;
  let best = null, bestD = PLAYER.punchRange;
  for (const t of targets) {
    const dx = t.x - player.x, dy = t.y - player.y;
    const d = Math.hypot(dx, dy);
    if (d > PLAYER.punchRange) continue;
    const ang = Math.atan2(dy, dx);
    let diff = Math.abs(ang - player.angle);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    if (diff < PLAYER.punchArc && d < bestD) { best = t; bestD = d; }
  }
  if (best && best.health !== undefined) best.health -= PLAYER.punchDamage;
  return best;
}

/** Shoot toward a world point. Returns a bullet or null (no ammo / cooling down). */
export function shoot(player, targetX, targetY, bullets) {
  if (!player.hasPistol || player.ammo <= 0 || player.shootTimer > 0) return null;
  player.shootTimer = 0.28;
  player.ammo -= 1;
  player.attacking = true;
  const angle = Math.atan2(targetY - player.y, targetX - player.x);
  player.angle = angle;
  const bullet = {
    x: player.x + Math.cos(angle) * 20, y: player.y + Math.sin(angle) * 20,
    vx: Math.cos(angle) * PLAYER.bulletSpeed, vy: Math.sin(angle) * PLAYER.bulletSpeed,
    life: 0.9, damage: PLAYER.shootDamage, fromPlayer: true,
  };
  bullets.push(bullet);
  return bullet;
}

/** The nearest car the player could enter (parked, traffic or empty police car). */
export function nearestEnterableCar(player, cars, maxDist) {
  let best = null, bestD = maxDist || 70;
  for (const car of cars) {
    const d = Math.hypot(car.x - player.x, car.y - player.y);
    if (d < bestD && !car.occupied) { best = car; bestD = d; }
  }
  return best;
}

export function enterCar(player, car) {
  player.inCar = car;
  car.occupied = true;
  car.speed = 0;
  player.x = car.x; player.y = car.y;
}

export function exitCar(player, city) {
  const car = player.inCar;
  if (!car) return;
  car.occupied = false;
  const side = car.angle + Math.PI / 2;
  player.x = car.x + Math.cos(side) * (CAR.width / 2 + PLAYER.radius + 6);
  player.y = car.y + Math.sin(side) * (CAR.width / 2 + PLAYER.radius + 6);
  if (city.collidesBuilding(player.x, player.y, PLAYER.radius)) {
    player.x = car.x - Math.cos(side) * (CAR.width / 2 + PLAYER.radius + 6);
    player.y = car.y - Math.sin(side) * (CAR.width / 2 + PLAYER.radius + 6);
  }
  player.x = Math.max(30, Math.min(WORLD.width - 30, player.x));
  player.y = Math.max(30, Math.min(WORLD.height - 30, player.y));
  player.inCar = null;
  player.vx = 0; player.vy = 0;
}

export { carHitsPoint };
