// Palmera Bay — the game itself: state, the fixed-step update, crimes,
// pickups, fares, saving, and the glue between city, traffic, police,
// missions and audio. Rendering lives in render.js; input in main.js.
import { AVENUES, CAR, PLAYER, SAVE_KEY, STEP, STREETS, WORLD } from './config.js';
import { createRandom } from './random.js';
import { createCity, KIND_AMMO, KIND_CASH, KIND_HEALTH } from './world.js';
import { createCar, driveCar, separateCars } from './vehicles.js';
import { createTraffic } from './traffic.js';
import { createPolice } from './police.js';
import { createPlayer, enterCar, exitCar, nearestEnterableCar, punch, shoot, stepOnFoot } from './player.js';
import { createMissions } from './missions.js';
import { createAudio } from './audio.js';

export function createGame(seed) {
  const random = createRandom(seed);
  const audio = createAudio();
  const city = createCity(random);
  const traffic = createTraffic(city, random);
  const police = createPolice(city, random);
  const missions = createMissions(city);

  const player = createPlayer(2100, 1500);
  const bullets = [];
  const particles = [];
  let elapsed = 0;
  let best = 0;
  let saveExists = false;
  let nearCar = null;
  let fareTimer = 40;
  let missionDelay = 0;
  let sirenTimer = 0;
  let crashSoundTimer = 0;
  let lastShotCrime = -999;
  let gunshot = null;

  function randomPlace() {
    const keys = Object.keys(city.places);
    return city.places[random.pick(keys)];
  }

  function randomPed() {
    return traffic.peds.length ? random.pick(traffic.peds) : null;
  }

  function spawnParticles(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const a = random.range(0, Math.PI * 2);
      const s = random.range(speed * 0.3, speed);
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: random.range(0.3, 0.7), maxLife: 0.7, size: random.range(2, 5), color });
    }
  }

  function save() {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: player.cash, best: Math.max(best, player.score),
        missionsCompleted: missions.completed, missionIndex: missions.index,
      }));
    } catch { /* storage off: progress lasts this visit only */ }
  }

  function load() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      player.cash = data.cash || 0;
      best = data.best || 0;
      missions.completed = data.missionsCompleted || 0;
      missions.index = Math.min(data.missionIndex || 0, 5);
      saveExists = true;
    } catch { /* corrupt save: start fresh */ }
  }

  function missionTarget() {
    if (missions.active) {
      const st = missions.currentStep();
      if (!st) return null;
      if (st.type === 'steal') return null;
      if (st.type === 'evade') return null;
      if (st.type === 'pickup' && missions.packageOnGround) {
        return { x: missions.packageOnGround.x, y: missions.packageOnGround.y, label: 'PACKAGE', color: '#ffd23e' };
      }
      const t = missions.targetOf(st);
      if (t) return { x: t.x, y: t.y, label: t.name.toUpperCase(), color: '#ffd23e' };
      return null;
    }
    const fare = missions.fare;
    if (fare.active) {
      if (fare.phase === 'pickup') return { x: fare.x, y: fare.y, label: 'FARE', color: '#37d67a' };
      return { x: fare.dx, y: fare.dy, label: (fare.destName || 'DROP OFF').toUpperCase(), color: '#37d67a' };
    }
    return null;
  }

  function reset() {
    player.x = 2100; player.y = 1500;
    player.vx = 0; player.vy = 0;
    player.health = PLAYER.health;
    player.inCar = null;
    player.ammo = 12; player.hasPistol = true;
    player.cash = 0;
    player.score = 0;
    bullets.length = 0;
    particles.length = 0;
    police.stars = 0;
    elapsed = 0;
    missionDelay = 1.5;
    fareTimer = 40;
    for (const p of city.pickups) p.taken = false;
    load();
    if (missions.index > 0 && missions.completed === 0) missions.completed = missions.index;
  }

  function commitCrime(n) {
    police.addCrime(n, elapsed);
    if (police.stars > 0) audio.playSiren();
  }

  function stealCar(car) {
    const policeNear = police.cars.some((c) => Math.hypot(c.x - car.x, c.y - car.y) < 600);
    const pedNear = traffic.peds.some((p) => Math.hypot(p.x - car.x, p.y - car.y) < 260);
    enterCar(player, car);
    audio.playClick();
    if (car.kind === 'parked' || car.kind === 'traffic') {
      car.kind = 'player';
      if (policeNear || pedNear) {
        commitCrime(1);
        missions.showToast('Car stolen — someone called the cops!', 3);
      } else {
        missions.showToast('Nice ride: the ' + car.name, 2.5);
      }
    }
  }

  function updateBullets(dt) {
    for (let i = bullets.length - 1; i >= 0; i -= 1) {
      const b = bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let dead = b.life <= 0 || b.x < 0 || b.y < 0 || b.x > WORLD.width || b.y > WORLD.height;
      if (!dead && city.collidesBuilding(b.x, b.y, 2)) { spawnParticles(b.x, b.y, '#c9c2ae', 4, 120); dead = true; }
      if (!dead && b.fromPlayer) {
        for (let j = traffic.peds.length - 1; j >= 0; j -= 1) {
          const ped = traffic.peds[j];
          if (Math.hypot(ped.x - b.x, ped.y - b.y) < 14) {
            spawnParticles(ped.x, ped.y, '#ff3b30', 10, 200);
            traffic.peds.splice(j, 1);
            traffic.spawnPed();
            commitCrime(1);
            dead = true;
            break;
          }
        }
        if (!dead) {
          for (let j = police.officers.length - 1; j >= 0; j -= 1) {
            const off = police.officers[j];
            if (Math.hypot(off.x - b.x, off.y - b.y) < 15) {
              off.health -= b.damage;
              spawnParticles(off.x, off.y, '#ff3b30', 8, 180);
              if (off.health <= 0) police.officers.splice(j, 1);
              commitCrime(1);
              dead = true;
              break;
            }
          }
        }
      }
      if (dead) bullets.splice(i, 1);
    }
  }

  function updateCarCollisions(dt) {
    const car = player.inCar;
    if (!car) return;
    // Ram traffic cars.
    for (const other of traffic.cars) {
      if (other === car) continue;
      if (separateCars(car, other)) {
        if (crashSoundTimer <= 0) { audio.playCrash(); crashSoundTimer = 0.4; }
        spawnParticles(car.x, car.y, '#e8d44d', 6, 160);
      }
    }
    for (const pc of police.cars) {
      if (separateCars(car, pc)) {
        if (crashSoundTimer <= 0) { audio.playCrash(); crashSoundTimer = 0.4; }
        if (player.hurtCooldown <= 0) {
          player.health -= 3;
          player.hurtFlash = 0.3;
          player.hurtCooldown = 0.9;
        }
      }
    }
    // Hit a pedestrian.
    if (Math.abs(car.speed) > 90) {
      for (let i = traffic.peds.length - 1; i >= 0; i -= 1) {
        const ped = traffic.peds[i];
        if (Math.hypot(ped.x - car.x, ped.y - car.y) < 30) {
          spawnParticles(ped.x, ped.y, '#ff3b30', 12, 240);
          traffic.peds.splice(i, 1);
          traffic.spawnPed();
          commitCrime(1);
          audio.playCrash();
        }
      }
    }
    // Smash into a building at speed: one hit, then a short grace period.
    const hit = city.collidesBuilding(car.x, car.y, 24);
    if (hit) {
      const impact = Math.abs(car.speed);
      car.speed *= 0.45;
      if (impact > 140 && player.hurtCooldown <= 0) {
        car.damage += 12;
        player.health -= 4;
        player.hurtFlash = 0.3;
        player.hurtCooldown = 0.9;
        spawnParticles(car.x, car.y, '#e8d44d', 8, 200);
      }
      if (impact > 140 && crashSoundTimer <= 0) { audio.playCrash(); crashSoundTimer = 0.4; }
    }
    city.pushOutOfBuildings(car, 24);
  }

  function updatePickups() {
    if (player.inCar) return;
    for (const p of city.pickups) {
      if (p.taken) continue;
      if (Math.hypot(p.x - player.x, p.y - player.y) < 32) {
        p.taken = true;
        if (p.kind === KIND_CASH) {
          player.cash += p.amount; player.score += p.amount;
          missions.showToast('+$' + p.amount + ' found on the street', 2);
          audio.playCash();
        } else if (p.kind === KIND_HEALTH) {
          player.health = Math.min(PLAYER.health, player.health + 35);
          missions.showToast('Health +35', 2);
          audio.playCash();
        } else if (p.kind === KIND_AMMO) {
          player.hasPistol = true; player.ammo += 12;
          missions.showToast('Pistol ammo +12', 2);
          audio.playCash();
        }
        save();
      }
    }
  }

  /**
   * One fixed step of live play. `input` is the frame's controls:
   * moveX/moveY (-1..1), run, throttle (-1..1), steer (-1..1),
   * handbrake, enterPressed, attackPressed, shootHeld, aimX, aimY.
   * Returns 'busted' | 'wasted' | null.
   */
  function step(dt, input) {
    elapsed += dt;
    gunshot = null;
    player.attacking = false;
    if (crashSoundTimer > 0) crashSoundTimer -= dt;

    // --- Player ---
    if (player.hurtCooldown > 0) player.hurtCooldown -= dt;
    if (player.inCar) {
      nearCar = null;
      const car = player.inCar;
      driveCar(car, dt, input.throttle, input.steer, input.handbrake);
      player.x = car.x; player.y = car.y;
      player.angle = car.angle;
      if (input.enterPressed) { exitCar(player, city); audio.playClick(); }
    } else {
      stepOnFoot(player, dt, input.moveX, input.moveY, input.run, city);
      nearCar = nearestEnterableCar(player, [...traffic.cars, ...police.cars], 70);
      if (input.enterPressed && nearCar) stealCar(nearCar);
      if (input.attackPressed) {
        const targets = [...traffic.peds, ...police.officers];
        const victim = punch(player, targets);
        if (victim) {
          audio.playPunch();
          spawnParticles(player.x + Math.cos(player.angle) * 24, player.y + Math.sin(player.angle) * 24, '#ffe66d', 6, 160);
          if (traffic.peds.includes(victim)) {
            const idx = traffic.peds.indexOf(victim);
            if (idx >= 0) { traffic.peds.splice(idx, 1); traffic.spawnPed(); }
            commitCrime(1);
          }
        } else audio.playPunch();
      }
      if (input.shootHeld && player.hasPistol) {
        const b = shoot(player, input.aimX, input.aimY, bullets);
        if (b) {
          audio.playShot();
          gunshot = { x: player.x, y: player.y };
          // Gunfire draws the law, but one crime per burst, not per bullet.
          if (elapsed - lastShotCrime > 4) { lastShotCrime = elapsed; commitCrime(1); }
        }
      }
    }
    if (player.punchTimer > 0) player.punchTimer -= dt;

    // --- World life ---
    traffic.step(dt, player, player.inCar, gunshot);
    const policeResult = police.step(dt, elapsed, player, player.inCar, traffic.cars);
    updateCarCollisions(dt);
    updateBullets(dt);
    updatePickups();

    // Particles.
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.96; p.vy *= 0.96;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }

    // Siren ambience while wanted.
    if (police.stars > 0) {
      sirenTimer -= dt;
      if (sirenTimer <= 0) { sirenTimer = 2.6; audio.playSiren(); }
    }

    // --- Missions ---
    const game = api;
    missions.step(dt, game);
    missions.stepFare(dt, game);
    if (!missions.active && !missions.allDone) {
      missionDelay -= dt;
      if (missionDelay <= 0) {
        if (missions.start()) {
          const def = missions.currentDef();
          if (def && def.id === 3) {
            police.stars = 2;
            missions.showToast('The cops are onto you — lose them!', 3);
          }
        }
        missionDelay = 3;
      }
    }
    // Free-roam fares when no mission is running.
    if (!missions.active) {
      fareTimer -= dt;
      if (fareTimer <= 0) { missions.offerFare(game); fareTimer = 55; }
    }

    if (player.health <= 0) { player.health = 0; return 'wasted'; }
    if (policeResult.busted) return 'busted';
    return null;
  }

  const api = {
    city, traffic, police, missions, player, bullets, particles, audio, random,
    get elapsed() { return elapsed; },
    get best() { return best; },
    set best(v) { best = v; },
    get saveExists() { return saveExists; },
    get nearCar() { return nearCar; },
    get cityAvenues() { return AVENUES; },
    get cityStreets() { return STREETS; },
    reset, save, load, step, missionTarget, randomPed, randomPlace,
    spawnParticles,
  };
  load();
  reset();
  return api;
}

export { STEP };
