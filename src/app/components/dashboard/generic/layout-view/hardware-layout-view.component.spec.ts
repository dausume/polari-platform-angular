import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';

import { DisplayEventsService } from '@services/no-code-services/display-events.service';
import { HardwareLayoutViewComponent } from './hardware-layout-view.component';
import { LayoutViewService } from './layout-view.service';
import { FIXTURE_LAYOUT, FIXTURE_STEPS } from './layout-view.fixture';
import { LvPayload, LvSession, LvTwinEvent } from './layout-view.types';

/**
 * lay-2 + sim-3 - the mounted renderer against a FAKE layout door and a FAKE twin session (no backend, no network). What must hold:
 * build: N boards, the parts and wires from the payload; a click on a hole shows its net and what else is on the strip, a second click and Escape clear (the click-toggle rule), and the
 * selection is announced as page scope (component, net); step mode shows steps 0..k with the new element outlined and the rest dimmed, keeps the step in ?step=, and has "Whole build";
 * bench: the event stream is subscribed BEFORE anything is injected, the watch list is set only after hello, a press is set <pin> 0 and its release 1 (mouse and Space), sliders are adc, the LED
 * sprite lights from the watched pin and dims by duty only when the edges give one, the piezo shows a tone marker, and a stopped session says so.
 */
describe('HardwareLayoutViewComponent', () => {
  let fixture: ComponentFixture<HardwareLayoutViewComponent>;
  let component: HardwareLayoutViewComponent;
  let log: string[];
  let injected: any[];
  let dispatched: { key: string; value: string }[];
  let streamOn: (e: LvTwinEvent) => void;
  let streamEnd: (why: string) => void;
  let closed: number;
  let navigated: any[];
  let layout: LvPayload;
  let session: LvSession | null;

  const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
  const row = (over: Partial<LvSession> = {}): LvSession => ({ name: 'uno-light-ab12cd', config: 'uno-light', state: 'running', participant: 'twin:arduino-uno-r3#0', hex_sha256: 'a'.repeat(64), remaining_s: 900, running_now: true, watch: ['PB5', 'PD2'], ...over });

  const fakeSvc = {
    layout: (_p: string, config: string, q: any): Observable<LvPayload> => { log.push(`layout:${config}:${q.board || ''}:${q.scheme || ''}`); return of(layout); },
    steps: (): Observable<any> => of(FIXTURE_STEPS),
    session: (): Observable<LvSession | null> => of(session),
    inject: (name: string, body: any): Observable<any> => { log.push('inject:' + Object.keys(body).filter(k => !['part', 'what', 'kind'].includes(k)).join('+')); injected.push({ name, ...body }); return of({ ok: true, reply: { t: 'ack', cycle: 1234 } }); },
    events: (name: string, replay: number, on: (e: LvTwinEvent) => void, end: (w: string) => void) => { log.push(`events:${name}:${replay}`); streamOn = on; streamEnd = end; return { close: () => { closed++; } }; },
  };

  async function create(opts: { query?: Record<string, string>; inputs?: Partial<HardwareLayoutViewComponent>; payload?: LvPayload; session?: LvSession | null } = {}): Promise<void> {
    log = []; injected = []; dispatched = []; closed = 0; navigated = [];
    layout = opts.payload || clone(FIXTURE_LAYOUT);
    session = opts.session === undefined ? row() : opts.session;
    const q = opts.query || {};
    TestBed.configureTestingModule({
      imports: [HardwareLayoutViewComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(q) }, queryParamMap: of(convertToParamMap(q)) } },
        { provide: LayoutViewService, useValue: fakeSvc },
        { provide: DisplayEventsService, useValue: { dispatch: (e: any) => dispatched.push(e.payload) } },
      ],
    });
    spyOn(TestBed.inject(Router), 'navigate').and.callFake((...a: any[]) => { navigated.push(a[1]); return Promise.resolve(true); });
    fixture = TestBed.createComponent(HardwareLayoutViewComponent);
    component = fixture.componentInstance;
    Object.assign(component, opts.inputs || {});
    fixture.detectChanges();
    await settle();
  }
  async function settle(): Promise<void> { await Promise.resolve(); component.drawNow(); fixture.detectChanges(); }
  const el = (sel: string): HTMLElement | null => fixture.nativeElement.querySelector(sel);
  const all = (sel: string): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll(sel));
  const part = (n: string): SVGGElement => el(`.lv-part[data-part="${n}"]`) as unknown as SVGGElement;
  const text = (sel: string): string => (el(sel)?.textContent || '').replace(/\s+/g, ' ').trim();
  const scope = (key: string): string[] => dispatched.filter(d => d.key === key).map(d => d.value);
  const click = (n: Element | null): void => { n!.dispatchEvent(new MouseEvent('click', { bubbles: true })); };

  afterEach(() => { fixture?.destroy(); });

  // ---------------------------------------------------------------------------------------------------------------- build
  describe('build mode', () => {
    beforeEach(async () => { await create({}); });

    it('draws N boards from the payload geometry: the UNO and the breadboard, 400 holes, the header pins, the 3 parts and 6 wires', () => {
      const c = component.counts()!;
      expect(c.boards).toBe(2);
      expect(c.holes).toBe(30 * 10 + 4 * 25);
      expect(c.pins).toBe(8 + 6 + 8 + 10 + 6);
      expect(c.parts).toBe(3);
      expect(c.wires).toBe(6);
      expect(all('.lv-layer').map(l => l.getAttribute('class')!.replace('lv-layer ', ''))).toEqual(['lv-boards', 'lv-parts', 'lv-wires', 'lv-highlights']);
    });

    it('draws the wires in their EFFECTIVE colour (the scheme\'s, or the person\'s own) and the resistor with its computed bands', () => {
      const gnd = el('.lv-wire[data-wire="w-gnd-header"] .lv-wire-line') as unknown as SVGPathElement;
      expect(gnd.style.stroke).not.toBe('');
      expect(el('.lv-wire[data-wire="w-d6"]')!.getAttribute('data-net')).toBe('LED_CONTROL');
      expect(all('.lv-part[data-part="R1"] .lv-band').map(b => b.getAttribute('class')!.split(' ')[1])).toEqual(['band-red', 'band-red', 'band-brown', 'band-gold']);
    });

    it('announces what it shows as page scope (config, board, scheme) so the tables beside it follow', () => {
      expect(scope('config')).toContain('uno-light');
      expect(scope('board')).toContain('bench-half-1');
      expect(scope('scheme')).toContain('wires-pin-view');
    });

    it('a click on a hole shows its net and what else is on the strip, highlights the strip and announces net + component; a second click clears; Escape clears', async () => {
      click(el('.lv-hole[data-hole="r7c"]'));
      await settle();
      expect(text('.lv-hole-words')).toContain('LED_CONTROL');
      expect(all('.lv-selection li').map(l => l.textContent)).toEqual(jasmine.arrayContaining([jasmine.stringMatching(/R1/), jasmine.stringMatching(/w-d6/)]));
      expect(text('.lv-selection')).toContain('hdr:D6');
      expect(all('.lv-hole.strip-hl').length).toBe(5);
      expect(el('.lv-hole.sel')!.getAttribute('data-hole')).toBe('r7c');
      expect(scope('net').pop()).toBe('LED_CONTROL');
      click(el('.lv-hole[data-hole="r7c"]'));
      await settle();
      expect(el('.lv-selection')).toBeNull();
      expect(all('.lv-hole.strip-hl').length).toBe(0);
      expect(scope('net').pop()).toBe('');
      click(el('.lv-hole[data-hole="r3a"]'));
      await settle();
      expect(text('.lv-selection')).toContain('BUTTON_INPUT');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await settle();
      expect(el('.lv-selection')).toBeNull();
    });

    it('a hole with nothing on its strip says so', async () => {
      click(el('.lv-hole[data-hole="r28c"]'));
      await settle();
      expect(text('.lv-hole-words')).toContain('nothing is connected');
    });

    it('a click on a part shows its row (legs and nets) and sets the component scope; on a wire its colour and ends; on a header pin its wires', async () => {
      click(part('LED1'));
      await settle();
      expect(text('.lv-part-row')).toContain('LED1');
      expect(text('.lv-part-row')).toContain('anode: r11d (net LED_ANODE)');
      expect(scope('component').pop()).toBe('LED1');
      expect(part('LED1').classList.contains('sel')).toBeTrue();
      click(el('.lv-wire[data-wire="w-d2"] .lv-wire-hit'));
      await settle();
      expect(text('.lv-wire-row')).toContain('w-d2');
      expect(text('.lv-wire-row')).toContain('grey wire');
      expect(scope('component').pop()).toBe('');
      click(el('.lv-pin[data-pin="D6"]'));
      await settle();
      expect(text('.lv-pin-row')).toContain('D6');
      expect(text('.lv-pin-row')).toContain('LED_CONTROL');
      expect(all('.lv-selection li').length).toBe(1);
    });

    it('step mode: starts as the whole build; Next goes to step 1, step k shows steps 0..k with the new element outlined and the rest dimmed; the step is kept in ?step=', async () => {
      expect(text('.lv-step-label')).toBe('Whole build (11 steps)');
      expect(all('.lv-part.hidden').length).toBe(0);
      (el('.lv-next') as HTMLButtonElement).click();
      await settle();
      expect(text('.lv-step-label')).toBe('Step 1 of 11');
      expect(navigated.pop()).toEqual(jasmine.objectContaining({ queryParams: { step: 1 }, queryParamsHandling: 'merge' }));
      expect(all('.lv-part:not(.hidden)').length).toBe(0);                  // step 1 builds nothing yet (unplug)
      for (let i = 0; i < 2; i++) { (el('.lv-next') as HTMLButtonElement).click(); await settle(); }
      expect(text('.lv-step-label')).toBe('Step 3 of 11');
      expect(text('.lv-step')).toContain('Place SW1');
      expect(all('.lv-part:not(.hidden)').map(p => p.getAttribute('data-part'))).toEqual(['SW1']);
      expect(part('SW1').classList.contains('new')).toBeTrue();
      expect(el('.lv-wire[data-wire="w-gnd-header"]')!.classList.contains('dimmed')).toBeTrue();   // built in an earlier step: dimmed
      expect(all('.lv-wire:not(.hidden)').length).toBe(1);
      expect(navigated.pop()).toEqual(jasmine.objectContaining({ queryParams: { step: 3 } }));
      (el('.lv-prev') as HTMLButtonElement).click();
      await settle();
      expect(text('.lv-step-label')).toBe('Step 2 of 11');
      (el('.lv-whole') as HTMLButtonElement).click();
      await settle();
      expect(text('.lv-step-label')).toBe('Whole build (11 steps)');
      expect(all('.lv-part.hidden').length).toBe(0);
      expect(all('.dimmed').length).toBe(0);
      expect(navigated.pop()).toEqual(jasmine.objectContaining({ queryParams: { step: null } }));
      (el('.lv-whole') as HTMLButtonElement).click();
      await settle();
      expect(text('.lv-step-label')).toBe('Step 1 of 11');
    });

    it('the last step\'s Next is disabled and its check text is shown', async () => {
      for (let i = 0; i < 11; i++) { (el('.lv-next') as HTMLButtonElement).click(); await settle(); }
      expect(text('.lv-step-label')).toBe('Step 11 of 11');
      expect((el('.lv-next') as HTMLButtonElement).disabled).toBeTrue();
      expect(all('.lv-part:not(.hidden)').length).toBe(3);
      expect(all('.lv-step li').length).toBeGreaterThan(2);
    });
  });

  describe('build mode with the address', () => {
    it('opens at ?step=3 (1-based) with only SW1 built and outlined', async () => {
      await create({ query: { step: '3' } });
      expect(text('.lv-step-label')).toBe('Step 3 of 11');
      expect(all('.lv-part:not(.hidden)').map(p => p.getAttribute('data-part'))).toEqual(['SW1']);
    });

    it('honours the pin view\'s ?pin=BoardPin:...:D6 and a ?component= by selecting them', async () => {
      await create({ query: { pin: 'BoardPin:arduino-uno-r3:D6' } });
      expect(el('.lv-pin.sel')!.getAttribute('data-pin')).toBe('D6');
      fixture.destroy();
      TestBed.resetTestingModule();
      await create({ query: { component: 'LED1' } });
      expect(part('LED1').classList.contains('sel')).toBeTrue();
    });

    it('?config= and ?board= choose what is asked of the door (the input is the fallback), and a scheme is passed on', async () => {
      await create({ query: { config: 'uno-light', board: 'bench-full-1' }, inputs: { scheme: 'my-colours' } });
      expect(log[0]).toBe('layout:uno-light:bench-full-1:my-colours');
    });

    it('follows another view: when the page scope says component = R1 this view selects R1 too', async () => {
      await create({});
      component.component = 'R1';
      component.ngOnChanges({ component: { firstChange: false, previousValue: '', currentValue: 'R1', isFirstChange: () => false } as any });
      await settle();
      expect(part('R1').classList.contains('sel')).toBeTrue();
    });

    it('a failed door says so in words and draws nothing', async () => {
      log = []; injected = []; dispatched = [];
      TestBed.configureTestingModule({
        imports: [HardwareLayoutViewComponent],
        providers: [provideRouter([]), { provide: LayoutViewService, useValue: { ...fakeSvc, layout: () => throwError(() => ({ status: 422, error: { error: 'config nope is not built' } })), steps: () => of(null) } },
          { provide: DisplayEventsService, useValue: { dispatch: () => undefined } }],
      });
      fixture = TestBed.createComponent(HardwareLayoutViewComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      await settle();
      expect(el('.lv-error')).not.toBeNull();
      expect(component.counts()!.boards).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------------------------------------------- bench
  describe('bench mode', () => {
    const edge = (pin: string, level: number, cycle = 100) => streamOn({ t: 'pin', pin, level, cycle });

    it('without a session it says what to do and offers nothing to press', async () => {
      await create({ inputs: { mode: 'bench', session: '' } });
      expect(text('.lv-bench-note')).toContain('No session is picked');
      expect(log.some(l => l.startsWith('events'))).toBeFalse();
      expect(all('.lv-hold').every(b => (b as HTMLButtonElement).disabled)).toBeTrue();
    });

    it('subscribes to the event stream FIRST (with a replay), and only after hello sets the watch list (the session\'s pins plus every output pin) and enables the controls', async () => {
      await create({ inputs: { mode: 'bench', session: 'uno-light-ab12cd' } });
      expect(log.filter(l => l.startsWith('events') || l.startsWith('inject'))).toEqual(['events:uno-light-ab12cd:100']);
      expect(all('.lv-hold').every(b => (b as HTMLButtonElement).disabled)).toBeTrue();
      expect(text('.lv-status')).toBe('Not live');
      streamOn({ t: 'hello', session: 'uno-light-ab12cd' });
      await settle();
      expect(log.filter(l => l.startsWith('events') || l.startsWith('inject'))).toEqual(['events:uno-light-ab12cd:100', 'inject:watch']);
      expect(injected[0].watch).toEqual(['PB5', 'PD2', 'PD6']);
      expect(text('.lv-status')).toContain('Live');
      expect((el('.lv-hold') as HTMLButtonElement).disabled).toBeFalse();
      expect(text('.lv-session-facts')).toContain('aaaaaaaaaaaa');
      expect(text('.lv-session-facts')).toContain('No edit or reflash');
    });

    it('a pointer press on the pushbutton sprite is set PD2 0 and its release set PD2 1, naming the part; the sprite shows pressed meanwhile; the stream was open before either', async () => {
      await create({ inputs: { mode: 'bench', session: 'uno-light-ab12cd' } });
      streamOn({ t: 'hello' });
      await settle();
      injected.length = 0;
      part('SW1').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      await settle();
      expect(injected).toEqual([jasmine.objectContaining({ set: 'PD2', level: 0, part: 'SW1', kind: 'press' })]);
      expect(part('SW1').classList.contains('pressed')).toBeTrue();
      window.dispatchEvent(new PointerEvent('pointerup'));
      await settle();
      expect(injected[1]).toEqual(jasmine.objectContaining({ set: 'PD2', level: 1, part: 'SW1', kind: 'release' }));
      expect(part('SW1').classList.contains('pressed')).toBeFalse();
      expect(log.indexOf('events:uno-light-ab12cd:100')).toBeLessThan(log.indexOf('inject:set+level'));
      expect(text('.lv-actions li')).toContain('released');
      expect(text('.lv-actions')).toContain('twin cycle 1234');
    });

    it('Space on the focused sprite presses and releases too (keyboard), and a second key-down while held does nothing', async () => {
      await create({ inputs: { mode: 'bench', session: 'uno-light-ab12cd' } });
      streamOn({ t: 'hello' });
      await settle();
      injected.length = 0;
      part('SW1').dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      await settle();
      part('SW1').dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      await settle();
      part('SW1').dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
      await settle();
      expect(injected.map(i => i.level)).toEqual([0, 1]);
    });

    it('the panel\'s own hold button works the same way', async () => {
      await create({ inputs: { mode: 'bench', session: 'uno-light-ab12cd' } });
      streamOn({ t: 'hello' });
      await settle();
      injected.length = 0;
      const b = el('.lv-hold') as HTMLButtonElement;
      b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      await settle();
      expect(injected.map(i => i.level)).toEqual([0, 1]);
    });

    it('the LED sprite lights from the watched pin: PD6 rising lights it, PD6 falling darkens it; before any edge it is dark and the panel says why', async () => {
      await create({ inputs: { mode: 'bench', session: 'uno-light-ab12cd' } });
      streamOn({ t: 'hello' });
      await settle();
      expect(part('LED1').classList.contains('lit')).toBeFalse();
      expect(text('[data-output="LED1"]')).toContain('no change seen yet');
      edge('PD6', 1);
      await settle();
      expect(part('LED1').classList.contains('lit')).toBeTrue();
      expect(text('[data-output="LED1"]')).toContain('lit');
      expect(text('[data-output="LED1"]')).toContain('pin high');
      edge('PD6', 0, 200);
      await settle();
      expect(part('LED1').classList.contains('lit')).toBeFalse();
      edge('PD2', 1, 300);                                                     // a pin that drives no output changes nothing on the sprites
      await settle();
      expect(part('LED1').classList.contains('lit')).toBeFalse();
    });

    it('a page opened mid-session learns the LED from the replayed edges that follow hello', async () => {
      await create({ inputs: { mode: 'bench', session: 'uno-light-ab12cd' } });
      streamOn({ t: 'hello' });
      edge('PD6', 1, 50);
      await settle();
      expect(part('LED1').classList.contains('lit')).toBeTrue();
    });

    it('the LED dims by duty ONLY when the edges give a PWM figure; a slow blink has no duty and is plain on/off', async () => {
      await create({ inputs: { mode: 'bench', session: 'uno-light-ab12cd' } });
      streamOn({ t: 'hello' });
      await settle();
      for (let i = 0; i < 10; i++) { edge('PD6', i % 2 === 0 ? 1 : 0, Math.round((i >> 1) * 16000 + (i % 2 === 0 ? 0 : 4000))); }
      await settle();
      expect(text('[data-output="LED1"]')).toContain('PWM');
      expect(part('LED1').style.getPropertyValue('--lv-duty')).toBe('0.25');
      fixture.destroy();
      TestBed.resetTestingModule();
      await create({ inputs: { mode: 'bench', session: 'uno-light-ab12cd' } });
      streamOn({ t: 'hello' });
      edge('PD6', 1, 0); edge('PD6', 0, 16_000_000); edge('PD6', 1, 32_000_000);
      await settle();
      expect(text('[data-output="LED1"]')).not.toContain('PWM');
      expect(part('LED1').classList.contains('lit')).toBeTrue();
      expect(part('LED1').style.getPropertyValue('--lv-duty')).toBe('1');
    });

    it('bumps the page scope rev after an edge on an output pin and after an action, so the App UI table and the interaction table fetch again', async () => {
      jasmine.clock().install();
      try {
        await create({ inputs: { mode: 'bench', session: 'uno-light-ab12cd' } });
        streamOn({ t: 'hello' });
        edge('PD6', 1);
        jasmine.clock().tick(450);
        expect(scope('rev').length).toBe(1);
        jasmine.clock().tick(1100);
        expect(scope('rev').length).toBe(2);
      } finally { jasmine.clock().uninstall(); }
    });

    it('Reset the board posts reset', async () => {
      await create({ inputs: { mode: 'bench', session: 'uno-light-ab12cd' } });
      streamOn({ t: 'hello' });
      await settle();
      injected.length = 0;
      (el('.lv-reset') as HTMLButtonElement).click();
      expect(injected).toEqual([jasmine.objectContaining({ reset: 1 })]);
    });

    it('an ended session says so and offers nothing; a stream that stops turns the controls off in words', async () => {
      await create({ inputs: { mode: 'bench', session: 'uno-light-ab12cd' }, session: row({ state: 'ended', running_now: false, end_reason: 'stopped by a person' }) });
      expect(text('.lv-bench-note')).toContain('has ended (stopped by a person)');
      expect(log.some(l => l.startsWith('events'))).toBeFalse();
      fixture.destroy();
      TestBed.resetTestingModule();
      await create({ inputs: { mode: 'bench', session: 'uno-light-ab12cd' } });
      streamOn({ t: 'hello' });
      await settle();
      streamEnd('the event stream ended');
      await settle();
      expect(text('.lv-bench-note')).toContain('live link to the session stopped');
      expect((el('.lv-hold') as HTMLButtonElement).disabled).toBeTrue();
    });

    it('closes the stream when the picture goes away', async () => {
      await create({ inputs: { mode: 'bench', session: 'uno-light-ab12cd' } });
      fixture.destroy();
      expect(closed).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------------------------------------------- bench with every overlay kind
  describe('bench mode overlays derived from the KitPart interface kinds', () => {
    function synth(): LvPayload {
      const p = clone(FIXTURE_LAYOUT);
      const leg = (t: string, n: string, hole: string, net: string) => ({ terminal: t, name: n, net, hole, row: +hole.slice(1, -1), col: hole.slice(-1), side: 'L' });
      const add = (name: string, part: string, kind: string, legs: any[], rows: number[]) =>
        p.placements.push({ name, part, kind, row: name, kit_part: `arduino-starter-kit:${part}`, params: {}, legs, ties: legs.map(l => l.hole), internal: [], rows, straddles_trench: false, terminal_order: legs.map(l => l.name), terminal_ids: legs.map(l => l.terminal) } as any);
      add('RV1', 'potentiometer', 'pot', [leg('RV1.a', 'a', 'r16e', 'V5'), leg('RV1.wiper', 'wiper', 'r18e', 'N_POT'), leg('RV1.b', 'b', 'r20e', 'GND')], [16, 18, 20]);
      add('U1', 'tmp36', 'tmp36', [leg('U1.vs', 'vs', 'r22e', 'V5'), leg('U1.out', 'out', 'r24e', 'N_T'), leg('U1.gnd', 'gnd', 'r26e', 'GND')], [22, 24, 26]);
      add('BZ1', 'piezo', 'piezo', [leg('BZ1.1', '1', 'r28a', 'N_BZ'), leg('BZ1.2', '2', 'r29a', 'GND')], [28, 29]);
      p.scene.parts['RV1'] = { kit_key: 'potentiometer', interaction: { control: 'slider', label: 'Turn the knob', pin: 'A0', twin_pin: 'PC0', adc: 0, unit: '%', min: 0, max: 100, step: 1, initial: 50, offset_mv: 0, per_unit_mv: 50, basis: '0-5 V at the wiper' }, output: null };
      p.scene.parts['U1'] = { kit_key: 'tmp36', interaction: { control: 'slider', label: 'Temperature', pin: 'A1', twin_pin: 'PC1', adc: 1, unit: '°C', min: -40, max: 125, step: 1, initial: 25, offset_mv: 500, per_unit_mv: 10, basis: 'TMP36: 10 mV per degC, 500 mV at 0 degC' }, output: null };
      p.scene.parts['BZ1'] = { kit_key: 'piezo', interaction: null, output: { kind: 'tone', pin: 'D9', twin_pin: 'PB1', note: '' } };
      p.scene.parts['S2'] = { kit_key: 'tilt-sensor', interaction: { control: 'toggle', label: 'Tilt', pin: 'D4', twin_pin: 'PD4', pressed_level: 0 }, output: null };
      p.scene.watch = ['PB1', 'PD6'];
      return p;
    }
    async function bench(): Promise<void> {
      await create({ payload: synth(), inputs: { mode: 'bench', session: 'uno-light-ab12cd' } });
      streamOn({ t: 'hello' });
      await settle();
      injected.length = 0;
    }
    const setRange = async (part_: string, v: number): Promise<void> => {
      const input = el(`[data-touch="${part_}"] input[type=range]`) as HTMLInputElement;
      input.value = String(v);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await settle();
    };

    it('the TMP36 temperature slider posts adc <channel> mv with 500 mV + 10 mV/degC (25 degC = 750 mV, 0 degC = 500 mV), once per release, and says its basis', async () => {
      await bench();
      expect(text('[data-touch="U1"]')).toContain('Temperature: U1 (A1)');
      expect(text('[data-touch="U1"]')).toContain('25 °C');
      await setRange('U1', 25);
      await setRange('U1', 0);
      expect(injected.map(i => [i.adc, i.mv, i.part])).toEqual([[1, 750, 'U1'], [1, 500, 'U1']]);
      expect(text('[data-touch="U1"]')).toContain('10 mV per degC');
      expect(text('.lv-actions li')).toContain('set to 0');
    });

    it('the potentiometer slider posts adc 0 with 0..5000 mV and turns its knob sprite', async () => {
      await bench();
      await setRange('RV1', 100);
      expect(injected).toEqual([jasmine.objectContaining({ adc: 0, mv: 5000, part: 'RV1' })]);
      const notch = (el('.lv-part[data-part="RV1"] .lv-pot-notch') as unknown as SVGLineElement);
      expect(+notch.getAttribute('x2')!).toBeGreaterThan(0);
      await setRange('RV1', 0);
      expect(+(el('.lv-part[data-part="RV1"] .lv-pot-notch') as unknown as SVGLineElement).getAttribute('x2')!).toBeLessThan(0);
    });

    it('a tilt sensor is a toggle (on drives the pressed level 0, off 1)', async () => {
      await bench();
      const box = el('[data-touch="S2"] input[type=checkbox]') as HTMLInputElement;
      box.checked = true; box.dispatchEvent(new Event('change', { bubbles: true }));
      box.checked = false; box.dispatchEvent(new Event('change', { bubbles: true }));
      expect(injected.map(i => [i.set, i.level, i.kind])).toEqual([['PD4', 0, 'toggle'], ['PD4', 1, 'toggle']]);
    });

    it('the piezo shows a tone marker while its pin toggles, and none while quiet; a part with no interaction kind is a plain sprite (no control, not touchable)', async () => {
      await bench();
      expect(all('.lv-tone-mark').length).toBe(0);
      streamOn({ t: 'pin', pin: 'PB1', level: 1, cycle: 10 });
      streamOn({ t: 'pin', pin: 'PB1', level: 0, cycle: 20 });
      await settle();
      expect(all('.lv-part[data-part="BZ1"] .lv-tone-mark, .lv-tone-mark').length).toBe(1);
      expect(text('[data-output="BZ1"]')).toContain('sounding');
      expect(el('[data-touch="R1"]')).toBeNull();
      expect(part('R1').classList.contains('touchable')).toBeFalse();
      expect(part('BZ1').classList.contains('touchable')).toBeFalse();
    });

    it('while the stream is not live the sliders are off', async () => {
      await create({ payload: synth(), inputs: { mode: 'bench', session: 'uno-light-ab12cd' } });
      expect((el('[data-touch="U1"] input[type=range]') as HTMLInputElement).disabled).toBeTrue();
      expect(injected.length).toBe(0);
    });
  });
});
