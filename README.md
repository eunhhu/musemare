# MuseMare

MuseMare is an experimental browser rhythm game with battle-level and exploration-map JSON editors. It uses the Next.js App Router, React, PixiJS, Vitest, and Playwright.

## Routes

- `/` — main menu, intro fallback, availability-aware selector, battles, settings, and credits.
- `/editor` — battle-level JSON editor with audio transport and a live Pixi preview.
- `/mapeditor` — exploration-map JSON editor with a live Pixi preview.

## Playable Path

A fresh browser profile can reach the repository’s playable ending through visible UI only:

1. Select `New Game`.
2. Select `Continue` on the intro fallback.
3. Select `Play Ending — prerequisites unavailable`.

The selector exposes this existing ending as a standalone playable level because every configured prerequisite battle lacks its matching recording. It does not write completion for those unavailable levels and does not claim that the story prerequisites were completed.

The selector still exposes each map section so the unavailable entries and their original track identities can be inspected. Unavailable entries are disabled and never create an audio element or start a battle.

## Level Availability

- `Halv — Romanesque`, `Exyl — MOAI`, and `t+pazolite — Dogbite` retain their embedded event/object/note payloads and provenance, but remain explicitly unavailable because matching legally usable recordings are not present.
- No replacement song is assigned to those three charts.
- `ending` retains `/assets/song/icyxis_true_ending.mp3` and is playable.

`app/data/level.ts` contains the four embedded level payloads. `app/data/levelManifest.ts` separately records song availability, track identity, and provenance. Integrity tests separately bind every level’s song and sprite source mapping so the normalized payload hashes cannot hide asset remapping.

## Requirements

- Node.js `22.22.0` for the validated workflow; `package.json` supports Node `>=22.12 <23`.
- npm `11.6.2`.
- Local Playwright Chromium for local smoke tests unless `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` points to a compatible executable.

CI runs on the Playwright `v1.62.1-noble` image pinned to the amd64 manifest digest `sha256:c091b21d9fae78c76e85cd4356431e9b018402f172a214fc7d7a5e9a7e29d8ac`. CI does not download a browser at runtime. Checkout and setup-node actions are also pinned to immutable commit SHAs, and workflow permissions are limited to `contents: read`.

## Development

```bash
npm install --global npm@11.6.2
node --version
npm --version
npm ci
npm run dev
```

Open `http://localhost:3000`. The editors are available at `/editor` and `/mapeditor`.

## Controls

### Battle editor

- `Space` — play or pause.
- `Home` / `End` — seek to the beginning or endpoint.
- Mouse wheel — pan the timeline; `Alt` + wheel zooms.
- Drag or click the timeline ruler to seek; hold `Shift` while dragging to snap.
- `W` — add a note to the selected chart object.
- `E` — add an event to the selected main track or object.
- `Delete` — remove the focused object, event, or note.
- `Ctrl+C`, `Ctrl+X`, `Ctrl+V` — copy, cut, and paste events.

Every discontinuous seek starts a new input/judgement epoch. Pending hits, judgement refs, and rendered judgements are cleared for Home, End, ruler seeks, imports, song/offset changes, and endpoint rewind.

### Map editor

- `A` / `D` move the preview player, `Space` jumps, `Shift` runs, and `Control` sneaks when focus is outside editable controls.
- Select a sprite and drag the canvas to move it in world space.
- Select `Set Size`, then drag in either direction to resize it in world units.

Pointer coordinates are inverted through the same camera translation, rotation, and `camera.scale * globalSize` transform used by the preview. Pointer capture, cancel, visibility, blur, and unmount cleanup prevent stuck move/resize interactions.

## Asset Integrity

`assets.sha256` contains one path-sorted SHA-256 entry for every file under `public/assets/` (53 files in the current tree). Integrity tests fail when a path is added or removed, when bytes change, when an entry is duplicated or unsorted, or when a listed digest does not match.

Regeneration is manual and explicit:

```bash
npm run assets:manifest
git diff -- assets.sha256
```

Tests and CI never regenerate the manifest automatically. Review every manifest diff together with the corresponding asset change.

## Verification

From a clean dependency state with Node `22.22.0` and npm `11.6.2`:

```bash
npm ci
npm ci --dry-run --offline
npm ls --all
npm run typecheck
npm run lint
npm run test:unit
npm run test:integrity
npm audit --audit-level=high
npm run build
npx playwright install chromium   # local machine only; CI uses the pinned container
npm run smoke
git diff --check
```

`npm run smoke` requires the production build and starts the standalone server. The suite covers fresh-storage navigation into the playable ending with advancing audio, unavailable entries, transformed map drag/resize behavior, editor seek/import behavior, runtime failure recovery, viewport/backing-size synchronization, and browser decoding of tracked image/audio assets.

On Linux ARM64, npm `11.6.2` may print `@img/sharp-wasm32` and `@emnapi/runtime` as `extraneous` during `npm ls --all` while exiting successfully. A separate clean project containing only `sharp@0.35.3` reproduces the same optional-package report. The MuseMare lock contains the Sharp optional edges and does not add those packages as direct dependencies; required `UNMET DEPENDENCY`, `ELSPROBLEMS`, or a nonzero exit remains a failure.

The missing intro video is represented by a visible local-image fallback. `MuseMare Setup.exe` is a legacy tracked installer artifact; the web build and CI do not execute it.
