# MuseMare

MuseMare is an experimental browser rhythm game with battle-level and exploration-map JSON editors. It uses Bun, Vite, React, PixiJS, Vitest, and Playwright.

## Routes

- `/` — main menu, intro fallback, availability-aware selector, battles, settings, and credits.
- `/editor` — battle-level JSON editor with audio transport and a live Pixi preview.
- `/mapeditor` — exploration-map JSON editor with a live Pixi preview.

The three routes are client-side Vite SPA entries. Production hosting must serve `dist/index.html` as the fallback for `/editor` and `/mapeditor`; `bun run preview` provides that fallback locally.

## Architecture

- `app/config/gameConfig.ts` owns static game defaults without importing UI or route modules.
- `app/components/GameSession.tsx` owns browser hydration and exposes typed navigation, battle preparation, exploration, and environment actions.
- `app/logic/` contains pure simulation, validation, timing, persistence, and progression code.
- `app/renderers/` contains the React/Pixi scene graph boundary. Game scenes and both editors pass render data into these components instead of constructing Pixi trees from logic helpers.
- `app/editor/useEditorLayout.ts` owns battle-editor panel geometry, resize listeners, drag state, and canvas viewport sizing.

The standalone editor routes do not import the main game scene graph. This keeps their Vite chunks independent and prevents editor tooling from depending on the gameplay session provider.

## Playable Path

A fresh browser profile can reach the repository’s playable ending through visible UI only:

1. Select `New Game`.
2. Select `Continue` on the intro fallback.
3. Select `Play Ending — prerequisites unavailable`.

The selector exposes this existing ending as a standalone playable level because every configured prerequisite battle lacks its matching recording. It does not write completion for those unavailable levels and does not claim that the story prerequisites were completed.

The selector still exposes each map section so the unavailable entries and their original track identities can be inspected. Unavailable entries are disabled and never create an audio element or start a battle.

## Battle Rules

- Every battle starts at 100 health. Health is capped at 100.
- Judgements change health by `Miss -10`, `Bad -1`, `Good +1`, `Great +2`, and `Perfect +3`.
- Reaching zero at any point immediately latches game over; later judgements cannot revive the attempt. A clear requires at least one health through the end of the level.
- Any non-repeating keyboard input can hit a note. Simultaneous notes on separate chart lines require the same number of simultaneous key presses.
- The editor and runtime share absolute, BPM-independent windows: `Perfect ±33.34ms`, `Great ±50ms`, `Good ±66.67ms`, `Bad ±83.33ms`, and `Miss ±100ms`. An unhit note becomes `Miss` when the 100ms window closes.

## Level Availability

- `Halv — Romanesque`, `Exyl — MOAI`, and `t+pazolite — Dogbite` retain their embedded event/object/note payloads and provenance, but remain explicitly unavailable because matching legally usable recordings are not present.
- No replacement song is assigned to those three charts.
- `ending` retains `/assets/song/icyxis_true_ending.mp3` and is playable.

`app/data/level.ts` contains the four embedded level payloads. `app/data/levelManifest.ts` separately records song availability, track identity, and provenance. Integrity tests separately bind every level’s song and sprite source mapping so the normalized payload hashes cannot hide asset remapping.

## Requirements

- Bun `1.3.14` as the package manager, script runner, and Vite runtime.
- Node.js `24.18.1` as the pinned Playwright and ecosystem-compatibility runtime; `package.json` supports Node `>=24.18 <25`.
- Local Playwright Chromium for local smoke tests unless `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` points to a compatible executable.

CI runs on the Playwright `v1.62.1-noble` image pinned to the amd64 manifest digest `sha256:c091b21d9fae78c76e85cd4356431e9b018402f172a214fc7d7a5e9a7e29d8ac`. CI does not download a browser at runtime. Checkout, setup-node, and setup-bun actions are pinned to immutable commit SHAs, and workflow permissions are limited to `contents: read`.

## Development

```bash
bun --version
node --version
bun ci
bun run dev
```

Open `http://localhost:3000`. The editors are available at `/editor` and `/mapeditor`.

## Controls

### Battle editor

- `Space` — start or resume playtest while stopped. During playtest it is a note input like every other key; use the visible Pause button to pause.
- `Home` / `End` — seek to the beginning or endpoint.
- Mouse wheel — pan the timeline; `Alt` + wheel zooms.
- Drag or click the timeline ruler to seek; hold `Shift` while dragging to snap.
- `W` — add a note to the selected chart object.
- `E` — add an event to the selected main track or object.
- `Delete` — remove the focused object, event, or note.
- `Ctrl+C`, `Ctrl+X`, `Ctrl+V` — copy, cut, and paste events.

Every explicit seek starts a new input/judgement epoch. Pending hits and rendered judgements are cleared for Home, End, ruler seeks, imports, and song/offset changes; reaching the endpoint now keeps the clear result visible instead of silently rewinding.

Playtest uses the same judgement and health pipeline as battle runtime. Starting from the middle silently skips older notes without charging health, pause/resume preserves the attempt, visual edits render during playback, note-topology edits start a fresh attempt, editing shortcuts are disabled while audio is playing, and failure or clear stays visible until restart or return to editing.

### Map editor

- `A` / `D` move the preview player, `Space` jumps, `Shift` runs, and `Control` sneaks when focus is outside editable controls.
- Select a sprite and drag the canvas to move it in world space.
- Select `Set Size`, then drag in either direction to resize it in world units.

Pointer coordinates are inverted through the same camera translation, rotation, and `camera.scale * globalSize` transform used by the preview. Pointer capture, cancel, visibility, blur, and unmount cleanup prevent stuck move/resize interactions.

## Asset Integrity

`assets.sha256` contains one path-sorted SHA-256 entry for every file under `public/assets/` (53 files in the current tree). Integrity tests fail when a path is added or removed, when bytes change, when an entry is duplicated or unsorted, or when a listed digest does not match.

Regeneration is manual and explicit:

```bash
bun run assets:manifest
git diff -- assets.sha256
```

Tests and CI never regenerate the manifest automatically. Review every manifest diff together with the corresponding asset change.

## Verification

From a clean dependency state with Bun `1.3.14` and Node `24.18.1`:

```bash
bun ci
bun install --frozen-lockfile --dry-run --offline
bun pm ls --all
bun run typecheck
bun run lint
bun run test:unit
bun run test:integrity
bun audit --audit-level=high
bun run build
bunx playwright install chromium   # local machine only; CI uses the pinned container
bun run smoke
git diff --check
```

`bun run smoke` requires the production build and starts the loopback Vite preview with Bun. The suite covers fresh-storage navigation into the playable ending with advancing audio, unavailable entries, transformed map drag/resize behavior, editor seek/import behavior, runtime failure recovery, viewport/backing-size synchronization, and browser decoding of tracked image/audio assets.

Bun intentionally leaves the optional `@parcel/watcher` build fallback and `unrs-resolver` postinstall script blocked. The committed lock includes their platform packages, and the verified workflow does not require either lifecycle script. Review their source and need before granting trust with `bun pm trust`.

The missing intro video is represented by a visible local-image fallback. The legacy Windows installer is intentionally excluded from source control; the web build and CI do not require or execute it.
