import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { HardwarePinViewComponent } from './hardware-pin-view.component';
import { FIXTURE_BASE, FIXTURE_SPI } from './pin-view.fixture';
import { PolariService } from '@services/polari-service';

/**
 * pv-1 — the pin view. What must hold: one shape per surface and one mark per pin; nothing is wired until
 * something is selected; a surface click draws only ITS connections; a second click and Escape clear; a pin
 * then a connection shows Drive / Signal / Use as three separate sections and Signal never speaks of
 * "driving" (drive = electricity, signal = outputs / inputs); the protocol filter dims the pins that cannot
 * carry it; "show unassigned" highlights the hollow pins; no JSON is ever on screen.
 * The payloads are real pin-view output (pin-view.fixture.ts).
 */
describe('HardwarePinViewComponent', () => {
  let fixture: ComponentFixture<HardwarePinViewComponent>;
  let component: HardwarePinViewComponent;
  let urls: string[];
  let reply: (url: string) => any;

  const PKG = 'package:arduino-uno-r3:U1';
  const DIE = 'die:arduino-uno-r3:U1';   // its connections are the pad-to-leg lines only: fewer than the whole board's
  const MOSI_LEG = 'PackageContact:atmega328p-28-spdip:17';

  function create(): void {
    urls = [];
    TestBed.configureTestingModule({
      imports: [HardwarePinViewComponent],
      providers: [
        provideRouter([]),
        { provide: HttpClient, useValue: { get: (url: string) => { urls.push(url); return reply(url); } } },
        { provide: PolariService, useValue: { getBackendBaseUrl: () => '', backendRequestOptions: {} } },
      ],
    });
    fixture = TestBed.createComponent(HardwarePinViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(() => {
    reply = (url: string) => {
      if (url.includes('/api/firmware/bindings')) { return of({ ok: true, bindings: [{ name: 'uno-light@arduino-uno-r3', board: 'arduino-uno-r3' }] }); }
      return of(url.includes('protocol=spi') || url.includes('stage=tasks-assigned') ? FIXTURE_SPI : FIXTURE_BASE);
    };
  });

  const root = () => fixture.nativeElement as HTMLElement;
  const q = (sel: string) => Array.from(root().querySelectorAll(sel)) as HTMLElement[];
  const pins = () => q('.pv-pins .pv-pin');
  const lines = () => q('.pv-lines .pv-conn');
  const click = (el: Element) => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); fixture.detectChanges(); };
  const surfaceEl = (id: string) => root().querySelector(`.pv-surface[data-surface-id="${id}"]`)!;
  const pinEl = (id: string) => root().querySelector(`.pv-pins .pv-pin[data-pin-id="${id}"]`)!;

  it('draws one shape per surface and one mark per pin, with nothing wired by default', () => {
    create();
    expect(q('.pv-surface').length).toBe(FIXTURE_BASE.surfaces.length);
    expect(pins().length).toBe(FIXTURE_BASE.pins.length);
    expect(new Set(pins().map(p => p.getAttribute('data-pin-id')))).toEqual(new Set(FIXTURE_BASE.pins.map(p => p.id)));
    expect(lines().length).toBe(0);
    expect(urls.some(u => u.includes('/api/board/arduino-uno-r3/pin-view') && u.includes('stage=base') && u.includes('system=uno-light-system'))).toBeTrue();
  });

  it('colours by family and marks the symbol and fill (RESET leg: reset glyph, hollow ring)', () => {
    create();
    const reset = pinEl('PackageContact:atmega328p-28-spdip:1');
    expect(reset.getAttribute('data-family')).toBe('reset-programming');
    expect(reset.getAttribute('data-role')).toBe('reset');
    expect(reset.getAttribute('data-fill')).toBe('hollow');
    expect((reset as HTMLElement).style.getPropertyValue('--fam')).toContain('--pin-reset-programming');
    const pad = pinEl('SocPin:atmega328p:PC6');
    expect(pad).toBeTruthy();
    expect(q('.pv-pins .pv-pin[data-role="power"]').length).toBeGreaterThan(0);
    expect(q('.pv-pins .pv-pin[data-role="ground"]').length).toBeGreaterThan(0);
  });

  it('a surface click draws only its own connections; a second click clears; Escape clears', () => {
    create();
    const mine = FIXTURE_BASE.connections.filter(c => {
      const on = (id: string) => FIXTURE_BASE.pins.find(p => p.id === id)!.surface === DIE;
      return on(c.a) || on(c.b);
    });
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.length).toBeLessThan(FIXTURE_BASE.connections.length);
    click(surfaceEl(DIE));
    expect(lines().map(l => l.getAttribute('data-conn-id')!).sort()).toEqual(mine.map(c => c.id).sort());
    expect(surfaceEl(DIE).classList).toContain('sel');
    expect(q('.pv-surface-title')[0].textContent).toContain('U1');
    expect(mine.every(c => c.kind === 'pad-to-leg')).toBeTrue();
    expect(q('.pv-group').length).toBeGreaterThan(0);
    click(surfaceEl(DIE));
    expect(lines().length).toBe(0);
    expect(surfaceEl(DIE).classList).not.toContain('sel');
    click(surfaceEl(DIE));
    expect(lines().length).toBe(mine.length);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(lines().length).toBe(0);
    expect(component.selection).toBeNull();
  });

  it('the SoC surface offers its register profile', () => {
    create();
    click(surfaceEl('die:arduino-uno-r3:U1'));
    const link = root().querySelector('a.pv-register-link') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toContain('/display/register-profile');
  });

  it('a pin shows its connections; a connection shows Drive, Signal and Use as separate sections, and Signal never says "driv"', () => {
    create();
    click(pinEl(MOSI_LEG));
    const own = FIXTURE_BASE.connections.filter(c => c.a === MOSI_LEG || c.b === MOSI_LEG);
    expect(own.length).toBeGreaterThan(1);
    expect(lines().length).toBe(own.length);
    expect(q('.pv-pin-title').length).toBe(1);
    click(root().querySelector('.pv-lines .pv-conn .pv-line-hit')!);
    expect(lines().length).toBe(own.length);   // the siblings stay drawn
    const drive = root().querySelector('.pv-sec-drive')!, signal = root().querySelector('.pv-sec-signal')!, use = root().querySelector('.pv-sec-use')!;
    expect(drive && signal && use).toBeTruthy();
    expect(drive.contains(signal) || signal.contains(drive) || use.contains(signal) || signal.contains(use)).toBeFalse();
    expect(drive.querySelector('h4')!.textContent).toBe('Drive');
    expect(signal.querySelector('h4')!.textContent).toBe('Signal');
    expect(use.querySelector('h4')!.textContent).toBe('Use');
    expect(signal.textContent).not.toMatch(/driv/i);
    expect(drive.textContent).toContain('Limit class');
    expect(drive.textContent).toContain('Electrical view');
    expect(signal.textContent).toMatch(/outputs|inputs|passes|bidirectional|undetermined/);
    // a second click on the same connection steps back to the pin
    click(root().querySelector('.pv-lines .pv-conn .pv-line-hit')!);
    expect(root().querySelector('.pv-sec-drive')).toBeNull();
    expect(q('.pv-pin-title').length).toBe(1);
    expect(lines().length).toBe(own.length);
  });

  it('protocol=spi asks the door and dims the pins that cannot carry SPI', () => {
    create();
    component.setProtocol('spi');
    fixture.detectChanges();
    expect(urls.some(u => u.includes('protocol=spi'))).toBeTrue();
    const lit = FIXTURE_SPI.pins.filter(p => !!p.lit).length;
    expect(lit).toBeGreaterThan(0);
    expect(q('.pv-pins .pv-pin.lit').length).toBe(lit);
    expect(q('.pv-pins .pv-pin.dim').length).toBe(FIXTURE_SPI.pins.length - lit);
    const sck = FIXTURE_SPI.pins.find(p => p.lit)!;
    expect(pinEl(sck.id).querySelector('title')!.textContent).toContain(sck.lit!.children[0].child);
    expect(root().querySelector('.pv-note')!.textContent).toContain('SCK');
  });

  it('show unassigned highlights the hollow pins and softens the assigned ones', () => {
    create();
    component.setStage('tasks-assigned');
    fixture.detectChanges();
    expect(urls.some(u => u.includes('stage=tasks-assigned') && u.includes('binding=uno-light%40arduino-uno-r3'))).toBeTrue();
    const hollow = FIXTURE_SPI.pins.filter(p => p.stage === 'unassigned' || p.stage === 'available').length;
    const assigned = FIXTURE_SPI.pins.length - hollow;
    expect(assigned).toBeGreaterThan(0);
    expect(q('.pv-pins .pv-pin[data-fill="proposed"]').length).toBeGreaterThan(0);
    expect(q('.pv-pins .pv-pin.unassigned-hi').length).toBe(0);
    const box = root().querySelector('.pv-unassigned-toggle') as HTMLInputElement;
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(q('.pv-pins .pv-pin.unassigned-hi').length).toBe(hollow);
    expect(q('.pv-pins .pv-pin.soft').length).toBe(assigned);
  });

  it('says in plain words when the door fails', () => {
    reply = (url: string) => (url.includes('/api/firmware/bindings') ? of({ bindings: [] }) : throwError(() => ({ status: 503, error: { error: 'engines still starting' } })));
    create();
    expect(root().querySelector('.pv-error')!.textContent).toContain('starting');
    expect(root().querySelector('.pv-loading')).toBeNull();
  });

  it('never puts raw JSON on screen, in any panel', () => {
    create();
    const bad = /[{}\[\]]\s*"|":\s*[{"\[\d]|\[object Object\]/;
    const check = () => { expect(root().querySelectorAll('pre, code').length).toBe(0); expect(root().textContent).not.toMatch(bad); };
    check();
    click(surfaceEl(PKG)); check();
    click(pinEl(MOSI_LEG)); check();
    click(root().querySelector('.pv-lines .pv-conn .pv-line-hit')!); check();
  });

  it('never writes: only GETs are issued, and the query carries names only', () => {
    create();
    click(pinEl(MOSI_LEG));
    expect(urls.every(u => !u.includes('{') && !u.includes('%7B'))).toBeTrue();
  });
});
