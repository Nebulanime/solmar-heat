# SOLMAR HEAT

![make.fun gta6-01](https://img.shields.io/badge/make.fun-gta6--01-ffd94a)
![license MIT](https://img.shields.io/badge/license-MIT-green)

An open-world crime game in the spirit of GTA 6, built for the make.fun
**gta6-01** competition ("Make GTA 6"). Everything is original: the city, the
characters, the story, the art and the music — nothing from Rockstar Games.

## The game

Welcome to **Solmar**, a sun-soaked fictional coastal city. You are **Jax Rook**,
a wheelman trying to go straight — until old friends pull him back in.
Finish all four jobs to become the **King of Solmar**.

- **Explore on foot and by car** — walk the avenues, steal any car with `E`,
  drive with `WASD`, sprint with `Shift`.
- **A living city** — traffic AI cruises the grid, pedestrians stroll the
  sidewalks and scatter when trouble starts, palms line the beach.
- **Wanted level 0–5 stars** — steal cars and shoot and Solmar PD sends
  cruisers after you. Lie low and the heat bleeds away; get caught and you
  are busted.
- **Four story missions** — jobs for **Rico** and **Mara**: steal a car for
  Rico's garage, run a package from the marina to the plaza, a heat run to the
  dockside warehouse, and a final showdown at the plaza. Each job pays cash.
- **Combat** — shoot with `F` or mouse click; cruisers shoot back.
- **HUD + minimap** — cash, health, wanted stars, objective banner and a live
  minimap with the player arrow, cruisers and the job marker.
- **Save** — progress autosaves to `localStorage` after every job; press `C`
  on the title screen to continue.
- **Sound** — engine hum, two-tone police sirens, gunshots and a bassline
  loop, all synthesised with WebAudio. No audio files. `M` mutes.
- **Camera** — drag the mouse to orbit around Jax.

## Controls

| Key | Action |
| --- | ------ |
| WASD / arrows | Move / drive |
| Shift | Sprint |
| E | Steal / exit car |
| F / click | Shoot |
| Mouse drag | Orbit camera |
| Space | Start / continue |
| C | Continue saved game |
| M | Mute |

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

The game is static files under `game/` with no build step: `game/index.html`
opens in desktop Chrome and plays with no network request. Every script is a
file under `game/` (hand-rolled pseudo-3D on a 2D canvas, no libraries).

Deterministic screenshot scenes: `?shot=start|drive|chase|mission&seed=N`.

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## License

MIT — see `LICENSE`.
