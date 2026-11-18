// Cars: a simple arcade bicycle-ish model — accelerate, steer, brake,
// handbrake slide — shared by the player's car, traffic and police.
// A car is { x, y, angle, speed, color, name, kind, ... }.
import { CAR, WORLD } from './config.js';
import { onRoad } from './world.js';

let nextId = 1;

export function createCar(x, y, angle, color, name, kind) {
  return {
    id: nextId += 1, x, y, angle, speed: 0, color, name,
    kind: kind || 'traffic', // 'player' | 'traffic' | 'police' | 'parked'
    length: CAR.length, width: CAR.width,
    targetSpeed: 0, steerInput: 0, brakeInput: false, handbrake: false,
    damage: 0, smoke: 0, honkTimer: 0,
  };
}

/** Advance one car a fixed step from its inputs (throttle -1..1, steer -1..1). */
export function driveCar(car, dt, throttle, steer, handbrake) {
  const roadFactor = onRoad(car.x, car.y) ? 1 : CAR.offroadFactor;
  const maxSpeed = CAR.maxSpeed * roadFactor;
  if (throttle > 0) car.speed += CAR.accel * throttle * dt;
  else if (throttle < 0) {
    if (car.speed > 5) car.speed -= CAR.brake * dt;
    else car.speed += CAR.reverseAccel * throttle * dt;
  }
  if (handbrake) car.speed -= Math.sign(car.speed) * CAR.brake * 0.7 * dt;
  // Drag and rolling resistance.
  car.speed -= car.speed * 0.55 * dt;
  if (Math.abs(car.speed) < 4 && throttle === 0) car.speed = 0;
  car.speed = Math.max(-CAR.maxReverse, Math.min(maxSpeed, car.speed));

  const grip = handbrake ? CAR.handbrakeGrip : CAR.grip;
  const turnRate = CAR.steer * grip * Math.min(1, Math.abs(car.speed) / 140);
  car.angle += steer * turnRate * Math.sign(car.speed) * dt;

  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = Math.max(40, Math.min(WORLD.width - 40, car.x));
  car.y = Math.max(40, Math.min(WORLD.height - 40, car.y));
  if (car.damage > 60) car.smoke = Math.min(1, car.smoke + dt);
}

/** Circle-vs-car test used for ramming, bumping and entering. */
export function carHitsPoint(car, px, py, pad) {
  const dx = px - car.x, dy = py - car.y;
  const along = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
  const side = -dx * Math.sin(car.angle) + dy * Math.cos(car.angle);
  return Math.abs(along) < car.length / 2 + (pad || 0) && Math.abs(side) < car.width / 2 + (pad || 0);
}

export function carsOverlap(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.hypot(dx, dy) < (a.length + b.length) / 2 - 8;
}

/** Push two overlapping cars apart and trade a little speed (a soft bump). */
export function separateCars(a, b) {
  if (!carsOverlap(a, b)) return false;
  const dx = a.x - b.x, dy = a.y - b.y;
  const d = Math.hypot(dx, dy) || 1;
  const push = ((a.length + b.length) / 2 - 8 - d) / 2;
  const nx = dx / d, ny = dy / d;
  a.x += nx * push; a.y += ny * push;
  b.x -= nx * push; b.y -= ny * push;
  const avg = (a.speed + b.speed) / 2;
  a.speed = avg * 0.85; b.speed = avg * 0.85;
  a.damage += 2; b.damage += 2;
  return true;
}
