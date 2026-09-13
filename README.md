# Pastel Village — Living Ecosystem Web Sandbox

A small, "alive" 3D village that runs entirely in the browser: NPCs with
homes/jobs/schedules, a day/night cycle, weather, and a zombie-infection
sandbox experiment. Built for GitHub Pages (static hosting, no backend
required), mobile-first for iPhone/iPad, and also playable on desktop.

**Live URL:** https://icelolan-ai.github.io/-pastel-village/

## Status

**Phase 2 — 3D Village Foundation.** The village now has a real (if still
placeholder-geometry) layout: an organic non-circular terrain, a road graph
(loop + branches, rendered as debug lines), and five zone types (village
center, shop, park, residential ×2, nature-buffer ring) rendered as
toggleable colored ground patches. Press **R** to toggle the road graph
debug view, **Z** to toggle zone debug colors. No real building/road/nature
assets yet — those arrive in Phase 3.

<details>
<summary>Phase 1 — GitHub + Web Foundation (done)</summary>

Rendering-pipeline proof: a pastel sky, a ground plane, one rounded
placeholder object, working pan/zoom camera controls (touch + mouse), and
an FPS debug overlay.
</details>

## Tech Stack

- TypeScript
- [Three.js](https://threejs.org/) (WebGL2)
- [Vite](https://vitejs.dev/) (build tool + dev server)
- Vanilla HTML/CSS for UI overlay (no framework, kept lean for mobile)
- [Vitest](https://vitest.dev/) (unit tests) + [Playwright](https://playwright.dev/) (browser/E2E tests, incl. mobile viewport emulation)
- GitHub Actions → GitHub Pages (deploy from Actions, no `gh-pages` branch)

## Getting Started

```bash
npm install
npm run dev       # local dev server with hot reload
```

## Build

```bash
npm run build      # type-check + production build to dist/
npm run preview    # serve the production build locally
```

## Testing

```bash
npm test           # unit tests (Vitest)
npm run test:e2e   # browser tests incl. iPhone/iPad viewport emulation (Playwright)
```

`npm run test:e2e` starts the preview server automatically (see
`playwright.config.ts`).

## Deployment

Deployment is automatic: every push to `main` triggers
`.github/workflows/deploy.yml`, which builds the project and publishes
`dist/` to GitHub Pages via `actions/deploy-pages`.

**Important:** `vite.config.ts` sets `base: '/-pastel-village/'` to match
this repository's name (including the leading hyphen). If the repository
is ever renamed, this value must be updated to match, or every asset will
404 on GitHub Pages.

## Project Structure

```
src/
  core/        # app entry point, main render/simulation loop
  rendering/   # Three.js scene, camera, renderer setup
  camera/      # pan/zoom camera controller
  debug/       # debug overlay
public/        # static assets (empty until Phase 3+)
tests/         # Playwright browser tests
```

See `ASSET_LICENSES.md` for the license of every external asset used in
the project (none yet, as of Phase 1).

## License

Source code is MIT licensed — see `LICENSE`.
