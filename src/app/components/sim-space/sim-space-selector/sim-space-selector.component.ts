import {
  AfterViewInit, Component, Input, OnDestroy, ViewChild, ViewContainerRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Subscription } from 'rxjs';

import {
  SimSpaceViewerComponent,
} from '@components/sim-space/sim-space-viewer/sim-space-viewer.component';
import {
  StateOverlayManager,
} from '@services/no-code-services/state-overlay-manager.service';
import { OverlayAnchor } from '@services/sim-space/overlay-anchor';
import {
  DisplaySelectionContextService,
} from '@services/dashboard/display-selection-context.service';
import { MsimProofService } from '@services/multi-scale/msim-proof.service';
import {
  SelectorOverlayOrchestrator,
} from './selector-overlay-orchestrator';
import {
  registerSelectionOverlay,
} from '@components/sim-space/selection-overlays/selection-overlay-registry';
import {
  MaterialChoiceOverlayComponent, MaterialProofState,
} from '@components/sim-space/selection-overlays/material-choice-overlay/material-choice-overlay.component';
import {
  MaterialChoicePopupComponent, MaterialChoicePopupData,
} from '@components/sim-space/selection-overlays/material-choice-overlay/material-choice-popup.component';
import {
  ElementChoiceOverlayComponent,
} from '@components/sim-space/selection-overlays/element-choice-overlay/element-choice-overlay.component';
import {
  ElementChoicePopupComponent, ElementChoicePopupData, ElementChoiceResult,
} from '@components/sim-space/selection-overlays/element-choice-overlay/element-choice-popup.component';

/** One selectable object of the space (all knobs — pure config). */
export interface SelectorItem {
  key: string;
  label: string;
  /** The freestanding object id in the selection scene. */
  objectId: string;
  /** Which registered overlay renders on it (selection-overlay-registry). */
  overlayRef?: string;
  description?: string;
  /** Open the details popup from the overlay's expand button. */
  popup?: boolean;
  /** VARIANTS of this choice (e.g. an element's ions) — offered in the
   *  popup; picking one publishes {key, variant} instead of key. */
  variants?: string[];
  /** Extra inputs forwarded verbatim to the overlay component (e.g.
   *  atomicNumber/elementName for element-choice) — pure config. */
  overlayInputs?: Record<string, unknown>;
}

/**
 * The `sim-space-selector` — a NEW KIND of configurable interface: a 3D
 * SELECTION SPACE. A fixed-camera scene (camera_json mode:'fixed') whose
 * objects are selectable choices; each carries a tiered overlay anchored
 * on its projected "shell shape" via the SAME StateOverlayManager +
 * overlay-component convention the 2D no-code canvas uses (size tiers,
 * popupRequested → MatDialog), and clicking an object publishes the
 * selection into the display-context channel for sibling components.
 *
 * Composition of existing machinery: sim-space-viewer (scene) +
 * StateOverlayManager (overlays/popups) + DisplaySelectionContext
 * (runtime selection channel) + MsimProofService (proof badges). The
 * scene, its items and the context key are all configuration —
 * registered in the DISPLAY_COMPONENT_REGISTRY so any Display can place
 * one.
 */
@Component({
  standalone: true,
  selector: 'sim-space-selector',
  imports: [CommonModule, MatDialogModule, SimSpaceViewerComponent],
  template: `
    <div class="selector-frame">
      <sim-space-viewer #viewer
          [simSpaceName]="simSpaceRef"
          [hideRunPanel]="true"
          [clickNavigates]="false"
          (objectClicked)="onObjectClicked($event)">
      </sim-space-viewer>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .selector-frame { position: relative; min-height: 260px; }
    sim-space-viewer { display: block; height: 100%; }
  `],
})
export class SimSpaceSelectorComponent implements AfterViewInit, OnDestroy {
  /** The selection scene (a SimSpaceDefinition — typically camera_json
   *  mode:'fixed' so framing and overlay anchors stay stable). */
  @Input({ required: true }) simSpaceRef!: string;
  @Input() items: SelectorItem[] = [];
  /** The display-context key selections publish under. */
  @Input() contextKey = 'selectedMaterialKey';
  /** Proof-badge source: the composition + stage whose proofs speak
   *  for these items (optional — badges show 'unproven' without it). */
  @Input() msimName = '';
  @Input() stageKey = '';

  @ViewChild('viewer') viewer!: SimSpaceViewerComponent;

  selectedKey: string | null = null;

  private orchestrator: SelectorOverlayOrchestrator;
  private subs: Subscription[] = [];
  private hostResizeObserver: ResizeObserver | null = null;
  /** Stable ref so removeEventListener can match the capture listener. */
  private onAnyScroll = () => this.orchestrator.reposition();

  constructor(
    overlayManager: StateOverlayManager,
    private vcr: ViewContainerRef,
    private dialog: MatDialog,
    private selectionContext: DisplaySelectionContextService,
    private proofService: MsimProofService,
  ) {
    // Idempotent — the built-in overlay kinds.
    registerSelectionOverlay('material-choice', MaterialChoiceOverlayComponent);
    registerSelectionOverlay('element-choice', ElementChoiceOverlayComponent);
    this.orchestrator = new SelectorOverlayOrchestrator(overlayManager);
  }

  ngAfterViewInit(): void {
    // The viewer creates its renderer asynchronously (dynamic three
    // import) — poll briefly until it exists, then wire everything.
    const started = Date.now();
    const tryWire = () => {
      const renderer = this.viewer?.getRenderer();
      if (!renderer) {
        if (Date.now() - started < 15000) setTimeout(tryWire, 200);
        return;
      }
      this.wire();
    };
    tryWire();
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.hostResizeObserver?.disconnect();
    window.removeEventListener('scroll', this.onAnyScroll, { capture: true });
    this.orchestrator.destroy();
  }

  onObjectClicked(objectId: string | null): void {
    const item = this.items.find(i => i.objectId === objectId);
    if (!item) return;
    // Items WITH variants (an element's ions) open the popup on click —
    // the selection needs the variant decision; plain items select
    // directly.
    if (item.variants?.length && item.popup !== false) {
      this.select(item.key);
      this.openPopup(item.key);
      return;
    }
    this.select(item.key);
  }

  select(key: string, variant?: string): void {
    if (!this.items.some(i => i.key === key)) return;
    this.selectedKey = key;
    // Publish for siblings (the IC picker follows via followContextKey).
    // A variant selection (an ion) publishes the pair.
    this.selectionContext.publish(
      this.contextKey, variant ? { key, variant } : key);
    const selected = this.items.find(i => i.key === key);
    this.viewer.getRenderer()?.setSelection(
      selected ? [selected.objectId] : []);
    this.pushOverlayStates();
  }

  private wire(): void {
    const renderer = this.viewer.getRenderer()!;
    const anchor = new OverlayAnchor(renderer, this.viewer.getViewerHost());
    this.orchestrator.attach(anchor, this.vcr, this.items.map(item => ({
      key: item.key,
      objectId: item.objectId,
      overlayRef: item.overlayRef || 'material-choice',
      inputs: {
        label: item.label,
        description: item.description ?? '',
        proofState: this.proofStateOf(item.key),
        selected: false,
        ...(item.overlayInputs ?? {}),
      },
    })));

    // The 3D analogue of the 2D zoom/pan sync: reproject anchors on any
    // camera/view change, plus host resizes.
    renderer.setOnViewChange(() => this.orchestrator.reposition());
    if (typeof ResizeObserver !== 'undefined') {
      this.hostResizeObserver =
        new ResizeObserver(() => this.orchestrator.reposition());
      this.hostResizeObserver.observe(this.viewer.getViewerHost());
    }
    // Overlays are viewport-fixed while the host lives in the page flow —
    // scrolling moves the tiles under the overlays without any camera or
    // resize event. Capture-phase because scroll doesn't bubble, so this
    // also catches nested scrollable ancestors.
    window.addEventListener(
      'scroll', this.onAnyScroll, { capture: true, passive: true });
    // Snapshot loads settle async — a short reposition tail covers the
    // first paint without a visible jump.
    setTimeout(() => this.orchestrator.reposition(), 500);
    setTimeout(() => this.orchestrator.reposition(), 1500);

    this.subs.push(this.orchestrator.popupRequested$.subscribe(
      key => this.openPopup(key)));
    // Proof verdicts update badges live.
    this.subs.push(this.proofService.proofChanged$.subscribe(ev => {
      if (this.msimName && ev.msim !== this.msimName) return;
      this.pushOverlayStates();
    }));
  }

  private pushOverlayStates(): void {
    for (const item of this.items) {
      this.orchestrator.updateInputs(item.key, {
        proofState: this.proofStateOf(item.key),
        selected: item.key === this.selectedKey,
      });
    }
  }

  private proofStateOf(key: string): MaterialProofState {
    if (!this.msimName || !this.stageKey) return 'unproven';
    const report = this.proofService.get(this.msimName, this.stageKey, key);
    if (!report) return 'unproven';
    if (report.achieved) return 'proven';
    return report.exhausted ? 'impossible' : 'unproven';
  }

  private proofSummaryOf(key: string): string {
    const report = this.msimName && this.stageKey
      ? this.proofService.get(this.msimName, this.stageKey, key) : null;
    if (!report) return '';
    if (report.achieved && report.winner) {
      const c = report.winner.candidate;
      return `Proven at ${Object.entries(c)
        .map(([k, v]) => `${k} = ${v}`).join(', ')}`;
    }
    if (report.exhausted) {
      return report.attempts?.[0]?.reason
        || 'No tried condition produced a solid ball.';
    }
    return '';
  }

  private openPopup(key: string): void {
    const item = this.items.find(i => i.key === key);
    if (!item || item.popup === false) return;
    // Popup kind follows the overlay kind (the item's overlayRef knob).
    // Both use the SAME MatDialog wiring the 2D state overlays use.
    if ((item.overlayRef || 'material-choice') === 'element-choice') {
      const data: ElementChoicePopupData = {
        key: item.key,
        label: `${item.label}${item.description ? ' — ' + item.description : ''}`,
        description: item.description ?? '',
        variants: item.variants ?? [],
      };
      this.dialog.open(ElementChoicePopupComponent, {
        data, panelClass: 'state-overlay-popup-panel', maxWidth: '480px',
      }).afterClosed().subscribe((result?: ElementChoiceResult) => {
        if (result?.select) this.select(key, result.variant);
      });
      return;
    }
    const data: MaterialChoicePopupData = {
      key: item.key,
      label: item.label,
      description: item.description ?? '',
      proofState: this.proofStateOf(item.key),
      proofSummary: this.proofSummaryOf(item.key),
      msimName: this.msimName,
      stageKey: this.stageKey,
    };
    this.dialog.open(MaterialChoicePopupComponent, {
      data, panelClass: 'state-overlay-popup-panel', maxWidth: '640px',
    }).afterClosed().subscribe(result => {
      if (result === 'select') this.select(key);
    });
  }
}
