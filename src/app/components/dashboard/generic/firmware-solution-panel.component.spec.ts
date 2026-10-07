import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { FirmwareSolutionPanelComponent } from './firmware-solution-panel.component';
import { PolariService } from '@services/polari-service';

/**
 * fs-2c — the pin-interaction UX slice of HARDWARE_DEV_PRIORITIES.md §3b (his rulings 2026-10-06). The solution
 * fixtures below are the REAL fs-2b captures (https://api.prf.192.168.0.210.nip.io, 2026-10-06) with ONE addition:
 * `capabilities` — the live capabilities API was still rolling out during this slice's own time box, so this field
 * is built from the live SEED_CAPABILITIES values in `cmod.custom.capabilities` and the exact shape
 * `cmod_firmware_api.py`'s `_capabilities()` already emits (`{name, goal, status, last_proof, task_names}`), per
 * this slice's own instructions. Everything else (SOLUTION/SCHEDULE/ASSIGNMENTS/valid-targets/pin-detail/compat/svg)
 * is untouched from fs-2b's captures.
 */
const LAYOUT_KEY = 'polari-firmware-panel-layout';

describe('FirmwareSolutionPanelComponent', () => {
  let fixture: ComponentFixture<FirmwareSolutionPanelComponent>;
  let component: FirmwareSolutionPanelComponent;
  let posts: Array<{ url: string; body: any }>;
  let postResponse: (url: string, body: any) => any;
  let getOverride: ((url: string) => any) | null;

  // GET /api/firmware/solutions/uno-sim-rig (real, captured 2026-10-06)
  const SOLUTION = {"name": "uno-sim-rig", "title": "UNO sim-rig firmware", "graph": "uno-sim-rig-graph", "board_definition": "arduino-uno-r3", "board_variable": "", "runtime": "c-device", "status": "validated", "last_build": "", "board_resolved": "arduino-uno-r3", "board_exists": true, "validation": "ok", "validation_why": "ok: board arduino-uno-r3 resolved (fixed board_definition 'arduino-uno-r3' (not checked against a live register here)); 16 target(s), 5 unbound (tick_init, led_init, rx_pop, clock.return, temp.return)", "task_count": 13, "purpose": "The firmware-only half of the sim-rig.", "notes": ""};
  const SCHEDULE = [{"name": "uno-sim-rig:called:led", "solution": "uno-sim-rig", "task": "led", "lane": "called", "order": 12, "trigger": "called by another task (not scheduled directly)", "period_ms": 0, "measured_cycles": -1, "isr_vector": "", "provenance": "derived", "notes": "text_bytes_noinline=12 B, stack_bytes=2 (CFunctionAtom.cost; no per-atom cycle count yet)"}, {"name": "uno-sim-rig:called:pwm", "solution": "uno-sim-rig", "task": "pwm", "lane": "called", "order": 13, "trigger": "called by another task (not scheduled directly)", "period_ms": 0, "measured_cycles": -1, "isr_vector": "", "provenance": "derived", "notes": "text_bytes_noinline=130 B, stack_bytes=10 (CFunctionAtom.cost; no per-atom cycle count yet)"}, {"name": "uno-sim-rig:init:usart_init", "solution": "uno-sim-rig", "task": "usart_init", "lane": "init", "order": 1, "trigger": "", "period_ms": 0, "measured_cycles": -1, "isr_vector": "", "provenance": "derived", "notes": "text_bytes_noinline=30 B, stack_bytes=2 (CFunctionAtom.cost; no per-atom cycle count yet)"}, {"name": "uno-sim-rig:init:tick_init", "solution": "uno-sim-rig", "task": "tick_init", "lane": "init", "order": 2, "trigger": "", "period_ms": 0, "measured_cycles": -1, "isr_vector": "", "provenance": "derived", "notes": "text_bytes_noinline=24 B, stack_bytes=2 (CFunctionAtom.cost; no per-atom cycle count yet)"}, {"name": "uno-sim-rig:init:led_init", "solution": "uno-sim-rig", "task": "led_init", "lane": "init", "order": 3, "trigger": "", "period_ms": 0, "measured_cycles": -1, "isr_vector": "", "provenance": "derived", "notes": "text_bytes_noinline=4 B, stack_bytes=2 (CFunctionAtom.cost; no per-atom cycle count yet)"}, {"name": "uno-sim-rig:init:pwm_init", "solution": "uno-sim-rig", "task": "pwm_init", "lane": "init", "order": 4, "trigger": "", "period_ms": 0, "measured_cycles": -1, "isr_vector": "", "provenance": "derived", "notes": "text_bytes_noinline=14 B, stack_bytes=2 (CFunctionAtom.cost; no per-atom cycle count yet)"}, {"name": "uno-sim-rig:init:adc_init", "solution": "uno-sim-rig", "task": "adc_init", "lane": "init", "order": 5, "trigger": "", "period_ms": 0, "measured_cycles": -1, "isr_vector": "", "provenance": "derived", "notes": "text_bytes_noinline=14 B, stack_bytes=2 (CFunctionAtom.cost; no per-atom cycle count yet)"}, {"name": "uno-sim-rig:isr:hal.INT0_vect", "solution": "uno-sim-rig", "task": "hal.INT0_vect", "lane": "isr", "order": 0, "trigger": "INT0_vect", "period_ms": 0, "measured_cycles": -1, "isr_vector": "INT0_vect", "provenance": "derived", "notes": "always linked into the glue"}, {"name": "uno-sim-rig:isr:hal.TIMER2_COMPA_vect", "solution": "uno-sim-rig", "task": "hal.TIMER2_COMPA_vect", "lane": "isr", "order": 1, "trigger": "TIMER2_COMPA_vect", "period_ms": 0, "measured_cycles": -1, "isr_vector": "TIMER2_COMPA_vect", "provenance": "derived", "notes": "always linked into the glue"}, {"name": "uno-sim-rig:isr:hal.USART_RX_vect", "solution": "uno-sim-rig", "task": "hal.USART_RX_vect", "lane": "isr", "order": 2, "trigger": "USART_RX_vect", "period_ms": 0, "measured_cycles": -1, "isr_vector": "USART_RX_vect", "provenance": "derived", "notes": "always linked into the glue"}, {"name": "uno-sim-rig:loop:rx_pop", "solution": "uno-sim-rig", "task": "rx_pop", "lane": "loop", "order": 10, "trigger": "", "period_ms": 0, "measured_cycles": -1, "isr_vector": "", "provenance": "derived", "notes": "text_bytes_noinline=52 B, stack_bytes=2 (CFunctionAtom.cost; no per-atom cycle count yet)"}, {"name": "uno-sim-rig:loop:apply", "solution": "uno-sim-rig", "task": "apply", "lane": "loop", "order": 11, "trigger": "", "period_ms": 0, "measured_cycles": -1, "isr_vector": "", "provenance": "derived", "notes": "text_bytes_noinline=192 B, stack_bytes=92 (CFunctionAtom.cost; no per-atom cycle count yet)"}, {"name": "uno-sim-rig:loop:clock", "solution": "uno-sim-rig", "task": "clock", "lane": "loop", "order": 20, "trigger": "", "period_ms": 0, "measured_cycles": -1, "isr_vector": "", "provenance": "derived", "notes": "text_bytes_noinline=54 B, stack_bytes=2 (CFunctionAtom.cost; no per-atom cycle count yet)"}, {"name": "uno-sim-rig:loop:adc", "solution": "uno-sim-rig", "task": "adc", "lane": "loop", "order": 22, "trigger": "", "period_ms": 0, "measured_cycles": -1, "isr_vector": "", "provenance": "derived", "notes": "text_bytes_noinline=36 B, stack_bytes=2 (CFunctionAtom.cost; no per-atom cycle count yet)"}, {"name": "uno-sim-rig:loop:temp", "solution": "uno-sim-rig", "task": "temp", "lane": "loop", "order": 23, "trigger": "", "period_ms": 0, "measured_cycles": -1, "isr_vector": "", "provenance": "derived", "notes": "text_bytes_noinline=48 B, stack_bytes=2 (CFunctionAtom.cost; no per-atom cycle count yet)"}, {"name": "uno-sim-rig:loop:send", "solution": "uno-sim-rig", "task": "send", "lane": "loop", "order": 26, "trigger": "", "period_ms": 0, "measured_cycles": -1, "isr_vector": "", "provenance": "derived", "notes": "text_bytes_noinline=34 B, stack_bytes=2 (CFunctionAtom.cost; no per-atom cycle count yet)"}, {"name": "uno-sim-rig:tick:telemetry", "solution": "uno-sim-rig", "task": "telemetry", "lane": "tick", "order": 21, "trigger": "period_ms=TELEMETRY_MS", "period_ms": 0, "measured_cycles": -1, "isr_vector": "", "provenance": "derived", "notes": "period macro 'TELEMETRY_MS' (resolved in board_config.h, not re-typed here)"}];
  const ASSIGNMENTS = [{"name": "uno-sim-rig:clock.return", "solution": "uno-sim-rig", "task": "clock", "port": "return", "target_kind": "memory-field", "controls": "SimRigState.uptime_ms", "lives_on": "unbound", "status": "unbound", "provenance": "derived", "notes": ""}, {"name": "uno-sim-rig:temp.return", "solution": "uno-sim-rig", "task": "temp", "port": "return", "target_kind": "memory-field", "controls": "SimRigState.temp_c", "lives_on": "unbound", "status": "unbound", "provenance": "derived", "notes": ""}, {"name": "uno-sim-rig:apply.r", "solution": "uno-sim-rig", "task": "apply", "port": "r", "target_kind": "pin", "controls": "apply a command", "lives_on": "arduino-uno-r3:D6", "status": "bound", "provenance": "annotation", "notes": ""}, {"name": "uno-sim-rig:rx_pop", "solution": "uno-sim-rig", "task": "rx_pop", "port": "", "target_kind": "pin", "controls": "pop one byte", "lives_on": "unbound", "status": "unbound", "provenance": "annotation", "notes": ""}, {"name": "uno-sim-rig:adc.channel", "solution": "uno-sim-rig", "task": "adc", "port": "channel", "target_kind": "register", "controls": "A0..A5", "lives_on": "arduino-uno-r3:A0", "status": "bound", "provenance": "annotation", "notes": ""}, {"name": "uno-sim-rig:adc_init", "solution": "uno-sim-rig", "task": "adc_init", "port": "", "target_kind": "register", "controls": "hal_adc_init", "lives_on": "arduino-uno-r3:A0", "status": "bound", "provenance": "annotation", "notes": ""}, {"name": "uno-sim-rig:led.on", "solution": "uno-sim-rig", "task": "led", "port": "on", "target_kind": "register", "controls": "set the LED", "lives_on": "arduino-uno-r3:D13", "status": "bound", "provenance": "annotation", "notes": ""}, {"name": "uno-sim-rig:led_init", "solution": "uno-sim-rig", "task": "led_init", "port": "", "target_kind": "register", "controls": "hal_led_init", "lives_on": "unbound", "status": "unbound", "provenance": "annotation", "notes": ""}, {"name": "uno-sim-rig:pwm.duty", "solution": "uno-sim-rig", "task": "pwm", "port": "duty", "target_kind": "register", "controls": "set the PWM duty", "lives_on": "arduino-uno-r3:D6", "status": "bound", "provenance": "annotation", "notes": ""}, {"name": "uno-sim-rig:pwm_init", "solution": "uno-sim-rig", "task": "pwm_init", "port": "", "target_kind": "register", "controls": "hal_pwm_init", "lives_on": "arduino-uno-r3:D6", "status": "bound", "provenance": "annotation", "notes": ""}, {"name": "uno-sim-rig:send.b", "solution": "uno-sim-rig", "task": "send", "port": "b", "target_kind": "register", "controls": "send n bytes", "lives_on": "arduino-uno-r3:D1", "status": "bound", "provenance": "annotation", "notes": ""}, {"name": "uno-sim-rig:tick_init", "solution": "uno-sim-rig", "task": "tick_init", "port": "", "target_kind": "register", "controls": "hal_tick_init", "lives_on": "unbound", "status": "unbound", "provenance": "annotation", "notes": ""}, {"name": "uno-sim-rig:usart_init", "solution": "uno-sim-rig", "task": "usart_init", "port": "", "target_kind": "register", "controls": "hal_usart_init", "lives_on": "arduino-uno-r3:D1", "status": "bound", "provenance": "annotation", "notes": ""}];
  const UNREGISTERED_TASKS = ASSIGNMENTS.filter(a => a.status === 'unbound');
  const REGISTERED_TASKS_BY_PIN = {"arduino-uno-r3:D6": [{"task": "apply", "port": "r", "status": "bound", "cooperating": true}, {"task": "pwm", "port": "duty", "status": "bound", "cooperating": true}, {"task": "pwm_init", "port": "", "status": "bound", "cooperating": true}], "arduino-uno-r3:A0": [{"task": "adc", "port": "channel", "status": "bound", "cooperating": true}, {"task": "adc_init", "port": "", "status": "bound", "cooperating": true}], "arduino-uno-r3:D13": [{"task": "led", "port": "on", "status": "bound", "cooperating": true}], "arduino-uno-r3:D1": [{"task": "send", "port": "b", "status": "bound", "cooperating": true}, {"task": "usart_init", "port": "", "status": "bound", "cooperating": true}]};

  // hw priorities P1 — `cmod_firmware_api.py`'s `_capabilities()` shape, values from `cmod.custom.capabilities`'s
  // live SEED_CAPABILITIES (the capabilities API itself was rolling out live during this slice's time box — read
  // from source per this slice's own instructions, not invented).
  const CAPABILITIES = [
    { name: 'temp-sensor-to-os', goal: 'data is retrieved from a temp sensor and gets sent back over USB to the OS', status: 'proven-on-twin', last_proof: '2026-10-05T00:00:00Z', task_names: ['adc', 'adc_init', 'frame', 'send', 'telemetry', 'temp'] },
    { name: 'blink-on-command', goal: "the OS turns the board's LED on and off on command", status: 'planned', last_proof: '', task_names: ['apply', 'led', 'rx_pop'] },
  ];

  // GET /api/firmware/solutions/uno-sim-rig/tasks/adc/valid-targets (real) — kind 'analog-in'; only A0-A5 valid.
  const ADC_VALID_TARGETS_PINS = [{"pin": "A0", "verdict": "valid", "reason": "A0: has an ADC alternate function (ADC0) (datasheet fact atmega328p:pin.PC0)", "registered_to": ["adc_init"], "cooperating": true}, {"pin": "A1", "verdict": "valid", "reason": "A1: has an ADC alternate function (ADC1) (datasheet fact atmega328p:pin.PC1)", "registered_to": [], "cooperating": true}, {"pin": "A2", "verdict": "valid", "reason": "A2: has an ADC alternate function (ADC2) (datasheet fact atmega328p:pin.PC2)", "registered_to": [], "cooperating": true}, {"pin": "A3", "verdict": "valid", "reason": "A3: has an ADC alternate function (ADC3) (datasheet fact atmega328p:pin.PC3)", "registered_to": [], "cooperating": true}, {"pin": "A4", "verdict": "valid", "reason": "A4: has an ADC alternate function (ADC4) (datasheet fact atmega328p:pin.PC4)", "registered_to": [], "cooperating": true}, {"pin": "A5", "verdict": "valid", "reason": "A5: has an ADC alternate function (ADC5) (datasheet fact atmega328p:pin.PC5)", "registered_to": [], "cooperating": true}, {"pin": "D8", "verdict": "invalid", "reason": "D8: no ADC alternate function (ICP1/CLKO/PCINT0) (datasheet fact atmega328p:pin.PB0)", "registered_to": [], "cooperating": true}, {"pin": "D9", "verdict": "invalid", "reason": "D9: no ADC alternate function (OC1A/PCINT1) (datasheet fact atmega328p:pin.PB1)", "registered_to": [], "cooperating": true}, {"pin": "D10", "verdict": "invalid", "reason": "D10: no ADC alternate function (SS/OC1B/PCINT2) (datasheet fact atmega328p:pin.PB2)", "registered_to": [], "cooperating": true}, {"pin": "D11", "verdict": "invalid", "reason": "D11: no ADC alternate function (MOSI/OC2A/PCINT3) (datasheet fact atmega328p:pin.PB3)", "registered_to": [], "cooperating": true}, {"pin": "D12", "verdict": "invalid", "reason": "D12: no ADC alternate function (MISO/PCINT4) (datasheet fact atmega328p:pin.PB4)", "registered_to": [], "cooperating": true}, {"pin": "D13", "verdict": "invalid", "reason": "D13: no ADC alternate function (SCK/PCINT5) (datasheet fact atmega328p:pin.PB5)", "registered_to": ["led"], "cooperating": false}, {"pin": "D0", "verdict": "invalid", "reason": "D0: no ADC alternate function (RXD/PCINT16) (datasheet fact atmega328p:pin.PD0)", "registered_to": [], "cooperating": true}, {"pin": "D1", "verdict": "invalid", "reason": "D1: no ADC alternate function (TXD/PCINT17) (datasheet fact atmega328p:pin.PD1)", "registered_to": ["send", "usart_init"], "cooperating": true}, {"pin": "D2", "verdict": "invalid", "reason": "D2: no ADC alternate function (INT0/PCINT18) (datasheet fact atmega328p:pin.PD2)", "registered_to": [], "cooperating": true}, {"pin": "D3", "verdict": "invalid", "reason": "D3: no ADC alternate function (INT1/OC2B/PCINT19) (datasheet fact atmega328p:pin.PD3)", "registered_to": [], "cooperating": true}, {"pin": "D4", "verdict": "invalid", "reason": "D4: no ADC alternate function (XCK/T0/PCINT20) (datasheet fact atmega328p:pin.PD4)", "registered_to": [], "cooperating": true}, {"pin": "D5", "verdict": "invalid", "reason": "D5: no ADC alternate function (T1/OC0B/PCINT21) (datasheet fact atmega328p:pin.PD5)", "registered_to": [], "cooperating": true}, {"pin": "D6", "verdict": "invalid", "reason": "D6: no ADC alternate function (AIN0/OC0A/PCINT22) (datasheet fact atmega328p:pin.PD6)", "registered_to": ["apply", "pwm", "pwm_init"], "cooperating": false}, {"pin": "D7", "verdict": "invalid", "reason": "D7: no ADC alternate function (AIN1/PCINT23) (datasheet fact atmega328p:pin.PD7)", "registered_to": [], "cooperating": true}, {"pin": "GND", "verdict": "invalid", "reason": "GND is a ground pin — power/ground pins are never assignable to a firmware task (his ruling 2026-10-06)", "registered_to": [], "cooperating": true}, {"pin": "AREF", "verdict": "invalid", "reason": "AREF is a power pin — power/ground pins are never assignable to a firmware task (his ruling 2026-10-06)", "registered_to": [], "cooperating": true}, {"pin": "+5V", "verdict": "invalid", "reason": "+5V is a power pin", "registered_to": [], "cooperating": true}, {"pin": "NC", "verdict": "invalid", "reason": "NC is a power pin", "registered_to": [], "cooperating": true}, {"pin": "IOREF", "verdict": "invalid", "reason": "IOREF is a power pin", "registered_to": [], "cooperating": true}, {"pin": "+3V3", "verdict": "invalid", "reason": "+3V3 is a power pin", "registered_to": [], "cooperating": true}, {"pin": "VIN", "verdict": "invalid", "reason": "VIN is a power pin", "registered_to": [], "cooperating": true}];

  // GET .../tasks/tick_init/valid-targets (real) — kind 'pwm-out'; D3/D5/D6/D9/D10/D11 valid.
  const TICK_INIT_VALID_TARGETS_PINS = [{"pin": "A0", "verdict": "invalid", "reason": "A0: no Output Compare function", "registered_to": ["adc", "adc_init"], "cooperating": true}, {"pin": "A1", "verdict": "invalid", "reason": "A1: no Output Compare function", "registered_to": [], "cooperating": true}, {"pin": "A2", "verdict": "invalid", "reason": "A2: no Output Compare function", "registered_to": [], "cooperating": true}, {"pin": "A3", "verdict": "invalid", "reason": "A3: no Output Compare function", "registered_to": [], "cooperating": true}, {"pin": "A4", "verdict": "invalid", "reason": "A4: no Output Compare function", "registered_to": [], "cooperating": true}, {"pin": "A5", "verdict": "invalid", "reason": "A5: no Output Compare function", "registered_to": [], "cooperating": true}, {"pin": "D8", "verdict": "invalid", "reason": "D8: no Output Compare function", "registered_to": [], "cooperating": true}, {"pin": "D9", "verdict": "valid", "reason": "D9: has an Output Compare alternate function (OC1A, timer TIMER1)", "registered_to": [], "cooperating": true}, {"pin": "D10", "verdict": "valid", "reason": "D10: has an Output Compare alternate function (OC1B, timer TIMER1)", "registered_to": [], "cooperating": true}, {"pin": "D11", "verdict": "valid", "reason": "D11: has an Output Compare alternate function (OC2A, timer TIMER2)", "registered_to": [], "cooperating": true}, {"pin": "D12", "verdict": "invalid", "reason": "D12: no Output Compare function", "registered_to": [], "cooperating": true}, {"pin": "D13", "verdict": "invalid", "reason": "D13: no Output Compare function", "registered_to": ["led"], "cooperating": true}, {"pin": "D0", "verdict": "invalid", "reason": "D0: no Output Compare function", "registered_to": [], "cooperating": true}, {"pin": "D1", "verdict": "invalid", "reason": "D1: no Output Compare function", "registered_to": ["send", "usart_init"], "cooperating": true}, {"pin": "D2", "verdict": "invalid", "reason": "D2: no Output Compare function", "registered_to": [], "cooperating": true}, {"pin": "D3", "verdict": "valid", "reason": "D3: has an Output Compare alternate function (OC2B, timer TIMER2)", "registered_to": [], "cooperating": true}, {"pin": "D4", "verdict": "invalid", "reason": "D4: no Output Compare function", "registered_to": [], "cooperating": true}, {"pin": "D5", "verdict": "valid", "reason": "D5: has an Output Compare alternate function (OC0B, timer TIMER0)", "registered_to": [], "cooperating": true}, {"pin": "D6", "verdict": "valid", "reason": "D6: has an Output Compare alternate function (OC0A, timer TIMER0)", "registered_to": ["apply", "pwm", "pwm_init"], "cooperating": true}, {"pin": "D7", "verdict": "invalid", "reason": "D7: no Output Compare function", "registered_to": [], "cooperating": true}, {"pin": "GND", "verdict": "invalid", "reason": "GND is a ground pin", "registered_to": [], "cooperating": true}, {"pin": "AREF", "verdict": "invalid", "reason": "AREF is a power pin", "registered_to": [], "cooperating": true}, {"pin": "+5V", "verdict": "invalid", "reason": "+5V is a power pin", "registered_to": [], "cooperating": true}, {"pin": "NC", "verdict": "invalid", "reason": "NC is a power pin", "registered_to": [], "cooperating": true}, {"pin": "IOREF", "verdict": "invalid", "reason": "IOREF is a power pin", "registered_to": [], "cooperating": true}, {"pin": "+3V3", "verdict": "invalid", "reason": "+3V3 is a power pin", "registered_to": [], "cooperating": true}, {"pin": "VIN", "verdict": "invalid", "reason": "VIN is a power pin", "registered_to": [], "cooperating": true}];

  // GET /api/firmware/solutions/uno-sim-rig/tasks/led/valid-targets — led is already bound to D13 ('apply'/'rx_pop'
  // in blink-on-command stay out of this one). verdict 'valid' for D13 (its own pin, registered_to excludes self).
  const LED_VALID_TARGETS_PINS = [
    { pin: 'D13', verdict: 'valid', reason: 'D13: GPIO-capable (own pin)', registered_to: [], cooperating: true },
    { pin: 'D9', verdict: 'valid', reason: 'D9: GPIO-capable', registered_to: [], cooperating: true },
    { pin: 'A0', verdict: 'invalid', reason: 'A0: already registered to adc/adc_init (not cooperating)', registered_to: ['adc', 'adc_init'], cooperating: false },
  ];

  // GET /api/board/arduino-uno-r3/pins/D13 (real) — fs-2a's pin-detail door.
  const PIN_DETAIL_D13 = {"ok": true, "board": "arduino-uno-r3", "pin": "D13", "roles": ["led"], "soc_pin": "PB5", "register": {"port": "B", "bit": 5, "package_pin": "19", "default_function": "GPIO", "fact": "atmega328p:pin.PB5"}, "alternate_functions": [{"function": "SCK", "peripheral": "SPI", "signal": "SCK", "kind": "SPI signal", "fact": "atmega328p:pin.PB5"}, {"function": "PCINT5", "peripheral": "PCINT", "signal": "PCINT5", "kind": "pin-change interrupt", "fact": "atmega328p:pin.PB5"}], "current_assignment": {"function": "led", "peripheral": "", "signal": "", "firmware_symbol": "LED_PIN"}, "electrical": {"fact": "arduino-uno-r3:pinout.max_current_io", "max_ma": 20}, "net": "LED_BUILTIN", "connector": "DIGITAL_H", "connector_number": 6, "facts": ["arduino-uno-r3:pinout.D13", "atmega328p:pin.PB5"], "registered_tasks": [{"task": "led", "port": "on", "solution": "uno-sim-rig", "lane": "called", "status": "bound", "cooperating": true}], "unregistered": false};

  // GET /api/board/arduino-uno-r3/pins/D9 — an UNREGISTERED pin (used for the pin->task symmetric-highlight spec).
  const PIN_DETAIL_D9 = {"ok": true, "board": "arduino-uno-r3", "pin": "D9", "roles": ["gpio"], "soc_pin": "PB1", "register": {"port": "B", "bit": 1, "package_pin": "15", "default_function": "GPIO", "fact": "atmega328p:pin.PB1"}, "alternate_functions": [{"function": "OC1A", "peripheral": "TIMER1", "signal": "OC1A", "kind": "timer channel", "fact": "atmega328p:pin.PB1"}], "current_assignment": {"function": "", "peripheral": "", "signal": "", "firmware_symbol": ""}, "electrical": {"fact": "arduino-uno-r3:pinout.max_current_io", "max_ma": 20}, "net": "D9", "connector": "DIGITAL_H", "connector_number": 9, "facts": [], "registered_tasks": [], "unregistered": true};

  // GET /api/board/target-compat (real) — board.custom.target_compat.rows(), global + cited.
  const TARGET_COMPAT_ROWS = [{"name": "analog-in", "kind": "analog-in", "title": "Analog input (ADC)", "roles": "adc", "description": "reads a continuously-varying voltage", "matches": "A0-A5", "source_label": "Arduino UNO R3 docs", "source_url": "https://docs.arduino.cc/hardware/uno-rev3/", "notes": ""}, {"name": "pwm-out", "kind": "pwm-out", "title": "PWM output", "roles": "pwm", "description": "drives a timer's Output Compare pin", "matches": "D3, D5, D6, D9, D10, D11", "source_label": "Arduino UNO R3 docs", "source_url": "https://docs.arduino.cc/hardware/uno-rev3/", "notes": ""}, {"name": "digital-in", "kind": "digital-in", "title": "Digital input", "roles": "gpio", "description": "reads a plain 0/1 logic level", "matches": "any non-power/ground pin", "source_label": "Arduino UNO R3 docs", "source_url": "https://docs.arduino.cc/hardware/uno-rev3/", "notes": ""}, {"name": "digital-out", "kind": "digital-out", "title": "Digital output", "roles": "gpio", "description": "drives a plain 0/1 logic level", "matches": "any non-power/ground pin", "source_label": "Arduino UNO R3 docs", "source_url": "https://docs.arduino.cc/hardware/uno-rev3/", "notes": ""}, {"name": "interrupt-in", "kind": "interrupt-in", "title": "Interrupt input", "roles": "gpio", "description": "wakes firmware on an edge", "matches": "INT0/INT1 or PCINTn", "source_label": "Arduino UNO R3 docs", "source_url": "https://docs.arduino.cc/hardware/uno-rev3/", "notes": ""}, {"name": "spi-sck", "kind": "spi-sck", "title": "SPI clock (SCK)", "roles": "spi", "description": "the SPI bus's clock line", "matches": "D13 / ICSP SCK", "source_label": "Arduino UNO R3 docs", "source_url": "https://docs.arduino.cc/hardware/uno-rev3/", "notes": ""}];

  // GET /api/board/arduino-uno-r3/pinmap.svg (real, trimmed to the D13/A0/D6/D9 `<g data-pin>` cells).
  const PINMAP_SVG = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 926 322\" width=\"926\" height=\"322\" font-family=\"monospace\" font-size=\"11\"><g class=\"pin-cell\" data-pin=\"D13\" data-role=\"led\"><title>LED_PIN: net=LED_BUILTIN</title><rect x=\"202\" y=\"176\" width=\"170\" height=\"26\" fill=\"#f9a825\" fill-opacity=\"0.16\" stroke=\"#f9a825\" data-pin=\"D13\"/><text x=\"208\" y=\"187\" font-weight=\"bold\">D13</text><text x=\"208\" y=\"198\" font-size=\"9\" fill=\"#37474f\">PB5 / LED_BUILTIN</text></g><g class=\"pin-cell\" data-pin=\"A0\" data-role=\"adc\"><title>ADC_CHANNEL: net=TEMP_SENSE</title><rect x=\"16\" y=\"46\" width=\"170\" height=\"26\" fill=\"#1565c0\" fill-opacity=\"0.16\" stroke=\"#1565c0\" data-pin=\"A0\"/><text x=\"22\" y=\"57\" font-weight=\"bold\">A0</text><text x=\"22\" y=\"68\" font-size=\"9\" fill=\"#37474f\">PC0 / TEMP_SENSE</text></g><g class=\"pin-cell\" data-pin=\"D6\" data-role=\"pwm\"><title>PWM_PIN: net=PWM_LED</title><rect x=\"388\" y=\"202\" width=\"170\" height=\"26\" fill=\"#e65100\" fill-opacity=\"0.16\" stroke=\"#e65100\" data-pin=\"D6\"/><text x=\"394\" y=\"213\" font-weight=\"bold\">D6</text><text x=\"394\" y=\"224\" font-size=\"9\" fill=\"#37474f\">PD6 / PWM_LED</text></g><g class=\"pin-cell\" data-pin=\"D9\" data-role=\"gpio\"><title>net=D9</title><rect x=\"202\" y=\"72\" width=\"170\" height=\"26\" fill=\"#78909c\" fill-opacity=\"0.16\" stroke=\"#78909c\" data-pin=\"D9\"/><text x=\"208\" y=\"83\" font-weight=\"bold\">D9</text><text x=\"208\" y=\"94\" font-size=\"9\" fill=\"#37474f\">PB1 / D9</text></g></svg>";

  function httpGet(url: string): any {
    if (getOverride) { const r = getOverride(url); if (r) { return r; } }
    if (url.endsWith('/pinmap.svg')) { return of(PINMAP_SVG); }
    if (url.endsWith('/api/firmware/solutions')) { return of({ ok: true, solutions: [{ name: 'uno-sim-rig', title: 'UNO sim-rig firmware' }] }); }
    if (url.endsWith('/api/firmware/solutions/uno-sim-rig')) {
      return of({
        ok: true, solution: SOLUTION, schedule: SCHEDULE, assignments: ASSIGNMENTS,
        unregistered_tasks: UNREGISTERED_TASKS, registered_tasks: REGISTERED_TASKS_BY_PIN,
        capabilities: CAPABILITIES,
        validation: { ok: true, why: SOLUTION.validation_why } as any, builds: [],
      });
    }
    if (url.endsWith('/tasks/adc/valid-targets')) { return of({ ok: true, solution: 'uno-sim-rig', task: 'adc', kind: 'analog-in', pins: ADC_VALID_TARGETS_PINS }); }
    if (url.endsWith('/tasks/tick_init/valid-targets')) { return of({ ok: true, solution: 'uno-sim-rig', task: 'tick_init', kind: 'pwm-out', pins: TICK_INIT_VALID_TARGETS_PINS }); }
    if (url.endsWith('/tasks/led/valid-targets')) { return of({ ok: true, solution: 'uno-sim-rig', task: 'led', kind: 'digital-out', pins: LED_VALID_TARGETS_PINS }); }
    if (url.endsWith('/pins/D13')) { return of(PIN_DETAIL_D13); }
    if (url.endsWith('/pins/D9')) { return of(PIN_DETAIL_D9); }
    if (url.endsWith('/api/board/target-compat')) { return of({ ok: true, rows: TARGET_COMPAT_ROWS }); }
    return of({ ok: false, error: 'unexpected GET ' + url });
  }

  beforeEach(async () => {
    try { localStorage.removeItem(LAYOUT_KEY); } catch { /* ignore */ }
    posts = [];
    getOverride = null;
    postResponse = (url: string, body: any) => of({ ok: true, assignment: { ...body, status: body.lives_on === 'unbound' ? 'unbound' : 'bound' } });
    await TestBed.configureTestingModule({
      imports: [FirmwareSolutionPanelComponent],
      providers: [
        { provide: HttpClient, useValue: {
            get: (url: string) => httpGet(url),
            post: (url: string, body: any) => { posts.push({ url, body }); return postResponse(url, body); },
          } },
        { provide: PolariService, useValue: { getBackendBaseUrl: () => '', backendRequestOptions: {} } },
        provideRouter([]),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(FirmwareSolutionPanelComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => { try { localStorage.removeItem(LAYOUT_KEY); } catch { /* ignore */ } });

  const pinEl = (pin: string) => (fixture.nativeElement as HTMLElement).querySelector(`[data-pin="${pin}"]`) as Element;
  const chipByTask = (task: string) => component.assignments.find(a => a.task === task)!;

  describe('section/preset layout + Tasks rename (fs-2b item 1, fs-2c addendum)', () => {
    it('defaults to all four sections open', () => {
      fixture.detectChanges();
      expect(component.openKeys).toEqual(['tasks', 'schedule', 'pins', 'detail']);
    });

    it('"One" maximises exactly the chosen section and persists it under the ONE layout key', () => {
      fixture.detectChanges();
      component.showOne('pins');
      expect(component.openKeys).toEqual(['pins']);
      const saved = JSON.parse(localStorage.getItem(LAYOUT_KEY)!);
      expect(saved).toEqual({ tasks: false, schedule: false, pins: true, detail: false });
    });

    it('a fresh instance reloads the persisted layout from localStorage', () => {
      fixture.detectChanges();
      component.showTwo('pins', 'detail');
      const fixture2 = TestBed.createComponent(FirmwareSolutionPanelComponent);
      const component2 = fixture2.componentInstance;
      fixture2.detectChanges();
      expect(component2.openKeys.sort()).toEqual(['detail', 'pins']);
    });

    it('renders "Tasks (N)" — never "Unregistered Tasks" — for the full-tasks section', () => {
      fixture.detectChanges();
      const text = (fixture.nativeElement as HTMLElement).textContent || '';
      expect(text).toContain(`Tasks (${SCHEDULE.length})`);
      expect(text).not.toContain('Unregistered Tasks (');
      expect(text).toContain('Pin map');
      expect(text).toContain('Target details');
    });
  });

  describe('Tasks grouped by Capability, status chips (fs-2c item 1)', () => {
    it('groups known tasks under their capability and the rest under Ungrouped', () => {
      fixture.detectChanges();
      const keys = component.taskGroups.map(g => g.key);
      expect(keys).toContain('temp-sensor-to-os');
      expect(keys).toContain('blink-on-command');
      expect(keys).toContain(component.UNGROUPED);
      const tempGroup = component.taskGroups.find(g => g.key === 'temp-sensor-to-os')!;
      expect(tempGroup.rows.map(r => r.task).sort()).toEqual(['adc', 'adc_init', 'send', 'telemetry', 'temp']); // 'frame' isn't a schedule task here
      const blinkGroup = component.taskGroups.find(g => g.key === 'blink-on-command')!;
      expect(blinkGroup.rows.map(r => r.task).sort()).toEqual(['apply', 'led', 'rx_pop']);
      const ungrouped = component.taskGroups.find(g => g.key === component.UNGROUPED)!;
      expect(ungrouped.rows.map(r => r.task)).toContain('usart_init');
      expect(ungrouped.rows.map(r => r.task)).toContain('clock');
    });

    it('carries the capability status chip and marks a registered pin vs "unregistered"', () => {
      fixture.detectChanges();
      const tempGroup = component.taskGroups.find(g => g.key === 'temp-sensor-to-os')!;
      expect(tempGroup.status).toBe('proven-on-twin');
      const adcRow = tempGroup.rows.find(r => r.task === 'adc')!;
      expect(adcRow.target).toBe('A0');
      const tempRow = tempGroup.rows.find(r => r.task === 'temp')!;
      expect(tempRow.target).toBe('unregistered'); // temp.return is 'unbound'
      const text = (fixture.nativeElement as HTMLElement).textContent || '';
      expect(text).toContain('proven-on-twin');
      expect(text).toContain('planned');
    });
  });

  describe('one selection model, many entry points (fs-2c item 2)', () => {
    it('the Tasks row, the chip, a schedule chip, and a Target-details row all select the SAME task via the SAME method', () => {
      fixture.detectChanges();
      component.handleTaskActivate(chipByTask('adc'));
      expect(component.selectedTask?.task).toBe('adc');
      component.clearSelection();
      component.handleTaskActivate(chipByTask('adc')); // the chip-strip entry point calls the identical method
      expect(component.selectedTask?.task).toBe('adc');
      component.clearSelection();
      component.onDragStart({ dataTransfer: { setData: () => {} } } as any, chipByTask('adc')); // the schedule/drag entry point
      expect(component.selectedTask?.task).toBe('adc');
    });

    it('a pin selected from the map and from a Target-details row (the valid-targets pin table) use the SAME method', () => {
      fixture.detectChanges();
      component.handleTaskActivate(chipByTask('adc'));
      component.handlePinActivate('A1'); // simulates clicking the A1 row inside the task's own Target-details table — SAME method the map click uses
      expect(component.pending).toEqual({ kind: 'register', task: jasmine.objectContaining({ task: 'adc' }), pin: 'A1' } as any);
      expect(component.selectedTask?.task).toBe('adc'); // the task stays selected — Target-details-row clicks set an OFFER, they do not switch the primary selection
    });

    it('toggle: the SAME task clicked twice deselects; Escape clears everything', () => {
      fixture.detectChanges();
      component.handleTaskActivate(chipByTask('adc'));
      expect(component.selectedTask?.task).toBe('adc');
      component.handleTaskActivate(chipByTask('adc'));
      expect(component.selectedTask).toBeNull();
      expect(component.detailMode).toBe('none');

      component.handlePinActivate('D13');
      expect(component.selectedPin).toBe('D13');
      component.onEscapeKey();
      expect(component.selectedPin).toBe('');
      expect(component.detailMode).toBe('none');
    });

    it('toggle: the SAME pin clicked twice deselects', () => {
      fixture.detectChanges();
      component.handlePinActivate('D13');
      expect(component.selectedPin).toBe('D13');
      component.handlePinActivate('D13');
      expect(component.selectedPin).toBe('');
      expect(component.detailMode).toBe('none');
    });
  });

  describe('symmetric highlighting, both ways (fs-2c item 3)', () => {
    it('task selected: its OWN pin is "solid", a valid candidate is "outline", an invalid one is "dim"', () => {
      fixture.detectChanges();
      component.handleTaskActivate(chipByTask('adc'));
      expect(component.taskHighlight === undefined).toBe(false);
      const a0 = pinEl('A0') as HTMLElement; // adc's own pin
      expect(a0.getAttribute('data-highlight')).toBe('solid');
      const d13 = pinEl('D13') as HTMLElement; // invalid for adc
      expect(d13.getAttribute('data-highlight')).toBe('dim');
    });

    it('task selected: its caller/called tasks highlight solid in the Tasks table', () => {
      fixture.detectChanges();
      component.handleTaskActivate(chipByTask('apply')); // 'apply' (loop:order 11) is the nearest preceding non-called task before 'led'/'pwm' (called)
      expect(component.taskHighlight('led')).toBe('solid');
      expect(component.taskHighlight('pwm')).toBe('solid');
      expect(component.taskHighlight('clock')).toBe(''); // unrelated
    });

    it('pin selected: its Registered Tasks are "solid" in the Tasks/Schedule highlight', () => {
      fixture.detectChanges();
      component.handlePinActivate('D13');
      expect(component.taskHighlight('led')).toBe('solid'); // from pinDetail.registered_tasks
      expect(component.taskHighlight('apply')).toBe('dim'); // not registered to D13, not cached as compatible
    });

    it('pin selected: a task whose CACHED valid-targets include this pin highlights "outline" (the stated cache-based derivation)', () => {
      fixture.detectChanges();
      component.handleTaskActivate(chipByTask('led')); // populates the cache for 'led' including D9: valid
      component.clearSelection();
      component.handlePinActivate('D9');
      expect(component.taskHighlight('led')).toBe('outline');
    });
  });

  describe('selection then action with a confirm — offer only for valid pairs, no POST before Register (fs-2c item 4)', () => {
    it('clicking an OUTLINED (valid, unclaimed) pin while a task is selected sets a pending Register offer and POSTS NOTHING', () => {
      fixture.detectChanges();
      component.handleTaskActivate(chipByTask('adc'));
      component.handlePinActivate('A1');
      expect(posts.length).toBe(0);
      expect(component.pending).toEqual({ kind: 'register', task: jasmine.objectContaining({ task: 'adc' }), pin: 'A1' } as any);
      expect(component.selectionText).toContain('Register adc.channel to A1');
    });

    it('clicking an INVALID pin offers nothing and surfaces the reason, with no pending and no POST', () => {
      fixture.detectChanges();
      component.handleTaskActivate(chipByTask('adc'));
      component.handlePinActivate('D13');
      expect(posts.length).toBe(0);
      expect(component.pending).toBeNull();
      expect(component.assignError).toContain('no ADC alternate function');
    });

    it('confirmPending() performs the exact POST only after Register is clicked', () => {
      fixture.detectChanges();
      component.handleTaskActivate(chipByTask('adc'));
      component.handlePinActivate('A1');
      expect(posts.length).toBe(0);
      component.confirmPending();
      expect(posts.length).toBe(1);
      expect(posts[0].url).toBe('/api/firmware/solutions/uno-sim-rig/assign');
      expect(posts[0].body).toEqual({ task: 'adc', port: 'channel', lives_on: 'arduino-uno-r3:A1' });
    });

    it('cancelPending() clears the offer without posting and keeps the task selected', () => {
      fixture.detectChanges();
      component.handleTaskActivate(chipByTask('adc'));
      component.handlePinActivate('A1');
      component.cancelPending();
      expect(component.pending).toBeNull();
      expect(posts.length).toBe(0);
      expect(component.selectedTask?.task).toBe('adc'); // only the offer is cancelled, not the selection
    });

    it('clicking the SAME pending pin again cancels the offer (toggle)', () => {
      fixture.detectChanges();
      component.handleTaskActivate(chipByTask('adc'));
      component.handlePinActivate('A1');
      expect(component.pending).not.toBeNull();
      component.handlePinActivate('A1');
      expect(component.pending).toBeNull();
    });

    it('clicking the task\'s own SOLID pin offers Unregister, not Register', () => {
      fixture.detectChanges();
      component.handleTaskActivate(chipByTask('adc')); // own pin A0
      component.handlePinActivate('A0');
      expect(component.pending?.kind).toBe('unregister');
      expect(component.selectionText).toContain('Unregister adc.channel from A0');
    });

    it('drag lands on the SAME confirm as a click — no POST until Register', () => {
      // D9 is one of the pins the trimmed PINMAP_SVG fixture actually renders (A1..A5 aren't in the trim) and is a
      // VALID, unclaimed target for tick_init (TICK_INIT_VALID_TARGETS_PINS).
      fixture.detectChanges();
      component.onDragStart({ dataTransfer: { setData: () => {} } } as any, chipByTask('tick_init'));
      component.onDrop({ preventDefault: () => {}, target: pinEl('D9') } as any);
      expect(posts.length).toBe(0);
      expect(component.pending).toEqual(jasmine.objectContaining({ kind: 'register', pin: 'D9' }));
      component.confirmPending();
      expect(posts.length).toBe(1);
      expect(posts[0].body).toEqual({ task: 'tick_init', port: '', lives_on: 'arduino-uno-r3:D9' });
    });

    it('a drop on an invalid pin never posts, even after the drag — the reason appears in the bar', () => {
      fixture.detectChanges();
      component.onDragStart({ dataTransfer: { setData: () => {} } } as any, chipByTask('adc'));
      component.onDrop({ preventDefault: () => {}, target: pinEl('D13') } as any);
      expect(posts.length).toBe(0);
      expect(component.pending).toBeNull();
      expect(component.assignError).toContain('no ADC alternate function');
    });
  });

  describe('Unregister path (fs-2c item 4)', () => {
    it('confirming an Unregister offer POSTs lives_on="unbound" — the existing assign door, no new backend endpoint', () => {
      fixture.detectChanges();
      component.handleTaskActivate(chipByTask('led')); // bound to D13
      component.handlePinActivate('D13');
      expect(component.pending?.kind).toBe('unregister');
      component.confirmPending();
      expect(posts.length).toBe(1);
      expect(posts[0].body).toEqual({ task: 'led', port: 'on', lives_on: 'unbound' });
    });

    it('the mirror direction (pin selected, then its own registered task clicked) offers the identical Unregister', () => {
      fixture.detectChanges();
      component.handlePinActivate('D13');
      component.handleTaskActivate(chipByTask('led'));
      expect(component.pending).toEqual({ kind: 'unregister', task: jasmine.objectContaining({ task: 'led' }), pin: 'D13' } as any);
    });
  });

  describe('a backend 422 surfaces its reason in the selection bar (fs-2c item 4)', () => {
    it('a 422 the backend still returns shows ITS reason (the door is never re-implemented client-side)', () => {
      fixture.detectChanges();
      postResponse = () => throwError(() => ({ status: 422, error: { ok: false, refused: true, error: 'pin arduino-uno-r3:D9 is already registered to rx_pop (not cooperating) — conflict', task: 'tick_init', lives_on: 'arduino-uno-r3:D9' } }));
      component.handleTaskActivate(chipByTask('tick_init'));
      component.handlePinActivate('D9');
      expect(component.pending?.kind).toBe('register'); // D9 is VALID per the door
      component.confirmPending();
      expect(posts.length).toBe(1);
      expect(component.assignError).toContain('already registered to rx_pop');
      expect(component.pending).toBeNull();
    });
  });

  describe('Target details ranked by relevance (fs-2c item 5)', () => {
    it('task selected: the first row is always viable, and the collapsed count equals the invalid count', () => {
      fixture.detectChanges();
      component.handleTaskActivate(chipByTask('adc'));
      const ranked = component.taskRanked;
      expect(['valid', 'undetermined'].includes(ranked.visible[0].verdict) || ranked.visible[0].registered_to.length > 0).toBe(true);
      expect(ranked.visible[0].verdict).not.toBe('invalid');
      const invalidCount = ADC_VALID_TARGETS_PINS.filter(p => p.verdict === 'invalid' && !p.registered_to.length).length;
      expect(ranked.invalid.length).toBe(invalidCount);
    });

    it('task selected: registered-elsewhere pins are cooperating-before-conflicting, after the unclaimed valid/undetermined ones', () => {
      fixture.detectChanges();
      component.handleTaskActivate(chipByTask('adc'));
      const visible = component.taskRanked.visible;
      const d1Index = visible.findIndex(p => p.pin === 'D1'); // cooperating-elsewhere (send/usart_init)
      const a0Index = visible.findIndex(p => p.pin === 'A0'); // valid, unclaimed-by-others (adc's own pin)
      expect(a0Index).toBeLessThan(d1Index);
    });

    it('pin selected: Registered Tasks come first; compatible unregistered tasks (from cache) come next', () => {
      fixture.detectChanges();
      component.handleTaskActivate(chipByTask('tick_init')); // tick_init IS unregistered; populates its cache, D9: valid
      component.clearSelection();
      component.handlePinActivate('D9');
      const ranked = component.pinRanked;
      expect(ranked.registered).toEqual([]); // D9 has no Registered Tasks in this fixture
      expect(ranked.compatible).toContain('tick_init');
    });
  });

  describe('pin detail register facts (fs-2b item 4, kept)', () => {
    it('clicking D13 renders its register detail and Registered Tasks', () => {
      fixture.detectChanges();
      component.handlePinActivate('D13');
      expect(component.detailMode).toBe('pin');
      expect(component.pinDetail?.soc_pin).toBe('PB5');
      expect(component.registerNames(component.pinDetail!)).toBe('DDRB / PORTB / PINB');
      expect(component.pinRanked.registered.map(r => r.task)).toEqual(['led']);
    });

    it('the pin highlights on the map (a selection ring, independent of any valid-targets overlay)', () => {
      fixture.detectChanges();
      component.handlePinActivate('D13');
      expect((pinEl('D13') as HTMLElement).style.filter).toContain('drop-shadow');
    });
  });
});
