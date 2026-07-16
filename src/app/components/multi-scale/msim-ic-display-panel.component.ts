import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

import { MsimIcPanelComponent } from './msim-ic-panel.component';
import {
  InitialConditionInterfaceService,
} from '@services/multi-scale/initial-condition-interface.service';
import { IcInterfaceConfig } from '@models/multi-scale/msim-types';
import { MsimPanelBusService } from '@services/multi-scale/msim-panel-bus.service';

/**
 * Display-embeddable wrapper for the interactive IC-interface panel
 * (material picker etc.). Loads the IcInterfaceConfig by name (Display
 * item inputs are plain JSON) and forwards run-created events onto the
 * panel bus so the page follows new runs even when the panel lives
 * inside a custom Display layout.
 * Registered as `msim-ic-panel` in the DISPLAY_COMPONENT_REGISTRY.
 */
@Component({
  standalone: true,
  selector: 'msim-ic-display-panel',
  imports: [CommonModule, MsimIcPanelComponent],
  template: `
    <msim-ic-panel *ngIf="ic"
      [ic]="ic"
      [coupledRunRefs]="coupledRunRefs"
      [busy]="running"
      (runCreated)="onRunCreated($event)">
    </msim-ic-panel>
    <div class="ic-loading" *ngIf="!ic && icInterfaceRef">
      Loading {{ icInterfaceRef }}…
    </div>
  `,
  styles: [`
    .ic-loading { padding: 16px; color: var(--text-secondary, #607d8b); font-size: 13px; }
  `],
})
export class MsimIcDisplayPanelComponent implements OnInit, OnChanges, OnDestroy {
  /** Per-item input (stored in the Display definition). */
  @Input() icInterfaceRef = '';

  /** Context inputs (merged in by the dashboard renderer). */
  @Input() msimName = '';
  @Input() coupledRunRefs: Record<string, string> = {};
  @Input() running = false;

  ic: IcInterfaceConfig | null = null;
  private sub?: Subscription;

  constructor(
    private icService: InitialConditionInterfaceService,
    private bus: MsimPanelBusService,
  ) {}

  ngOnInit(): void { this.load(); }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['icInterfaceRef'] && !changes['icInterfaceRef'].firstChange) {
      this.ic = null;
      this.load();
    }
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  private load(): void {
    if (!this.icInterfaceRef) return;
    this.sub = this.icService.loadByName(this.icInterfaceRef).subscribe({
      next: (cfg) => (this.ic = cfg),
      error: () => { /* keep the loading note; the ref may not exist yet */ },
    });
  }

  onRunCreated(runName: string): void {
    this.bus.runCreated$.next(runName);
  }
}
