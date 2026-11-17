// Drawing only: a small hand-rolled 3D renderer on a 2D canvas. Every box in
// the city (buildings, cars, people, the pier) is projected with a perspective
// camera, its faces shaded by the sun and painted far-to-near, with windows
// drawn on the near walls. No library, no images: the whole look is code.

import { CITY_EDGE, PALETTE, ROAD_LINES, ROAD_WIDTH } from './config.js';
import { angleLerp, clamp, lerp } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const SUN = { x: 0.45, y: 0.75, z: 0.35 };

function shade(hex, factor) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(Math.round(((n >> 16) & 255) * factor), 0, 255);
  const g = clamp(Math.round(((n >> 8) & 255) * factor), 0, 255);
  const b = clamp(Math.round((n & 255) * factor), 0, 255);
  return `rgb(${r},${g},${b})`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let W = 0;
  let H = 0;
  let focal = 600;
  // Smoothed camera that chases the player instead of snapping to them.
  const cam = { x: 0, y: 6, z: -14, yaw: 0 };
  let orbit = 0;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    W = Math.round(window.innerWidth * ratio);
    H = Math.round(window.innerHeight * ratio);
    canvas.width = W;
    canvas.height = H;
    focal = H * 0.85;
  }
  resize();
  window.addEventListener('resize', resize);

  // Project a world point into screen space. Null when behind the camera.
  function project(x, y, z) {
    const dx = x - cam.x;
    const dy = y - cam.y;
    const dz = z - cam.z;
    const cos = Math.cos(cam.yaw);
    const sin = Math.sin(cam.yaw);
    const cx = dx * cos - dz * sin;
    let cy = dy;
    let cz = dx * sin + dz * cos;
    // Pitch the camera down a little so the street fills the frame.
    const pitch = 0.18;
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const y2 = cy * cp - cz * sp;
    const z2 = cy * sp + cz * cp;
    if (z2 < 0.4) return null;
    return {
      x: W / 2 + (cx / z2) * focal,
      y: H * 0.52 - (y2 / z2) * focal,
      depth: z2,
    };
  }

  function quad(points, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    ctx.fill();
  }

  // A flat quad on the ground plane (y = 0.05), drawn before the boxes.
  function groundQuad(x0, z0, x1, z1, fill) {
    const p = [project(x0, 0.05, z0), project(x1, 0.05, z0), project(x1, 0.05, z1), project(x0, 0.05, z1)];
    if (p.some((q) => q === null)) return;
    quad(p, fill);
  }

  // Collect one box's faces into `faces`. heading rotates it around Y.
  function addBox(faces, cx, cy, cz, w, h, d, heading, topColor, sideColor, windows) {
    const hw = w / 2;
    const hh = h / 2;
    const hd = d / 2;
    const cos = Math.cos(heading);
    const sin = Math.sin(heading);
    const local = [
      [-hw, -hh, -hd], [hw, -hh, -hd], [hw, -hh, hd], [-hw, -hh, hd],
      [-hw, hh, -hd], [hw, hh, -hd], [hw, hh, hd], [-hw, hh, hd],
    ];
    const world = local.map(([lx, ly, lz]) => ({
      x: cx + lx * cos + lz * sin,
      y: cy + ly,
      z: cz - lx * sin + lz * cos,
    }));
    const faceDefs = [
      { idx: [4, 5, 6, 7], normal: [0, 1, 0], color: topColor, kind: 'top' },
      { idx: [3, 2, 6, 7], normal: [0, 0, 1], color: sideColor, kind: 'wall' },
      { idx: [1, 0, 4, 5], normal: [0, 0, -1], color: sideColor, kind: 'wall' },
      { idx: [2, 1, 5, 6], normal: [1, 0, 0], color: sideColor, kind: 'wall' },
      { idx: [0, 3, 7, 4], normal: [-1, 0, 0], color: sideColor, kind: 'wall' },
    ];
    for (const def of faceDefs) {
      const pts = def.idx.map((i) => world[i]);
      // World-space normal for sun shading.
      const [nx, ny, nz] = def.normal;
      const wnx = nx * cos + nz * sin;
      const wnz = -nx * sin + nz * cos;
      const sunDot = Math.max(0, wnx * SUN.x + ny * SUN.y + wnz * SUN.z);
      const bright = 0.62 + 0.38 * sunDot;
      let depth = 0;
      let visible = false;
      for (const p of pts) {
        const pr = project(p.x, p.y, p.z);
        if (pr) {
          depth += pr.depth;
          visible = true;
        }
      }
      if (!visible) continue;
      faces.push({ pts, fill: shade(def.color, bright), depth: depth / 4, windows: def.kind === 'wall' && windows ? { w, h } : null });
    }
  }

  function drawFaceWithWindows(face) {
    const p = face.pts.map((q) => project(q.x, q.y, q.z));
    if (p.some((q) => q === null)) return;
    quad(p, face.fill);
    if (!face.windows) return;
    const { w, h } = face.windows;
    const cols = clamp(Math.floor(w / 3.2), 1, 6);
    const rows = clamp(Math.floor(h / 3.6), 1, 7);
    if (cols * rows < 2) return;
    const a = face.pts[0];
    const b = face.pts[1];
    const c = face.pts[2];
    const d = face.pts[3];
    // Bilinear interpolation across the face for each window pane.
    for (let r = 0; r < rows; r += 1) {
      for (let col = 0; col < cols; col += 1) {
        const u0 = (col + 0.22) / cols;
        const u1 = (col + 0.78) / cols;
        const v0 = (r + 0.22) / rows;
        const v1 = (r + 0.78) / rows;
        const corner = (u, v) => {
          const top = { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), z: lerp(a.z, b.z, u) };
          const bot = { x: lerp(d.x, c.x, u), y: lerp(d.y, c.y, u), z: lerp(d.z, c.z, u) };
          return { x: lerp(top.x, bot.x, v), y: lerp(top.y, bot.y, v), z: lerp(top.z, bot.z, v) };
        };
        const wp = [corner(u0, v0), corner(u1, v0), corner(u1, v1), corner(u0, v1)].map((q) => project(q.x, q.y, q.z));
        if (wp.some((q) => q === null)) continue;
        quad(wp, 'rgba(40,70,95,0.85)');
      }
    }
  }

  function drawSky(time) {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, PALETTE.skyTop);
    grad.addColorStop(0.55, PALETTE.skyMid);
    grad.addColorStop(0.8, PALETTE.skyLow);
    grad.addColorStop(1, '#f7d9a0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    // Sun and slow clouds, screen-space.
    const sx = W * 0.78;
    const sy = H * 0.16;
    ctx.fillStyle = PALETTE.sun;
    ctx.beginPath();
    ctx.arc(sx, sy, H * 0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (let i = 0; i < 4; i += 1) {
      const cxp = ((time * 6 + i * 340) % (W + 400)) - 200;
      const cyp = H * (0.10 + i * 0.05);
      ctx.beginPath();
      ctx.ellipse(cxp, cyp, 90, 18, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawGround(world) {
    // Sea to the east, sand, then the city ground.
    groundQuad(CITY_EDGE, -420, 460, 420, PALETTE.sea);
    groundQuad(178, -420, CITY_EDGE, 420, PALETTE.sand);
    groundQuad(-420, -420, 178, 420, '#a8a294');
    // Block interiors in alternating tones, so the city reads as blocks, not desert.
    const lines = ROAD_LINES;
    for (let ix = 0; ix < lines.length - 1; ix += 1) {
      for (let iz = 0; iz < lines.length - 1; iz += 1) {
        const tone = (ix + iz) % 2 === 0 ? '#b3ab97' : '#a49c88';
        groundQuad(lines[ix] + ROAD_WIDTH / 2, lines[iz] + ROAD_WIDTH / 2, lines[ix + 1] - ROAD_WIDTH / 2, lines[iz + 1] - ROAD_WIDTH / 2, tone);
      }
    }
    for (const park of world.city.parks) {
      groundQuad(park.x - park.w / 2, park.z - park.d / 2, park.x + park.w / 2, park.z + park.d / 2, PALETTE.grass);
    }
    // Roads: dark strips along every avenue, with centre dashes.
    const rw = ROAD_WIDTH;
    for (const line of lines) {
      groundQuad(line - rw / 2, -185, line + rw / 2, 185, PALETTE.road);
      groundQuad(-185, line - rw / 2, 185, line + rw / 2, PALETTE.road);
    }
    for (const line of lines) {
      for (let s = -170; s < 170; s += 12) {
        groundQuad(line - 0.35, s, line + 0.35, s + 6, PALETTE.roadLine);
        groundQuad(s, line - 0.35, s + 6, line + 0.35, PALETTE.roadLine);
      }
    }
    // The pier deck.
    const pier = world.city.pier;
    groundQuad(pier.x0, pier.z0, pier.x1, pier.z1, '#a9805a');
  }

  function drawCar(faces, car, time) {
    const bodyY = 0.75;
    addBox(faces, car.x, bodyY, car.z, car.width, 0.85, car.length, car.heading, shade(car.color, 1.15), car.color, false);
    addBox(faces, car.x - Math.sin(car.heading) * 0.3, bodyY + 0.72, car.z - Math.cos(car.heading) * 0.3,
      car.width * 0.82, 0.7, car.length * 0.5, car.heading, PALETTE.glass, shade(car.color, 0.85), false);
    // Wheels.
    const fwdX = Math.sin(car.heading);
    const fwdZ = Math.cos(car.heading);
    const rightX = Math.cos(car.heading);
    const rightZ = -Math.sin(car.heading);
    for (const [along, side] of [[1.5, 1], [1.5, -1], [-1.5, 1], [-1.5, -1]]) {
      addBox(faces, car.x + fwdX * along + rightX * side * 0.95, 0.32, car.z + fwdZ * along + rightZ * side * 0.95,
        0.35, 0.65, 0.8, car.heading, '#1a1a1a', '#1a1a1a', false);
    }
    if (car.kind === 'cop') {
      const blink = Math.floor(time * 4) % 2 === 0;
      addBox(faces, car.x - Math.sin(car.heading) * 0.3, bodyY + 1.35, car.z - Math.cos(car.heading) * 0.3,
        0.9, 0.28, 0.5, car.heading, blink ? '#ff2d2d' : '#2d6bff', blink ? '#ff2d2d' : '#2d6bff', false);
    }
    if (car.brakeLight) {
      addBox(faces, car.x - fwdX * (car.length / 2 - 0.1), bodyY + 0.2, car.z - fwdZ * (car.length / 2 - 0.1),
        car.width * 0.9, 0.25, 0.15, car.heading, '#ff2222', '#ff2222', false);
    }
  }

  function drawPerson(faces, x, z, heading, shirt, pants, bob, down) {
    if (down) {
      addBox(faces, x, 0.35, z, 0.6, 0.7, 1.8, heading, shirt, shirt, false);
      addBox(faces, x, 0.35, z + 1.0, 0.5, 0.5, 0.5, heading, '#e8b98a', '#e8b98a', false);
      return;
    }
    const bounce = Math.abs(Math.sin(bob)) * 0.08;
    addBox(faces, x, 0.55 + bounce, z, 0.55, 0.6, 0.4, heading, pants, pants, false);
    addBox(faces, x, 1.25 + bounce, z, 0.75, 0.75, 0.45, heading, shade(shirt, 1.05), shirt, false);
    addBox(faces, x, 1.85 + bounce, z, 0.5, 0.5, 0.45, heading, '#e8b98a', '#e8b98a', false);
  }

  function drawMarker(faces, world, time) {
    const target = world.missionTarget;
    if (!target) return;
    const bob = Math.sin(time * 2.4) * 0.6;
    // Light pillar.
    const p = [project(target.x - 1.2, 0, target.z), project(target.x + 1.2, 0, target.z), project(target.x + 1.2, 26, target.z), project(target.x - 1.2, 26, target.z)];
    if (!p.some((q) => q === null)) {
      ctx.globalAlpha = 0.28;
      quad(p, '#ffd94d');
      ctx.globalAlpha = 1;
    }
    // Floating diamond.
    const d = project(target.x, 7 + bob, target.z);
    if (d) {
      const s = 26;
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath();
      ctx.moveTo(d.x, d.y - s);
      ctx.lineTo(d.x + s * 0.7, d.y);
      ctx.lineTo(d.x, d.y + s);
      ctx.lineTo(d.x - s * 0.7, d.y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#7a5b00';
      ctx.font = `bold ${Math.round(H * 0.022)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('◆', d.x, d.y + 6);
    }
  }

  function drawParticles(world) {
    for (const pt of world.particles) {
      const p = project(pt.x, pt.y, pt.z);
      if (!p) continue;
      ctx.globalAlpha = clamp(pt.life / pt.maxLife, 0, 1);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1, pt.size / Math.max(1, p.depth * 0.08)), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawPanel(title, lines, prompt) {
    const w = Math.min(W * 0.62, 760);
    const h = H * 0.12 + lines.length * H * 0.045 + H * 0.12;
    const x = (W - w) / 2;
    const y = (H - h) / 2;
    ctx.fillStyle = 'rgba(12,16,26,0.88)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#f2c14e';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f2c14e';
    ctx.font = `bold ${Math.round(H * 0.075)}px sans-serif`;
    ctx.fillText(title, W / 2, y + H * 0.1);
    ctx.fillStyle = '#f4ead8';
    ctx.font = `${Math.round(H * 0.026)}px sans-serif`;
    lines.forEach((line, i) => {
      ctx.fillText(line, W / 2, y + H * 0.17 + i * H * 0.045);
    });
    ctx.fillStyle = '#ffd94d';
    ctx.font = `bold ${Math.round(H * 0.028)}px sans-serif`;
    ctx.fillText(prompt, W / 2, y + h - H * 0.045);
  }

  // Where the camera wants to be: behind the player (or their car), a little above.
  function cameraTarget(world) {
    const player = world.state.player;
    const focus = player.inCar && player.car ? player.car : player;
    const heading = focus.heading;
    const targetYaw = heading + orbit;
    const dist = player.inCar ? 11.5 : 8;
    const height = player.inCar ? 4.6 : 3.6;
    return {
      x: focus.x - Math.sin(targetYaw) * dist,
      y: height,
      z: focus.z - Math.cos(targetYaw) * dist,
      yaw: targetYaw,
    };
  }

  /** Paint one frame of the world under the given screen. */
  function draw(world, screen, best) {
    const state = world.state;
    const player = state.player;
    // Camera: chases the target instead of snapping to it.
    const target = cameraTarget(world);
    cam.x = lerp(cam.x, target.x, 0.12);
    cam.z = lerp(cam.z, target.z, 0.12);
    cam.y = lerp(cam.y, target.y, 0.12);
    cam.yaw = angleLerp(cam.yaw, target.yaw, 0.1);

    drawSky(state.elapsed);
    drawGround(world);

    const faces = [];
    const camD = (x, z) => Math.hypot(x - cam.x, z - cam.z);
    for (const b of world.city.buildings) {
      if (camD(b.x, b.z) > 150) continue;
      const near = camD(b.x, b.z) < 48;
      addBox(faces, b.x, b.h / 2, b.z, b.w, b.h, b.d, 0, b.roof, b.wall, near);
    }
    for (const palm of world.city.palms) {
      if (camD(palm.x, palm.z) > 120) continue;
      addBox(faces, palm.x, 2.0, palm.z, 0.3, 4.0, 0.3, 0, '#7a5a33', '#7a5a33', false);
      addBox(faces, palm.x, 4.3, palm.z, 1.7, 0.5, 1.7, palm.z * 0.7, '#4fae62', '#3d8f4f', false);
    }
    for (const car of world.cars) {
      if (!car.alive || camD(car.x, car.z) > 150) continue;
      drawCar(faces, car, state.elapsed);
    }
    for (const cop of world.police.cops) {
      if (camD(cop.x, cop.z) > 150) continue;
      drawCar(faces, cop, state.elapsed);
    }
    for (const ped of world.peds) {
      if (!ped.alive || camD(ped.x, ped.z) > 120) continue;
      drawPerson(faces, ped.x, ped.z, ped.heading, ped.shirt, ped.pants, ped.walkPhase, ped.down);
    }
    for (const off of world.police.officers) {
      if (!off.alive || camD(off.x, off.z) > 120) continue;
      drawPerson(faces, off.x, off.z, off.heading, '#20242e', '#20242e', state.elapsed * 6, false);
    }
    if (!player.inCar) {
      drawPerson(faces, player.x, player.z, player.heading, '#e85d3d', '#2e3a4a', player.walkPhase, false);
    }
    // Cash pickups glinting on the street.
    for (const pk of state.pickups) {
      if (!pk.taken && camD(pk.x, pk.z) < 100) {
        addBox(faces, pk.x, 0.4 + Math.sin(state.elapsed * 3 + pk.x) * 0.15, pk.z, 0.8, 0.5, 0.5, state.elapsed, '#2fae62', '#2fae62', false);
      }
    }

    faces.sort((a, b) => b.depth - a.depth);
    for (const face of faces) drawFaceWithWindows(face);
    drawMarker(faces, world, state.elapsed);
    drawParticles(world);

    // Muzzle flash.
    if (world.combat.muzzle > 0 && !player.inCar) {
      const mx = player.x + Math.sin(player.heading) * 1.6;
      const mz = player.z + Math.cos(player.heading) * 1.6;
      const p = project(mx, 1.4, mz);
      if (p) {
        ctx.fillStyle = '#fff3c4';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 26, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Damage vignette.
    if (state.damageFlash > 0) {
      ctx.fillStyle = `rgba(200,20,20,${clamp(state.damageFlash * 0.5, 0, 0.45)})`;
      ctx.fillRect(0, 0, W, H);
    }
    // Low-health pulse.
    if (state.health < 30 && screen === SCREEN_PLAY) {
      ctx.fillStyle = `rgba(200,20,20,${0.08 + 0.06 * Math.sin(state.elapsed * 6)})`;
      ctx.fillRect(0, 0, W, H);
    }

    if (screen === SCREEN_TITLE) {
      drawPanel('SOLMAR HEAT', [
        'A sun-soaked open-world crime story in the city of Solmar.',
        'Steal cars, outrun the Solmar PD, run jobs for Rico and Mara.',
        'WASD move / drive   •   E enter car   •   Q punch   •   F shoot',
        'M start story   •   P pause   •   Your progress saves automatically',
        best > 0 ? `Best haul so far: $${best.toLocaleString('en-US')}` : 'New driver. The city is waiting.',
      ], 'Press ENTER or click to start');
    } else if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['Solmar waits for no one — except now.', 'Progress is saved.'], 'Press P to keep driving');
    } else if (screen === SCREEN_OVER) {
      drawPanel(state.overKind === 'busted' ? 'BUSTED' : 'WASTED', [
        state.overKind === 'busted' ? 'The Solmar PD finally caught up with you.' : 'Solmar got the better of you this time.',
        `You kept $${Math.round(state.cash).toLocaleString('en-US')} — the story continues.`,
      ], 'Press ENTER to get back out there');
    }
  }

  return {
    draw,
    // Put the camera exactly on its target at once: screenshot scenes only get
    // one or two frames before the shutter, so a smoothed camera never arrives.
    snap(world) {
      const target = cameraTarget(world);
      cam.x = target.x;
      cam.y = target.y;
      cam.z = target.z;
      cam.yaw = target.yaw;
    },
    setOrbit(value) {
      orbit = value;
    },
    addOrbit(delta) {
      orbit += delta;
    },
  };
}
