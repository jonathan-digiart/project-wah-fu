# Development and release

An independent procedural clay model of Wah Fu Estate and its surroundings. This approved visual baseline has 18 estate houses and 103 surrounding building objects, rendered as 124 components. It is an early reconstruction, not a survey or verified historical record.

The browser generates terrain and building geometry from semantic parameters. No mesh files, textures, photographs, external model services or authentication keys are needed at runtime. The static demo supports orbit, pan, zoom, building focus and a camera collision envelope.

## Development

Node.js 24 and the committed npm lockfile are required.

- npm ci --ignore-scripts
- npm run dev
- npm run check:release

Checks cover formatting, TypeScript, lint, unit/geometry/collision tests, production build and public-artifact safeguards. npm run test:e2e runs browser scenarios when approved Playwright browsers are available; browser tests are separate from the default checks. A passed build is not proof of mobile performance.

## Selected public releases

The GitHub Pages workflow runs only by manual dispatch from `main`. Select the full 40-character lowercase commit SHA of an approved version already merged into `main`. The workflow first checks out the trusted release policy from `main`, verifies that the selected commit belongs to its history, then checks out that exact commit and runs release checks. Unmerged branch or PR commits are rejected before their code runs. Dependency caching is disabled in the release job. Only the resulting checked `dist` artifact is deployed, in a separate job with Pages permissions. Normal pushes and PRs do not deploy. GitHub Pages must be configured to use GitHub Actions.

The relative Vite base supports the project Pages subdirectory. The private working preview remains a separate deployment.

## Accuracy and limitations

Footprints and heights are simplified source-derived envelopes. Terrain is provisional: the retained independent comparison summary is about 2.6 m mean absolute error and 7.5 m 95th-percentile error. Ground contacts, steps, access routes and walkability are not yet verified. Sea height and the presentation base are illustrative. Collision protects the rendered clay shapes, not surveyed real-world surfaces. One-metre camera clearance intentionally excludes gaps narrower than two metres.

## Data, attribution and licensing

Source: Lands Department, Government of the Hong Kong SAR, through the CSDI Portal, 3D Visualisation Map (Non-textured models). Government and relevant organisations retain source-data intellectual property rights.

See [data attribution and terms](../public/DATA-ATTRIBUTION.txt). The source terms are distinct from project code. No blanket open-source licence is assigned to the project or third-party data by this release; code is publicly viewable, with no additional project licence grant.

Three.js is MIT-licensed; its incorporated Earcut triangulator is ISC-licensed. Their required notices are in public/ and included in each deployment. This project is not endorsed by the Government.

## v128 public replacement

The deployed root now uses the self-contained accepted v127-derived scene in
`release/public-v128/`, with a minimal interface and source credits. It contains
414 files (61,940,679 bytes), rather than the private preview's historical variants.
The prior procedural app remains as development source and regression fixtures;
it is built to `dist-legacy`, never uploaded by Pages. Git history is retained.

`npm run build` checks TypeScript, builds that legacy regression target, verifies
all static-release SHA-256 identities, then copies only the approved release into
`dist`. `npm run check:release` checks both targets. The release manifest is
`verification/public-v128/FILE-MANIFEST.json`; its verifier rejects missing,
extra, changed or symlinked files. It is portable and requires only Python 3.
`npm run preview -- 4174` serves the actual new public release on port 4174.
This plain static server preserves explicitly requested `.gz` bytes; Vite preview
adds Content-Encoding to those files and is unsuitable for compressed-byte
integrity checks. Actual Pages response semantics and live loading are verified
after deployment, not inferred from this local server. Playwright runs the
legacy scenarios at port 4173 and the public-release smoke at port 4174.

This is a provisional reconstruction, not a survey. Accepted road changes are
retained exactly; the Wah Ming carpark perimeter is unchanged at the user's
request. A short ribbed bridge-head transition remains outside the corrected
north-boundary strip. Source/license details are in deployed `credits.html`.
No raw aerial/photos, archived comparison pages, or historical models deploy.
No new project-code licence is granted. Publication still uses the manual,
checked-main-commit workflow above, at the existing Pages URL.
