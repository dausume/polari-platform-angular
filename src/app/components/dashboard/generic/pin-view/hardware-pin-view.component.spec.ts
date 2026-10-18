import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { defer, of, throwError } from 'rxjs';

import { HardwarePinViewComponent } from './hardware-pin-view.component';
import { FIXTURE_BASE, FIXTURE_COMMITTED, FIXTURE_SPI } from './pin-view.fixture';
import { FIXTURE_BOOTLOADER, FIXTURE_EVENTS, FIXTURE_RESET } from './pin-view-phases.fixture';
import { DRIVE_GLYPHS, GLYPHS } from './pin-view-encode';
import { buildScene } from './pin-view-layout';
import { PolariService } from '@services/polari-service';

/**
 * pv-1 — the pin view. What must hold: one shape per surface and one mark per pin; nothing is wired until
 * something is selected; a surface click draws only ITS connections; a second click and Escape clear; a pin
 * then a connection shows Drive / Signal / Use as three separate sections and Signal never speaks of
 * "driving" (drive = electricity, signal = outputs / inputs); the protocol filter dims the pins that cannot
 * carry it; "show unassigned" highlights the hollow pins; no JSON is ever on screen.
 * pv-2 adds: the All / Drive / Signal mode switch (a mode hides the pins that are not relevant to it, the surfaces stay), the drive symbols per status, the
 * multi-select protocol chips with "activated only", the drive filters (matching pins highlighted, the rest greyed), the per-mode legend, part titles and the fit.
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

  function create(query: Record<string, string> = {}): void {
    urls = [];
    TestBed.configureTestingModule({
      imports: [HardwarePinViewComponent],
      providers: [
        provideRouter([]),
        ...(Object.keys(query).length ? [{ provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) }, queryParamMap: of(convertToParamMap(query)) } }] : []),
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
      if (url.includes('/config-events')) { return of(FIXTURE_EVENTS); }
      if (url.includes('phase=reset') || url.includes('phase=power-up')) { return of(FIXTURE_RESET); }
      if (url.includes('phase=bootloader')) { return of(FIXTURE_BOOTLOADER); }
      if (url.includes('stage=firmware-committed')) { return of(FIXTURE_COMMITTED); }
      return of(url.includes('protocol=') || url.includes('stage=tasks-assigned') ? FIXTURE_SPI : FIXTURE_BASE);
    };
  });

  const root = () => fixture.nativeElement as HTMLElement;
  const q = (sel: string) => Array.from(root().querySelectorAll(sel)) as HTMLElement[];
  const pins = () => q('.pv-pins .pv-pin');
  const lines = () => q('.pv-lines .pv-conn');
  const click = (el: Element) => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); fixture.detectChanges(); };
  const surfaceEl = (id: string) => root().querySelector(`.pv-surface[data-surface-id="${id}"]`)!;
  const pinEl = (id: string) => root().querySelector(`.pv-pins .pv-pin[data-pin-id="${id}"]`)! as HTMLElement;

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

  it('says in plain words when the door fails (after ONE retry for a 5xx / network failure)', fakeAsync(() => {
    let calls = 0;
    reply = (url: string) => (url.includes('/api/firmware/bindings') || url.includes('/config-events') ? of({ bindings: [], ok: true, events: [] })
      : defer(() => { calls++; return throwError(() => ({ status: 503, error: { error: 'engines still starting' } })); }));
    create();
    tick(1600);
    fixture.detectChanges();
    expect(calls).toBe(2);
    expect(root().querySelector('.pv-error')!.textContent).toContain('starting');
    expect(root().querySelector('.pv-loading')).toBeNull();
  }));

  it('does not retry a 4xx (a bad name is reported at once)', fakeAsync(() => {
    let calls = 0;
    reply = (url: string) => (url.includes('/api/firmware/bindings') || url.includes('/config-events') ? of({ bindings: [], ok: true, events: [] })
      : defer(() => { calls++; return throwError(() => ({ status: 404, error: { error: 'no such board' } })); }));
    create();
    tick(1600);
    expect(calls).toBe(1);
  }));

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

  // ================================================================ pv-2
  const D6 = 'SocPin:atmega328p:PD6', D2 = 'SocPin:atmega328p:PD2', D0 = 'SocPin:atmega328p:PD0', VCC_LEG = 'PackageContact:atmega328p-28-spdip:7', GND_LEG = 'PackageContact:atmega328p-28-spdip:8';
  const CSTCE = 'part:arduino-uno-r3:CSTCE16M0V53-R0';
  const hidden = () => pins().filter(p => (p as unknown as SVGElement).style.display === 'none');
  const modeBtn = (m: string) => root().querySelector(`.pv-mode[data-mode="${m}"]`)!;
  function committed(): void {
    create();
    component.setStage('firmware-committed');
    fixture.detectChanges();
  }

  it('the mode switch: Drive hides the pins that are not drive-relevant, Signal hides supply and ground, All shows everything; the surfaces stay drawn', () => {
    committed();
    const nSurfaces = q('.pv-surface').length;
    expect(hidden().length).toBe(0);
    click(modeBtn('drive'));
    expect(component.mode).toBe('drive');
    expect(hidden().map(p => p.getAttribute('data-pin-id')!).sort()).toEqual(FIXTURE_COMMITTED.pins.filter(p => !p.drive_relevant).map(p => p.id).sort());
    expect(hidden().length).toBeGreaterThan(0);
    expect(pinEl(VCC_LEG).style.display).not.toBe('none');   // a supply leg is a drive pin
    expect(q('.pv-surface').length).toBe(nSurfaces);
    click(modeBtn('signal'));
    expect(hidden().map(p => p.getAttribute('data-pin-id')!).sort()).toEqual(FIXTURE_COMMITTED.pins.filter(p => !p.signal_relevant).map(p => p.id).sort());
    expect(pinEl(VCC_LEG).style.display).toBe('none');
    expect(pinEl(GND_LEG).style.display).toBe('none');
    expect(pinEl(D6).style.display).not.toBe('none');
    expect(q('.pv-surface').length).toBe(nSurfaces);
    click(modeBtn('all'));
    expect(hidden().length).toBe(0);
    expect(modeBtn('all').getAttribute('aria-pressed')).toBe('true');
  });

  it('drive symbols follow the status: D6 sources or sinks (double-headed), D2 pulled up (resistor), the ground leg returns, the supply leg is supplied; colour = rail; hatched while the limit is undetermined', () => {
    committed();
    click(modeBtn('drive'));
    const glyph = (id: string) => pinEl(id).querySelector('.pv-glyph')!.getAttribute('d');
    expect(pinEl(D6).getAttribute('data-role')).toBe('sources-or-sinks');
    expect(glyph(D6)).toBe(DRIVE_GLYPHS['sources-or-sinks']);
    expect(pinEl(D2).getAttribute('data-role')).toBe('pulled-up');
    expect(glyph(D2)).toBe(DRIVE_GLYPHS['pulled-up']);
    expect(pinEl(D0).getAttribute('data-role')).toBe('high-impedance');
    expect(pinEl(GND_LEG).getAttribute('data-role')).toBe('returns');
    expect(glyph(GND_LEG)).toBe(DRIVE_GLYPHS['returns']);
    expect(pinEl(VCC_LEG).getAttribute('data-role')).toBe('supplied');
    expect(glyph(VCC_LEG)).toBe(DRIVE_GLYPHS['supplied']);
    expect(pinEl(D6).getAttribute('data-family')).toBe('logic-io');
    expect(pinEl(VCC_LEG).getAttribute('data-family')).toBe('5V');
    expect((pinEl(VCC_LEG) as HTMLElement).style.getPropertyValue('--fam')).toContain('--drive-5v');
    expect(pinEl(D6).getAttribute('data-fill')).toBe('hatched');   // limit_class undetermined (rule led_current, assumed forward voltage)
    expect(pinEl(D2).getAttribute('data-fill')).not.toBe('hatched');
    // the limit filter recolours by the class of the limit
    component.toggleLimit('undetermined');
    fixture.detectChanges();
    expect((pinEl(D6) as HTMLElement).style.getPropertyValue('--fam')).toContain('--drive-undetermined');
    expect(pinEl(D6).getAttribute('data-family')).toBe('undetermined');
  });

  it('signal mode shows the activated function as a badge in its family colour with the symbol of its direction; nothing is activated at stage base', () => {
    create();
    click(modeBtn('signal'));
    expect(q('.pv-badge').filter(b => b.style.display !== 'none').length).toBe(0);
    expect(pins().every(p => p.getAttribute('data-fill') === 'hollow')).toBeTrue();
    component.setStage('firmware-committed');
    fixture.detectChanges();
    const badge = pinEl(D0).querySelector('.pv-badge') as HTMLElement;
    expect(badge.textContent).toBe('RXD');
    expect(badge.style.display).not.toBe('none');
    expect(pinEl(D0).getAttribute('data-family')).toBe('uart');
    expect(pinEl(D0).getAttribute('data-role')).toBe('input');
    expect(pinEl(D0).querySelector('.pv-glyph')!.getAttribute('d')).toBe(GLYPHS.input);
    expect(pinEl(D6).getAttribute('data-role')).toBe('output');
    expect((pinEl(D6).querySelector('.pv-badge') as HTMLElement).textContent).toBe('GPIO-out');
  });

  it('connection lines follow the mode: a mode draws only its relevant connections; the pin panel lists Drive and Signal with the capable functions greyed', () => {
    committed();
    click(surfaceEl(PKG));
    const mine = FIXTURE_COMMITTED.connections.filter(c => FIXTURE_COMMITTED.pins.some(p => (p.id === c.a || p.id === c.b) && p.surface === PKG));
    const isRail = (c: { kind: string; signal: { family: string } }) => (c.signal.family === 'power' || c.signal.family === 'ground') && c.kind !== 'pad-to-leg';
    expect(mine.some(isRail)).toBeTrue();
    expect(lines().length).toBe(mine.filter(c => !isRail(c)).length);   // All: rail links are stubs, not lines
    click(modeBtn('signal'));
    expect(lines().length).toBe(mine.filter(c => c.signal_relevant && !isRail(c)).length);
    expect(lines().length).toBeLessThan(mine.length);
    click(modeBtn('drive'));
    expect(lines().length).toBe(mine.filter(c => c.drive_relevant).length);   // Drive: the rail links ARE the point
    click(pinEl(D0));
    const sig = root().querySelector('.pv-psec-signal')!, drv = root().querySelector('.pv-psec-drive')!;
    expect(sig && drv).toBeTruthy();
    expect(drv.textContent).toContain('high impedance');
    expect(sig.textContent).toContain('RXD');
    const grey = Array.from(sig.querySelectorAll('.pv-capable .pv-chip.pv-grey')).map(c => c.textContent);
    expect(grey).toContain('GPIO');
    expect(grey).not.toContain('RXD');
    expect(sig.querySelector('.pv-capable .pv-chip.pv-active')!.textContent).toBe('RXD');
    expect(drv.textContent).not.toMatch(/outputs|inputs|RXD/);
    expect(sig.textContent).not.toMatch(/sources|sinks|supplied/);
  });

  it('rail links collapse outside Drive mode: a stub and a rail tag on the pin, the rail\'s other pins listed in the panel; Drive draws them; selecting zooms to the selection and clearing fits all', () => {
    committed();
    const rails = (c: { kind: string; signal: { family: string } }) => (c.signal.family === 'power' || c.signal.family === 'ground') && c.kind !== 'pad-to-leg';
    click(surfaceEl(PKG));
    const stubs = () => q('.pv-stubs .pv-stub');
    expect(stubs().map(s => s.getAttribute('data-pin-id'))).toEqual(jasmine.arrayContaining([VCC_LEG, GND_LEG]));
    expect(stubs().find(s => s.getAttribute('data-pin-id') === VCC_LEG)!.querySelector('text')!.textContent).toBe('5V');
    expect(stubs().find(s => s.getAttribute('data-pin-id') === GND_LEG)!.querySelector('text')!.textContent).toBe('GND');
    const drawnIds = lines().map(l => l.getAttribute('data-conn-id'));
    expect(FIXTURE_COMMITTED.connections.filter(c => rails(c) && drawnIds.includes(c.id)).length).toBe(0);
    expect(root().querySelector('.pv-rails')!.textContent).toContain('also reaches');
    click(modeBtn('signal'));
    expect(lines().every(l => !rails(FIXTURE_COMMITTED.connections.find(c => c.id === l.getAttribute('data-conn-id'))!))).toBeTrue();
    click(modeBtn('drive'));
    expect(stubs().length).toBe(0);
    expect(lines().some(l => rails(FIXTURE_COMMITTED.connections.find(c => c.id === l.getAttribute('data-conn-id'))!))).toBeTrue();
    // zoom to the selection, and back
    const zoomG = root().querySelector('.pv-zoom') as SVGGElement;
    const before = zoomG.getAttribute('transform');
    click(surfaceEl(DIE));
    expect(component.selection).toBeTruthy();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(component.selection).toBeNull();
    expect(before).toBeTruthy();
  });

  it('protocol chips are multi-select: i2c + spi ask the door for both and every pin outside both sets is greyed, not hidden; activated only asks for it', () => {
    committed();
    q('.pv-protocol-chip')[0].click();
    fixture.detectChanges();
    expect(component.protocol).toBe('i2c');
    (root().querySelector('.pv-protocol-chip[data-protocol="spi"]') as HTMLElement).click();
    fixture.detectChanges();
    expect(component.protocol).toBe('i2c,spi');
    expect(urls.some(u => u.includes('protocol=i2c%2Cspi'))).toBeTrue();
    const asked = ['i2c', 'spi'];
    const want = FIXTURE_SPI.pins.filter(p => p.families.some(f => asked.includes(f)));
    expect(want.length).toBeGreaterThan(0);
    expect(want.length).toBeLessThan(FIXTURE_SPI.pins.length);
    expect(q('.pv-pins .pv-pin.dim').length).toBe(FIXTURE_SPI.pins.length - want.length);   // the door's answer is for spi alone, so the family match answers meanwhile
    expect(hidden().length).toBe(0);   // greyed, not hidden
    const ao = root().querySelector('.pv-activated-only') as HTMLInputElement;
    expect(ao.disabled).toBeFalse();
    ao.checked = true;
    ao.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(urls[urls.length - 1]).toContain('activated_only=1');
    // a second click on a chip clears it
    (root().querySelector('.pv-protocol-chip[data-protocol="i2c"]') as HTMLElement).click();
    fixture.detectChanges();
    expect(component.protocol).toBe('spi');
  });

  it('drive filters highlight the matching pins and grey the rest; "Clear filters" resets every filter', () => {
    committed();
    click(modeBtn('drive'));
    (root().querySelector('.pv-rail-chip[data-rail="5V"]') as HTMLElement).click();
    fixture.detectChanges();
    const five = FIXTURE_COMMITTED.pins.filter(p => p.rail === '5V' && p.drive_relevant);
    expect(five.length).toBeGreaterThan(0);
    expect(q('.pv-pins .pv-pin.match').filter(p => p.style.display !== 'none').length).toBe(five.length);
    expect(pinEl(VCC_LEG).classList).not.toContain('dim');
    expect(pinEl(D6).classList).toContain('dim');
    expect(hidden().length).toBeGreaterThan(0);   // hidden = not drive-relevant only; the greyed pins are still there
    (root().querySelector('.pv-status-chip[data-status="pulled-up"]') as HTMLElement).click();
    fixture.detectChanges();
    expect(q('.pv-pins .pv-pin.match').filter(p => p.style.display !== 'none').length).toBe(0);   // 5V AND pulled-up: nothing
    const clear = root().querySelector('.pv-clear-filters') as HTMLButtonElement;
    expect(clear.disabled).toBeFalse();
    click(clear);
    expect(component.fRails.size + component.fStatuses.size + component.fLimits.size).toBe(0);
    expect(q('.pv-pins .pv-pin.dim').length).toBe(0);
    expect(clear.disabled).toBeTrue();
  });

  it('the legend changes with the mode: signal families, then rails and power-flow symbols, then signal symbols', () => {
    committed();
    const legend = () => root().querySelector('.pv-legend')!.textContent!;
    expect(legend()).toContain('Colour is the signal family');
    expect(root().querySelector('.pv-drive-legend')).toBeNull();
    click(modeBtn('drive'));
    expect(legend()).toContain('Colour is the rail');
    expect(legend()).not.toContain('Colour is the signal family');
    expect(q('.pv-drive-legend li').length).toBeGreaterThan(3);
    expect(q('.pv-rail-legend .pv-chip').length).toBeGreaterThan(1);
    expect(q('.pv-drive-legend li').every(li => li.querySelector('.pv-glyph')!.getAttribute('d') === DRIVE_GLYPHS[li.getAttribute('data-status') as keyof typeof DRIVE_GLYPHS])).toBeTrue();
    click(modeBtn('signal'));
    expect(legend()).toContain('activated function');
    expect(q('.pv-signal-legend li').length).toBeGreaterThanOrEqual(5);
    expect(root().querySelector('.pv-drive-legend')).toBeNull();
  });

  it('small parts get their abbreviated name under the box (the full name on hover); the die title sits inside the die, not over the leg labels', () => {
    committed();
    const title = root().querySelector(`.pv-title[data-surface-id="${CSTCE}"]`)!;
    const shown = Array.from(title.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent).join('');   // the text itself, not the hover <title> child
    expect(shown.length).toBeLessThanOrEqual(12);
    expect(shown).toContain('\u2026');
    expect(title.querySelector('title')!.textContent).toContain('CSTCE16M0V53-R0');
    const die = root().querySelector(`.pv-title[data-surface-id="${DIE}"]`)!;
    expect(die.getAttribute('text-anchor')).toBe('middle');
    const ps = buildScene(FIXTURE_COMMITTED).surfaces.get(DIE)!;
    expect(Number(die.getAttribute('x'))).toBeCloseTo(ps.ox, 6);
    expect(Number(die.getAttribute('y'))).toBeCloseTo(ps.oy, 6);
  });

  it('the fit includes every surface, pin and part label box: the bounds reach the part extents', () => {
    const sc = buildScene(FIXTURE_COMMITTED);
    const part = sc.surfaces.get(CSTCE)!;
    const e = part.surface.extent!;
    expect(sc.bounds.x0).toBeLessThanOrEqual(part.ox + e.x0 + 1e-9);
    expect(sc.bounds.x1).toBeGreaterThanOrEqual(part.ox + e.x1 - 1e-9);
    expect(sc.bounds.y1).toBeGreaterThanOrEqual(part.oy + e.y1 - 1e-9);
    for (const ps of sc.surfaces.values()) {
      for (const [x, y] of ps.points) { expect(x).toBeGreaterThanOrEqual(sc.bounds.x0 - 1e-9); expect(y).toBeLessThanOrEqual(sc.bounds.y1 + 1e-9); }
    }
  });

  it('fit-all hangs the content from the top of the viewport: no blank band above the board (top edge within a small margin; bottom inside the viewport)', () => {
    create();
    const canvas = (component as any).canvas;
    for (const [w, h] of [[1000, 700], [900, 1200], [1400, 520]]) {
      const f = canvas.fitTransform(w, h);
      const top = f.ty + f.k * f.bounds.y0, bottom = f.ty + f.k * f.bounds.y1;
      expect(top).toBeGreaterThanOrEqual(0);
      expect(top).toBeLessThanOrEqual(24);
      expect(bottom).toBeLessThanOrEqual(h);
      expect(f.tx + f.k * f.bounds.x0).toBeGreaterThanOrEqual(0);
      expect(f.tx + f.k * f.bounds.x1).toBeLessThanOrEqual(w + 1e-6);
    }
  });

  it('?pin= selects that pin on load (its connections are drawn); a second click clears it (click-toggle rule); Escape clears too', () => {
    create({ pin: MOSI_LEG });
    expect(component.selection).toEqual({ kind: 'pin', id: MOSI_LEG });
    expect(lines().length).toBeGreaterThan(0);
    click(pinEl(MOSI_LEG));
    expect(component.selection).toBeNull();
    expect(lines().length).toBe(0);
  });

  it('?surface= selects a surface and ?connection= a connection on load; an id the payload does not hold selects nothing', () => {
    create({ surface: PKG });
    expect(component.selection).toEqual({ kind: 'surface', id: PKG });
    TestBed.resetTestingModule();
    const conn = FIXTURE_BASE.connections[0].id;
    create({ connection: conn });
    expect(component.selection).toEqual({ kind: 'connection', id: conn });
    TestBed.resetTestingModule();
    create({ pin: 'no-such-pin' });
    expect(component.selection).toBeNull();
  });

  // ================================================================ pv-4: phases, the blank baselines and the configuration-event timeline
  const phaseBtn = (id: string) => root().querySelector(`.pv-phase[data-phase="${id}"]`)!;
  const blankBtn = (id: string) => root().querySelector(`.pv-blank[data-blank="${id}"]`)!;
  const eventBtns = () => q('.pv-events .pv-event');

  it('the phase selector lists power-up, reset, bootloader, init and runtime next to the stage selector; runtime is on by default and asks nothing extra of the door', () => {
    create();
    expect(q('.pv-phase').map(b => b.getAttribute('data-phase'))).toEqual(['power-up', 'reset', 'bootloader', 'init', 'runtime']);
    expect(phaseBtn('runtime').classList).toContain('on');
    expect(q('.pv-blank').map(b => b.getAttribute('data-blank'))).toEqual(['chip', 'board']);
    expect(urls.filter(u => u.includes('/pin-view')).every(u => !u.includes('phase='))).toBeTrue();
    expect((root().querySelector('.pv-stage-select') as HTMLSelectElement).disabled).toBeFalse();
    expect(root().querySelector('.pv-banner')).toBeNull();
  });

  it('switching to reset changes the marks: every I/O pin goes blank (high-impedance in Drive, nothing activated in Signal), the banner says so, the stage selector follows the phase', () => {
    committed();
    click(modeBtn('drive'));
    expect(pinEl(D6).getAttribute('data-role')).toBe('sources-or-sinks');
    expect(pinEl(D2).getAttribute('data-role')).toBe('pulled-up');
    click(phaseBtn('reset'));
    expect(urls[urls.length - 1]).toContain('phase=reset');
    expect(urls[urls.length - 1]).toContain('blank=board');
    for (const id of [D6, D2, D0]) { expect(pinEl(id).getAttribute('data-role')).toBe('high-impedance'); expect(pinEl(id).getAttribute('data-fill')).toBe('hollow'); }
    expect(root().querySelector('.pv-banner')!.textContent).toContain('After every reset the pins are blank until init runs');
    expect((root().querySelector('.pv-stage-select') as HTMLSelectElement).disabled).toBeTrue();
    click(modeBtn('signal'));
    expect(q('.pv-badge').filter(b => b.style.display !== 'none').length).toBe(0);
    click(phaseBtn('runtime'));
    expect(root().querySelector('.pv-banner')).toBeNull();
    click(modeBtn('drive'));
    expect(pinEl(D6).getAttribute('data-role')).toBe('sources-or-sinks');
  });

  it('bootloader (board as delivered): D0 serves the bootloader link as RXD, D6 stays blank; the blank line cites the bootloader and says the factory sketch is undetermined; the chip baseline asks again', () => {
    committed();
    click(modeBtn('signal'));
    click(phaseBtn('bootloader'));
    expect(urls[urls.length - 1]).toContain('phase=bootloader');
    const d0 = pinEl(D0).querySelector('.pv-badge') as HTMLElement;
    expect(d0.textContent).toBe('RXD');
    expect(d0.style.display).not.toBe('none');
    expect((pinEl(D6).querySelector('.pv-badge') as HTMLElement).style.display).toBe('none');
    const line = root().querySelector('.pv-blankline')!.textContent!;
    expect(line).toContain('Bootloader: yes');
    expect(line).toContain('Factory sketch: undetermined');
    const n = urls.length;
    click(blankBtn('chip'));
    expect(urls.length).toBe(n + 1);
    expect(urls[urls.length - 1]).toContain('blank=chip');
  });

  it('the event timeline lists the real-world changes oldest first in plain words (cause, time, who); an event with no time says so', () => {
    create();
    expect(urls.some(u => u.includes('/api/board/arduino-uno-r3/config-events'))).toBeTrue();
    const btns = eventBtns();
    expect(btns.length).toBe(FIXTURE_EVENTS.events.length);
    expect(btns[0].textContent).toContain('Wire added');
    expect(btns[0].textContent).toContain('time not recorded');
    expect(btns[1].textContent).toContain('Firmware flashed');
    expect(btns[1].textContent).toContain('was installed');
    expect(btns[1].textContent).toContain('not recorded');
  });

  it('clicking an event highlights the pins it changed and dims the rest; a second click clears; Escape clears too; no raw JSON appears', () => {
    create();
    const flash = FIXTURE_EVENTS.events.find(e => e.kind === 'flash')!;
    const ids = new Set(flash.pins_changed.map(p => p.pin));
    expect(ids.size).toBeGreaterThan(3);
    const btn = eventBtns().find(b => b.getAttribute('data-kind') === 'flash')!;
    click(btn);
    expect(component.eventSel!.name).toBe(flash.name);
    expect(pins().filter(p => p.classList.contains('event-hi')).map(p => p.getAttribute('data-pin-id')).sort()).toEqual([...ids].sort());
    expect(pins().filter(p => !ids.has(p.getAttribute('data-pin-id')!)).every(p => p.classList.contains('dim'))).toBeTrue();
    expect(pins().filter(p => ids.has(p.getAttribute('data-pin-id')!)).every(p => !p.classList.contains('dim'))).toBeTrue();
    expect(root().querySelector('.pv-event-table')!.textContent).toContain('sources-or-sinks');
    expect(root().textContent).not.toMatch(/[{}\[\]]\s*"|":\s*[{"\[\d]|\[object Object\]/);
    click(btn);
    expect(component.eventSel).toBeNull();
    expect(pins().some(p => p.classList.contains('event-hi') || p.classList.contains('dim'))).toBeFalse();
    click(btn);
    expect(pins().some(p => p.classList.contains('event-hi'))).toBeTrue();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(component.eventSel).toBeNull();
    expect(pins().some(p => p.classList.contains('event-hi') || p.classList.contains('dim'))).toBeFalse();
  });

  it('a failed event read says so in words and never blocks the picture', () => {
    reply = (url: string) => (url.includes('/config-events') ? throwError(() => ({ status: 500, error: { error: 'events broke' } })) : url.includes('/api/firmware/bindings') ? of({ bindings: [] }) : of(FIXTURE_BASE));
    create();
    expect(pins().length).toBe(FIXTURE_BASE.pins.length);
    expect(root().querySelector('.pv-events-note')!.textContent!.length).toBeGreaterThan(5);
    expect(eventBtns().length).toBe(0);
  });
});
