// Traffic cars and pedestrians: they wander the city on their own so
// the streets feel alive, and they react to the player (peds flee from
// a speeding car or a gunshot; drivers honk when blocked).
import { AVENUES, CAR, PLAYER, STREETS, WORLD } from './config.js';
import { createCar, driveCar, separateCars } from './vehicles.js';
import { nearestRoad, onRoad } from './world.js';

const PED_COLORS = ['#f2d8a7', '#e8a7a7', '#a7c8e8', '#c8e8a7', '#e8d8a7', '#d8a7e8'];

export function createTraffic(city, random) {
  const cars = [];
  const peds = [];

  function spawnTrafficCar() {
    const avenue = random.pick(AVENUES);
    const street = random.pick(STREETS);
    const vertical = random.chance(0.5);
    const x = vertical ? avenue + (random.chance(0.5) ? 22 : -22) : random.range(200, WORLD.width - 200);
    const y = vertical ? random.range(200, WORLD.height - 400) : street + (random.chance(0.5) ? 22 : -22);
    const angle = vertical ? (random.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (random.chance(0.5) ? 0 : Math.PI);
    const car = createCar(x, y, angle, city.randomCarColor(), city.randomCarName(), 'traffic');
    car.cruise = random.range(150, 240);
    car.lane = random.chance(0.5) ? 22 : -22;
    cars.push(car);
    return car;
  }

  function spawnPed(x, y) {
    peds.push({
      x: x ?? random.range(200, WORLD.width - 200),
      y: y ?? random.range(200, WORLD.height - 400),
      angle: random.range(0, Math.PI * 2),
      speed: random.range(45, 80),
      color: random.pick(PED_COLORS),
      flee: 0, panic: 0, walkTimer: random.range(1, 4),
      targetX: 0, targetY: 0, hasTarget: false,
    });
  }

  function spawnParkedCar() {
    const avenue = random.pick(AVENUES);
    const street = random.pick(STREETS);
    const vertical = random.chance(0.5);
    const x = vertical ? avenue + 34 : random.range(400, WORLD.width - 400);
    const y = vertical ? random.range(400, WORLD.height - 600) : street + 34;
    const angle = vertical ? Math.PI / 2 : 0;
    const car = createCar(x, y, angle, city.randomCarColor(), city.randomCarName(), 'parked');
    cars.push(car);
    return car;
  }

  for (let i = 0; i < 14; i += 1) spawnTrafficCar();
  for (let i = 0; i < 8; i += 1) spawnParkedCar();
  for (let i = 0; i < 30; i += 1) spawnPed();

  function steerTrafficCar(car, dt) {
    // Follow the road grid: head along the current road, and at an
    // intersection sometimes turn onto the crossing road.
    const road = nearestRoad(car.x, car.y);
    const onV = road.axis === 'v';
    const movingAlong = onV
      ? Math.abs(Math.sin(car.angle)) > 0.7
      : Math.abs(Math.cos(car.angle)) > 0.7;
    let targetAngle = car.angle;
    if (movingAlong) {
      // Stay in lane: steer gently toward the lane centre.
      const laneLine = road.line + car.lane;
      const offset = onV ? car.x - laneLine : car.y - laneLine;
      const base = onV ? (Math.sin(car.angle) > 0 ? Math.PI / 2 : -Math.PI / 2) : (Math.cos(car.angle) > 0 ? 0 : Math.PI);
      targetAngle = base - Math.max(-0.3, Math.min(0.3, offset * 0.004)) * (onV ? Math.sign(Math.sin(car.angle)) : Math.sign(Math.cos(car.angle)));
    } else {
      // Off the grid (bumped): turn back toward the nearest road.
      targetAngle = Math.atan2(road.axis === 'v' ? 0 : 1, road.axis === 'v' ? 1 : 0);
    }
    // At an intersection, sometimes pick a new direction.
    const nearX = AVENUES.some((ax) => Math.abs(car.x - ax) < 60);
    const nearY = STREETS.some((sy) => Math.abs(car.y - sy) < 60);
    if (nearX && nearY && random.chance(0.004)) {
      car.angle = random.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
      car.lane = random.chance(0.5) ? 22 : -22;
    }
    let diff = targetAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, diff * 2.2));
    // Slow down for the car ahead.
    let throttle = 0.55;
    for (const other of cars) {
      if (other === car || other.kind === 'parked') continue;
      const dx = other.x - car.x, dy = other.y - car.y;
      const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
      if (ahead > 0 && ahead < 90 && side < 30) { throttle = -0.4; break; }
    }
    driveCar(car, dt, throttle, steer, false);
    car.speed = Math.max(-20, Math.min(car.cruise, car.speed));
  }

  function updatePeds(dt, player, playerCar, gunshot) {
    for (const ped of peds) {
      if (ped.flee > 0) ped.flee -= dt;
      if (ped.panic > 0) ped.panic -= dt;
      // Flee a nearby speeding car or a gunshot.
      const car = playerCar;
      if (car && Math.hypot(ped.x - car.x, ped.y - car.y) < 130 && Math.abs(car.speed) > 120) {
        ped.flee = 1.2;
        ped.angle = Math.atan2(ped.y - car.y, ped.x - car.x);
      }
      if (gunshot && Math.hypot(ped.x - gunshot.x, ped.y - gunshot.y) < 420) {
        ped.panic = 2;
        ped.angle = Math.atan2(ped.y - gunshot.y, ped.x - gunshot.x);
      }
      if (player && Math.hypot(ped.x - player.x, ped.y - player.y) < 60 && player.attacking) {
        ped.panic = 1.5;
        ped.angle = Math.atan2(ped.y - player.y, ped.x - player.x);
      }
      const speed = (ped.flee > 0 || ped.panic > 0) ? ped.speed * 2.4 : ped.speed;
      if (ped.flee <= 0 && ped.panic <= 0) {
        ped.walkTimer -= dt;
        if (ped.walkTimer <= 0) {
          ped.walkTimer = random.range(2, 6);
          ped.angle = random.range(0, Math.PI * 2);
        }
      }
      ped.x += Math.cos(ped.angle) * speed * dt;
      ped.y += Math.sin(ped.angle) * speed * dt;
      ped.x = Math.max(60, Math.min(WORLD.width - 60, ped.x));
      ped.y = Math.max(60, Math.min(WORLD.height - 60, ped.y));
      if (!onRoad(ped.x, ped.y)) city.pushOutOfBuildings(ped, PLAYER.radius);
    }
  }

  function step(dt, player, playerCar, gunshot) {
    for (const car of cars) {
      if (car.kind === 'traffic') steerTrafficCar(car, dt);
    }
    for (let i = 0; i < cars.length; i += 1) {
      for (let j = i + 1; j < cars.length; j += 1) separateCars(cars[i], cars[j]);
      city.pushOutOfBuildings(cars[i], CAR.length / 2);
    }
    updatePeds(dt, player, playerCar, gunshot);
    return { cars, peds };
  }

  return { cars, peds, step, spawnTrafficCar, spawnParkedCar, spawnPed };
}
