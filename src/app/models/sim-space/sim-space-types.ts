/**
 * @cross-cutting
 * @tags @xc:render-shared, @xc:bindings
 * @consumers
 *   - sim-space-2d / sim-space-3d renderer implementations
 *   - per-class binding tab (both dimensions)
 *   - backend snapshot endpoint response shape
 * @impact-on-edit
 *   This is a barrel re-export — actual type defs live in `./types/`.
 *   Edit the per-facet file (core / object / binding / snapshot) and
 *   the import surface here stays stable.
 * @see /OVERLAP_MAP.md
 *
 * Barrel re-export. Each facet of the type model lives in its own file:
 *   - types/core.ts      dimensionality, position/rotation/scale, viewport, screen pos
 *   - types/object.ts    SimSpaceObject + SimSpaceConnection
 *   - types/binding.ts   SimSpaceBinding + temporal binding
 *   - types/snapshot.ts  Definition payload + Snapshot + ResolvedBinding
 *
 * Callers can import from this file (preserves the pre-split surface) or
 * directly from a facet when they only need one slice.
 */

export * from './types/core';
export * from './types/object';
export * from './types/binding';
export * from './types/snapshot';
export * from './types/evaluation';
