import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import {
  ArchIsle,
  ArchPath,
  ArchTopology,
  ArchTopologyService,
} from '@services/reticulum/arch-topology.service';
import {
  agoLabel,
  demandPercent,
  deviceKindLabel,
  directionBadge,
  formatBps,
  formatBytesPerMin,
  formatMeters,
  freshnessLabel,
  heardViaList,
  km2ToM2,
  offersTransmit,
  plannerVerdictTone,
  rangeFidelityLabel,
  truncateHash,
  verdictTone,
} from '@services/reticulum/arch-view';
import {
  MeshSimService,
  PlacementRequest,
  PlannerBearer,
  PlannerRequest,
  PlannerResult,
} from '@services/reticulum/meshsim.service';
import {
  LocalPolygon,
  mixSum,
  mixValid,
  ParsedPolygon,
  parsePolygonGeojson,
  POPULATION_BUILDS,
  projectPoint,
  ringToSvgPath,
  SvgProjection,
  svgProjection,
  toLocalMeters,
  unprojectPoint,
} from '@services/reticulum/planner-geo';
import {
  MapPolygonDefinition,
} from '@models/geojson/MapPolygonDefinition';
import {
  MapPolygonDefinitionService,
} from '@services/geojson/map-polygon-definition.service';
import {
  AdjudicationOutcome,
  PeerEntry,
  PeersReport,
  ReticulumPeersService,
} from '@services/reticulum/peers.service';

/**
 * ret-1b/1d/1e: the .arch topology — isles as BLOCKS, one level
 * above the isle topology's device blocks — plus the peers panel
 * (heard broadcasts adjudicated into .arch / .mesh by a named
 * human; hearing is not admitting) and the mesh planner (spacing +
 * relay allowance under the flat-terrain disclaimer).
 *
 * Postures carried from the plan, visible here:
 *  - Numbers are DECLARED or MEASURED and say which; a stale
 *    measurement shows its age; an unknown capacity draws NO bar.
 *  - A device that cannot transmit never shows a TX affordance.
 *  - A 401 on adjudication renders as the system working (admission
 *    is a named human act), never as hidden buttons.
 *  - Every planner result carries the terrain disclaimer, loudly.
 */
@Component({
  selector: 'arch-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './arch.component.html',
  styleUrls: ['./arch.component.css'],
})
export class ArchComponent implements OnInit {
  topo: ArchTopology | null = null;
  loading = true;

  // ret-1d peers panel state
  peersReport: PeersReport | null = null;
  peersLoading = true;
  archNameInput: Record<string, string> = {};
  adjudicating: string | null = null;
  adjudicationOutcome: AdjudicationOutcome | null = null;
  adjudicatedPeer: string | null = null;

  // ret-1e planner state
  plannerForm = {
    bearerSet: 'lora-only',
    propagationMode: 'flat-assumed',
    meshSizeNodes: 9,
    targetPerPeerBps: 200,
    areaKm2: 3,
  };
  bearerSets = [
    'lora-only', 'halow-only', 'lora+halow', 'lora+halow+ham',
    'wifi-confined-meshapps', 'halow+ham',
  ];
  propagationModes = [
    { value: 'flat-assumed', label: 'flat-assumed', built: true },
    { value: 'measured', label: 'measured', built: true },
    {
      value: 'average-elevation',
      label: 'average-elevation (not built yet)', built: false,
    },
    {
      value: 'ideal-elevation',
      label: 'ideal-elevation (not built yet)', built: false,
    },
  ];
  plan: PlannerResult | null = null;
  planAbsent = false;
  planning = false;

  // ---- ret-1f: population mix ---------------------------------------
  populationEnabled = false;
  populationN = 50;
  populationBuilds = [...POPULATION_BUILDS];
  populationMix: Record<string, number> = {
    lora: 40, 'ham-rx': 20, 'ham-tx': 5,
    wifi: 25, 'wifi-halow': 10, lorawan: 0,
  };
  /** loadouts: kit rows — one person carrying several devices */
  kitRows: Array<{ label: string; pct: number;
                   units: Record<string, number> }> = [];

  // ---- ret-1f: map placement ----------------------------------------
  placementEnabled = false;
  placementMode: PlacementRequest['mode'] = 'cheapest-coverage';
  reachMode: PlacementRequest['reachMode'] = 'max-spread';
  polygonSource: 'stored' | 'geojson' = 'stored';
  storedPolygons: MapPolygonDefinition[] = [];
  storedPolygonId = '';
  storedPolygonsNote = '';
  geojsonText = '';
  parsedPolygon: ParsedPolygon | null = null;
  localPolygon: LocalPolygon | null = null;
  fixedNodes: Array<{ name: string; x_m: number; y_m: number }> = [];
  // devices for the solver: the catalogued pair by default; free rows
  // for models the catalog endpoint will serve later (said in a
  // comment where the list is built).
  useShL1a = true;
  shL1aUnitsMax = 4;
  extraDevices: Array<{ model: string; capacityBps: number | null;
                        unitsMax: number }> = [];
  readonly svgW = 420;
  readonly svgH = 320;
  fallbackDisclaimer =
    'TERRAIN IS NOT ACCOUNTED FOR: predictions assume flat terrain. '
    + 'Treat every predicted range as an upper bound that real '
    + 'ground will shorten.';

  // pure view rules, exposed to the template
  verdictTone = verdictTone;
  demandPercent = demandPercent;
  formatBytesPerMin = formatBytesPerMin;
  formatBps = formatBps;
  formatMeters = formatMeters;
  deviceKindLabel = deviceKindLabel;
  directionBadge = directionBadge;
  offersTransmit = offersTransmit;
  freshnessLabel = freshnessLabel;
  truncateHash = truncateHash;
  agoLabel = agoLabel;
  heardViaList = heardViaList;
  plannerVerdictTone = plannerVerdictTone;
  rangeFidelityLabel = rangeFidelityLabel;

  mixSum = mixSum;
  mixValid = mixValid;

  constructor(
    private archService: ArchTopologyService,
    private peersService: ReticulumPeersService,
    private meshSimService: MeshSimService,
    private polygonService: MapPolygonDefinitionService,
  ) {}

  async ngOnInit(): Promise<void> {
    [this.topo, this.peersReport] = await Promise.all([
      this.archService.topology(),
      this.peersService.peers(),
    ]);
    this.loading = false;
    this.peersLoading = false;
    // the drawn shapes already in Polari (geojson-config rows) —
    // absent/erroring quietly leaves the raw-geojson path available.
    this.polygonService.fetchAllResolved().subscribe({
      next: (polygons) => {
        this.storedPolygons =
          polygons.filter((p) => p.toGeoJsonFeature() !== null);
        this.storedPolygonsNote = this.storedPolygons.length
          ? ''
          : 'no drawn shapes stored yet — draw one on the maps page '
            + 'or paste geojson below';
      },
      error: () => {
        this.storedPolygonsNote =
          'stored shapes unavailable — paste geojson below';
      },
    });
  }

  // ---- ret-1f handlers ----------------------------------------------

  selectStoredPolygon(): void {
    const polygon = this.storedPolygons
      .find((p) => p.id === this.storedPolygonId);
    const feature = polygon?.toGeoJsonFeature();
    if (feature) {
      this.geojsonText = JSON.stringify(feature);
      this.parsePolygon();
    }
  }

  parsePolygon(): void {
    this.parsedPolygon = parsePolygonGeojson(this.geojsonText);
    this.localPolygon = this.parsedPolygon.error
      ? null : toLocalMeters(this.parsedPolygon);
  }

  get svgProj(): SvgProjection | null {
    return this.localPolygon
      ? svgProjection(this.localPolygon.bbox, this.svgW, this.svgH)
      : null;
  }

  get polygonPath(): string {
    return this.svgProj && this.localPolygon
      ? ringToSvgPath(this.svgProj, this.localPolygon.ringM) : '';
  }

  get clickToPlace(): boolean {
    return this.placementEnabled
      && this.placementMode !== 'cheapest-coverage';
  }

  svgClick(event: MouseEvent): void {
    if (!this.clickToPlace || !this.svgProj) { return; }
    const svg = event.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    const sx = ((event.clientX - rect.left) / rect.width) * this.svgW;
    const sy = ((event.clientY - rect.top) / rect.height) * this.svgH;
    const [x, y] = unprojectPoint(this.svgProj, sx, sy);
    this.fixedNodes = [...this.fixedNodes, {
      name: `n${this.fixedNodes.length + 1}`,
      x_m: Math.round(x), y_m: Math.round(y),
    }];
  }

  removeFixedNode(index: number): void {
    this.fixedNodes = this.fixedNodes
      .filter((_, i) => i !== index);
  }

  addExtraDevice(): void {
    this.extraDevices = [...this.extraDevices,
                         { model: '', capacityBps: null,
                           unitsMax: 4 }];
  }

  addKitRow(): void {
    const units: Record<string, number> = {};
    for (const build of this.populationBuilds) { units[build] = 0; }
    this.kitRows = [...this.kitRows, {
      label: `kit-${this.kitRows.length + 1}`, pct: 0, units,
    }];
  }

  removeKitRow(index: number): void {
    this.kitRows = this.kitRows.filter((_, i) => i !== index);
  }

  /** simple builds + kit rows as one mix — what both the 100% rule
   *  and the request see. Kit labels colliding with a build name or
   *  each other get suffixed rather than silently merged. */
  get combinedMix(): Record<string,
      number | { kit: Record<string, number>; pct: number }> {
    const mix: Record<string,
      number | { kit: Record<string, number>; pct: number }> =
      { ...this.populationMix };
    for (const row of this.kitRows) {
      let label = (row.label || 'kit').trim() || 'kit';
      while (label in mix) { label = `${label}+`; }
      const kit: Record<string, number> = {};
      for (const [build, n] of Object.entries(row.units)) {
        if (n > 0) { kit[build] = n; }  // zeros omitted from payload
      }
      mix[label] = { kit, pct: row.pct };
    }
    return mix;
  }

  kitDeviceList(devices: Record<string, number>): string {
    return Object.entries(devices)
      .map(([build, n]) => `${n}× ${build}`)
      .join(', ');
  }

  removeExtraDevice(index: number): void {
    this.extraDevices = this.extraDevices
      .filter((_, i) => i !== index);
  }

  marker(x: number, y: number): [number, number] | null {
    return this.svgProj ? projectPoint(this.svgProj, x, y) : null;
  }

  metersToSvg(meters: number | undefined): number {
    return this.svgProj && meters
      ? meters * this.svgProj.scale : 0;
  }

  get placementReady(): boolean {
    if (!this.placementEnabled) { return true; }
    if (!this.localPolygon) { return false; }
    return this.placementMode === 'cheapest-coverage'
      || this.fixedNodes.length > 0;
  }

  get isles(): ArchIsle[] {
    return this.topo?.isles ?? [];
  }

  get paths(): ArchPath[] {
    return this.topo?.paths ?? [];
  }

  get nowMs(): number {
    return this.topo?.nowMs ?? Date.now();
  }

  get peersNowMs(): number {
    return this.peersReport?.nowMs ?? Date.now();
  }

  get undecided(): PeerEntry[] {
    return this.peersReport?.peers?.unadjudicated ?? [];
  }

  peerBucket(bucket: 'archipelago' | 'mesh' | 'ignored'): PeerEntry[] {
    return this.peersReport?.peers?.[bucket] ?? [];
  }

  peerDest(entry: PeerEntry): string {
    return entry.dest_hash ?? entry.destHash ?? entry.name;
  }

  peerIdentity(entry: PeerEntry): string {
    return entry.identity_hash ?? entry.identityHash ?? '';
  }

  peerLastHeard(entry: PeerEntry): number | undefined {
    return entry.last_heard_ms ?? entry.lastHeardMs;
  }

  peerCount(entry: PeerEntry): number {
    return entry.announce_count ?? entry.count ?? 0;
  }

  async adjudicate(
    entry: PeerEntry,
    decision: 'archipelago' | 'mesh' | 'ignored',
  ): Promise<void> {
    const name = entry.name || this.peerDest(entry);
    this.adjudicating = name;
    this.adjudicatedPeer = name;
    this.adjudicationOutcome = await this.peersService.adjudicate(
      name,
      decision,
      decision === 'archipelago'
        ? (this.archNameInput[name] || '').trim() : undefined,
      entry.persisted === false ? entry : undefined,
    );
    this.adjudicating = null;
    if (this.adjudicationOutcome.ok) {
      this.peersReport = await this.peersService.peers();
    }
  }

  archNameMissing(entry: PeerEntry): boolean {
    const name = entry.name || this.peerDest(entry);
    return !(this.archNameInput[name] || '').trim();
  }

  async runPlan(): Promise<void> {
    if (this.populationEnabled && !mixValid(this.combinedMix)) {
      return; // the sum indicator is already saying why
    }
    if (!this.placementReady) { return; }
    this.planning = true;
    this.plan = null;
    this.planAbsent = false;
    const request: PlannerRequest = {
      bearerSet: this.plannerForm.bearerSet,
      propagationMode: this.plannerForm.propagationMode,
      meshSizeNodes: this.plannerForm.meshSizeNodes,
      targetPerPeerBps: this.plannerForm.targetPerPeerBps,
      areaM2: km2ToM2(this.plannerForm.areaKm2),
    };
    if (this.populationEnabled) {
      request.population = { mix: this.combinedMix,
                             n: this.populationN };
    }
    if (this.placementEnabled && this.localPolygon) {
      // device options: the catalogued pair by default; free rows
      // until a catalog-listing endpoint exists to populate a picker.
      const deviceOptions = [
        ...(this.useShL1a
          ? [{ model: 'dsd-tech-sh-l1a', capacityBps: 6568,
               unitsMax: this.shL1aUnitsMax }] : []),
        ...this.extraDevices
          .filter((d) => d.model.trim())
          .map((d) => ({
            model: d.model.trim(),
            unitsMax: d.unitsMax,
            ...(d.capacityBps ? { capacityBps: d.capacityBps } : {}),
          })),
      ];
      request.placement = {
        mode: this.placementMode,
        reachMode: this.reachMode,
        polygon: JSON.parse(this.geojsonText),
        ...(this.placementMode !== 'cheapest-coverage'
          ? { nodes: this.fixedNodes } : {}),
        ...(deviceOptions.length ? { deviceOptions } : {}),
      };
    }
    const result = await this.meshSimService.plan(request);
    this.planning = false;
    if (result === null) {
      this.planAbsent = true;
    } else {
      this.plan = result;
    }
  }

  get planBearers(): Array<{ bearer: string; entry: PlannerBearer }> {
    const per = this.plan?.perBearer ?? {};
    return Object.entries(per)
      .map(([bearer, entry]) => ({ bearer, entry }));
  }

  trackByName(_i: number, item: { name: string }): string {
    return item.name;
  }

  trackByBearer(_i: number, item: { bearer: string }): string {
    return item.bearer;
  }
}
