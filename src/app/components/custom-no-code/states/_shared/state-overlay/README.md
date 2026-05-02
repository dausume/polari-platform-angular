# State Overlay Convention

Every per-state overlay in `states/<category>/<state>/<state>-overlay/` follows the
same shape so a developer opening any state folder can predict the structure.

## Folder layout

```
<state>-overlay/
├── <state>-overlay.component.ts      ← base: owns state, computes sizeTier, routes to a sub-view
├── <state>-overlay.component.html    ← template: a single [ngSwitch] over sizeTier
├── <state>-overlay.component.css     ← root wrapper styles (no per-tier styles here)
├── <state>-overlay.types.ts          ← state-specific input/output payload types only
├── views/
│   ├── tiny/                         ← width < 60px — icon stub, no controls
│   ├── compact/                      ← 60px ≤ width < 140px — header + condensed controls
│   └── full/                         ← width ≥ 140px — full editing surface
└── popup/                            ← OPTIONAL — per-state full-page popup (request via popupRequested)
```

## Base component contract

Every base overlay component declares **exactly these standard inputs and outputs**:

```ts
@Input() x: number = 0;
@Input() y: number = 0;
@Input() width: number = 100;
@Input() height: number = 100;
@Input() stateName: string = '';
@Input() solutionName: string = '';
@Input() boundObjectFieldValues: { [key: string]: any } = {};

@Output() fieldValuesChanged = new EventEmitter<{ [key: string]: any }>();
@Output() popupRequested = new EventEmitter<void>();   // emitted when the user clicks the expand button

sizeTier: SizeTier = 'full';
```

Plus state-specific inputs/outputs as needed (e.g. FormValidation adds `upstreamFields` and `slotsChanged`).

### Expand button (opt-in per state)

The expand button is part of every state's header **scaffolding**, but it only renders if
the state has declared a popup view. The base component owns this declaration:

```ts
// On the base component:
/** Set to true when the state has a popup/ sub-folder wired into the canvas. */
hasPopupView: boolean = false;
```

States that have a popup set `hasPopupView = true` (e.g. math, conditional-chain). States
without a popup leave it `false` — the button stays hidden, the contract stays uniform.

The base passes `hasPopupView` to its compact and full sub-views as an `@Input()`. The
sub-view template renders the button conditionally:

```html
<button class="expand-btn"
        *ngIf="hasPopupView"
        (click)="onExpand($event)"
        title="Open full view">
  <mat-icon>open_in_full</mat-icon>
</button>
```

Sub-views emit `expandClicked` (a `void` event); the base forwards as `popupRequested`. The
canvas (`custom-no-code.ts`) subscribes to `popupRequested` only for states that have a popup
component, opening the per-state popup via `MatDialog`. Tiny tier omits the button — there's
no header to attach it to.

Use the shared helper (relative path depends on overlay-folder depth):

```ts
// from states/<category>/<overlay-only>/<state>-overlay.component.ts:
import { SizeTier, resolveSizeTier } from '../../_shared/state-overlay/size-tier';
// from states/<category>/<state>/<state>-overlay/<state>-overlay.component.ts:
import { SizeTier, resolveSizeTier } from '../../../_shared/state-overlay/size-tier';
```

The `StateOverlayManager` calls `forceUpdateSizeMode()` on each component during zoom/pan,
so every base must implement it to recompute `sizeTier` from the current `width`.

## Sub-view contract

Sub-views are presentational — they receive already-computed data via `@Input()`s and
emit user interactions back to the base via `@Output()`s. They never own persistent state.

Keep sub-view selectors in the form `<state>-overlay-<tier>` (e.g. `form-validation-overlay-tiny`)
so multiple states can declare similarly-named sub-views without collision.

## Popup view contract

The popup view is optional. If a state has a `popup/` sub-folder, the base emits
`popupRequested` and the canvas opens that component inside a generic dialog shell
(see `popups/state-page-popup/`). If no popup exists, the generic state-page-popup is used.

A popup component is a regular Angular component receiving the same standard inputs as
the base and emitting `fieldValuesChanged`. It owns its own larger editing surface.
