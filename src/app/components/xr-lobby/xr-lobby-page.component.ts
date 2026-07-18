import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subscription, firstValueFrom } from 'rxjs';

import {
  SimSpaceService,
  SimSpaceSummary,
} from '@services/sim-space/sim-space.service';
import { MultiScaleSimDefinitionService } from '@services/multi-scale/multi-scale-sim-definition.service';
import { MultiScaleSimSummary } from '@models/multi-scale/NamedMultiScaleSimConfig';
import { PolariService } from '@services/polari-service';
import { parseCrudeReadAllResponse }
  from '@services/sim-space/crude-response-parser';

/** A SimulationDefinition with xr_requirement 'ar-capture', plus its
 *  live requirement status (tied selection-zone count). */
interface ArRequiredSim {
  name: string;
  description: string;
  /** ZoneDefinition rows with simulation_ref === name and
   *  zone_role === 'selection'. */
  zoneCount: number;
}

/**
 * /xr — the headset-first homepage (Dustin directive 2026-07-12,
 * first real Wolvic-on-Vive session): the flat app's dense,
 * scroll-heavy navigation is nearly unusable on a headset pad, so
 * this lobby exists purely to FIND and VIEW sim spaces and
 * multiscale sims. Design rules: giant tap targets, page with big
 * PREV/NEXT buttons instead of fine scrolling, one tap from a card
 * to /xr/enter — DIRECT XR entry (2026-07-12), no flat-preview page
 * in between, just one big ENTER VR action. A multiscale card
 * expands to its panels' bound spaces (opened with the msim name as
 * cascade context).
 */
@Component({
  standalone: true,
  selector: 'xr-lobby-page',
  imports: [CommonModule, RouterModule],
  template: `
    <div class="lobby">
      <header>
        <h1>Polari XR</h1>
        <p>Pick a space, then Enter VR.</p>
        <a routerLink="/xr/zone-capture" class="flat-link">
          Zone capture</a>
        <a routerLink="/" class="flat-link">Flat site</a>
      </header>

      <section class="ar-required">
        <h2>AR Required Simulations</h2>
        <p class="hint">These simulations run inside zones captured
          from the real world — capture is THE way in.</p>
        <p class="hint" *ngIf="arSimsError">{{ arSimsError }}</p>
        <p class="hint" *ngIf="!arSimsError && arSimsLoaded
            && !arSims.length">
          No simulations currently require AR capture.</p>
        <div class="grid">
          <div *ngFor="let sim of arSims" class="card ar-card">
            <span class="card-title">{{ sim.name }}</span>
            <span class="card-sub">{{ sim.description
              || 'AR-capture simulation' }}</span>
            <span class="req-status" [class.met]="sim.zoneCount > 0">
              {{ sim.zoneCount > 0
                ? sim.zoneCount + ' zone'
                  + (sim.zoneCount === 1 ? '' : 's') + ' captured'
                : 'requirement: capture at least one zone' }}</span>
            <div class="ar-actions">
              <a class="capture-btn" routerLink="/xr/zone-capture"
                 [queryParams]="{ sim: sim.name }">
                Capture zones (requirement)</a>
              <a *ngIf="sim.zoneCount > 0" class="board-link"
                 routerLink="/zones-board">Rooms/zones board</a>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2>Sim Spaces</h2>
        <p class="hint" *ngIf="spacesError">{{ spacesError }}</p>
        <div class="grid">
          <a *ngFor="let space of pagedSpaces"
             class="card" [routerLink]="['/xr/enter', space.name]">
            <span class="card-title">{{ space.name }}</span>
            <span class="card-sub">{{ space.description
              || (space.dimensionality === '3d'
                  ? '3D space' : '2D space') }}</span>
          </a>
        </div>
        <div class="pager" *ngIf="spaces.length > PAGE_SIZE">
          <button (click)="spacePage = spacePage - 1"
                  [disabled]="spacePage === 0">&#8592; Prev</button>
          <span>{{ spacePage + 1 }} / {{ spacePages }}</span>
          <button (click)="spacePage = spacePage + 1"
                  [disabled]="spacePage >= spacePages - 1">
            Next &#8594;</button>
        </div>
      </section>

      <section>
        <h2>Multiscale Sims</h2>
        <div class="grid">
          <div *ngFor="let msim of pagedMsims" class="card msim"
               [class.open]="expandedMsim === msim.name"
               (click)="toggleMsim(msim.name)">
            <span class="card-title">{{ msim.name }}</span>
            <span class="card-sub">{{ msim.description
              || msim.memberCount + ' member sims' }}</span>
            <div class="members" *ngIf="expandedMsim === msim.name"
                 (click)="$event.stopPropagation()">
              <p class="hint" *ngIf="!expandedSpaces.length">
                {{ expandedNote }}</p>
              <a *ngFor="let ref of expandedSpaces" class="member"
                 [routerLink]="['/xr/enter', ref]"
                 [queryParams]="{ msim: msim.name }">
                {{ ref }}</a>
            </div>
          </div>
        </div>
        <div class="pager" *ngIf="msims.length > PAGE_SIZE">
          <button (click)="msimPage = msimPage - 1"
                  [disabled]="msimPage === 0">&#8592; Prev</button>
          <span>{{ msimPage + 1 }} / {{ msimPages }}</span>
          <button (click)="msimPage = msimPage + 1"
                  [disabled]="msimPage >= msimPages - 1">
            Next &#8594;</button>
        </div>
      </section>
    </div>
  `,
  styles: [`
    /* Theme TOKENS throughout — surface-* backgrounds pair with
       text-primary so light/dark switching keeps contrast (the
       first build paired a theme background with the always-white
       text-on-dark and went unreadable in light mode). */
    :host { display: block; min-height: 100vh;
      background: var(--surface-app-background);
      color: var(--text-primary); }
    .lobby { max-width: 1100px; margin: 0 auto; padding: 24px; }
    header { display: flex; align-items: baseline; gap: 20px;
      flex-wrap: wrap; }
    h1 { font-size: 2.4rem; margin: 8px 0; }
    header p { font-size: 1.2rem; color: var(--text-secondary);
      flex: 1; }
    .flat-link { color: var(--brand-blue); font-size: 1.1rem; }
    h2 { font-size: 1.6rem; margin: 28px 0 14px; }
    .grid { display: grid; gap: 18px;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }
    .card { display: flex; flex-direction: column; gap: 8px;
      min-height: 140px; padding: 22px; border-radius: 18px;
      background: var(--surface-primary);
      border: 2px solid var(--surface-hover); cursor: pointer;
      text-decoration: none; color: var(--text-primary); }
    .card:hover, .card:focus { border-color: var(--brand-blue); }
    .card-title { font-size: 1.5rem; font-weight: 600;
      overflow-wrap: anywhere; }
    .card-sub { font-size: 1.05rem;
      color: var(--text-secondary); }
    .msim.open { border-color: var(--brand-blue); }
    .members { display: flex; flex-direction: column; gap: 10px;
      margin-top: 10px; }
    .member { display: block; padding: 16px; font-size: 1.2rem;
      border-radius: 12px; background: var(--surface-secondary);
      color: var(--brand-blue); text-decoration: none; }
    .pager { display: flex; align-items: center; gap: 18px;
      justify-content: center; margin: 18px 0; }
    .pager button { font-size: 1.3rem; padding: 16px 30px;
      border-radius: 14px; border: 2px solid var(--surface-hover);
      background: var(--surface-secondary);
      color: var(--text-primary); cursor: pointer;
      min-width: 140px; }
    .pager button:disabled { opacity: .35; }
    .pager span { font-size: 1.2rem; }
    .hint { color: var(--text-secondary); font-size: 1.05rem; }
    /* AR Required Simulations — prominent, first section. */
    .ar-required { padding: 4px 0 8px; }
    .ar-required h2 { color: var(--brand-blue); }
    .ar-card { cursor: default; border-color: var(--brand-blue); }
    .req-status { font-size: 1.05rem; font-weight: 600;
      color: #e67e22; }
    .req-status.met { color: #2ecc71; }
    .ar-actions { display: flex; flex-wrap: wrap; gap: 10px;
      margin-top: 8px; }
    .capture-btn { display: inline-block; padding: 14px 22px;
      font-size: 1.15rem; font-weight: 600; border-radius: 12px;
      background: var(--brand-blue); color: #fff;
      text-decoration: none; }
    .board-link { display: inline-block; padding: 14px 22px;
      font-size: 1.15rem; border-radius: 12px;
      background: var(--surface-secondary);
      border: 2px solid var(--surface-hover);
      color: var(--brand-blue); text-decoration: none; }
  `],
})
export class XrLobbyPageComponent implements OnInit, OnDestroy {

  readonly PAGE_SIZE = 6;
  arSims: ArRequiredSim[] = [];
  arSimsError = '';
  arSimsLoaded = false;
  spaces: SimSpaceSummary[] = [];
  spacesError = '';
  spacePage = 0;
  msims: MultiScaleSimSummary[] = [];
  msimPage = 0;
  expandedMsim: string | null = null;
  expandedSpaces: string[] = [];
  expandedNote = '';
  private subscription?: Subscription;

  constructor(private simSpace: SimSpaceService,
              private msimService: MultiScaleSimDefinitionService,
              private http: HttpClient,
              private polari: PolariService) {}

  ngOnInit(): void {
    void this.loadArRequiredSims();
    this.simSpace.list()
      .then(rows => { this.spaces = rows; })
      .catch(() => {
        this.spacesError = 'Could not load sim spaces — is the '
          + 'backend reachable (and its certificate accepted)?';
      });
    this.subscription = this.msimService.allConfigList$
      .subscribe(rows => { this.msims = rows; });
    this.msimService.fetchAllConfigs();
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  /** AR-required sims + their live requirement status: generic CRUDE
   *  reads of SimulationDefinition (xr_requirement 'ar-capture') and
   *  ZoneDefinition (simulation_ref + zone_role 'selection' counts).
   *  A failed zone read degrades to count-unknown (0) rather than
   *  hiding the sims — the capture entry point must stay visible. */
  private async loadArRequiredSims(): Promise<void> {
    const base = this.polari.getBackendBaseUrl();
    const options = this.polari.backendRequestOptions;
    let zones: any[] = [];
    try {
      const simResponse = await firstValueFrom(
        this.http.get(`${base}/SimulationDefinition`, options));
      const sims = parseCrudeReadAllResponse(
        simResponse, 'SimulationDefinition')
        .filter(row => row?.xr_requirement === 'ar-capture');
      try {
        const zoneResponse = await firstValueFrom(
          this.http.get(`${base}/ZoneDefinition`, options));
        zones = parseCrudeReadAllResponse(
          zoneResponse, 'ZoneDefinition');
      } catch { /* counts degrade to 0; sims still listed */ }
      this.arSims = sims.map(sim => ({
        name: String(sim.name ?? ''),
        description: String(sim.description ?? ''),
        zoneCount: zones.filter(z =>
          z?.simulation_ref === sim.name
          && z?.zone_role === 'selection').length,
      })).filter(sim => sim.name);
      this.arSimsError = '';
    } catch {
      this.arSimsError = 'Could not load AR-required simulations — '
        + 'is the backend reachable?';
    }
    this.arSimsLoaded = true;
  }

  get pagedSpaces(): SimSpaceSummary[] {
    return this.spaces.slice(this.spacePage * this.PAGE_SIZE,
                             (this.spacePage + 1) * this.PAGE_SIZE);
  }

  get spacePages(): number {
    return Math.max(1, Math.ceil(this.spaces.length
                                 / this.PAGE_SIZE));
  }

  get pagedMsims(): MultiScaleSimSummary[] {
    return this.msims.slice(this.msimPage * this.PAGE_SIZE,
                            (this.msimPage + 1) * this.PAGE_SIZE);
  }

  get msimPages(): number {
    return Math.max(1, Math.ceil(this.msims.length
                                 / this.PAGE_SIZE));
  }

  /** Expand an msim card to the 3D spaces its panels bind — those
   *  are the XR-enterable things (members are SIMULATION refs). */
  toggleMsim(name: string): void {
    if (this.expandedMsim === name) {
      this.expandedMsim = null;
      return;
    }
    this.expandedMsim = name;
    this.expandedSpaces = [];
    this.expandedNote = 'loading…';
    this.msimService.loadByName(name).subscribe({
      next: config => {
        const refs = (config.panels || [])
          .map(panel => (panel as any).simSpaceRef as string)
          .filter(ref => !!ref);
        this.expandedSpaces = Array.from(new Set(refs));
        this.expandedNote = this.expandedSpaces.length ? ''
          : 'no 3D spaces bound to this msim yet — an honest gap, '
            + 'not an error';
      },
      error: () => { this.expandedNote = 'could not load the msim'; },
    });
  }
}
