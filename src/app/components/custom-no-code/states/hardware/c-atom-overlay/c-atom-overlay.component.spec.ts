import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatIconModule } from '@angular/material/icon';

import { CAtomOverlayComponent } from './c-atom-overlay.component';
import { StateOverlayShellComponent } from '../../_shared/state-overlay/state-overlay-shell.component';
import { StateOverlayInteractionsDirective } from '../../_shared/state-overlay/state-overlay-interactions.directive';
import { PolariService } from '@services/polari-service';

/**
 * hn-0 — THE c-atom OVERLAY (the planned cmod-3) for the two DEVICE node kinds.
 *
 * What must hold: a CAtom node reads its atom from GET /api/cmod/atoms/{atom} and shows the signature, the ports with
 * their Polari types and the placement (board · C) — as a table, never JSON; a HardwareSubgraph node is ONE collapsed
 * node (counts only) that expands INSIDE the overlay into the CGraph's nodes and collapses again; editing the name
 * emits fieldValuesChanged (the canvas's persistence path) and re-reads; a refusal's words are shown.
 */
const cells = (r: Element) => Array.from(r.querySelectorAll('td')).map(td => (td.textContent || '').trim()).filter(Boolean).join(' ');

describe('CAtomOverlayComponent (hn-0)', () => {
  const BASE = 'http://backend.test';
  let fixture: ComponentFixture<CAtomOverlayComponent>;
  let comp: CAtomOverlayComponent;
  let http: HttpTestingController;

  async function make(cls: string, fields: any, width = 260) {
    await TestBed.configureTestingModule({
      declarations: [CAtomOverlayComponent, StateOverlayShellComponent, StateOverlayInteractionsDirective],
      imports: [MatIconModule],
      providers: [provideHttpClient(), provideHttpClientTesting(),
                  { provide: PolariService, useValue: { getBackendBaseUrl: () => BASE, backendRequestOptions: {} } }],
    }).compileComponents();
    fixture = TestBed.createComponent(CAtomOverlayComponent);
    comp = fixture.componentInstance;
    fixture.componentRef.setInput('boundClassName', cls);
    fixture.componentRef.setInput('boundObjectFieldValues', fields);
    fixture.componentRef.setInput('width', width);
    fixture.componentRef.setInput('placement', 'board');
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  it('a CAtom node: the atom read from /api/cmod/atoms, its ports as a table, the placement badge', async () => {
    await make('CAtom', { atom: 'uno:hal.hal_adc_read', stage: 'loop' });
    http.expectOne(`${BASE}/api/cmod/atoms/uno%3Ahal.hal_adc_read`).flush({
      ok: true,
      atom: { name: 'uno:hal.hal_adc_read', function: 'hal_adc_read', signature: 'uint16_t hal_adc_read(uint8_t channel)', kind: 'function',
              isr_safe: 'yes', pure: false, text_bytes_noinline: 30, role: 'one blocking ADC conversion, AVcc reference' },
      ports: [{ port: 'channel', direction: 'in', polari_type: 'int64', ctype: 'uint8_t', unit: '' },
              { port: 'return', direction: 'out', polari_type: 'int64', ctype: 'uint16_t', unit: 'count' }],
    });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(comp.mode).toBe('atom');
    expect(comp.title).toBe('hal_adc_read');
    expect(el.querySelector('.hw-sig')?.textContent).toContain('uint16_t hal_adc_read(uint8_t channel)');
    const ports = Array.from(el.querySelectorAll('.hw-port')).map(cells);
    expect(ports).toEqual(['in channel int64', 'out return int64 count']);
    expect(el.querySelector('.hw-badge--place')?.textContent).toContain('board · C');
    expect(el.textContent).not.toContain('{');   // no raw JSON on screen
  });

  it('a HardwareSubgraph node is ONE collapsed node that expands into the CGraph\'s nodes and collapses again', async () => {
    await make('HardwareSubgraph', { cgraph: 'uno-sim-rig-graph', board_definition: 'arduino-uno-r3' });
    http.expectOne(`${BASE}/api/cmod/graphs/uno-sim-rig-graph`).flush({
      ok: true,
      graph: { name: 'uno-sim-rig-graph', title: 'The sim rig as a graph', status: 'proven', node_count: 3, edge_count: 2, atom_count: 2,
               cost_estimate_bytes: 3144, graph_sha256: 'e5ea718e' },
      nodes: [{ instance: 'adc', kind: 'c-atom', atom: 'uno:hal.hal_adc_read', stage: 'loop', order: 22 },
              { instance: 'usart_init', kind: 'c-atom', atom: 'uno:hal.hal_usart_init', stage: 'init', order: 1 },
              { instance: 'telemetry', kind: 'tick', atom: '', stage: '', order: 21 }],
    });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(comp.mode).toBe('subgraph');
    expect(el.querySelector('.hw-summary')?.textContent).toContain('3 nodes · 2 atoms · 2 edges');
    expect(el.querySelectorAll('.hw-node').length).toBe(0);           // collapsed: one node on the canvas
    (el.querySelector('.hw-expand') as HTMLButtonElement).click();
    fixture.detectChanges();
    const rows = Array.from(el.querySelectorAll('.hw-node')).map(cells);
    expect(rows).toEqual(['usart_init c-atom hal_usart_init init', 'telemetry tick', 'adc c-atom hal_adc_read loop']);
    (el.querySelector('.hw-expand') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelectorAll('.hw-node').length).toBe(0);
  });

  it('editing the name emits fieldValuesChanged and re-reads; a refusal shows its words', async () => {
    await make('CAtom', { atom: 'uno:hal.hal_millis' });
    http.expectOne(`${BASE}/api/cmod/atoms/uno%3Ahal.hal_millis`).flush({ ok: true, atom: null, ports: [] });
    const emitted: any[] = [];
    comp.fieldValuesChanged.subscribe(v => emitted.push(v));
    comp.onRefChange('apply_command');
    expect(emitted).toEqual([{ atom: 'apply_command' }]);
    http.expectOne(`${BASE}/api/cmod/atoms/apply_command`).flush(
      { ok: false, error: "'apply_command' names several atoms: uno:apps/sim_rig.apply_command, uno:apps/scenario_rig.apply_command" },
      { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.hw-state--error')?.textContent).toContain('names several atoms');
  });

  it('the tiny tier is an icon only (no controls)', async () => {
    await make('CAtom', { atom: 'uno:hal.hal_led' }, 40);
    http.expectOne(`${BASE}/api/cmod/atoms/uno%3Ahal.hal_led`).flush({ ok: true, atom: null, ports: [] });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(comp.sizeTier).toBe('tiny');
    expect(el.querySelector('.tier-tiny')).not.toBeNull();
    expect(el.querySelector('input')).toBeNull();
  });
});
