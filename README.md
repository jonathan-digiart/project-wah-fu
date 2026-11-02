# Project Wah Fu — experimental procedural clay engine

**Experimental code scaffold, not a completed estate reconstruction or a public demo.** Site parameters are deliberately excluded. GitHub Pages has not been enabled by this work; no deployment workflow is included.

Three.js + strict TypeScript + Vite. This phase is plain clay terrain and building massing only: no runtime mesh/texture assets or facade details.

## Run

Use the pinned Node version in `.nvmrc`, then `npm ci` and `npm run dev`.

`npm run check` runs formatting, strict types, typed lint, unit/regression tests and production build. `npm run test:e2e` requires Playwright browsers and a working WebGL 2 environment. A successful unit/build check is not a visual, mobile-performance or survey-accuracy pass.

An authorised private preview receives **semantic parameters** at `public/site-data.json`: a short boundary polygon, short building footprints/base/height and explicit uncertainty, sparse terrain controls, optional land/sea regions and presentation-bottom datum. It is excluded from Git. Without this file the application intentionally shows a missing-parameters state; no estate geometry is fabricated. Synthetic fixtures exercise the public engine without private source data.

## Architecture

- `src/model.ts`: metre coordinate conversion, semantic contract, validation and height interpolation.
- `src/scene.ts`: algorithmic terrain subdivision, semantic footprint extrusion, presentation shell and boundary.
- `src/main.ts`: responsive review/navigation and graceful error state. Rendering is on-demand instead of consuming frames while idle.
- `src/*.test.ts`: coordinate, topology, interpolation, geometry and asset-policy regressions. Private-data verification runs only when authorised parameters are locally supplied.
- `tests/smoke.spec.ts`: missing-data, repeated navigation/reload and WebGL-unavailable flows.

See [base-model review gate](docs/base-model-review.md) for limits and acceptance order. Each discovered issue should gain a focused regression test or lint rule when statically expressible, rather than a brittle blanket lint rule.

## Publication boundaries

The first procedural rebuild must receive owner approval before public demo publication. Reference-derived measurements and source provenance remain private pending rights review. Do not copy private preview `dist` into GitHub Pages or a public preview. Rebuild public code from a clean checkout without private parameters. No deployment or merge is performed by these scripts.

Toolchain dependencies are exact-pinned in the lockfile. `npm audit --omit=dev` previously returned zero production findings; a development-only minimatch advisory remains in the lint dependency chain and must be tracked rather than blindly overridden.
