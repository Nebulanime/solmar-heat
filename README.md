# SOLMAR HEAT — a Nova Vega story

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Nebulanime/solmar-heat/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Nebulanime/solmar-heat/reward.svg)](https://make.fun/bounty/gta6-01)

An open-world crime game in the spirit of GTA 6, built for the
[make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01) — a hand-rolled
WebGL 3D city you can explore on foot and by car, with traffic,
pedestrians, a wanted level and police who respond, five story missions,
shops, a safehouse, a minimap and a full city map. No 3D library, no
network: every texture is painted procedurally at boot and the game runs
fully offline from static files.

## The city

Solmar is a sun-soaked coastal city: Downtown towers with setback crowns,
Neon Row's glowing shopfronts, the Old Marina with its docks and yachts,
Palma Heights, and a beach that runs the whole east side into the sea.
Streets are dark asphalt with lane markings; facades carry dense, small
lit windows; palms and streetlights line the roads; the sun hangs low
over the bay at sunset and the neon takes over at night.

## Play

You are **Nova Vega**, back in Solmar with $250 and a reputation to
rebuild. Five missions pay out $5,550 in total:

1. **First Wheels** ($400) — steal a car, deliver it to the Neon Row garage
2. **Sunset Courier** ($650) — pick up a package, deliver it across town
3. **Marina Meet** ($900) — drive to the Old Marina and meet the buyer
4. **Heat Run** ($1,400) — get the police on your tail, then lose them home
5. **Solmar Crown** ($2,200) — one last run to the Downtown penthouse

Steal cars, outrun cruisers (and the helicopter at 3 stars and up),
buy food, ammo and clothes at named shops, and save at the safehouse —
your money, mission and position persist in localStorage.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move / drive (W accelerates, S brakes/reverses) |
| E | Enter/steal a car, talk, shop, save |
| M | Full city map |
| P / Esc | Pause |
| C | Camera (chase / far / hood / top) |
| R | Radio station (3 procedural stations) |
| N | Day / sunset / night |
| Space | Handbrake |
| Shift | Run |

## Run it

```sh
node serve.ts        # serves game/ at http://localhost:8080
```

Hand the entry in (writes `/output`, or `MAKEFUN_OUTPUT_DIR`):

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Structure

- `game/index.html` — canvas + HUD root, loads the game
- `game/src/main.js` — browser entrypoint: canvas, loop, debug handle
- `game/src/game.js` — state machine, driving, traffic, police, missions
- `game/src/render.js` — hand-rolled WebGL renderer, sky, sprites
- `game/src/world.js` — deterministic city generation (seed 20261119)
- `game/src/textures.js` — procedural texture atlas (facades, road, sea…)
- `game/src/hud.js` — DOM HUD, minimap, fullscreen map, menus
- `game/src/audio.js` — synthesized radio + engine + siren (WebAudio)
- `game/src/logic.js` — pure rules (wanted, missions, save) — unit tested
- `game/src/config.js` — city data, missions, shops, radio, tuning
- `game/src/shots.js` — screenshot staging (`?shot=chase|night|title|map`)
- `tests/logic.test.mjs` — logic tests (`node --test tests/logic.test.mjs`)

## Screenshots

1. `1-chase.jpg` — sunset chase, wanted 3, helicopter overhead
2. `2-night.jpg` — Nova on foot on Neon Ave at night
3. `3-title.jpg` — title screen over the sunset skyline
4. `4-map.jpg` — fullscreen city map

<!-- Badges, second pass: the three live make.fun badges are the ones the
     task names (entry, rank, reward). They are also at the top of this
     file; this comment keeps the badge list explicit for the next round. -->
