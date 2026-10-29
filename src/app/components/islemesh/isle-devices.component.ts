import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { firstValueFrom, timeout } from 'rxjs';
import { PolariService } from '@services/polari-service';

interface DeviceRecord {
  name: string;
  agent_present?: boolean;
  polari_instances?: string[];
  apps?: { name: string; domain: string }[];
}

@Component({
  selector: 'app-isle-devices',
  standalone: true,
  imports: [CommonModule, MatButtonModule],
  templateUrl: './isle-devices.component.html',
  styleUrls: ['./isle-devices.component.scss'],
})
export class IsleDevicesComponent implements OnInit {
  devices: DeviceRecord[] = [];
  loading = false;
  error = '';
  retrievedAt: Date | null = null;
  mockNetwork = false;
  constructor(private http: HttpClient, private polari: PolariService) {}
  ngOnInit(): void { void this.refresh(); }
  async refresh(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    this.error = '';
    try {
      const data = await firstValueFrom(this.http.get<{
        ok: boolean; devices: DeviceRecord[]; mock_network?: boolean;
      }>(`${this.polari.getBackendBaseUrl()}/api/islemesh/coherence`,
        this.polari.backendRequestOptions).pipe(timeout(10000)));
      if (!data?.ok || !Array.isArray(data.devices)) throw new Error('Invalid inventory');
      this.devices = data.devices.filter(d => typeof d?.name === 'string');
      this.mockNetwork = data.mock_network === true;
      this.retrievedAt = new Date();
    } catch {
      this.error = 'Device inventory could not be refreshed. Check the Isle connection and try again.';
    } finally { this.loading = false; }
  }
}
