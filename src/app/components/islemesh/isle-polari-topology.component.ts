/** Select a frontend, never pretend one frontend can switch its runtime backend. */
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';
import { PolariService } from '@services/polari-service';

@Component({
  selector: 'app-isle-polari-topology', standalone: true, imports: [CommonModule],
  template: `
    <section class="polari-topology">
      <h2>Polari topology</h2>
      <p>View Polari instances, modules and their relationships. The Network topology tab shows devices and network connections.</p>
      <label>Frontend <select [value]="selected" (change)="selectFrontend($any($event.target).value)">
        <option *ngFor="let item of frontends" [value]="item.origin">{{item.label}}</option>
      </select></label>
      <button type="button" (click)="refresh()">Refresh frontend list</button>
      <a [href]="openUrl" target="_blank" rel="noopener">Open topology in a new window</a>
      <p>Each frontend reads its own configured backend; selecting a frontend does not move apps or change that configuration.
        The embedded page names the backend it actually reads.</p>
      <p *ngIf="selected === localOrigin">This frontend currently reads {{backend}}.</p>
      <p role="status" *ngIf="notice">{{notice}}</p>
      <p class="hint">If the frame is blank or blocked, open it in a new window to inspect the connection or certificate error. Loading a frame does not establish backend health.</p>
      <iframe *ngIf="frameUrl" [src]="frameUrl" title="Polari topology for the selected frontend"></iframe>
    </section>`,
  styles: [`
    .polari-topology { padding: 1rem; }
    select, button, a { margin: .3rem .7rem .3rem 0; }
    iframe { width: 100%; height: 78vh; min-height: 550px; border: 1px solid #8885; border-radius: 8px; }
    .hint { font-size: .9rem; opacity: .8; }
  `],
})
export class IslePolariTopologyComponent implements OnInit {
  readonly localOrigin = window.location.origin;
  readonly backend: string;
  selected = this.localOrigin;
  frontends = [{origin: this.localOrigin, label: 'Current frontend — ' + window.location.host}];
  frameUrl: SafeResourceUrl | null = null;
  openUrl = '';
  notice = '';
  constructor(private http: HttpClient, private polari: PolariService, private sanitizer: DomSanitizer) {
    this.backend = polari.getBackendBaseUrl();
    this.selectFrontend(this.localOrigin);
  }
  ngOnInit(): void { void this.refresh(); }
  selectFrontend(origin: string): void {
    // Only origins admitted from the current location or validated Isle DNS names.
    if (!this.frontends.some(item => item.origin === origin)) return;
    this.selected = origin;
    this.openUrl = origin + '/topology';
    this.frameUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.openUrl + '?embed=1');
  }
  async refresh(): Promise<void> {
    this.notice = 'Loading reported frontends…';
    try {
      const data: any = await firstValueFrom(this.http.get(this.backend + '/api/islemesh/coherence', this.polari.backendRequestOptions));
      if (!data?.ok) throw new Error('Inventory unavailable');
      const found = new Map<string, string>([[this.localOrigin, 'Current frontend — ' + window.location.host]]);
      for (const row of data.polari?.instances || []) {
        if (!['frontend', 'both'].includes(row.component_role || row.role)) continue;
        const domain = String(row.domain || '').toLowerCase();
        if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+isle$/.test(domain) || domain.length > 253) continue;
        const origin = 'https://' + domain;
        if (!found.has(origin)) found.set(origin, domain + (row.device ? ' — reported on ' + row.device : ''));
      }
      this.frontends = [...found].map(([origin, label]) => ({origin, label}));
      if (!found.has(this.selected)) this.selectFrontend(this.localOrigin);
      this.notice = 'Inventory read at ' + new Date().toLocaleString() + '. Reported locations are not a live reachability check.';
    } catch {
      this.notice = 'Frontend inventory unavailable. The current selection remains available; its page reports backend errors independently.';
    }
  }
}
