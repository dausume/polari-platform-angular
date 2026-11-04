import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSlideToggleModule, MatSlideToggleChange } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { RuntimeConfigService } from '@services/runtime-config.service';
import { ShellBridgeService } from '@services/shell-bridge.service';

@Component({
  selector: 'app-isle-security', standalone: true,
  imports: [CommonModule, MatSlideToggleModule, MatButtonModule],
  template: `
    <section class="security-settings">
      <h2>Keycloak sign-in</h2>
      <p>{{ security.enabled ? 'Enabled' : 'Disabled intentionally' }} for this Polari frontend.</p>
      <p>Backend permission enforcement is separate. This switch does not make protected operations available anonymously.</p>
      <mat-slide-toggle [checked]="security.enabled" [disabled]="busy || !local || (security.enabled && security.requiredBy.length > 0)" (change)="change($event)">
        Enable Keycloak sign-in
      </mat-slide-toggle>
      <p>Changing this setting requires administrator authentication on the device hosting this frontend. Enabling also checks that Keycloak is reachable over trusted HTTPS.</p>
      <p *ngIf="security.requiredBy.length">Required by: {{ security.requiredBy.join(', ') }}. Remove these dependencies before disabling sign-in.</p>
      <p role="alert" *ngIf="security.configurationError">{{ security.configurationError }}</p>
      <p role="status" aria-live="polite">{{ message }}</p>
      <button mat-stroked-button [disabled]="busy" (click)="refresh()">Check local availability</button>
      <details><summary>Terminal commands</summary>
        <p>Run on the frontend's hosting device. For the initial core deployment use ~/polari-isle/runtime-config.json.</p>
        <pre>sudo isle polari security enable --config /path/to/runtime-config.json</pre>
        <pre>sudo isle polari security disable --config /path/to/runtime-config.json</pre>
      </details>
    </section>
  `,
  styles: [`.security-settings { padding: 1rem; } pre { white-space: pre-wrap; overflow-wrap: anywhere; } details { margin-top: 1rem; }`]
})
export class IsleSecurityComponent implements OnInit {
  local = false;
  busy = false;
  message = '';
  get security() { return this.runtime.getKeycloakSecurity(); }
  constructor(public runtime: RuntimeConfigService, private shell: ShellBridgeService) {}
  ngOnInit() { void this.refresh(); }
  async refresh() {
    this.local = false;
    if (!this.shell.available) { this.message = 'Open the native Isle App on the frontend’s hosting device to change this setting.'; return; }
    this.busy = true;
    try {
      const result = await this.shell.securityStatus();
      this.local = result.ok && result.state?.local === true;
      this.message = this.local ? 'Available on this device. PolicyKit will ask for administrator authentication.'
        : result.error || result.output || 'Update the native shell and CLI, and use the frontend’s hosting device.';
    } catch (error: any) { this.message = error.message || 'Local security controls are unavailable.'; }
    finally { this.busy = false; }
  }
  async change(event: MatSlideToggleChange) {
    const enabled = event.checked;
    event.source.checked = this.security.enabled;
    if (this.busy || !this.local) return;
    this.busy = true;
    this.message = 'Waiting for administrator authentication…';
    try {
      const result = await this.shell.setKeycloak(enabled);
      if (result.ok && result.state?.ok && result.state.enabled === enabled) {
        this.message = 'Setting saved. Reloading the app…';
        window.location.reload();
      } else {
        this.message = result.cancelled || result.exitCode === 126 || result.exitCode === 127
          ? 'Authentication was cancelled or refused. The setting was not changed.'
          : result.error || result.output || 'The setting could not be changed.';
      }
    } catch (error: any) { this.message = error.message || 'The setting was not changed.'; }
    finally { this.busy = false; }
  }
}
