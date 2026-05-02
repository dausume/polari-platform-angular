// Author: Dustin Etts
// Shared size-tier infrastructure for per-state overlay components.
//
// Every state overlay routes between three sized sub-views (tiny / compact / full)
// based on the host rect width. The breakpoints below are the project-wide defaults
// — individual states can override by passing a different threshold to resolveSizeTier
// if they need state-specific behavior, but the standard tiers are preferred.

export type SizeTier = 'tiny' | 'compact' | 'full';

export const TINY_MAX_WIDTH = 60;
export const COMPACT_MAX_WIDTH = 140;

export interface SizeTierBreakpoints {
  tinyMax: number;
  compactMax: number;
}

export const DEFAULT_BREAKPOINTS: SizeTierBreakpoints = {
  tinyMax: TINY_MAX_WIDTH,
  compactMax: COMPACT_MAX_WIDTH
};

export function resolveSizeTier(
  width: number,
  breakpoints: SizeTierBreakpoints = DEFAULT_BREAKPOINTS
): SizeTier {
  if (width < breakpoints.tinyMax) return 'tiny';
  if (width < breakpoints.compactMax) return 'compact';
  return 'full';
}
