// Drawing only: the city, the cars, the people, the effects and the
// menu screens. The camera follows the player; the world is drawn in
// world coordinates, the HUD in screen coordinates (see hud.js).
import { AVENUES, CAR, FONT, PALETTE, ROAD_W, STREETS, VIEW, WORLD } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_BUSTED = 'busted';

export function createRenderer(canvas, hud) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const camera = { x: 0, y: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, bold) {
    const key = size + (bold ? 'b' : '');
    if (!fonts.has(key)) fonts.set(key, (bold ? 'bold ' : '') + size + 'px ' + FONT);
    ctx.font = fonts.get(key);
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.fillText(value, x, y);
  }

  function drawCity(city, cam) {
    // Ground.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(cam.x - 40, cam.y - 40, VIEW.width + 80, VIEW.height + 80);
    // Bay and beach along the south edge.
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(cam.x - 40, WORLD.bayY - 70, VIEW.width + 80, 70);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(cam.x - 40, WORLD.bayY, VIEW.width + 80, VIEW.height + 80);
    ctx.fillStyle = PALETTE.waterDeep;
    for (let i = 0; i < 12; i += 1) {
      const wx = ((i * 397) % WORLD.width);
      const wy = WORLD.bayY + 30 + ((i * 173) % 200);
      if (wx < cam.x - 60 || wx > cam.x + VIEW.width + 60 || wy < cam.y - 60 || wy > cam.y + VIEW.height + 60) continue;
      ctx.beginPath();
      ctx.ellipse(wx, wy, 40, 8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Parks.
    for (const park of city.parks) {
      ctx.fillStyle = PALETTE.park;
      ctx.fillRect(park.x, park.y, park.w, park.h);
      ctx.fillStyle = '#4e8a3a';
      for (let i = 0; i < park.trees; i += 1) {
        const tx = park.x + 30 + ((i * 97) % Math.max(1, park.w - 60));
        const ty = park.y + 30 + ((i * 61) % Math.max(1, park.h - 60));
        ctx.beginPath(); ctx.arc(tx, ty, 12, 0, Math.PI * 2); ctx.fill();
      }
    }
    // Sidewalks (the block edges) and roads.
    ctx.fillStyle = PALETTE.sidewalk;
    for (let bx = 0; bx < AVENUES.length - 1; bx += 1) {
      for (let by = 0; by < STREETS.length - 1; by += 1) {
        const x0 = AVENUES[bx] + ROAD_W / 2;
        const y0 = STREETS[by] + ROAD_W / 2;
        const x1 = AVENUES[bx + 1] - ROAD_W / 2;
        const y1 = STREETS[by + 1] - ROAD_W / 2;
        if (y0 > WORLD.bayY - 120) continue;
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      }
    }
    ctx.fillStyle = PALETTE.road;
    for (const ax of AVENUES) ctx.fillRect(ax - ROAD_W / 2, 0, ROAD_W, WORLD.bayY);
    for (const sy of STREETS) ctx.fillRect(0, sy - ROAD_W / 2, WORLD.width, ROAD_W);
    // Lane dashes.
    ctx.fillStyle = PALETTE.lane;
    for (const ax of AVENUES) {
      for (let y = 60; y < WORLD.bayY; y += 90) ctx.fillRect(ax - 2, y, 4, 44);
    }
    for (const sy of STREETS) {
      for (let x = 60; x < WORLD.width; x += 90) ctx.fillRect(x, sy - 2, 44, 4);
    }
    // Buildings with roofs, windows and a drop shadow.
    for (const b of city.buildings) {
      if (b.x > cam.x + VIEW.width + 80 || b.x + b.w < cam.x - 80 || b.y > cam.y + VIEW.height + 80 || b.y + b.h < cam.y - 80) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = PALETTE.roof;
      ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, Math.min(26, b.h - 16));
      ctx.fillStyle = PALETTE.glass;
      const cols = Math.max(1, Math.floor(b.w / 72));
      const rows = Math.max(1, Math.floor(b.h / 84));
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          ctx.fillRect(b.x + 18 + cx * 72, b.y + 46 + cy * 84, 20, 14);
        }
      }
    }
    // Place labels.
    ctx.textBaseline = 'alphabetic';
    for (const key of Object.keys(city.places)) {
      const p = city.places[key];
      text(p.name.toUpperCase(), p.x, p.y - 100, 15, 'rgba(245,241,230,0.85)', 'center', true);
    }
  }

  function drawCar(car) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-CAR.length / 2 + 3, -CAR.width / 2 + 4, CAR.length, CAR.width);
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.roundRect(-CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 8);
    ctx.fill();
    ctx.fillStyle = 'rgba(20,30,40,0.85)';
    ctx.fillRect(-6, -CAR.width / 2 + 3, 16, CAR.width - 6);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(CAR.length / 2 - 10, -CAR.width / 2 + 4, 4, CAR.width - 8);
    if (car.kind === 'police') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(-CAR.length / 2 + 4, -CAR.width / 2 + 3, CAR.length - 8, 7);
      ctx.fillStyle = '#ff3b30';
      ctx.fillRect(-4, -CAR.width / 2 - 2, 8, 5);
      ctx.fillStyle = '#2b6fd6';
      ctx.fillRect(-4, CAR.width / 2 - 3, 8, 5);
    }
    if (car.damage > 40) {
      ctx.fillStyle = 'rgba(60,60,60,0.7)';
      ctx.beginPath(); ctx.arc(-CAR.length / 2 + 6, 0, 7, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    // Smoke from a wrecked car.
    if (car.smoke > 0.2) {
      ctx.fillStyle = 'rgba(120,120,120,0.5)';
      ctx.beginPath(); ctx.arc(car.x - Math.cos(car.angle) * 20, car.y - Math.sin(car.angle) * 20, 6 + car.smoke * 6, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawPerson(x, y, angle, color, radius, isPlayer) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(x + 2, y + 3, radius, radius * 0.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.stroke();
    // Facing tick.
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * (radius + 5), y + Math.sin(angle) * (radius + 5));
    ctx.stroke();
    if (isPlayer) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('YOU', x, y - radius - 6);
    }
  }

  function drawPickups(city) {
    for (const p of city.pickups) {
      if (p.taken) continue;
      const bob = Math.sin(Date.now() / 300 + p.x) * 2;
      if (p.kind === 'cash') {
        ctx.fillStyle = PALETTE.cash;
        ctx.fillRect(p.x - 10, p.y - 6 + bob, 20, 12);
        ctx.fillStyle = '#0c2b18';
        ctx.font = 'bold 11px ' + FONT;
        ctx.textAlign = 'center';
        ctx.fillText('$', p.x, p.y + 3 + bob);
      } else if (p.kind === 'health') {
        ctx.fillStyle = PALETTE.health;
        ctx.fillRect(p.x - 10, p.y - 10 + bob, 20, 20);
        ctx.fillStyle = '#fff';
        ctx.fillRect(p.x - 2, p.y - 7 + bob, 4, 14);
        ctx.fillRect(p.x - 7, p.y - 2 + bob, 14, 4);
      } else {
        ctx.fillStyle = '#ffd23e';
        ctx.beginPath(); ctx.arc(p.x, p.y + bob, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#333';
        ctx.font = 'bold 10px ' + FONT;
        ctx.textAlign = 'center';
        ctx.fillText('AMMO', p.x, p.y + 3 + bob);
      }
    }
  }

  function drawMarker(x, y, color, label) {
    const pulse = 1 + Math.sin(Date.now() / 250) * 0.15;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(pulse, pulse);
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(-10, -8); ctx.lineTo(10, -8); ctx.closePath(); ctx.fill();
    ctx.restore();
    if (label) text(label, x, y - 46, 15, color, 'center', true);
  }

  function drawBullets(bullets) {
    ctx.fillStyle = '#ffe66d';
    for (const b of bullets) {
      ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawParticles(particles) {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 640;
    const height = 150 + lines.length * 34 + 60;
    const x = (VIEW.width - width) / 2;
    const y = (VIEW.height - height) / 2;
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = accent || '#ffd23e';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, width - 2, height - 2);
    ctx.textBaseline = 'alphabetic';
    text(title, VIEW.width / 2, y + 72, 46, '#f5f1e6', 'center', true);
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], VIEW.width / 2, y + 128 + i * 34, 20, '#c9c2ae', 'center');
    }
    text(prompt, VIEW.width / 2, y + height - 30, 22, '#ffd23e', 'center', true);
  }

  /** Paint one frame. `game` carries the whole state; `screen` selects the overlay. */
  function draw(game, screen) {
    const player = game.player;
    const focusX = player.inCar ? player.inCar.x : player.x;
    const focusY = player.inCar ? player.inCar.y : player.y;
    camera.x = Math.max(0, Math.min(WORLD.width - VIEW.width, focusX - VIEW.width / 2));
    camera.y = Math.max(0, Math.min(WORLD.height - VIEW.height, focusY - VIEW.height / 2));

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0e1420';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    drawCity(game.city, camera);
    drawPickups(game.city);
    // Mission package on the ground.
    if (game.missions.packageOnGround) {
      drawMarker(game.missions.packageOnGround.x, game.missions.packageOnGround.y, '#ffd23e', 'PACKAGE');
    }
    // Mission / fare target marker.
    const target = game.missionTarget();
    if (target) drawMarker(target.x, target.y, target.color || '#ffd23e', target.label);
    // Traffic, police, peds.
    for (const car of game.traffic.cars) drawCar(car);
    for (const car of game.police.cars) drawCar(car);
    for (const ped of game.traffic.peds) {
      drawPerson(ped.x, ped.y, ped.angle, ped.color, 10, false);
    }
    for (const officer of game.police.officers) {
      drawPerson(officer.x, officer.y, officer.angle, '#2b4a7a', 12, false);
      text('POLICE', officer.x, officer.y - 18, 10, '#bcd6ff', 'center', true);
    }
    drawBullets(game.bullets);
    // The player (or their car) last, on top.
    if (player.inCar) drawCar(player.inCar);
    else if (player.health > 0) {
      const blink = player.invulnerable > 0 && Math.floor(player.invulnerable * 10) % 2 === 0;
      if (!blink) drawPerson(player.x, player.y, player.angle, PALETTE.player, 13, true);
    }
    drawParticles(game.particles);
    ctx.restore();

    // Screen-space overlays.
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) hud.drawHud(ctx, game);
    if (screen === SCREEN_TITLE) {
      drawPanel('PALMERA BAY', [
        'An open-world crime game — explore the city on foot or by car.',
        'Steal cars, run missions for Lena Ortiz, dodge the police.',
        'WASD / arrows move & drive · Space handbrake · E enter car',
        'F punch · click to shoot · P pause · M mute',
        'Missions done: ' + game.missions.completed + ' / 5    Best score: ' + game.best,
      ], game.saveExists ? 'Press Enter to continue — or start a new story' : 'Press Enter to start the story', '#ffd23e');
      text('A sun-soaked city of your own. No real place, no real gang.', VIEW.width / 2, VIEW.height - 46, 15, '#c9c2ae', 'center');
    } else if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The city waits for you.', 'Cash $' + player.cash + ' · Score ' + player.score + ' · Missions ' + game.missions.completed + '/5'], 'Press P or Enter to resume', '#7fc4d8');
    } else if (screen === SCREEN_OVER) {
      drawPanel('WASTED', ['Marlo went down in Palmera Bay.', 'Score ' + player.score + ' · Cash $' + player.cash + ' · Best ' + game.best], 'Press Enter to try again', '#ff3b30');
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('BUSTED', ['The Palmera Bay police finally caught up with Marlo.', 'Score ' + player.score + ' · Cash $' + player.cash + ' · Best ' + game.best], 'Press Enter to try again', '#2b6fd6');
    }
  }

  resize();
  window.addEventListener('resize', resize);

  /** Mouse position in CSS pixels -> world coordinates (for aiming). */
  function screenToWorld(cssX, cssY) {
    const ratio = window.devicePixelRatio || 1;
    const logicalX = (cssX * ratio - view.x) / view.scale + camera.x;
    const logicalY = (cssY * ratio - view.y) / view.scale + camera.y;
    return { x: logicalX, y: logicalY };
  }

  return { draw, view, camera, screenToWorld };
}
