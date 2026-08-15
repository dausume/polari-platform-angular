import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { Subscription, firstValueFrom } from 'rxjs';

import { PolariService } from '@services/polari-service';

/**
 * sep-4 (decision 9): /engines/:engine — the engine DATA PAGE.
 * Three honest blocks: placement (which instances the topology
 * assigns the engine's modules to, refusals stated), reachability
 * (the resolution ladder's rungs, each stated), and usage over time
 * (metering windows — or "not tracked yet", never an empty chart
 * pretending to be zero).
 */

interface Placement {
  module: string;
  resolved: boolean;
  instance: string;
  url: string;
  refusal: string;
}

interface UsageWindow {
  windowStart: string;
  calls: number;
  errors: number;
  bytesOut: number;
  bytesIn: number;
  latencyMsAvg: number;
  latencyMsMax: number;
}

interface EngineReport {
  ok: boolean;
  engine: string;
  title: string;
  nature: string;
  app: string;
  placement: Placement[];
  reachability: {
    ladder: any[];
    capability: any;
    capabilityNote: string;
  };
  usage: { tracked: boolean; windows: UsageWindow[]; note: string };
  error?: string;
}

@Component({
  standalone: true,
  selector: 'engine-page',
  imports: [CommonModule, MatIconModule],
  template: `
  <div class="ep-page" *ngIf="report; else loading">
    <div class="ep-head">
      <mat-icon>memory</mat-icon>
      <h2>{{ report.title }}</h2>
      <span class="ep-chip">{{ report.nature }}</span>
      <span class="ep-chip app" *ngIf="report.app"
            (click)="goApp()">app: {{ report.app }}</span>
    </div>
    <div class="ep-error" *ngIf="!report.ok">{{ report.error }}</div>

    <ng-container *ngIf="report.ok">
    <h3>Placement</h3>
    <table class="ep-table">
      <tr><th>module seam</th><th>state</th><th>where</th></tr>
      <tr *ngFor="let p of report.placement">
        <td><code>{{ p.module }}</code></td>
        <td>
          <span class="ep-chip" [class.on]="p.resolved"
                [class.off]="!p.resolved">
            {{ p.resolved ? 'resolved' : 'unresolved' }}</span>
        </td>
        <td>
          <span *ngIf="p.resolved">{{ p.instance }}
            — <code>{{ p.url }}</code></span>
          <span class="ep-dim" *ngIf="!p.resolved">
            {{ p.refusal }}</span>
        </td>
      </tr>
    </table>

    <h3>Reachability — the resolution ladder</h3>
    <ol class="ep-ladder">
      <li *ngFor="let r of report.reachability.ladder">
        <strong>{{ r.rung }}</strong>
        <span *ngIf="r.name"> ({{ r.name }})</span>:
        <span class="ep-chip"
              [class.on]="r.set || r.bound || r.resolved"
              [class.off]="!(r.set || r.bound || r.resolved)">
          {{ (r.set || r.bound || r.resolved) ? 'answers'
             : 'silent' }}</span>
        <code *ngIf="r.value || r.url">{{ r.value || r.url }}</code>
      </li>
    </ol>
    <p *ngIf="report.reachability.capability" class="ep-cap">
      live capability:
      <code>{{ report.reachability.capability | json }}</code></p>
    <p *ngIf="!report.reachability.capability" class="ep-dim">
      {{ report.reachability.capabilityNote }}</p>

    <h3>Usage through this instance's seam</h3>
    <p class="ep-dim" *ngIf="!report.usage.tracked">
      {{ report.usage.note }}</p>
    <table class="ep-table" *ngIf="report.usage.tracked">
      <tr><th>window (UTC hour)</th><th>calls</th><th>errors</th>
          <th>bytes out/in</th><th>latency avg/max ms</th></tr>
      <tr *ngFor="let w of report.usage.windows">
        <td>{{ w.windowStart }}</td>
        <td>{{ w.calls }}</td>
        <td [class.ep-err]="w.errors">{{ w.errors }}</td>
        <td>{{ w.bytesOut }} / {{ w.bytesIn }}</td>
        <td>{{ w.latencyMsAvg }} / {{ w.latencyMsMax }}</td>
      </tr>
    </table>
    </ng-container>
  </div>
  <ng-template #loading>
    <div class="ep-page"><p>loading engine report…</p></div>
  </ng-template>
  `,
  styles: [`
    .ep-page { padding: 18px 24px; max-width: 900px; }
    .ep-head { display: flex; align-items: center; gap: 10px; }
    .ep-head h2 { margin: 0; }
    .ep-chip { border: 1px solid var(--border-strong, #888);
      border-radius: 12px; padding: 1px 10px; font-size: .8em; }
    .ep-chip.on { color: var(--ok-text, #2e7d32); }
    .ep-chip.off { color: var(--warn-text, #c98a00); }
    .ep-chip.app { cursor: pointer; }
    .ep-table { border-collapse: collapse; width: 100%; }
    .ep-table th, .ep-table td { text-align: left; padding: 4px 10px;
      border-bottom: 1px solid var(--border-weak, #ddd); }
    .ep-ladder li { margin: 4px 0; }
    .ep-dim { opacity: .7; }
    .ep-err { color: var(--warn-text, #c98a00); }
    .ep-error { color: var(--warn-text, #c98a00); }
    .ep-cap code { word-break: break-all; }
  `],
})
export class EnginePageComponent implements OnInit, OnDestroy {
  report: EngineReport | null = null;
  private sub?: Subscription;

  constructor(private route: ActivatedRoute,
              private router: Router,
              private http: HttpClient,
              private polariService: PolariService) {}

  ngOnInit(): void {
    this.sub = this.route.paramMap.subscribe(params => {
      void this.load(params.get('engine') || '');
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private async load(engine: string): Promise<void> {
    this.report = null;
    this.report = await firstValueFrom(this.http.get<EngineReport>(
      `${this.polariService.getBackendBaseUrl()}/api/engines/`
      + encodeURIComponent(engine),
      this.polariService.backendRequestOptions))
      .catch(err => (err?.error ?? {
        ok: false, engine, title: engine, nature: '', app: '',
        placement: [], usage: { tracked: false, windows: [],
                                note: '' },
        reachability: { ladder: [], capability: null,
                        capabilityNote: '' },
        error: `engine report unreachable (${err?.status ?? '?'})`,
      }));
  }

  goApp(): void {
    if (this.report?.app) {
      this.router.navigate(['/app', this.report.app]);
    }
  }
}
