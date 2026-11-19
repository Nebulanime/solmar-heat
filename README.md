# SOLMAR HEAT — A Nova Vega Story

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/Nebulanime/solmar-heat/rank.svg)](https://make.fun/c/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/Nebulanime/solmar-heat/reward.svg)](https://make.fun/c/gta6-01)

An original open-world crime game in the spirit of GTA 6, built for the
[make.fun gta6-01 bounty](https://make.fun/c/gta6-01). No Rockstar names, art,
music or maps — Solmar City, its people and its story are all our own.

## The game

You are **Nova Vega**, back in **Solmar City** after five years away. Steal
cars, run jobs for Milo, outrun the Solmar PD, and take the city back — one
mission at a time.

- **Open world** — a hand-rolled WebGL 3D city: named avenues and streets,
  procedurally textured towers, setbacks and cylinders, dark asphalt roads
  with lane markings and crosswalks, parks, a beach and a marina. All art is
  procedural; the game runs fully offline with zero network requests.
- **On foot and by car** — walk the sidewalks, steal any traffic car (E),
  arcade driving with drift, collisions and run-over consequences.
- **Traffic & pedestrians** — cars cruise the grid and turn at intersections;
  pedestrians wander the sidewalks.
- **Wanted 0–5** — Solmar PD cruisers chase and ram; a police helicopter
  circles at wanted 3+. Lay low and the heat cools off. Get busted and you
  pay bail.
- **5 story missions** — First Wheels, Courier Run, Heat Rising, Night Shift,
  Solmar Showdown — with timed drops, escapes, a rooftop holdout and a finale.
- **Shops & safehouse** — buy ammo, armor and food at Solmar Arms and the
  Neon Diner; progress saves at Nova's Loft (localStorage).
- **HUD** — circular minimap with street names, wanted stars, cash, clock,
  big speedometer, weapon/ammo, radio station, mission panel and the police
  response list. Full city map on M. Title, pause and MISSION PASSED screens.
- **Sound** — synthesized WebAudio: engine hum, sirens, gunshots, UI blips
  and three looping radio stations (R to change station).

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move / drive |
| Shift | Sprint |
| E | Enter / exit car, use shop |
| F | Shoot |
| R | Next radio station |
| C | Camera distance |
| M | Big city map |
| P | Pause |
| Esc | Quit to title |

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

## Shots

Screenshots are staged with `?shot=`:

- `?shot=chase` — sunset pursuit, wanted 3, cruisers behind
- `?shot=night` — Nova on foot in the neon night
- `?shot=title` — title screen over the skyline
- `?shot=map` — the full labelled city map

## Structure

- `game/index.html` — page + HUD DOM
- `game/css/style.css` — HUD / title / map styling
- `game/js/main.js` — bootstrap, loop, player, camera, shot modes
- `game/js/gl.js` — WebGL core, shaders, mesh builders
- `game/js/util.js` — seeded RNG, mat4 math
- `game/js/city.js` — Solmar layout: streets, buildings, places
- `game/js/textures.js` — procedural canvas textures
- `game/js/world.js` — sky, sun, buildings, props, rendering
- `game/js/vehicles.js` — car meshes, traffic AI, driving physics
- `game/js/police.js` — wanted system, cruisers, helicopter
- `game/js/missions.js` — 5 missions, shops, save
- `game/js/audio.js` — synthesized sound + radio
- `game/js/hud.js` — HUD, minimap, big map
- `main.ts` — the make.fun entrypoint (copies game/ + screenshots/, writes dossier.json)
