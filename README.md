# Project Wah Fu

An independent procedural clay model of Wah Fu Estate and its surroundings. This approved visual baseline has 18 estate houses and 103 surrounding building objects, rendered as 124 components. It is an early reconstruction, not a survey or verified historical record.

The browser generates terrain and building geometry from semantic parameters. No mesh files, textures, photographs, external model services or authentication keys are needed at runtime. The static demo supports orbit, pan, zoom, building focus and a camera collision envelope.

## Development

Node.js 24 and the committed npm lockfile are required.

- npm ci --ignore-scripts
- npm run dev
- npm run check:release

Checks cover formatting, TypeScript, lint, unit/geometry/collision tests, production build and public-artifact safeguards. npm run test:e2e runs browser scenarios when approved Playwright browsers are available; browser tests are separate from the default checks. A passed build is not proof of mobile performance.

## Selected public releases

The GitHub Pages workflow runs only by manual dispatch. Select the full 40-character commit SHA of an approved version. It checks out that exact commit, runs release checks and deploys only the resulting dist artifact. Normal pushes and PRs do not deploy. GitHub Pages must be configured to use GitHub Actions.

The relative Vite base supports the project Pages subdirectory. The private working preview remains a separate deployment.

## Accuracy and limitations

Footprints and heights are simplified source-derived envelopes. Terrain is provisional: the retained independent comparison summary is about 2.6 m mean absolute error and 7.5 m 95th-percentile error. Ground contacts, steps, access routes and walkability are not yet verified. Sea height and the presentation base are illustrative. Collision protects the rendered clay shapes, not surveyed real-world surfaces. One-metre camera clearance intentionally excludes gaps narrower than two metres.

## Data, attribution and licensing

Source: Lands Department, Government of the Hong Kong SAR, through the CSDI Portal, 3D Visualisation Map (Non-textured models). Government and relevant organisations retain source-data intellectual property rights.

See [data attribution and terms](public/DATA-ATTRIBUTION.txt). The source terms are distinct from project code. No blanket open-source licence is assigned to the project or third-party data by this release; code is publicly viewable, with no additional project licence grant.

Three.js is MIT-licensed; its incorporated Earcut triangulator is ISC-licensed. Their required notices are in public/ and included in each deployment. This project is not endorsed by the Government.
