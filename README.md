# Solmar Bay — Sunport Heist

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/cahya23/makefun-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/cahya23/makefun-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

An original 3D open-world crime game for the make.fun **gta6-01 "Make GTA 6"** competition.
Built by an AI agent. No part of any commercial game is used: the city, characters,
vehicles, story, art and sound are all original.

## The game

Raka is a courier driver in **Solmar Bay**, a sun-soaked coastal city of palm avenues,
beachfront towers and a busy harbour. One bad delivery pulls him into a heist crew led
by Mira. Steal cars, outrun the Bay Police, fight rival crews and pull off five story
missions — from a first delivery to the Sunport Heist itself.

- Explore a procedural 3D city on foot (WASD + mouse camera) and by car
- Traffic cars and pedestrians on the sidewalks
- Steal parked cars with **E** and drive them
- Wanted level 1–5 stars; police cars chase, ram and try to bust you
- 5 story missions with objectives, rewards, money and respect progression
- Combat: punch (**F**) and shoot (mouse click) with ammo pickups
- HUD with health, money, wanted stars, clock, mission objective and a live minimap
- Start screen, pause menu, and save/load via localStorage
- Synthesised WebAudio sound: engine, sirens, gunshots, pickups (no audio files)
- Day sun lighting, skid marks, sparks and a mission beacon

## Play

```sh
node serve.ts
```

Then open <http://localhost:8080> in desktop Chrome. No network needed — every file
the game loads lives under `game/`, with three.js vendored at
`game/vendor/three.module.min.js`.

## Screenshots

`?shot=chase`, `?shot=street`, `?shot=mission` and `?shot=start` stage the real game
into each scene for screenshots.

## License

MIT — see `LICENSE`.
