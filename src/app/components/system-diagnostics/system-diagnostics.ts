import { Component, OnInit, OnDestroy } from '@angular/core';
import { CRUDEservicesManager } from '@services/crude-services-manager';
import { Subscription } from 'rxjs';

@Component({
  standalone: false,
  selector: 'system-diagnostics',
  templateUrl: './system-diagnostics.html',
  styleUrls: ['./system-diagnostics.css']
})
export class SystemDiagnosticsComponent implements OnInit, OnDestroy {
  systemData: any = null;
  loading: boolean = true;
  error: string | null = null;
  private subscription?: Subscription;

  constructor(private crudeManager: CRUDEservicesManager) {}

  ngOnInit(): void {
    this.loadSystemData();
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  loadSystemData(): void {
    this.loading = true;
    this.error = null;

    const service = this.crudeManager.getCRUDEclassService('system-info');

    this.subscription = service.readAll().subscribe({
      next: (response: any) => {
        console.log('[SystemDiagnostics] Received response:', response);

        // API returns array format: [{ "system-info": {...} }]
        if (response && response.length > 0) {
          const sysInfo = response[0]['system-info'];
          if (sysInfo) {
            this.systemData = sysInfo;
          } else {
            this.error = 'Invalid system info format';
          }
        } else {
          this.error = 'No system data received';
        }

        this.loading = false;
      },
      error: (err) => {
        console.error('[SystemDiagnostics] Error loading system data:', err);
        this.error = 'Failed to load system data';
        this.loading = false;
      }
    });
  }

  refresh(): void {
    this.loadSystemData();
  }

  formatBytes(bytes: number): string {
    if (bytes == null) return '0 B';
    if (bytes === 0) return '0 B';
    const sign = bytes < 0 ? '-' : '';
    const abs = Math.abs(bytes);
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const k = 1024;
    const i = Math.floor(Math.log(abs) / Math.log(k));
    const value = abs / Math.pow(k, i);
    return sign + value.toFixed(1) + ' ' + units[i];
  }

  getMemoryPercent(): number {
    if (!this.systemData?.memory) return 0;
    return this.systemData.memory.percentUsed || 0;
  }

  getSwapPercent(): number {
    if (!this.systemData?.swap || !this.systemData.swap.total) return 0;
    return Math.round((this.systemData.swap.used / this.systemData.swap.total) * 100);
  }

  getProgressColor(percent: number): string {
    if (percent >= 80) return 'warn';
    if (percent >= 60) return 'accent';
    return 'primary';
  }

  getBootMemoryDelta(from: any, to: any): string | null {
    if (!from || !to) return null;
    const delta = to.usedMemory - from.usedMemory;
    const prefix = delta >= 0 ? '+' : '';
    return prefix + this.formatBytes(delta);
  }
}
