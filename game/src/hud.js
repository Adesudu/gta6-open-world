// The HUD: health, cash, score, wanted stars, mission objective, and
// the live minimap — drawn on the main canvas, in screen space.
import { PALETTE, VIEW, WORLD } from './config.js';

const MAP_W = 200;
const MAP_H = 150;
const MAP_X = VIEW.width - MAP_W - 16;
const MAP_Y = VIEW.height - MAP_H - 16;

export function createHud() {
  function star(x, y, r, filled, ctx) {
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const ang = -Math.PI / 2 + (i * Math.PI) / 5;
      const rad = i % 2 === 0 ? r : r * 0.45;
      const px = x + Math.cos(ang) * rad, py = y + Math.sin(ang) * rad;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = filled ? '#ffd23e' : 'rgba(255,255,255,0.25)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function panel(ctx, x, y, w, h) {
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  function drawHud(ctx, game) {
    const player = game.player;
    const police = game.police;
    const missions = game.missions;
    ctx.textBaseline = 'top';

    // Top-left: health bar, cash, score.
    panel(ctx, 16, 14, 250, 86);
    ctx.fillStyle = '#f5f1e6';
    ctx.font = 'bold 20px ' + '"Trebuchet MS", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('MARLO CRUZ', 28, 22);
    ctx.fillStyle = '#222';
    ctx.fillRect(28, 50, 160, 14);
    ctx.fillStyle = player.health > 30 ? '#37d67a' : '#ff3b30';
    ctx.fillRect(28, 50, Math.max(0, 160 * player.health / 100), 14);
    ctx.fillStyle = '#f5f1e6';
    ctx.font = '16px "Trebuchet MS", sans-serif';
    ctx.fillText('HP ' + Math.max(0, Math.ceil(player.health)), 194, 48);
    ctx.fillStyle = '#37d67a';
    ctx.font = 'bold 20px "Trebuchet MS", sans-serif';
    ctx.fillText('$' + player.cash, 28, 70);
    ctx.fillStyle = '#c9c2ae';
    ctx.font = '14px "Trebuchet MS", sans-serif';
    ctx.fillText('Score ' + player.score + (player.hasPistol ? '   🔫 ' + player.ammo : ''), 130, 74);

    // Top-right: wanted stars (label on top, stars in a row beneath).
    panel(ctx, VIEW.width - 16 - 220, 14, 220, 62);
    ctx.fillStyle = '#f5f1e6';
    ctx.font = 'bold 15px "Trebuchet MS", sans-serif';
    ctx.fillText('WANTED', VIEW.width - 224, 22);
    for (let i = 0; i < 5; i += 1) star(VIEW.width - 214 + i * 34, 54, 12, i < police.stars, ctx);

    // Top-centre: mission objective.
    const def = missions.currentDef();
    const step = missions.currentStep();
    if (missions.active && def && step) {
      const text = def.title + ': ' + step.text;
      ctx.font = 'bold 17px "Trebuchet MS", sans-serif';
      const w = Math.min(620, ctx.measureText(text).width + 36);
      panel(ctx, (VIEW.width - w) / 2, 14, w, 52);
      ctx.fillStyle = '#ffd23e';
      ctx.textAlign = 'center';
      ctx.fillText(text, VIEW.width / 2, 24);
      ctx.fillStyle = '#f5f1e6';
      ctx.font = '14px "Trebuchet MS", sans-serif';
      const sub = missions.timeLeft !== null ? 'Time left: ' + Math.ceil(missions.timeLeft) + 's' : 'Reward $' + def.reward;
      ctx.fillText(sub, VIEW.width / 2, 46);
      ctx.textAlign = 'left';
    } else if (missions.allDone) {
      ctx.font = 'bold 16px "Trebuchet MS", sans-serif';
      ctx.fillStyle = '#ffd23e';
      ctx.textAlign = 'center';
      ctx.fillText('All missions complete — free roam! Take a taxi fare for cash.', VIEW.width / 2, 24);
      ctx.textAlign = 'left';
    }

    // Toast message.
    if (missions.toastTimer > 0) {
      ctx.font = 'bold 18px "Trebuchet MS", sans-serif';
      const w = Math.min(760, ctx.measureText(missions.toast).width + 40);
      panel(ctx, (VIEW.width - w) / 2, 78, w, 40);
      ctx.fillStyle = '#f5f1e6';
      ctx.textAlign = 'center';
      ctx.fillText(missions.toast, VIEW.width / 2, 88);
      ctx.textAlign = 'left';
    }

    // Bottom-left: context prompt (enter car / fare / controls).
    let prompt = '';
    if (game.nearCar) prompt = 'Press E to steal the ' + game.nearCar.name;
    else if (game.missions.fare.active && game.missions.fare.phase === 'pickup') prompt = 'Drive to the yellow marker to pick up the fare';
    else if (player.inCar) prompt = 'WASD drive · Space handbrake · E exit car · P pause · M mute';
    else prompt = 'WASD walk · Shift run · E enter car · F punch / click shoot · P pause · M mute';
    ctx.font = '15px "Trebuchet MS", sans-serif';
    ctx.fillStyle = '#f5f1e6';
    ctx.fillText(prompt, 20, VIEW.height - 26);

    drawMinimap(ctx, game);
  }

  function drawMinimap(ctx, game) {
    const sx = MAP_W / WORLD.width;
    const sy = MAP_H / WORLD.height;
    panel(ctx, MAP_X, MAP_Y, MAP_W, MAP_H);
    ctx.save();
    ctx.beginPath();
    ctx.rect(MAP_X, MAP_Y, MAP_W, MAP_H);
    ctx.clip();
    // Water at the bottom.
    ctx.fillStyle = '#2f7fb8';
    ctx.fillRect(MAP_X, MAP_Y + MAP_H * (3300 / WORLD.height), MAP_W, MAP_H);
    // Roads.
    ctx.strokeStyle = '#5a6068';
    ctx.lineWidth = 3;
    for (const ax of game.cityAvenues) {
      ctx.beginPath(); ctx.moveTo(MAP_X + ax * sx, MAP_Y); ctx.lineTo(MAP_X + ax * sx, MAP_Y + MAP_H); ctx.stroke();
    }
    for (const sy2 of game.cityStreets) {
      ctx.beginPath(); ctx.moveTo(MAP_X, MAP_Y + sy2 * sy); ctx.lineTo(MAP_X + MAP_W, MAP_Y + sy2 * sy); ctx.stroke();
    }
    // Mission / fare marker.
    const target = game.missionTarget();
    if (target) {
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath(); ctx.arc(MAP_X + target.x * sx, MAP_Y + target.y * sy, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
    }
    // Traffic cars, police, peds.
    ctx.fillStyle = '#e8e4d8';
    for (const car of game.traffic.cars) ctx.fillRect(MAP_X + car.x * sx - 1.5, MAP_Y + car.y * sy - 1.5, 3, 3);
    ctx.fillStyle = '#2b6fd6';
    for (const car of game.police.cars) {
      ctx.beginPath(); ctx.arc(MAP_X + car.x * sx, MAP_Y + car.y * sy, 4, 0, Math.PI * 2); ctx.fill();
    }
    // Player.
    const px = game.player.inCar ? game.player.inCar.x : game.player.x;
    const py = game.player.inCar ? game.player.inCar.y : game.player.y;
    ctx.fillStyle = '#ff5a3c';
    ctx.beginPath(); ctx.arc(MAP_X + px * sx, MAP_Y + py * sy, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#c9c2ae';
    ctx.font = '12px "Trebuchet MS", sans-serif';
    ctx.fillText('PALMERA BAY', MAP_X + 6, MAP_Y + 4);
  }

  return { drawHud, drawMinimap };
}
