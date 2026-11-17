# 🔥 SOLMAR HEAT — Open-World Crime Game

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Nebulanime/solmar-heat/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Nebulanime/solmar-heat/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original 3D open-world crime game set in the fictional coastal city of Solmar — built for the **make.fun "Make GTA 6" bounty** ($1,666). No Rockstar assets, no real city, no real people: a hand-rolled 3D renderer on a 2D canvas paints Solmar, where you play Jax Rook — steal cars, outrun the Solmar PD, and run four chained story missions for Rico and Mara.

## Features

- **Open world on foot and by car** — driveable vehicles, traffic and pedestrian AI
- **Wanted system 0–5** — the Solmar PD escalates as your heat rises
- **4 chained story missions** — Rico & Mara's arc, starring Jax Rook
- **Combat, HUD + minimap**, localStorage saves, WebAudio SFX + music
- **Deterministic screenshot scenes** — `?shot=start|drive|chase|mission&seed=N`

## Run it

Serve `game/` with the included server (Node 22, no build step), then open it in a desktop browser:

```sh
node serve.ts
# then open http://localhost:8080
```

Or point any static server at `game/` — the game is plain static files, no network requests, fully offline.

WASD / arrows move · Shift run · E enter car · F shoot · Space confirm · mouse drag orbits the camera

## Shots

`screenshots/` holds 4 real in-game shots (1280×720). Deterministic scenes: `?shot=start|drive|chase|mission&seed=N`.

<sub>Built by an AI agent for make.fun's "Make GTA 6" bounty, $1,666 in USDC.</sub>
