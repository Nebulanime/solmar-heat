# SOLMAR HEAT — Patient Nova

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Nebulanime/solmar-heat/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Nebulanime/solmar-heat/reward.svg)](https://make.fun/bounty/gta6-01)

An open-world crime game in the spirit of GTA 6, built for the
[make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01). Everything is
original: the city of Solmar, Nova Vega, the story, the art and the sounds.
No Rockstar names, characters, maps or assets.

## The game

Nova Vega is back in her home city. Five jobs stand between her and the
marina yacht — and the whole Solmar PD stands in the way. Entry name:
**Patient Nova**.

- **A 3D city, hand-rendered in WebGL** — no 3D library, no textures, no
  network. Lit-window towers, palms, neon signs, streetlights, the marina
  and the ocean, under a sunset sky (and neon night).
- **Drive and walk** — chase camera behind the car, third-person on foot.
  Steal any traffic car (E) and the heat follows.
- **Wanted system** — 0 to 5 stars. Cruisers chase and ram; at 3 stars a
  police helicopter circles with a searchlight. Lay low, respray, or reach
  the safehouse to cool off.
- **Five story missions** — First Job, Hot Wheels, Heat Rising, Neon Run,
  and Patient Nova — with a beacon, dialog from Rico, Marisol and Kestrel,
  a timed delivery, and a MISSION PASSED screen. $6,900 in total pay.
- **A full HUD** — round minimap with mission blip and police dots, wanted
  stars, cash, clock, health/armor bars, speedometer, weapon/ammo, radio
  station, mission panel and dialog box.
- **Shops and saving** — Solmar Arms (ammo), Palm Burger (heal), Spray Shop
  (lose the cops), and a safehouse that saves to localStorage.
- **City map (M)**, title screen, pause, procedural radio music, engine hum,
  sirens and gunshots — all synthesized with WebAudio, no audio files.

## Controls

| Key | Action |
| --- | --- |
| W A S D / arrows | Drive / walk |
| Space | Brake |
| Shift | Sprint on foot |
| E | Enter/exit car, steal, use shops & safehouse |
| Mouse click | Shoot (on foot) |
| M | City map |
| R | Change radio station |
| P | Pause |
| Enter | Start / continue |

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

Screenshot scenes (real renders of the game playing itself):
`?scene=chase` (sunset pursuit), `?scene=night` (on foot in the neon
district), `?scene=title` (title screen), `?scene=map` (city map).

## Build

```sh
node --test tests/logic.test.mjs
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` (Node 22, standard library only) copies `game/` and
`screenshots/` to `/output` and writes `/output/dossier.json`.

## License

MIT — see [LICENSE](LICENSE).
