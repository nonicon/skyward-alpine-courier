# skyward-alpine-courier

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/nonicon/skyward-alpine-courier/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/nonicon/skyward-alpine-courier/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

**Skyward — Alpine Courier** is a 3D flight game that runs in desktop Chrome from static files, with no network requests. Fly a red bush plane through glowing rings over a seeded alpine valley — pine forests, a lake, snowy peaks and the Alderfield airfield — then bring her home to the runway. Three courier sorties with rising wind and tighter courses, fuel and airframe management, stalls, rough-field landings, a live HUD (altitude, speed, heading, artificial horizon, compass, minimap) and synthesised engine and wind audio.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. Fly with the arrow keys (climb, descend, bank), **W**/**S** for throttle, mouse drag to steer, **P** to pause, **R** to restart, **M** to mute.

## Layout

- `game/` — the playable game (static files only; Three.js is vendored under `game/vendor/`)
- `game/src/` — the game's own source, one file per job: flight model, terrain, sky, aircraft, missions, HUD, audio, input, screenshots
- `screenshots/` — real renders of the game, taken in headless Chrome
- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`

---

<sub>Entered on [make.fun](https://make.fun/?ref=nonicon&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
