/**
 * /isle Coherence tab — the JOINED topology: the isle topology
 * (devices/agents — where packets go) and the polari topology
 * (instances — what runs where) displayed and ASSESSED together.
 * Assessments are evidence-bearing suggestions (knobs rule): the
 * page never acts; the named verbs do.
 */
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';

import { PolariService } from '@services/polari-service';

interface CoherenceApp {
  name: string;
  domain: string;
  subdomains: string[];
}

interface CoherenceDevice {
  name: string;
  agent_present: boolean;
  app_count: number;
  apps: CoherenceApp[];
  polari_instances: string[];
}

interface PolariInstance {
  app: string;
  device: string;
  domain: string;
  role: string;
  subdomains: string[];
}

interface Assessment {
  level: string;
  code: string;
  message: string;
}

@Component({
  selector: 'app-isle-coherence',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  template: `
    <div class="coherence-page">
      <div class="head">
        <div>
          <h1>Topology coherence</h1>
          <p class="sub">
            The isle topology (devices, agents — where packets go)
            joined with the polari topology (instances — what runs
            where). Assessments suggest; the named verbs act.
          </p>
        </div>
        <button mat-stroked-button (click)="refresh()"
                [disabled]="loading">
          <mat-icon>refresh</mat-icon> Refresh
        </button>
      </div>

      <div class="err" *ngIf="loadError">{{ loadError }}</div>
      <div *ngIf="loading">Loading…</div>

      <ng-container *ngIf="!loading && !loadError">
        <h2>Assessments</h2>
        <ul class="assessments">
          <li *ngFor="let a of assessments"
              class="level-{{ a.level }}">
            <span class="lvl">{{ a.level }}</span>
            {{ a.message }}
          </li>
          <li *ngIf="!assessments.length" class="level-ok">
            <span class="lvl">ok</span> nothing to flag —
            topologies are coherent
          </li>
        </ul>

        <h2>Polari instances</h2>
        <div class="dev-table">
          <div class="dev-row pol-head dev-head">
            <span>instance</span><span>role</span>
            <span>device</span><span>domains</span>
          </div>
          <div class="dev-row pol-row" *ngFor="let i of polari">
            <span class="dev-name mono">{{ i.app }}</span>
            <span>
              <span class="role role-{{ i.role }}">{{ i.role }}
              </span>
            </span>
            <span>{{ i.device || '?' }}</span>
            <span class="mono">{{ i.domain }}
              <span class="subs" *ngIf="i.subdomains.length">
                + {{ i.subdomains.join(', ') }}</span>
            </span>
          </div>
        </div>
        <p class="comp-hint" *ngIf="components">
          Component shape: polari installs as SUBSECTIONS of
          itself —
          <span *ngFor="let c of componentKeys(); let last = last">
            <code>{{ c }}</code>
            <em>({{ components[c] }})</em><span *ngIf="!last">,
            </span>
          </span>. Backends are the replicable part; component
          installs land with the shared-db profile arc.
        </p>

        <h2>Devices × what runs where</h2>
        <div class="dev-table">
          <div class="dev-row dev-head">
            <span>device</span><span>member</span>
            <span>polari instances</span><span>apps + subdomains</span>
          </div>
          <div class="dev-row" *ngFor="let d of devices">
            <span class="dev-name">{{ d.name }}</span>
            <span>
              <mat-icon inline class="{{ d.agent_present
                ? 'yes' : 'no' }}">
                {{ d.agent_present ? 'check_circle' : 'cancel' }}
              </mat-icon>
              {{ d.agent_present ? 'agent up' : 'no agent' }}
            </span>
            <span class="mono">
              {{ d.polari_instances.join(', ') || '—' }}</span>
            <span class="mono apps-cell">
              <span class="app-line" *ngFor="let a of d.apps">
                {{ a.name }}
                <span class="subs" *ngIf="a.subdomains.length">
                  ({{ a.subdomains.join(', ') }})</span>
              </span>
              <span *ngIf="!d.apps.length">—</span>
            </span>
          </div>
        </div>

        <h2>Scaling polari</h2>
        <p *ngIf="candidates.length" class="scale-hint">
          polari could also run on
          <strong>{{ candidates.join(', ') }}</strong> — on that
          device: <code>isle polari instance deploy</code>
          (a mesh-app install; it appears here and in the store as
          another tracked instance).
        </p>
        <p *ngIf="!candidates.length" class="scale-hint">
          every member device already hosts a polari instance.
        </p>
      </ng-container>
    </div>
  `,
  styles: [`
    .coherence-page { padding: 16px 24px; max-width: 1000px; }
    .head { display: flex; justify-content: space-between;
            align-items: start; gap: 16px; }
    .sub { color: var(--text-muted, #666); max-width: 640px; }
    .assessments { list-style: none; padding: 0;
      li { margin: 4px 0; padding: 6px 10px; border-radius: 6px;
           background: var(--surface-2, #f4f4f6); }
      .lvl { font-weight: 700; text-transform: uppercase;
             font-size: .7rem; margin-right: 8px; }
      .level-warn .lvl { color: #c62828; }
      .level-info .lvl { color: #1565c0; }
      .level-ok .lvl { color: #2e7d32; }
    }
    .dev-table { border: 1px solid var(--border, #ddd);
                 border-radius: 8px; overflow: hidden; }
    .dev-row { display: grid;
      grid-template-columns: 1.4fr 1fr 1.2fr 2fr;
      gap: 8px; padding: 8px 12px;
      border-top: 1px solid var(--border, #eee);
      &.dev-head { font-weight: 600; border-top: none;
                   background: var(--surface-2, #f4f4f6); }
    }
    .dev-name { font-weight: 600; }
    .mono { font-family: monospace; font-size: .85rem;
            overflow-wrap: anywhere; }
    mat-icon.yes { color: #2e7d32; }
    mat-icon.no { color: #c62828; }
    .role { font-size: .7rem; font-weight: 700;
      text-transform: uppercase; border-radius: 4px;
      padding: 2px 6px; }
    .role-core { background: #1565c0; color: #fff; }
    .role-additional { background: #00897b; color: #fff; }
    .subs { color: var(--text-muted, #777); font-size: .8rem; }
    .apps-cell .app-line { display: block; }
    .comp-hint { font-size: .85rem; color: var(--text-muted, #666);
      code { background: var(--surface-2, #f4f4f6);
             padding: 1px 5px; border-radius: 4px; } }
    .scale-hint code { background: var(--surface-2, #f4f4f6);
                       padding: 2px 6px; border-radius: 4px; }
  `],
})
export class IsleCoherenceComponent implements OnInit {
  devices: CoherenceDevice[] = [];
  assessments: Assessment[] = [];
  candidates: string[] = [];
  polari: PolariInstance[] = [];
  components: Record<string, string> | null = null;
  loading = true;
  loadError = '';

  componentKeys(): string[] {
    return this.components ? Object.keys(this.components) : [];
  }

  constructor(private http: HttpClient,
              private polariService: PolariService) {}

  ngOnInit(): void {
    this.refresh();
  }

  async refresh(): Promise<void> {
    this.loading = true;
    this.loadError = '';
    const data: any = await firstValueFrom(this.http.get(
      `${this.polariService.getBackendBaseUrl()}`
      + `/api/islemesh/coherence`,
      this.polariService.backendRequestOptions))
      .catch(() => null);
    this.loading = false;
    if (!data?.ok) {
      this.loadError = 'GET /api/islemesh/coherence did not '
        + 'answer — is the islemesh module deployed?';
      return;
    }
    this.devices = data.devices ?? [];
    this.assessments = data.assessments ?? [];
    this.candidates = data.polari?.candidates ?? [];
    this.polari = data.polari?.instances ?? [];
    this.components = data.polari?.components ?? null;
  }
}
