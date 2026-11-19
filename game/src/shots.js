// SOLMAR HEAT — shots.js
// Screenshot staging. The URL query ?shot=<name> puts the game into a
// composed scene for the four screenshots, waits until the scene has
// rendered stably, then sets window.__shotReady. The capture script
// (shoot.mjs) waits for that flag before saving the JPEG.
//
//   chase — sunset chase: Nova in her teal car on Solmar Blvd, sun low
//           ahead, three cruisers behind, wanted 3, helicopter overhead.
//   night — Nova on foot on Neon Ave at night, neon shop glows, lamp
//           halos in the foreground, a dialogue line open.
//   title — the title screen over the orbiting sunset skyline.
//   map   — the fullscreen city map with the mission marker.
//
// Staging only uses the game's own debug hooks (game.debug.*) — the same
// state any player could reach by playing.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function settle(frames = 45) {
  // Let the loop run so traffic, cops and the camera settle, then give
  // the GPU a beat before the capture.
  const start = window.__frames || 0;
  while ((window.__frames || 0) - start < frames) await sleep(50);
  await sleep(400);
}

export async function stageShot(game, name, params) {
  const dbg = game.debug;
  if (name === 'chase') {
    // Sunset, Heat Run active, Nova driving west into the low sun.
    dbg.setDay(game, 0.74);
    dbg.setMission(game, 3, 1);
    dbg.giveCar(game, 40, 0, -Math.PI / 2);
    game.playerCar.speed = 26;
    dbg.setWanted(game, 3);
    dbg.startPlaying(game);
    game.showDialog('NOVA: Three stars and a bird overhead. Hold on — we\'re taking Sunset Dr all the way home.', 'NOVA', 8);
    game.dispatchMsg('DISPATCH: All units — suspect Nova Vega, wanted level 3. Air unit overhead.');
    // Cruisers right behind the player car, in formation.
    game.cops = [
      { x: 62, z: 4, yaw: -Math.PI / 2, speed: 24, siren: 0 },
      { x: 66, z: 12, yaw: -Math.PI / 2, speed: 22, siren: 1 },
      { x: 58, z: -2, yaw: -Math.PI / 2, speed: 23, siren: 2 },
      { x: 74, z: 8, yaw: -Math.PI / 2, speed: 21, siren: 3 },
    ];
    game.heli = { x: 20, z: -6, y: 42, yaw: 0 };
    game.cameraMode = 0;
    game.camYaw = Math.PI / 2; // camera behind the westbound car
    await settle(50);
    // Re-show the line after the settle: SwiftShader renders slowly and
    // a short dialogue would expire before the capture.
    game.showDialog('NOVA: Three stars and a bird overhead. Hold on — we\'re taking Sunset Dr all the way home.', 'NOVA', 60);
  } else if (name === 'night') {
    // Neon Row at night, on foot, dialogue open, lamps in the foreground.
    dbg.setDay(game, 0.93);
    dbg.setMission(game, 1, 0);
    dbg.startPlaying(game);
    dbg.teleport(game, -80, 24);
    game.player.yaw = Math.PI * 0.85; // facing the neon shopfronts
    game.camYaw = Math.PI * 0.85 + Math.PI;
    game.showDialog('MARA: The package is at Palma Pharmacy. Don\'t open it, don\'t stop for anyone — and don\'t scratch the paint.', 'MARA', 9);
    // A few pedestrians nearby so the street reads as alive.
    for (let i = 0; i < 3; i++) {
      game.peds[i].x = -70 + i * 2;
      game.peds[i].z = 30 + (i % 2) * 6;
      game.peds[i].yaw = Math.PI / 2;
    }
    game.cameraMode = 0;
    await settle(50);
    // Closer camera and a fresh dialogue line for the capture.
    game.camDist = 8;
    game.showDialog('MARA: The package is at Palma Pharmacy. Don\'t open it, don\'t stop for anyone — and don\'t scratch the paint.', 'MARA', 60);
  } else if (name === 'title') {
    dbg.setDay(game, 0.74);
    dbg.showTitle(game);
    game.menuIndex = 0;
    await settle(60);
  } else if (name === 'map') {
    dbg.setDay(game, 0.74);
    dbg.setMission(game, 2, 0);
    dbg.startPlaying(game);
    game.state = 'map';
    await settle(20);
  } else {
    throw new Error('unknown shot: ' + name);
  }
  window.__shotReady = true;
  window.__shotName = name;
}
