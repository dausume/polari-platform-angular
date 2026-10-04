// polari-platform-angular/src/app/components/custom-no-code/states/hardware/hw-interface-overlay/hw-interface-overlay.component.ts
//
// hn-0 (HARDWARE_NOCODE_PLAN.md §2b rule 3, D-hn-2): the inline overlay for the `hw-interface` node kind — THE SPLIT POINT
// between the board and the backend. It names one grpcbridge HardwareInterfaceBinding (a Polari object row ↔ a board
// instance + its port or the twin's pty, on one bridge) and shows what that binding is doing: the row it ties, the port,
// frames seen, frames refused. Frames come UP through it; a PUT of the row goes DOWN through it.
//
// Same overlay pattern as every state (StateOverlayBase, <state-overlay-shell>, appStateOverlayRoot,
// fieldValuesChanged). Reads GET /api/hwnocode/interface?binding=<name>; when that is unreachable (no hwnocode on this
// node) it shows the node's own field values, never raw JSON.

import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';

import { StateOverlayBase } from '../../_shared/state-overlay/state-overlay-base';
import { PolariService } from '@services/polari-service';

export interface HwBindingView {
  name: string; bridge_name: string; object_class: string; object_name: string; board_instance: string;
  board_definition: string; interface_kind: string; interface_name: string; port: string; instance_index: number;
  frames_seen: number; refused_frames: number; last_seen_at: string;
}

@Component({
  standalone: false,
  selector: 'hw-interface-overlay',
  templateUrl: './hw-interface-overlay.component.html',
  styleUrls: ['./hw-interface-overlay.component.css'],
})
export class HwInterfaceOverlayComponent extends StateOverlayBase implements OnInit, OnDestroy {
  @Input() boundClassName: string = 'HardwareInterface';
  @Input() boundObjectFieldValues: { [key: string]: any } | null = null;
  @Input() placement: string = 'bridge';

  @Output() fieldValuesChanged = new EventEmitter<{ [key: string]: any }>();

  binding: HwBindingView | null = null;
  live = false;
  loading = false;
  note = '';

  private sub: Subscription | null = null;

  constructor(private http: HttpClient, private polariService: PolariService) {
    super();
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.load();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  get bindingName(): string {
    return String((this.boundObjectFieldValues || {})['binding'] || '');
  }

  /** The node's own fields as a binding view — the honest fallback when the live row cannot be read. */
  private fromFields(): HwBindingView {
    const v = this.boundObjectFieldValues || {};
    return {
      name: String(v['binding'] || ''), bridge_name: String(v['bridge_name'] || ''), object_class: String(v['object_class'] || ''),
      object_name: String(v['object_name'] || ''), board_instance: String(v['board_instance'] || ''), board_definition: '',
      interface_kind: String(v['interface_kind'] || ''), interface_name: '', port: String(v['port'] || ''), instance_index: 0,
      frames_seen: 0, refused_frames: 0, last_seen_at: '',
    };
  }

  load(): void {
    this.binding = this.fromFields();
    this.live = false;
    if (!this.bindingName) {
      this.note = 'No binding named yet';
      return;
    }
    const url = `${this.polariService.getBackendBaseUrl()}/api/hwnocode/interface?binding=${encodeURIComponent(this.bindingName)}`;
    this.loading = true;
    this.sub?.unsubscribe();
    this.sub = this.http.get<any>(url, { headers: (this.polariService.backendRequestOptions as any)?.headers }).subscribe({
      next: (r: any) => {
        this.loading = false;
        if (r?.binding) {
          this.binding = r.binding;
          this.live = true;
          this.note = '';
        }
      },
      error: (e: any) => {
        this.loading = false;
        this.note = e?.status === 404 ? `binding ${this.bindingName} is not on this node — showing the node's fields`
                                      : 'live binding unreachable — showing the node\'s fields';
      },
    });
  }

  onBindingChange(value: string): void {
    this.boundObjectFieldValues = { ...(this.boundObjectFieldValues || {}), binding: value };
    this.fieldValuesChanged.emit({ binding: value });
    this.load();
  }
}
