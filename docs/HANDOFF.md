# Wildgrove Zoo: handoff for a new chat

Read this first, then `README.md` (architecture), then carry on with "Up next".

## Where things are

- **Repo:** github.com/nj-boop/Woodland-Park. Plain JS files concatenated into one page
  (`src/manifest.json` lists the order). Three.js r128 from the CDN.
- **Live game:** claude.ai artifact `https://claude.ai/artifact/UpKimj3WzpQBX1vQ1SHfiF`. Always publish
  `dist/index.html` to that URL (pass `url`), never as a new artifact. When new model files are
  added, also publish them with `files` (e.g. `{"models/x.json": "dist/models/x.json"}`).
- **Version:** 0.39.1 (package.json). 52 tests, all passing.

## How to work on it

- `npm test` builds `dist/test.html` and runs `tests/run.mjs` in headless Chrome (Playwright).
  The test build exposes `window.__wg` (`src/core/testhook.js`).
- `npm run build` builds `dist/index.html`. Format with `npx prettier --write src tests`.
- Animal models: `assets/blender/build_animals.py <species> build/glb` (bpy is installed), then
  `python3 tools/glb-to-json.py build/glb assets/models`.
- After each slice: bump the version, test, build, commit, push, publish.
- Commits: author "Nigel Jahn" <nigel.jahn@gmail.com>, and every message ends with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` plus the session's `Claude-Session:` line.
- Keep simulation (`src/sim`) free of rendering, so it can move to Godot later.

## Design rules Nigel has set

- Start every Standard game with $1,000,000. Modes: Standard, Sandbox, Challenge. No campaign.
- Logistics are always on (Prison Architect-style depth).
- **Guests in the middle, services around the outside.** Roads (vehicles + staff) and footpaths
  (guests + staff) never meet at grade; laying one over the other builds a bridge (footbridge or
  road bridge, whichever is laid second goes on top).
- **No doors in habitat fences.** Each land habitat gets an **Animal house** on its fence: animals
  sleep there at night, keepers and vets go in through it, the animal ambulance loads at its door.
  It needs road access and a footpath nearby. Old saves keep their keeper gates.
- Vet care: minor cases treated in the habitat; serious cases ride the animal ambulance to the vet
  clinic for surgery, which guests watch from the viewing gallery, then ride back.
- Day and night: one month = one day; Office → Settings can switch it off.
- Use a green cross, never a red one (protected emblem).

## Up next (Nigel's queue, in order)

1. **Decorative fences and more lighting.** Low decorative fences/hedges/railings along paths, more
   lamp styles (string lights, bollards, lanterns), "a little more" scenery generally. Lamps already
   share `LAMP_MAT`, which glows at night.
2. **Movable front gate, with guests walking in from parking.** The entrance is currently fixed to
   the south edge (`checkEntrance`, `placeEntrance`, `GATE`). Make it placeable anywhere; guests
   should arrive at parking lots (or street parking), walk footpaths to the gate, and pay there.
3. **Richer shops** (carts, restaurants, etc.) and **animated scenes inside buildings**, like old
   tycoon games: small looping vignettes (a cook flipping burgers, a cashier, vets operating) that
   reward a close look.
4. Content still on the roadmap: show training, sky tram, raised paths.
5. Back burner: first person, campaign.
