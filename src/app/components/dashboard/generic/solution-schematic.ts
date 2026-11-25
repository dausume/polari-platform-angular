/**
 * cb-6 (AI-Notes/plans/COMPONENT_BINDING_PLAN.md §8c): the pure half of the WHOLE-SOLUTION schematic - every schematic component of one
 * hardware solution on one drawing, around its chip. Each component is laid out exactly as its card draws it (schematic-drawing.ts), the
 * blocks stacked top to bottom on the left; every line that ends at a chip pin runs on to the chip, drawn as one box on the right with its
 * pins named inside. A component that is not solved keeps its red. No d3, no network: rows in, a model out.
 */
import { PIN_DOT_X, SchematicComponentRow, SchematicDrawing, SchematicPartRow, SchematicPortRow, Wire, layoutSchematic } from './schematic-drawing';

export interface SolutionBlock { name: string; title: string; red: boolean; words: string; offsetY: number; drawing: SchematicDrawing; }
export interface ChipPin { x: number; y: number; pin: string; red: boolean; }
export interface SolutionSchematic {
  solution: string; chip: string; board: string; width: number; height: number;
  blocks: SolutionBlock[]; stubs: (Wire & { red: boolean })[]; chipBox: { x: number; y: number; w: number; h: number }; chipPins: ChipPin[];
  unsolved: number; words: string;
}

const CHIP_X = 300;      // the chip box's left edge
const CHIP_W = 120;
const GAP = 12;          // between two blocks
const HEAD = 18;         // a block's title line

const rank = (c: SchematicComponentRow) => ((c.solve_state || 'unsolved') === 'solved' ? 1 : 0);

/** The solutions the rows name (components with no hardware_solution - the drawing's prototype rows - belong to none). */
export function solutionsOf(components: SchematicComponentRow[]): string[] {
  return Array.from(new Set((components || []).map((c) => c.hardware_solution || '').filter((s) => !!s))).sort();
}

export function layoutSolution(solution: string, components: SchematicComponentRow[], ports: SchematicPortRow[],
                               parts: SchematicPartRow[]): SolutionSchematic {
  const comps = (components || []).filter((c) => c.hardware_solution === solution)
    .sort((a, b) => rank(a) - rank(b) || String(a.title || a.name).localeCompare(String(b.title || b.name)));
  const out: SolutionSchematic = { solution, chip: '', board: comps[0]?.board || '', width: CHIP_X + CHIP_W + 10, height: 0, blocks: [],
    stubs: [], chipBox: { x: CHIP_X, y: 0, w: CHIP_W, h: 0 }, chipPins: [], unsolved: 0, words: '' };
  let y = 0;
  for (const c of comps) {
    const full = layoutSchematic(c, ports, parts);
    // the pins' own labels and dots give way to the chip box: the line runs on to the chip, the pin is named there
    const drawing: SchematicDrawing = { ...full, labels: full.labels.filter((l) => l.x <= PIN_DOT_X), pins: [] };
    const offsetY = y + HEAD;
    out.blocks.push({ name: c.name, title: c.title || c.name, red: full.red, words: full.words, offsetY, drawing });
    for (const p of full.pins) {
      out.stubs.push({ x1: PIN_DOT_X, y1: offsetY + p.y, x2: CHIP_X, y2: offsetY + p.y, red: full.red });
      out.chipPins.push({ x: CHIP_X, y: offsetY + p.y, pin: p.pin || 'open', red: full.red });
      out.chip = out.chip || p.chip || '';
    }
    if (full.red) { out.unsolved++; }
    y = offsetY + full.height + GAP;
  }
  const ys = out.chipPins.map((p) => p.y);
  const top = ys.length ? Math.min(...ys) - 22 : 0;
  const bot = ys.length ? Math.max(...ys) + 16 : 40;
  out.chipBox = { x: CHIP_X, y: Math.max(top, 0), w: CHIP_W, h: bot - Math.max(top, 0) };
  out.height = Math.max(y, bot + 8);
  out.words = `${comps.length} component${comps.length === 1 ? '' : 's'} on ${out.chip || 'the chip'}`
    + (out.unsolved ? `; ${out.unsolved} not solved (drawn red)` : '; all solved');
  return out;
}
