// Author: Dustin Etts
// Shared type system for the value-binding selector family.
//
// Two leaf selectors (`value-source-selector`, `value-potential-selector`) compose
// the same parent shell + the same branch sub-components. This file defines the
// vocabulary they share so a literal entered through either selector has the
// same shape, and so the shell's branch dropdown can be filtered consistently.

/**
 * Discriminator for which branch UI is active.
 *
 *   - `literal`        — direct value entry (source) OR typed placeholder (potential)
 *   - `from_upstream`  — pick an upstream input slot variable (SOURCE only)
 *   - `from_object`    — pick object instance + field path (source) OR class spec (potential)
 *   - `from_dataset`   — pick dataset + field (source) OR dataset shape (potential)
 *   - `parameter`      — declare a named, typed runtime parameter (POTENTIAL only)
 */
export type BranchKind =
    | 'literal'
    | 'from_upstream'
    | 'from_object'
    | 'from_dataset'
    | 'parameter';

/** Mode the parent shell is operating in. Drives header chrome + default branch set. */
export type SelectorMode = 'source' | 'potential';

/** Primitive type tags carried by literal & parameter branches. */
export type ValueTypeTag = 'int' | 'float' | 'str' | 'bool';

/** Catalog entry for one branch — what label/icon to show in the kind dropdown. */
export interface BranchOption {
    kind: BranchKind;
    label: string;
    icon: string;
}

/**
 * Full catalog of branches with display metadata.
 * Leaf selectors filter this list to advertise only the kinds they support.
 */
export const BRANCH_OPTIONS: BranchOption[] = [
    { kind: 'literal',       label: 'Literal Value',          icon: 'edit' },
    { kind: 'from_upstream', label: 'From Upstream Variable', icon: 'data_object' },
    { kind: 'from_object',   label: 'From Object Instance',   icon: 'account_tree' },
    { kind: 'from_dataset',  label: 'From DataSet',           icon: 'table_chart' },
    { kind: 'parameter',     label: 'Parameter',              icon: 'tune' },
];

/** Fast lookup: kind → option (label/icon). */
export function getBranchOption(kind: BranchKind): BranchOption | undefined {
    return BRANCH_OPTIONS.find(o => o.kind === kind);
}

/**
 * Header chrome label shown by the parent shell when `[showHeader]=true`.
 * Used in popup contexts so the user can tell "I'm picking a live source"
 * from "I'm declaring an expected input shape".
 */
export function modeHeaderLabel(mode: SelectorMode): string {
    return mode === 'source' ? 'Data Source Selection' : 'Data Potential Selection';
}

/**
 * Helper tooltip text for the header info icon.
 */
export function modeHeaderTooltip(mode: SelectorMode): string {
    return mode === 'source'
        ? 'Pick a concrete source carrying a live value at runtime. Used inside no-code states where upstream variables, objects, and datasets are already in scope.'
        : 'Declare the *shape* of input this binding should receive. Used at design time (e.g. on an equation) before a state-space context exists. When the equation is later dropped into a state, each potential becomes a slot for the source selector to fill.';
}

// ============================================================================
// Data Potential definition
// ============================================================================

/**
 * The branches a `value-potential-selector` may produce. Subset of BranchKind
 * — `from_upstream` is excluded (you can't declare "needs to come from input
 * slot 2" as a shape; that's a binding, not a type).
 */
export type DataPotentialKind = 'literal' | 'from_object' | 'from_dataset' | 'parameter';

/**
 * Describes the *shape* of an input a binding expects, with no concrete value.
 * Stored alongside an equation (or any design-time artifact) and later
 * fulfilled by a `value-source-selector` when the artifact is hosted inside
 * a state-space.
 */
export interface DataPotentialDefinition {
    kind: DataPotentialKind;

    /** `literal` / `parameter`: primitive type the supplied value must match. */
    valueType?: ValueTypeTag;

    /** `from_object`: class identifier expected (matches a top-level object name). */
    className?: string;

    /** `from_dataset`: dataset id expected — host states must supply a dataset
     *  with this id, or a runtime-bound dataset where the type is compatible. */
    datasetId?: string;

    /** `parameter`: the name the runtime caller must use when supplying value. */
    parameterName?: string;
}

/** Branches the potential selector exposes by default. */
export const POTENTIAL_ALLOWED_BRANCHES: BranchKind[] = [
    'literal',
    'from_object',
    'from_dataset',
    'parameter',
];

/** Map a DataPotentialKind onto the matching BranchKind. They share names but
 *  the union of the latter is wider, so this is a narrowing convenience. */
export function potentialKindToBranchKind(k: DataPotentialKind): BranchKind {
    return k as BranchKind;
}

/** Default potential — picks `literal:float` as the most common case. */
export function createDefaultPotential(): DataPotentialDefinition {
    return { kind: 'literal', valueType: 'float' };
}
