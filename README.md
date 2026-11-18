# SOLMAR HEAT

[![Bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/Nebulanime/solmar-heat/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/Nebulanime/solmar-heat/reward.svg)](https://make.fun/bounty/gta6-01)

**SOLMAR HEAT** is an original open-world crime game for the
[make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01).
You play Nova Vega, fresh out and broke in Solmar — a fictional
sun-baked coastal city that is entirely our own invention: no
Rockstar names, maps, characters, art or music anywhere in it.

## What is in the game

- **A city to explore** — a procedural road grid with blocks of
  buildings, Palm Park, Coral Plaza, the Old Harbor, Solmar Tower,
  and a beach and sea along the east edge.
- **On foot and by car** — walk, run, punch and shoot, or press E
  to steal any parked car and drive it. Traffic keeps the roads busy.
- **Pedestrians** — sidewalk walkers who stroll, panic and scatter
  when shots ring out or a car comes at them too fast.
- **Wanted level + police** — crimes raise your stars; police cars
  chase, ram and try to bust you. Stay clean and the heat cools off.
- **Missions and a story** — five missions in a chain, from stealing
  your first wheels to owning the whole coast, with payouts.
- **Combat** — fists and gunfire, with bullet tracers and hit flashes.
- **HUD + minimap** — health, cash, wanted stars, mission objective,
  speed, a live clock and a minimap with the mission marker.
- **Start screen, pause and save** — progress autosaves in the
  browser; a saved game can be continued from the title screen.
- **Sound** — a fully synthesized Web Audio soundtrack: engine hum,
  sirens, gunshots, crashes and a bass groove. No audio files.

## Controls

| Key | Action |
| --- | ------ |
| WASD / arrows | Move on foot, drive the car |
| E | Steal a car / get out |
| Space | Punch on foot, horn in a car |
| F | Shoot toward the mouse |
| Shift | Run |
| M | Mission list |
| P / Esc | Pause |
| N | Mute |

## How to play

Serve the `game/` folder with any static server and open
`game/index.html` in desktop Chrome — it plays fully offline, with
no network requests and no build step:

```sh
node serve.ts
# then open http://localhost:8080
```

## How to package the entry

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

That copies `game/` and `screenshots/` into `out/` and writes
`out/dossier.json` with the vendored make.fun library.

## Credits

Built from scratch for the make.fun gta6-01 bounty by Nebulanime.
Everything in `game/` is original work: code, city, story, names,
art and synthesized sound. Licensed under the MIT License.
