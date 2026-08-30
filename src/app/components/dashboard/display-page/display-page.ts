import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { DisplayManagerService } from '@services/dashboard/display-manager.service';
import { Display } from '@models/dashboards/Display';
import { DisplayRendererComponent } from '@components/dashboard/dashboard-renderer/dashboard-renderer';
import { Subscription, combineLatest } from 'rxjs';
import { registerMsimDisplayComponents } from '@components/multi-scale/msim-display-components';
import { registerMsciDisplayComponents } from '@components/materials-science/msci-display-components';
import { registerAquaponicsDisplayComponents } from '@components/aquaponics/aquaponics-display-components';
import { registerGenericDisplayComponents } from '@components/dashboard/generic/generic-display-components';
import { registerPsppDisplayComponents } from '@components/pspp/pspp-display-components';
import { registerVideoDisplayComponents } from '@components/video/video-display-components';
import { DisplayEventsService } from '@services/no-code-services/display-events.service';

@Component({
  standalone: true,
  selector: 'display-page',
  template: `
    <div class="display-page-container">
      <div *ngIf="loading" class="display-page-loading">
        <mat-spinner diameter="48"></mat-spinner>
        <p>Loading display...</p>
      </div>

      <div *ngIf="error && !loading" class="display-page-error">
        <mat-icon>error_outline</mat-icon>
        <h3>Display Not Found</h3>
        <p>{{ error }}</p>
      </div>

      <div *ngIf="needsObject && !loading && !error" class="display-page-error">
        <mat-icon>info_outline</mat-icon>
        <h3>This page needs an object</h3>
        <p>It is a generic page: open it as
          /display/{{ currentDisplayId }}?object=&lt;name&gt; and every
          panel is pointed at that object's own data.</p>
      </div>

      <dashboard-renderer
        *ngIf="display && !loading && !error && !needsObject"
        [dashboard]="display"
        [context]="rendererContext">
      </dashboard-renderer>
    </div>
  `,
  styles: [`
    .display-page-container {
      padding: 16px;
      min-height: calc(100vh - 64px);
    }
    .display-page-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 80px 20px;
    }
    .display-page-loading p {
      margin-top: 16px;
      color: var(--text-secondary);
    }
    .display-page-error {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 80px 20px;
      text-align: center;
      color: var(--text-secondary);
    }
    .display-page-error mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: #ccc;
      margin-bottom: 16px;
    }
    .display-page-error h3 {
      margin: 0 0 8px 0;
      color: var(--text-primary);
    }
  `],
  imports: [CommonModule, MatProgressSpinnerModule, MatIconModule, DisplayRendererComponent]
})
export class DisplayPageComponent implements OnInit, OnDestroy {
  display: Display | null = null;
  loading = true;
  error: string | null = null;
  /** fg-1: the page's object (?object=<name>) — every '{object}' in
   *  the definition's inputs/titles is substituted with it. */
  objectName: string | null = null;
  /** true when the definition still contains '{object}' because the
   *  page was opened without ?object= — banner, not broken panels. */
  needsObject = false;

  private sub?: Subscription;
  private eventsSub?: Subscription;
  private currentId: string | null = null;

  get currentDisplayId(): string { return this.currentId || ''; }

  get rendererContext(): { object: string } {
    return { object: this.objectName || '' };
  }

  constructor(
    private route: ActivatedRoute,
    private displayManager: DisplayManagerService,
    private displayEvents: DisplayEventsService
  ) {}

  ngOnInit(): void {
    // Displays may contain multi-scale panels (scene/graph/IC pickers)
    // or materials-science pages (basis browser, formulation-search
    // workbench); register their components before rendering.
    registerMsimDisplayComponents();
    registerMsciDisplayComponents();
    registerAquaponicsDisplayComponents();
    registerGenericDisplayComponents();
    registerPsppDisplayComponents();
    registerVideoDisplayComponents();
    // fg-1: one page definition, many objects — the id names the
    // generic page, ?object= names the row it renders for.
    this.sub = combineLatest([this.route.paramMap, this.route.queryParamMap])
      .subscribe(([params, query]) => {
        const id = params.get('id');
        this.objectName = query.get('object');
        if (id) {
          this.currentId = id;
          this.loadDisplay(id);
        } else {
          this.loading = false;
          this.error = 'No display ID provided.';
        }
      });
    // First consumer of the display event bus (P4): a no-code solution
    // emitting an event named 'refreshDisplay' re-fetches this display's
    // data — form saves can refresh what the page shows, no code.
    this.eventsSub = this.displayEvents.on('refreshDisplay').subscribe(() => {
      if (this.currentId) this.loadDisplay(this.currentId);
    });
  }

  private loadDisplay(id: string): void {
    this.loading = true;
    this.error = null;
    this.displayManager.loadDisplay(id).subscribe({
      next: (display: Display) => {
        this.needsObject = this.substituteObject(display, this.objectName);
        this.display = display;
        this.loading = false;
      },
      error: (err: any) => {
        this.loading = false;
        this.error = `Could not load display "${id}".`;
        console.error('[DisplayPage] Load failed:', err);
      }
    });
  }

  /** Replaces '{object}' in every item title and componentProps
   *  input string (nested rows included). Returns true when a
   *  '{object}' could NOT be resolved — the page was opened without
   *  ?object= — so the caller shows one clear banner instead of a
   *  page of 404ing panels. */
  private substituteObject(display: Display, objectName: string | null): boolean {
    let unresolved = false;
    const sub = (v: any): any => {
      if (typeof v !== 'string' || !v.includes('{object}')) { return v; }
      if (!objectName) { unresolved = true; return v; }
      return v.split('{object}').join(objectName);
    };
    const walkItem = (item: any): void => {
      if (!item) { return; }
      item.title = sub(item.title);
      const inputs = item.componentProps?.inputs;
      if (inputs && typeof inputs === 'object') {
        for (const k of Object.keys(inputs)) { inputs[k] = sub(inputs[k]); }
      }
      (item.nestedRows || []).forEach(walkRow);
    };
    // The deserialized model keeps row items in `dashboardItems`
    // (DisplayRow) and column items in `dashboardItems` too
    // (DisplayColumn) — the definition JSON's `items` key does NOT
    // survive deserialization (that miss shipped once: every panel
    // called the API with a literal '{object}').
    const walkRow = (row: any): void => {
      (row?.dashboardItems || row?.items || []).forEach(walkItem);
      (row?.columns || []).forEach((col: any) =>
        (col?.dashboardItems || col?.items || []).forEach(walkItem));
    };
    (display?.rows || []).forEach(walkRow);
    return unresolved;
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.eventsSub?.unsubscribe();
  }
}
