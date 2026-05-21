# Sim Space — Frontend Cross-Cutting Module

This file is the impact-check companion to
`/home/user/Desktop/polari-suite/polari-rf-node/OVERLAP_MAP.md`.
Read both before editing anything under any `sim-space*` directory.

## Three directories, three responsibilities

```
models/sim-space/        models/sim-space-2d/        models/sim-space-3d/
services/sim-space/      services/sim-space-2d/      services/sim-space-3d/
components/sim-space/    components/sim-space-2d/    components/sim-space-3d/
```

- **`sim-space/`** — shared abstraction. `SimSpaceRenderer` interface,
  `SimSpaceObject` base, `SimSpaceDefinition` base, `SimSpaceBinding`,
  `SimSpaceOverlayManager`, `SimSpacePicker`. Anything in here is consumed by
  both 2D and 3D and (eventually) the no-code editor.
  Imports of `d3` or `three` are **forbidden** here.

- **`sim-space-2d/`** — 2D SVG-based implementation. `D3SimSpaceRenderer`,
  Shape2D + Style2D libraries (absorbing `SvgIconLibrary`), 2D viewer.
  Imports `d3` and the shared `sim-space/` layer only.

- **`sim-space-3d/`** — 3D WebGL-based implementation (Phase 2+).
  `ThreeSimSpaceRenderer`, Mesh3D + Material3D + Texture3D libraries, 3D viewer.
  Imports `three` (lazy-loaded) and the shared `sim-space/` layer only.

## What changes here affects

| If you edit … | Run these smoke checks |
|---|---|
| Anything in `sim-space/` | All of the below |
| `sim-space-2d/` shape layers | No-code editor: drag a state, draw a transition, save/load |
| `sim-space-2d/` renderer interface | No-code editor + any existing SimSpace2D demos |
| `sim-space-2d/` shape/style library | All `SvgIconLibrary` consumers (maps, table buttons, class-data-table) |
| `sim-space-3d/` renderer | Any existing SimSpace3D demos |
| Anything in `services/sim-space*/` | All viewers that inject the affected service |

## Header comment

Every `.ts` file inside these directories carries the `@cross-cutting`
header from `OVERLAP_MAP.md`. When you add a new consumer, update both the
header and the OVERLAP_MAP row in the same PR.
