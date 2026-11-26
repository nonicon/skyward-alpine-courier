// The HUD and the screens: lit instruments, a compass strip, an artificial
// horizon, a minimap, and the title, briefing, pause and end overlays.
// All text is English; the HUD is the pilot's view of the flight model.

import { WORLD, MISSIONS } from './config.js';
import { clamp } from './random.js';

function headingDeg(yaw) {
  return (((180 - (yaw * 180) / Math.PI) % 360) + 360) % 360;
}

function fmt(n) {
  return Math.round(n).toLocaleString('en-US');
}

export function createHud() {
  const $ = (id) => document.getElementById(id);
  const els = {
    hud: $('hud'),
    alt: $('alt'),
    spd: $('spd'),
    hdg: $('hdg'),
    vspeed: $('vspeed'),
    compass: $('compass'),
    horizon: $('horizon'),
    throttleFill: $('throttle-fill'),
    throttleVal: $('throttle-val'),
    fuelFill: $('fuel-fill'),
    hullFill: $('hull-fill'),
    score: $('score'),
    missionName: $('mission-name'),
    objective: $('objective'),
    timer: $('timer'),
    minimap: $('minimap'),
    target: $('target'),
    toast: $('toast'),
    banner: $('banner'),
    title: $('screen-title'),
    brief: $('screen-brief'),
    pause: $('screen-pause'),
    end: $('screen-end'),
  };
  const compassCtx = els.compass.getContext('2d');
  const horizonCtx = els.horizon.getContext('2d');
  const mapCtx = els.minimap.getContext('2d');
  let toastTimer = null;
  let bannerTimer = null;

  function drawCompass(heading) {
    const w = els.compass.width;
    const h = els.compass.height;
    compassCtx.clearRect(0, 0, w, h);
    compassCtx.fillStyle = 'rgba(8, 18, 28, 0.72)';
    compassCtx.fillRect(0, 0, w, h);
    compassCtx.strokeStyle = '#9fd4e8';
    compassCtx.fillStyle = '#eaf6ff';
    compassCtx.font = 'bold 13px system-ui, sans-serif';
    compassCtx.textAlign = 'center';
    const pxPerDeg = 3;
    const centre = w / 2;
    for (let d = -60; d <= 60; d += 5) {
      const deg = Math.round(((heading + d) % 360 + 360) % 360);
      const x = centre + d * pxPerDeg;
      const major = deg % 30 === 0;
      compassCtx.beginPath();
      compassCtx.moveTo(x, major ? 8 : 16);
      compassCtx.lineTo(x, 26);
      compassCtx.stroke();
      if (major) {
        const label = deg === 0 ? 'N' : deg === 90 ? 'E' : deg === 180 ? 'S' : deg === 270 ? 'W' : String(deg);
        compassCtx.fillText(label, x, 42);
      }
    }
    // Centre lubber line.
    compassCtx.fillStyle = '#ffb020';
    compassCtx.beginPath();
    compassCtx.moveTo(centre - 6, 0);
    compassCtx.lineTo(centre + 6, 0);
    compassCtx.lineTo(centre, 8);
    compassCtx.closePath();
    compassCtx.fill();
  }

  function drawHorizon(pitch, roll) {
    const w = els.horizon.width;
    const h = els.horizon.height;
    const ctx = horizonCtx;
    ctx.save();
    ctx.clearRect(0, 0, w, h);
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(-roll);
    const offset = clamp(pitch, -0.6, 0.6) * h * 0.9;
    ctx.fillStyle = '#3f8fd2';
    ctx.fillRect(-w, -h + offset, w * 2, h);
    ctx.fillStyle = '#7a5a34';
    ctx.fillRect(-w, offset, w * 2, h);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-w, offset);
    ctx.lineTo(w, offset);
    ctx.stroke();
    ctx.restore();
    // Fixed aircraft symbol.
    ctx.strokeStyle = '#ffb020';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 22, h / 2);
    ctx.lineTo(w / 2 - 6, h / 2);
    ctx.moveTo(w / 2 + 6, h / 2);
    ctx.lineTo(w / 2 + 22, h / 2);
    ctx.moveTo(w / 2, h / 2 - 4);
    ctx.lineTo(w / 2, h / 2 + 4);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(234, 246, 255, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawMinimap(flight, mission) {
    const w = els.minimap.width;
    const h = els.minimap.height;
    const ctx = mapCtx;
    const scale = w / WORLD.size;
    const toMap = (x, z) => [w / 2 + x * scale, h / 2 + z * scale];
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(8, 20, 30, 0.72)';
    ctx.fillRect(0, 0, w, h);
    // Lake.
    ctx.fillStyle = '#2e6f9e';
    ctx.beginPath();
    const [lx, ly] = toMap(-620, -480);
    ctx.arc(lx, ly, 300 * scale, 0, Math.PI * 2);
    ctx.fill();
    // Runway.
    ctx.fillStyle = '#c8cdd2';
    const [rx, ry] = toMap(WORLD.airfield.x, WORLD.airfield.z);
    ctx.fillRect(rx - 2, ry - (WORLD.runway.length / 2) * scale, 4, WORLD.runway.length * scale);
    // Rings.
    if (mission && mission.active) {
      for (const ring of mission.active.rings) {
        const [x, y] = toMap(ring.def.x, ring.def.z);
        ctx.fillStyle = ring.passed ? '#2ecc71' : '#ffb020';
        ctx.beginPath();
        ctx.arc(x, y, ring.passed ? 3 : 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Aircraft triangle, pointing along its heading.
    const [px, py] = toMap(flight.position.x, flight.position.z);
    const heading = headingDeg(flight.yaw);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate((heading * Math.PI) / 180);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function showOnly(name) {
    for (const key of ['title', 'brief', 'pause', 'end']) {
      els[key].classList.toggle('hidden', key !== name);
    }
    // Any overlay screen hides the flight HUD; only open sky shows it.
    els.hud.classList.toggle('hidden', name !== null);
  }

  function toast(text) {
    els.toast.textContent = text;
    els.toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.add('hidden'), 2600);
  }

  function banner(text, ms = 2200) {
    els.banner.textContent = text;
    els.banner.classList.remove('hidden');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => els.banner.classList.add('hidden'), ms);
  }

  function showTitle(onSelect) {
    showOnly('title');
    const list = $('mission-list');
    list.innerHTML = '';
    MISSIONS.forEach((m, i) => {
      const btn = document.createElement('button');
      btn.className = 'mission-btn';
      btn.innerHTML = `<strong>${i + 1}. ${m.name}</strong><span>${m.rings.length} rings · wind ${m.wind} m/s · fuel ${m.fuel}%</span>`;
      btn.addEventListener('click', () => onSelect(i));
      list.appendChild(btn);
    });
  }

  function showBriefing(mission, onStart) {
    showOnly('brief');
    $('brief-name').textContent = mission.name;
    $('brief-text').textContent = mission.briefing;
    $('brief-rings').textContent = `${mission.rings.length} rings, then land at Alderfield`;
    const btn = $('brief-start');
    btn.onclick = onStart;
    btn.focus();
  }

  function showPause(onResume, onQuit) {
    showOnly('pause');
    $('pause-resume').onclick = onResume;
    $('pause-quit').onclick = onQuit;
  }

  function showEnd(result, onAgain, onMenu) {
    showOnly('end');
    $('end-title').textContent = result.title;
    $('end-text').textContent = result.text;
    $('end-score').textContent = `Score ${fmt(result.score)}`;
    $('end-again').onclick = onAgain;
    $('end-menu').onclick = onMenu;
  }

  function update(flight, mission, elapsed) {
    els.alt.textContent = fmt(Math.max(0, (flight.position.y - 1.6) * 3.28));
    els.spd.textContent = fmt(flight.speed * 1.94);
    const heading = headingDeg(flight.yaw);
    els.hdg.textContent = String(Math.round(heading)).padStart(3, '0');
    const vs = flight.verticalSpeed * 3.28 * 60;
    els.vspeed.textContent = `${vs >= 0 ? '+' : ''}${fmt(vs)} fpm`;
    drawCompass(heading);
    drawHorizon(flight.pitch, flight.roll);
    els.throttleFill.style.width = `${Math.round(flight.throttle * 100)}%`;
    els.throttleVal.textContent = `${Math.round(flight.throttle * 100)}%`;
    const fuelPct = clamp((flight.fuel / 100) * 100, 0, 100);
    els.fuelFill.style.width = `${fuelPct}%`;
    els.fuelFill.classList.toggle('low', fuelPct < 25);
    els.hullFill.style.width = `${clamp(flight.hull, 0, 100)}%`;
    els.hullFill.classList.toggle('low', flight.hull < 35);
    if (mission && mission.active) {
      els.score.textContent = fmt(mission.active.score);
      els.missionName.textContent = mission.active.mission.name;
      const left = mission.ringsLeft();
      els.objective.textContent = left > 0
        ? `Fly through ring ${mission.active.rings.length - left + 1} of ${mission.active.rings.length}`
        : 'All rings clear — land on the runway';
    }
    const mins = Math.floor(elapsed / 60);
    const secs = Math.floor(elapsed % 60);
    els.timer.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    drawMinimap(flight, mission);
    // Target indicator: bearing and distance to the next ring.
    const ring = mission ? mission.nextRing() : null;
    if (ring && !flight.landed && !flight.crashed) {
      const dx = ring.def.x - flight.position.x;
      const dz = ring.def.z - flight.position.z;
      const dist = Math.hypot(dx, dz);
      const bearing = headingDeg(Math.atan2(dx, dz));
      let rel = ((bearing - heading + 540) % 360) - 180;
      const arrow = rel > 25 ? '⟶' : rel < -25 ? '⟵' : '⟶';
      els.target.textContent = `${arrow} RING ${mission.active.index + 1} · ${fmt(dist)} m`;
      els.target.classList.remove('hidden');
    } else {
      els.target.classList.add('hidden');
    }
    // Warnings.
    if (flight.speed < 26 && flight.airborne && !flight.crashed) {
      banner('STALL — NOSE DOWN, ADD THROTTLE', 600);
    } else if (flight.fuel < 20 && flight.fuel > 0) {
      banner('LOW FUEL', 600);
    }
  }

  return {
    showTitle,
    showBriefing,
    showPause,
    showEnd,
    showOnly,
    update,
    toast,
    banner,
    setHudVisible(v) {
      els.hud.classList.toggle('hidden', !v);
    },
  };
}
