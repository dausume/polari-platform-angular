import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { firstValueFrom, timeout } from 'rxjs';
import { PolariService } from '@services/polari-service';

import { buildIsleInventory, IsleInventory } from './isle-device-inventory';

@Component({
  selector: 'app-isle-devices',
  standalone: true,
  imports: [CommonModule, MatButtonModule],
  templateUrl: './isle-devices.component.html',
  styleUrls: ['./isle-devices.component.scss'],
})
export class IsleDevicesComponent implements OnInit {
  inventory: IsleInventory = buildIsleInventory(null, null, null);
  get devices() { return this.inventory.devices; }
  get mockNetwork() { return this.inventory.hasMockData; }
  unavailable: string[] = [];
  loading = false;
  error = '';
  retrievedAt: Date | null = null;
  constructor(private http: HttpClient, private polari: PolariService) {}
  ngOnInit(): void { void this.refresh(); }
  async refresh(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    this.error = '';
    try {
      const base = this.polari.getBackendBaseUrl();
      const sources = ['', '/coherence', '/catalog'];
      const results = await Promise.allSettled(sources.map(path => firstValueFrom(
        this.http.get<{ok: boolean}>(`${base}/api/islemesh${path}`,
          this.polari.backendRequestOptions).pipe(timeout(10000)))));
      const values = results.map(r => r.status === 'fulfilled' && r.value?.ok === true ? r.value : null);
      this.unavailable = ['Device observations', 'App registrations', 'App catalog'].filter((_, i) => values[i] === null);
      if (values.every(value => value === null)) throw new Error('Inventory unavailable');
      this.inventory = buildIsleInventory(values[0], values[1], values[2]);
      this.retrievedAt = new Date();
    } catch {
      this.error = 'Device inventory could not be refreshed. Check the Isle connection and try again.';
    } finally { this.loading = false; }
  }
}
