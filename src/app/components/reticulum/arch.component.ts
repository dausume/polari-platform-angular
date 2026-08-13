import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';

import {
  ArchIsle,
  ArchPath,
  ArchTopology,
  ArchTopologyService,
} from '@services/reticulum/arch-topology.service';
import {
  demandPercent,
  deviceKindLabel,
  directionBadge,
  formatBps,
  formatBytesPerMin,
  freshnessLabel,
  offersTransmit,
  verdictTone,
} from '@services/reticulum/arch-view';

/**
 * ret-1b: the .arch topology — isles as BLOCKS, one level above the
 * isle topology's device blocks. Inside each block: its radios
 * (bearer + rx/tx as device facts) and its apps with their declared
 * demand. Between blocks: the measured latency matrix. Per block:
 * demand vs capacity with the backend's verdict rendered as loudly
 * as it deserves.
 *
 * Postures carried from the plan, visible here:
 *  - Numbers are DECLARED or MEASURED and say which; a stale
 *    measurement shows its age; an unknown capacity draws NO bar.
 *  - A device that cannot transmit never shows a TX affordance.
 *  - An empty peer block is honest (its inventory arrives with the
 *    gossip payload), not a bug to hide.
 */
@Component({
  selector: 'arch-page',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './arch.component.html',
  styleUrls: ['./arch.component.css'],
})
export class ArchComponent implements OnInit {
  topo: ArchTopology | null = null;
  loading = true;

  // pure view rules, exposed to the template
  verdictTone = verdictTone;
  demandPercent = demandPercent;
  formatBytesPerMin = formatBytesPerMin;
  formatBps = formatBps;
  deviceKindLabel = deviceKindLabel;
  directionBadge = directionBadge;
  offersTransmit = offersTransmit;
  freshnessLabel = freshnessLabel;

  constructor(private archService: ArchTopologyService) {}

  async ngOnInit(): Promise<void> {
    this.topo = await this.archService.topology();
    this.loading = false;
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

  trackByName(_i: number, item: { name: string }): string {
    return item.name;
  }
}
