import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { HardwarePinViewComponent } from './hardware-pin-view.component';
import { FIXTURE_BASE } from './pin-view.fixture';
import { FIXTURE_BENCH_BRIDGES, FIXTURE_BRIDGE_HOPS, FIXTURE_STRUCT_BINDINGS } from './pin-view-struct.fixture';
import { FIXTURE_EVENTS } from './pin-view-phases.fixture';
import { buildScene } from './pin-view-layout';
import { buildStructLane, fieldPins, pinFor, structRows } from './pin-view-struct';
import { PvPayload, PvStructBinding } from './pin-view.types';
import { PolariService } from '@services/polari-service';

/**
 * hsp-3b — the pin view's struct lane (HARDWARE_SYSTEM_PINS_PLAN §7.3). What must hold: off by default (the base picture reads no extra door); on, it reads
 * the bindings and the bench's bridge by GET only; the fields stand in a column beside the board with one arrow per binding, coloured by its lane and
 * stamped HW / US; a binding lands on the SoC pin's package leg; the bridge path is a chain of hops wired from the UART pins, with the level on each hop and
 * the mode on the last; a field click lights its pins (and the chain when it crosses the bridge), a second click clears; a pin shows its fields in the
 * side panel (both ways); a board with no binding says so in words. The data is real framework output (pin-view-struct.fixture.ts).
 */
const PAYLOAD = FIXTURE_BASE as unknown as PvPayload;
const ROWS = FIXTURE_STRUCT_BINDINGS.rows as PvStructBinding[];
const CHAIN = { bridge: FIXTURE_BENCH_BRIDGES.bridges[0] as any, hops: FIXTURE_BRIDGE_HOPS.rows as any[] };

describe('pin view struct lane (model)', () => {
  const scene = buildScene(PAYLOAD);

  it('lands a binding on the package leg of its SoC pin, never on a guess', () => {
    expect(pinFor(scene, 'PD2')?.pin.id).toBe('PackageContact:atmega328p-28-spdip:4');
    expect(pinFor(scene, 'PZ9')).toBeNull();
  });

  it('places the fields in a column right of the board, one arrow per binding, lane and updater kept', () => {
    const lane = buildStructLane(scene, PAYLOAD, ROWS, CHAIN);
    expect(lane.fields.map(f => f.field).sort()).toEqual(['*', 'led_on', 'source', 'status', 'toggles']);
    expect(lane.fields.every(f => f.x > scene.bounds.x1)).toBeTrue();
    expect(lane.arrows.length).toBe(ROWS.length);
    expect(lane.arrows.filter(a => a.updater === 'HW').length).toBe(ROWS.filter(r => r.updater === 'HW').length);
    expect(lane.arrows.find(a => a.direction === 'from-bridge')!.lane).toBe('isr');
    expect(lane.fields.find(f => f.field === '*')!.label).toBe('(the whole struct)');
    expect(lane.unplaced).toEqual([]);
  });

  it('draws the bridge as its five hops, the level on each (-1 when nobody cited one) and the mode on the last, wired from PD0 / PD1', () => {
    const lane = buildStructLane(scene, PAYLOAD, ROWS, CHAIN);
    expect(lane.hops.map(h => h.kind)).toEqual(['chip-pins', 'converter', 'connector', 'host-port', 'userspace']);
    expect(lane.hops[1].level).toBe('5 V');
    expect(lane.hops[2].level).toBe('level -1');
    expect(lane.hops[4].level).toContain('serial');
    expect(lane.hopLinks.map(l => l.pinName)).toEqual(['PD0', 'PD1']);
    expect(lane.hopEdges.length).toBe(4);
    expect(lane.bounds.x1).toBeGreaterThan(lane.fields[0].x + lane.fields[0].w);
  });

  it('reads both ways: a field names its pins; a pin names its fields', () => {
    const lane = buildStructLane(scene, PAYLOAD, ROWS, CHAIN);
    const pd2 = pinFor(scene, 'PD2')!.pin.id, pd6 = pinFor(scene, 'PD6')!.pin.id;
    expect([...fieldPins(lane, 'LightState_t.led_on')]).toContain(pd2);
    expect([...fieldPins(lane, 'LightState_t.led_on')]).toContain(pd6);
    expect(structRows(lane, { pinName: 'PD6' }).map(r => r.fieldLabel)).toEqual(['led_on']);
    expect(structRows(lane, { pinName: 'PD6' })[0].direction).toBe('the field drives the pin');
  });

  it('a pin the picture does not hold is listed as unplaced, with why', () => {
    const lane = buildStructLane(scene, PAYLOAD, [{ ...ROWS[0], pin: 'PB7' }], null);
    expect(lane.arrows.length).toBe(0);
    expect(lane.unplaced[0].pin).toBe('PB7');
  });
});

describe('pin view struct lane (component)', () => {
  let fixture: ComponentFixture<HardwarePinViewComponent>;
  let component: HardwarePinViewComponent;
  let urls: string[];

  function create(query: Record<string, string> = {}): void {
    urls = [];
    TestBed.configureTestingModule({
      imports: [HardwarePinViewComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) }, queryParamMap: of(convertToParamMap(query)) } },
        {
          provide: HttpClient, useValue: {
            get: (url: string) => {
              urls.push(url);
              if (url.includes('/api/firmware/bindings')) { return of({ ok: true, bindings: [] }); }
              if (url.includes('/config-events')) { return of(FIXTURE_EVENTS); }
              if (url.includes('/catom-assertions/')) { return of(FIXTURE_STRUCT_BINDINGS); }
              if (url.includes('view=hops')) { return of(FIXTURE_BRIDGE_HOPS); }
              if (url.includes('/bench-bridges/')) { return of(FIXTURE_BENCH_BRIDGES); }
              return of(FIXTURE_BASE);
            },
          },
        },
        { provide: PolariService, useValue: { getBackendBaseUrl: () => '', backendRequestOptions: {} } },
      ],
    });
    fixture = TestBed.createComponent(HardwarePinViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }
  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const click = (n: Element) => n.dispatchEvent(new MouseEvent('click', { bubbles: true }));

  it('is off by default: no struct door is read and nothing of the lane is drawn', () => {
    create();
    expect(urls.some(u => u.includes('catom-assertions') || u.includes('bench-bridges'))).toBeFalse();
    expect(el().querySelectorAll('.pv-lane-arrow').length).toBe(0);
  });

  it('the toggle reads the bindings and the bridge by GET and draws arrows, fields, stamps and hops; off again removes them', () => {
    create();
    component.setShowStruct(true);
    fixture.detectChanges();
    expect(urls).toContain('/api/cmod/catom-assertions/uno-light?view=bindings');
    expect(urls).toContain('/api/grpc/bench-bridges/home-bench?view=hops&bridge=uno-1-bridge');
    expect(el().querySelectorAll('.pv-lane-arrow').length).toBe(ROWS.length);
    expect(el().querySelectorAll('.pv-lane-arrow.lane-isr').length).toBe(1);
    expect(el().querySelectorAll('.pv-lane-field').length).toBe(5);
    expect(Array.from(el().querySelectorAll('.pv-lane-stamp')).map(t => t.textContent)).toContain('US');
    expect(el().querySelectorAll('.pv-hop').length).toBe(5);
    expect(el().querySelector('.pv-hop.last .pv-hop-level')!.textContent).toContain('serial');
    expect(el().querySelector('.pv-lane-legend')).not.toBeNull();
    component.setShowStruct(false);
    fixture.detectChanges();
    expect(el().querySelectorAll('.pv-lane-arrow, .pv-lane-field, .pv-hop').length).toBe(0);
  });

  it('?struct=1 opens with the lane drawn', () => {
    create({ struct: '1' });
    expect(el().querySelectorAll('.pv-lane-field').length).toBe(5);
  });

  it('a field click lights its pins and arrows (and the chain: led_on also comes in through the bridge), dims the rest; a second click clears', () => {
    create({ struct: '1' });
    const led = el().querySelector('.pv-lane-field[data-field="LightState_t.led_on"]')!;
    click(led);
    fixture.detectChanges();
    expect(component.fieldSel).toBe('LightState_t.led_on');
    expect(led.classList).toContain('sel');
    expect(el().querySelector('.pv-pin[data-pin-id="PackageContact:atmega328p-28-spdip:4"]')!.classList).toContain('event-hi');
    expect(el().querySelectorAll('.pv-lane-arrow.hi').length).toBe(ROWS.filter(r => r.field === 'led_on').length);
    expect(el().querySelector('.pv-hop')!.classList).toContain('hi');   // led_on also arrives from the host: SET_LED through uno-1-bridge
    expect(el().querySelector('.pv-field-title')!.textContent).toContain('LightState_t.led_on');
    click(el().querySelector('.pv-lane-field[data-field="LightState_t.*"]')!);
    fixture.detectChanges();
    expect(el().querySelector('.pv-hop')!.classList).toContain('hi');
    expect(el().querySelector('.pv-hop-list')).not.toBeNull();
    click(el().querySelector('.pv-lane-field[data-field="LightState_t.*"]')!);
    fixture.detectChanges();
    expect(component.fieldSel).toBe('');
    expect(el().querySelectorAll('.pv-lane-arrow.dim').length).toBe(0);
  });

  it('a pin shows its struct fields in the side panel, from the die pad as from the leg (both ways); Escape clears a field', () => {
    create({ struct: '1' });
    component.pickPin('SocPin:atmega328p:PD6');
    fixture.detectChanges();
    const rows = Array.from(el().querySelectorAll('.pv-pin-struct .pv-struct-row'));
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('led_on');
    expect(el().querySelectorAll('.pv-lane-arrow.hi').length).toBe(1);
    expect(el().querySelector('.pv-hop')!.classList).toContain('dim');   // PD6 is no bridge pin
    component.pickField('LightState_t.led_on');
    expect(component.selection).toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(component.fieldSel).toBe('');
  });

  it('a board with no binding chosen says so in words and reads no binding door', () => {
    create({ struct: '1', board: 'esp32-c3' });
    fixture.detectChanges();
    expect(urls.some(u => u.includes('catom-assertions'))).toBeFalse();
    expect(el().querySelector('.pv-struct-note')!.textContent).toContain('No firmware binding is chosen for esp32-c3');
  });

  it('never puts JSON on screen', () => {
    create({ struct: '1' });
    component.pickField('LightState_t.led_on');
    fixture.detectChanges();
    expect(el().querySelector('.pv-side')!.textContent).not.toMatch(/[{}]\s*"/);
  });
});
