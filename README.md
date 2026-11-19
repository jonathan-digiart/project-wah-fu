# Project Wah Fu

[![3D preview: explore Wah Fu](https://img.shields.io/badge/3D_preview-Explore_Wah_Fu-1683b7?style=plastic)](https://jonathan-digiart.github.io/project-wah-fu/)
[![Three.js: WebGL](https://img.shields.io/badge/Three.js-WebGL-1683b7?style=plastic&logo=threedotjs&logoColor=white)](https://threejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?style=plastic&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-646cff?style=plastic&logo=vite&logoColor=white)](https://vite.dev/)
[![Status: in development](https://img.shields.io/badge/status-in_development-d49a25?style=plastic)](https://github.com/jonathan-digiart/project-wah-fu/issues)

**An AI-assisted 3D reconstruction project to document the architecture, everyday scenery and community memories of Wah Fu Estate, Hong Kong.**

[繁體中文（香港）](README.zh-HK.md) · English

### Overview

Project Wah Fu is an experimental digital preservation project focused on Wah Fu Estate in Hong Kong. It combines 3D modelling, browser-based interaction and reference research to explore how the estate's architecture and everyday environment can be documented as the community changes.

The long-term aim is an explorable 3D environment that connects buildings and public spaces with photographs, writing, sound and stories, allowing users to learn about Wah Fu through specific places.

**The project is in early development. A complete estate reconstruction is not yet available.**

### Background

Wah Fu Estate was designed by Donald Liao Poon-huai, an architect with the former Hong Kong Housing Authority. Completed in phases from 1967 onwards, it comprises 18 residential blocks alongside shops, schools, terraces and communal spaces, and has been home to generations of residents.

Phased redevelopment will gradually change its buildings, public spaces and everyday scenery, making their documentation increasingly time-sensitive. [Official redevelopment update, 2 November 2026](https://www.news.gov.hk/eng/2026/11/20261102/20261102_174753_450.html?type=ticker)

Project Wah Fu grew from an exploration of generative AI as a tool for documenting communities, inspired by photographs and stories shared through Facebook pages such as 「[邨新富華](https://www.facebook.com/WahFuRelocation)」 and 「[華富一邨民](https://www.facebook.com/profile.php?id=100086308818605)」. Beyond its buildings, the project also aims to record the many details that make up everyday life on the estate.

### Long-term goals

The intended scope covers Wah Fu I, Wah Fu II and the surrounding environment connected to life on the estate. The main goals are:

- **Spatial exploration:** present the estate, individual buildings and public spaces, including their relationships to one another.
- **Place-based storytelling:** connect photographs, writing, sound, relevant reporting and community pages to specific locations.
- **Records of different periods:** present historical appearances where sufficient evidence exists, with dates, sources and uncertainties identified.
- **Browser usability:** balance visual detail with loading times and responsive navigation.

These are development goals and have not all been realised.

### Current stage: public preview and code-only experiment

[Explore the live v128 preview](https://jonathan-digiart.github.io/project-wah-fu/) · [Deployed v128 commit](https://github.com/jonathan-digiart/project-wah-fu/commit/53d214ca9cdb5b8fbe39c82e503bc4bb85b8fac6)

The lean v128 release replaced the first public clay preview through [PR #38](https://github.com/jonathan-digiart/project-wah-fu/pull/38). It presents the estate model with a minimal interface and source credits. It is a work-in-progress reconstruction, not a survey or a complete historical record.

The separate [code-only reconstruction experiment (draft PR #39)](https://github.com/jonathan-digiart/project-wah-fu/pull/39) uses **[Three.js](https://threejs.org), [TypeScript](https://www.typescriptlang.org) and [Vite](https://vite.dev)** to generate geometry from code and explicit parameters, without importing images or 3D assets. It builds on the procedural scaffold introduced in [PR #6](https://github.com/jonathan-digiart/project-wah-fu/pull/6). Terrain, buildings and ground connections still need reference-based refinement. Similar visual fidelity and any gains in size, loading time or performance have yet to be demonstrated. The draft has not replaced the live preview.

Earlier prototypes used government open geospatial and 3D data to establish a base model, with photographic references and AI assistance used to develop selected architectural details. Code and scene data are handled separately; publishing code does not automatically release source models, photographs or earlier assets. Known limitations and further work are tracked in [Issues](https://github.com/jonathan-digiart/project-wah-fu/issues).

### Workflow and the role of AI

The creator sets the direction, selects reference material and reviews the results. AI agents assist with research, coding, model preparation and testing. OpenAI Dots helps co-ordinate and carry out this work, continuing suitable tasks when tools are available and instructions are clear. Visual judgements, decisions about evidence and release approval remain with the project owner.

Development and review follow these principles:

- **Evidence:** distinguish content supported by photographs or measurements from inferences and unknowns.
- **Correction:** do not treat AI-generated results as evidence of historical fact. Reassess and correct details when more reliable sources become available.
- **Staged review:** establish spatial relationships and building forms before adding detail, with separate checks of code, rendered appearance and interaction.
- **Sources and rights:** record sources, dates, attribution and usage conditions. Keep material with unresolved permissions out of public releases.

### Development progress

Tasks and unresolved questions are tracked in [Issues](https://github.com/jonathan-digiart/project-wah-fu/issues). Proposed code changes are submitted for review through [Pull requests](https://github.com/jonathan-digiart/project-wah-fu/pulls).

Near-term work covers:

1. Establishing coordinates, scale and the site boundary.
2. Refining procedural terrain and building forms.
3. Checking building-to-ground connections and improving navigation.
4. Reviewing fidelity, performance and regression-test results.

Architectural detail and storytelling are later development goals, dependent on these foundations and verification of the supporting material.

### Licensing and materials

> Proposed revision: the following split licensing scheme is under consideration and has not yet been applied.

- **Code that the project has the right to license:** proposed licence: [PolyForm Noncommercial License 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0).
- **Original creative assets that the project has the right to license:** proposed licence: [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)](https://creativecommons.org/licenses/by-nc-sa/4.0/).
- **Third-party software, data and assets:** their respective licences and usage conditions continue to apply. Inclusion or reference in this project does not place them under the licences above. Government open data, reference photographs and other externally sourced material will have their sources, attribution and usage restrictions recorded separately.

Until the licence files and their scope have been confirmed and published, these are proposed choices rather than licences already in effect. The goal of free public access is separate from the licensing of code and assets for reuse.

### Technical documentation

See [Development and release](docs/development-and-release.md) for development commands, the release procedure, known limitations and data-source notices.

See the [changelog](CHANGELOG.md) for published versions and previews.
