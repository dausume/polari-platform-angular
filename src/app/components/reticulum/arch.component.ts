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
  PlannerBearer,
  PlannerResult,
} from '@services/reticulum/meshsim.service';
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
  ) {}

  async ngOnInit(): Promise<void> {
    [this.topo, this.peersReport] = await Promise.all([
      this.archService.topology(),
      this.peersService.peers(),
    ]);
    this.loading = false;
    this.peersLoading = false;
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
    this.planning = true;
    this.plan = null;
    this.planAbsent = false;
    const result = await this.meshSimService.plan({
      bearerSet: this.plannerForm.bearerSet,
      propagationMode: this.plannerForm.propagationMode,
      meshSizeNodes: this.plannerForm.meshSizeNodes,
      targetPerPeerBps: this.plannerForm.targetPerPeerBps,
      areaM2: km2ToM2(this.plannerForm.areaKm2),
    });
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
