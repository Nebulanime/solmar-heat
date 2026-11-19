# Solmar Heat — Patient Nova

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Nebulanime/solmar-heat/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Nebulanime/solmar-heat/reward.svg)](https://make.fun/bounty/gta6-01)

An open-world crime game in the sun-soaked city of **Solmar**, built for the
[make.fun GTA 6 bounty](https://make.fun/bounty/gta6-01) (`gta6-01`).
You are **Nova Vega**, a getaway driver back in her hometown. Five jobs,
five stars of heat, one way out.

Everything is original and written by hand: a WebGL renderer with no 3D
library, procedural canvas textures for every building facade, and a city,
characters, vehicles, names and story invented for this entry. No Rockstar
names, assets or maps are used. The game runs offline from static files —
no network requests.

## Play

Serve the game and open it in a desktop browser:

```sh
node serve.ts
# open http://localhost:8080
```

Press **Enter** (or Space) on the title screen to start the first mission.

### Controls

| Key | Action |
| --- | --- |
| W / A / S / D or arrows | Drive / walk (Shift to run on foot) |
| E | Enter or exit a car (steal a nearby traffic car) |
| M | Full city map (Esc closes it) |
| P | Pause / resume |
| C | Camera (chase / high / hood) |
| R | Cycle radio station |
| N | Toggle day / night |
| Enter / Space | Start mission, continue after BUSTED |

### The city

Solmar is a road grid on a bay: a marina and sea to the west, a downtown of
textured towers with setbacks, roof details and lit windows, palm-lined
avenues, billboards, street lamps, crosswalks and dark wet-look asphalt with
lane markings. At sunset the sun hangs low over the sea and shadows stretch
long; at night the neon signs, headlights and lamp pools take over.

### Systems

- **Driving & on-foot play** — a sports car with sloped bodywork, cylinder
  wheels, glowing headlights and taillights; Nova on foot in her pink jacket.
- **Traffic & pedestrians** — ten cruising cars (including a taxi) and a
  dozen pedestrians walking the sidewalks.
- **Police & wanted level** — 0–5 stars. Stealing cars, speeding and
  missions raise the heat; cruisers with flashing light bars chase you, a
  helicopter joins at 3 stars, and the heat cools when you break line of
  sight and hide. Get caught at 0 health and it's BUSTED.
- **Missions & story** — five jobs from Mara Voss, Dario Sol and Captain
  Reyes, each with two waypoints and a golden beacon. Total story rewards:
  **$4,700** (Homecoming $400, Neon Errand $650, The Long Way Home $900,
  Storm Surge $1,200, Heatwave $1,550).
- **Shops & safehouse** — Palm Court Garage, Neon Row Club, Vela Marina
  Diner, Solmar Ammo & Pawn, Calle Rosa Tacos and the Bayview Motel, where
  the game saves (localStorage) and restores health.
- **HUD** — round minimap with street names, wanted stars, cash, clock,
  health/armor bars, big speedometer, weapon/ammo, radio station, mission
  panel with distance, police response list and character dialogue.
- **Screens** — title, full city map, MISSION PASSED, pause and BUSTED.

## Build & verify

```sh
node tests/logic.test.mjs   # pure-logic unit tests (missions, driving, wanted, save)
node main.ts                # with MAKEFUN_OUTPUT_DIR=out outside the grader
node cli/makefun.mjs check  # from the gta6-01 kit (see the kit's README)
```

The screenshots in `screenshots/` are real renders of the game itself:
`1-chase.jpg` (sunset chase with a police cruiser), `2-night.jpg` (Nova on
foot in neon Solmar), `3-title.jpg` (title over the coastal sunset) and
`4-map.jpg` (the full city map).

## Files

- `game/index.html` + `game/style.css` — page, sky, HUD and overlays.
- `game/src/main.js` — game loop, input, camera, police, missions, HUD, map.
- `game/src/render.js` — hand-written WebGL renderer (one shader program).
- `game/src/mesh.js` — mesh builder (tapered boxes, cylinders, spheres) and matrices.
- `game/src/city.js` — Solmar: roads, textured buildings, palms, lamps, billboards.
- `game/src/vehicles.js` — cars, pedestrians, Nova, the police helicopter.
- `game/src/textures.js` — procedural canvas textures (facades, neon, asphalt).
- `game/src/logic.js` — pure rules (driving, wanted, missions, save), unit-tested.
- `tests/logic.test.mjs` — Node tests for `logic.js`.
- `shots.json` — the four staged screenshot scenes.
- `screenshots/` — the four 1280×720 renders used for the entry.

## License

MIT — see `LICENSE`.
