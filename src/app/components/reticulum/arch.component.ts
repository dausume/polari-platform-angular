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

  // ---- ret-1f: population, COUNTS-FIRST ------------------------------
  populationEnabled = false;
  populationBuilds = [...POPULATION_BUILDS];
  /** seeded KitProfile names — hardcoded until a KitProfile listing
   *  endpoint exists to populate this dropdown. */
  kitProfiles = [
    { name: 'everyday-node',
      hint: '1 lora + 1 ham-rx + 1 wifi-halow' },
    { name: 'meshapp-broadcaster',
      hint: '1 ham-tx + 3 wifi-halow' },
    { name: 'bandwidth-backbone', hint: '4 wifi-halow' },
  ];
  /** cohorts: N people with a profile or a custom kit. The counts
   *  ARE the configuration; percentages come back as analytics. */
  cohorts: Array<{ mode: 'profile' | 'kit'; profile: string;
                   label: string; count: number;
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
  /** catalog options: the measured pair + the four generic
   *  reference rows (typical figures, not SKUs — unpriced ones show
   *  as informative refused-costing rows in cheapest-coverage). */
  deviceCatalog: Array<{ model: string; label: string; hint: string;
                         capacityBps?: number; checked: boolean;
                         unitsMax: number; antenna: string }> = [
    { model: 'dsd-tech-sh-l1a',
      label: 'DSD TECH SH-L1A',
      hint: 'catalogued, measured 6 568 bps',
      capacityBps: 6568, checked: true, unitsMax: 4,
      antenna: 'stock' },
    { model: 'generic-lora', label: 'generic LoRa',
      hint: 'reference class — typical figures, not a SKU; unpriced',
      checked: false, unitsMax: 4, antenna: 'stock' },
    { model: 'generic-ham-vhf-uhf', label: 'generic HAM VHF/UHF',
      hint: 'reference class — typical figures, not a SKU; unpriced',
      checked: false, unitsMax: 4, antenna: 'stock' },
    { model: 'generic-wifi-24', label: 'generic WiFi 2.4',
      hint: 'reference class — typical figures, not a SKU; unpriced',
      checked: false, unitsMax: 4, antenna: 'stock' },
    { model: 'generic-wifi-halow', label: 'generic WiFi HaLow',
      hint: 'reference class — typical figures, not a SKU; $134.97',
      checked: false, unitsMax: 4, antenna: 'stock' },
  ];
  antennaChoices = [
    { value: 'stock', label: 'stock' },
    { value: 'high-gain-omni', label: 'high-gain omni (×1.8)' },
    { value: 'directional', label: 'directional (×3.0)' },
  ];
  extraDevices: Array<{ model: string; capacityBps: number | null;
                        unitsMax: number; antenna: string }> = [];
  rangeScenario: 'pessimistic' | 'typical' | 'optimistic' = 'typical';
  rangeOverrideM: number | null = null;
  /** drone bridges — the one seeded profile, hardcoded until a
   *  DroneProfile listing endpoint replaces it. */
  dronesEnabled = false;
  droneProfileName = 'generic-quadcopter-bridge';
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
                           unitsMax: 4, antenna: 'stock' }];
  }

  addCohort(): void {
    const units: Record<string, number> = {};
    for (const build of this.populationBuilds) { units[build] = 0; }
    this.cohorts = [...this.cohorts, {
      mode: 'profile', profile: 'everyday-node',
      label: `custom-${this.cohorts.length + 1}`, count: 10, units,
    }];
  }

  removeCohort(index: number): void {
    this.cohorts = this.cohorts.filter((_, i) => i !== index);
  }

  get populationTotal(): number {
    return this.cohorts
      .reduce((s, c) => s + (c.count > 0 ? c.count : 0), 0);
  }

  /** at least one counted cohort; a kit cohort needs at least one
   *  device (an empty kit is nobody carrying nothing). */
  get cohortsValid(): boolean {
    if (!this.cohorts.some((c) => c.count > 0)) { return false; }
    return this.cohorts.every((c) => c.count <= 0
      || c.mode === 'profile'
      || Object.values(c.units).some((n) => n > 0));
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
    if (this.populationEnabled && !this.cohortsValid) {
      return; // the cohort hint is already saying why
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
      request.population = {
        cohorts: this.cohorts
          .filter((c) => c.count > 0)
          .map((c) => c.mode === 'profile'
            ? { profile: c.profile, count: c.count }
            : {
              kit: Object.fromEntries(
                Object.entries(c.units)
                  .filter(([, n]) => n > 0)),  // zeros omitted
              count: c.count,
              label: c.label.trim() || 'custom',
            }),
      };
    }
    if (this.placementEnabled && this.localPolygon) {
      // device options: the catalogued pair by default; free rows
      // until a catalog-listing endpoint exists to populate a picker.
      const deviceOptions = [
        ...this.deviceCatalog
          .filter((d) => d.checked)
          .map((d) => ({
            model: d.model,
            unitsMax: d.unitsMax,
            antenna: d.antenna,
            ...(d.capacityBps
              ? { capacityBps: d.capacityBps } : {}),
          })),
        ...this.extraDevices
          .filter((d) => d.model.trim())
          .map((d) => ({
            model: d.model.trim(),
            unitsMax: d.unitsMax,
            antenna: d.antenna,
            ...(d.capacityBps ? { capacityBps: d.capacityBps } : {}),
          })),
      ];
      request.placement = {
        mode: this.placementMode,
        reachMode: this.reachMode,
        rangeScenario: this.rangeScenario,
        ...(this.rangeOverrideM
          ? { rangeOverrideM: this.rangeOverrideM } : {}),
        polygon: JSON.parse(this.geojsonText),
        ...(this.placementMode !== 'cheapest-coverage'
          ? { nodes: this.fixedNodes } : {}),
        ...(deviceOptions.length ? { deviceOptions } : {}),
        ...(this.dronesEnabled
            && this.placementMode === 'fixed-locations'
          ? { droneProfiles: [this.droneProfileName] } : {}),
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
