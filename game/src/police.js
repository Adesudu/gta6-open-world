// The wanted system: stars rise when the player commits a crime in
// sight of the law (or anyone who calls it in), police cars and foot
// officers spawn to match the level, and stars fall once the player
// stays clean and out of sight. Police chase, ram, and on foot try to
// bust the player; the game ends busted, not just damaged.
import { PLAYER, WANTED, WORLD } from './config.js';
import { createCar, driveCar } from './vehicles.js';

export function createPolice(city, random) {
  const cars = [];
  const officers = [];
  let stars = 0;
  let decayTimer = 0;
  let bustTimer = 0;
  let lastCrime = -999;

  function spawnPoliceCarNear(x, y) {
    const angle = random.range(0, Math.PI * 2);
    const px = Math.max(120, Math.min(WORLD.width - 120, x + random.range(-500, 500)));
    const py = Math.max(120, Math.min(WORLD.height - 120, y + random.range(-500, 500)));
    const car = createCar(px, py, angle, '#2b6fd6', 'Interceptor', 'police');
    car.cruise = 520;
    cars.push(car);
    return car;
  }

  function spawnOfficerNear(x, y) {
    officers.push({
      x: Math.max(80, Math.min(WORLD.width - 80, x + random.range(-300, 300))),
      y: Math.max(80, Math.min(WORLD.height - 80, y + random.range(-300, 300))),
      angle: 0, speed: 0, punchTimer: 0, health: 50,
    });
  }

  /** Raise the wanted level by `n` stars (capped) and note the crime time. */
  function addCrime(n, now) {
    stars = Math.min(WANTED.maxStars, stars + n);
    lastCrime = now;
    decayTimer = WANTED.decaySeconds;
  }

  function wantedCount() {
    return { cars: WANTED.policeCars[stars], foot: WANTED.policeFoot[stars] };
  }

  function step(dt, now, player, playerCar, trafficCars) {
    // Keep the deployed force matched to the wanted level.
    const want = wantedCount();
    while (cars.length < want.cars) spawnPoliceCarNear(player.x, player.y);
    while (officers.length < want.foot) spawnOfficerNear(player.x, player.y);
    // Stars fall after a clean stretch with no new crime.
    if (stars > 0 && now - lastCrime > WANTED.decaySeconds) {
      decayTimer -= dt;
      if (decayTimer <= 0) {
        stars -= 1;
        decayTimer = WANTED.decaySeconds;
        lastCrime = now;
      }
    } else if (stars > 0) {
      decayTimer = WANTED.decaySeconds;
    }
    if (stars === 0) {
      // Stand down: police drive off and officers leave.
      for (const car of cars) {
        const away = Math.atan2(car.y - player.y, car.x - player.x);
        driveCar(car, dt, 0.5, Math.max(-1, Math.min(1, (away - car.angle) * 2)), false);
      }
      cars.length = 0;
      officers.length = 0;
      bustTimer = 0;
      return { busted: false };
    }

    // Police cars hunt the player (in the car, or on foot).
    const tx = playerCar ? playerCar.x : player.x;
    const ty = playerCar ? playerCar.y : player.y;
    for (const car of cars) {
      const targetAngle = Math.atan2(ty - car.y, tx - car.x);
      let diff = targetAngle - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, diff * 2.4));
      driveCar(car, dt, 1, steer, false);
      car.speed = Math.min(car.cruise, car.speed);
      city.pushOutOfBuildings(car, 28);
    }
    // Officers run at the player on foot and punch when close.
    let busted = false;
    for (const officer of officers) {
      const dx = player.x - officer.x, dy = player.y - officer.y;
      const d = Math.hypot(dx, dy);
      officer.angle = Math.atan2(dy, dx);
      const chaseSpeed = 235;
      if (d > 26) {
        officer.x += Math.cos(officer.angle) * chaseSpeed * dt;
        officer.y += Math.sin(officer.angle) * chaseSpeed * dt;
        city.pushOutOfBuildings(officer, PLAYER.radius);
      }
      officer.punchTimer -= dt;
      if (d < 30 && officer.punchTimer <= 0 && !playerCar) {
        officer.punchTimer = 0.9;
        player.health -= 8;
      }
      // Busted: an officer stays on the player while the player is on foot.
      if (!playerCar && d < 34 && Math.abs(player.vx || 0) < 40 && Math.abs(player.vy || 0) < 40) {
        bustTimer += dt;
        if (bustTimer > WANTED.bustSeconds) busted = true;
      } else if (d > 60) {
        bustTimer = Math.max(0, bustTimer - dt);
      }
    }
    // A slow player car boxed in by police also gets busted.
    if (playerCar && Math.abs(playerCar.speed) < 12) {
      const near = cars.some((c) => Math.hypot(c.x - playerCar.x, c.y - playerCar.y) < 90);
      if (near) {
        bustTimer += dt;
        if (bustTimer > WANTED.bustSeconds + 1.5) busted = true;
      } else bustTimer = Math.max(0, bustTimer - dt);
    }
    return { busted };
  }

  return {
    cars, officers,
    get stars() { return stars; },
    set stars(v) { stars = Math.max(0, Math.min(WANTED.maxStars, v)); lastCrime = 0; },
    addCrime, step, spawnPoliceCarNear, spawnOfficerNear,
  };
}
