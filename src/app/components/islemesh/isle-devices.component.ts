import { IsleVisibleRefresh, isleReportFreshness } from './isle-visible-refresh';
import { Component, OnInit, OnDestroy, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { firstValueFrom, timeout } from 'rxjs';
import { PolariService } from '@services/polari-service';

import { hostedAppType, buildIsleInventory, IsleInventory, CapabilityReport, readCapabilityReport, CAPABILITY_LABELS } from './isle-device-inventory';

@Component({
  selector: 'app-isle-devices',
  standalone: true,
  imports: [CommonModule, MatButtonModule],
  templateUrl: './isle-devices.component.html',
  styleUrls: ['./isle-devices.component.scss'],
})
export class IsleDevicesComponent implements OnInit, OnDestroy {
  private poller: IsleVisibleRefresh | null = null;
  private disposed = false;
  readonly reportState = isleReportFreshness;
  readonly hostedAppType = hostedAppType;
  inventory: IsleInventory = buildIsleInventory(null, null, null);
  get devices() { return this.inventory.devices; }
  get mockNetwork() { return this.inventory.hasMockData; }
  unavailable: string[] = [];
  hostReport: CapabilityReport | null = null;
  useReport: CapabilityReport | null = null;
  readonly capabilityLabels = CAPABILITY_LABELS;
  targetsFor(device: string, report: CapabilityReport | null) {
    return (report?.entries || []).flatMap(app => app.targets
      .filter(target => target.device === device).map(target => ({ app: app.entry, ...target })));
  }
  loading = false;
  error = '';
  retrievedAt: Date | null = null;
  constructor(private http: HttpClient, private polari: PolariService, private host: ElementRef<HTMLElement>) {}
  ngOnInit(): void {
    void this.refresh();
    this.poller = new IsleVisibleRefresh(() => this.refresh(), () => !document.hidden && !!this.host.nativeElement.getClientRects().length, 120000);
    this.poller.start();
  }
  ngOnDestroy(): void { this.disposed = true; this.poller?.stop(); }
  async refresh(): Promise<void> {
    if (this.loading || this.disposed) return;
    this.loading = true;
    this.error = '';
    try {
      const base = this.polari.getBackendBaseUrl();
      const sources = ['', '/coherence', '/catalog', '/gaps?action=host', '/gaps?action=use'];
      const results = await Promise.allSettled(sources.map(path => firstValueFrom(
        this.http.get<{ok: boolean}>(`${base}/api/islemesh${path}`,
          this.polari.backendRequestOptions).pipe(timeout(10000)))));
      if (this.disposed) return;
      const values = results.map(r => r.status === 'fulfilled' && r.value?.ok === true ? r.value : null);
      this.unavailable = ['Device observations', 'App registrations', 'App catalog'].filter((_, i) => values[i] === null);
      this.hostReport = readCapabilityReport(values[3], 'host');
      this.useReport = readCapabilityReport(values[4], 'use');
      if (values.slice(0, 3).every(value => value === null)) throw new Error('Inventory unavailable');
      this.inventory = buildIsleInventory(values[0], values[1], values[2]);
      this.retrievedAt = new Date();
    } catch {
      this.error = 'Device inventory could not be refreshed. Check the Isle connection and try again.';
    } finally { this.loading = false; }
  }
}
