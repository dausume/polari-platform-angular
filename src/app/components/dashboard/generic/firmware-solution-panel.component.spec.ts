import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { FirmwareSolutionPanelComponent } from './firmware-solution-panel.component';
import { PolariService } from '@services/polari-service';

/**
 * fs-2b — EVERY fixture below is a REAL captured response from the live staging server
 * (https://api.prf.192.168.0.210.nip.io, 2026-10-06, the fs-2a doors going live during this slice's time box):
 * `GET /api/firmware/solutions/uno-sim-rig`, `GET .../tasks/adc/valid-targets`, `GET .../tasks/tick_init/valid-targets`,
 * `GET /api/board/arduino-uno-r3/pins/D13`, `GET /api/board/target-compat`, `GET /api/board/arduino-uno-r3/pinmap.svg`
 * (trimmed to the D13/A0/D6/D9 cells) — not invented shapes. What must hold: the layout presets change the open
 * section set and persist under ONE localStorage key; selecting the ADC task marks exactly A0-A5 valid; a drop on
 * a greyed (invalid) pin never POSTs; a 422 the backend still returns shows ITS reason; and clicking D13 renders
 * its register detail and Registered Tasks (fs-2a's own door).
 */
const LAYOUT_KEY = 'polari-firmware-panel-layout';

describe('FirmwareSolutionPanelComponent', () => {
  let fixture: ComponentFixture<FirmwareSolutionPanelComponent>;
  let component: FirmwareSolutionPanelComponent;
  let posts: Array<{ url: string; body: any }>;
  let postResponse: (url: string, body: any) => any;

  // GET /api/firmware/solutions/uno-sim-rig (real, captured 2026-10-06)
  const SOLUTION = {"name": "uno-sim-rig", "title": "UNO sim-rig firmware", "graph": "uno-sim-rig-graph", "board_definition": "arduino-uno-r3", "board_variable": "", "runtime": "c-device", "status": "validated", "last_build": "", "board_resolved": "arduino-uno-r3", "board_exists": true, "validation": "ok", "validation_why": "ok: board arduino-uno-r3 resolved (fixed board_definition 'arduino-uno-r3' (not checked against a live register here)); 16 target(s), 5 unbound (tick_init, led_init, rx_pop, clock.return, temp.return)", "task_count": 13, "purpose": "The firmware-only half of the sim-rig: tasks = the 13 atoms of uno-sim-rig-graph, scheduled by their own ISR/tick/loop/init annotations (never authored), registers bound to arduino-uno-r3's pin map (A0/D6/D13/D0/D1); temp_c and uptime_ms are memory-field targets, exposed unbound (fs-0, his message 2026-10-05).", "notes": ""};
  const SCHEDULE = [{"name": "uno-sim-rig:called:led", "solution": "uno-sim-rig", "task": "led", "lane": "called", "order": 12, "trigger": "called by another task (not scheduled directly)", "period_ms": 0, "measured_cycles": -1, "isr_vector": "", "provenance": "derived", "notes": "text_bytes_noinline=12 B, stack_bytes=2 (CFunctionAtom.cost; no per-atom cycle count yet)"}, {"name": "uno-sim-rig:called:pwm", "solution": "uno-sim-rig", "task": "pwm", "lane": "called", "order": 13, "trigger": "called by another task (not scheduled directly)", "period_ms": 0, "measured_cycles": -1, "isr_vector": "", "provenance": "derived", "notes": "text_bytes_noinline=130 B, stack_bytes=10 (CFunctionAtom.cost; no per-atom cycle count yet)"}, {"name": "uno-sim-rig:init:usart_init", "solution": "uno-sim-rig", "task": "usart_init", "lane": "init", "order": 1, "trigger": "", "period_ms": 0, "measured_cycles": -1, "isr_vector": "", "provenance": "derived", "notes": "text_bytes_noinline=30 B, stack_bytes=2 (CFunctionAtom.cost; no per-atom cycle count yet)"}, {"name": "uno-sim-rig:init:tick_init", "solution": "uno-sim-rig", "task": "tick_init", "lane": "init", "order": 2, "trigger": "", "period_ms": 0, "measured_cycles": -1, "isr_vector": "", "provenance": "derived", "notes": "text_bytes_noinline=24 B, stack_bytes=2 (CFunctionAtom.cost; no per-atom cycle count yet)"}, {"name": "uno-sim-rig:init:led_init", "solution": "uno-sim-rig", "task": "led_init", "lane": "init", "order": 3, "trigger": "", "period_ms": 0, "measured_cycles": -1, "isr_vector": "", "provenance": "derived", "notes": "text_bytes_noinline=4 B, stack_bytes=2 (CFunctionAtom.cost; no per-atom cycle count yet)"}, {"name": "uno-sim-rig:init:pwm_init", "solution": "uno-sim-rig", "task": "pwm_init", "lane": "init", "order": 4, "trigger": "", "period_ms": 0, "measured_cycles": -1, "isr_vector": "", "provenance": "derived", "notes": "text_bytes_noinline=14 B, stack_bytes=2 (CFunctionAtom.cost; no per-atom cycle count yet)"}, {"name": "uno-sim-rig:init:adc_init", "solution": "uno-sim-rig", "task": "adc_init", "lane": "init", "order": 5, "trigger": "", "period_ms": 0, "measured_cycles": -1, "isr_vector": "", "provenance": "derived", "notes": "text_bytes_noinline=14 B, stack_bytes=2 (CFunctionAtom.cost; no per-atom cycle count yet)"}, {"name": "uno-sim-rig:isr:hal.INT0_vect", "solution": "uno-sim-rig", "task": "hal.INT0_vect", "lane": "isr", "order": 0, "trigger": "INT0_vect", "period_ms": 0, "measured_cycles": -1, "isr_vector": "INT0_vect", "provenance": "derived", "notes": "always linked into the glue (project-level ISR, not wired as a graph node); cost is bytes/stack (CFunctionAtom.cost) \u2014 no per-atom cycle measurement exists yet"}, {"name": "uno-sim-rig:isr:hal.TIMER2_COMPA_vect", "solution": "uno-sim-rig", "task": "hal.TIMER2_COMPA_vect", "lane": "isr", "order": 1, "trigger": "TIMER2_COMPA_vect", "period_ms": 0, "measured_cycles": -1, "isr_vector": "TIMER2_COMPA_vect", "provenance": "derived", "notes": "always linked into the glue (project-level ISR, not wired as a graph node); cost is bytes/stack (CFunctionAtom.cost) \u2014 no per-atom cycle measurement exists yet"}, {"name": "uno-sim-rig:isr:hal.USART_RX_vect", "solution": "uno-sim-rig", "task": "hal.USART_RX_vect", "lane": "isr", "order": 2, "trigger": "USART_RX_vect", "period_ms": 0, "measured_cycles": -1, "isr_vector": "USART_RX_vect", "provenance": "derived", "notes": "always linked into the glue (project-level ISR, not wired as a graph node); cost is bytes/stack (CFunctionAtom.cost) \u2014 no per-atom cycle measurement exists yet"}, {"name": "uno-sim-rig:loop:rx_pop", "solution": "uno-sim-rig", "task": "rx_pop", "lane": "loop", "order": 10, "trigger": "", "period_ms": 0, "measured_cycles": -1, "isr_vector": "", "provenance": "derived", "notes": "text_bytes_noinline=52 B, stack_bytes=2 (CFunctionAtom.cost; no per-atom cycle count yet)"}, {"name": "uno-sim-rig:loop:apply", "solution": "uno-sim-rig", "task": "apply", "lane": "loop", "order": 11, "trigger": "", "period_ms": 0, "measured_cycles": -1, "isr_vector": "", "provenance": "derived", "notes": "text_bytes_noinline=192 B, stack_bytes=92 (CFunctionAtom.cost; no per-atom cycle count yet)"}, {"name": "uno-sim-rig:loop:clock", "solution": "uno-sim-rig", "task": "clock", "lane": "loop", "order": 20, "trigger": "", "period_ms": 0, "measured_cycles": -1, "isr_vector": "", "provenance": "derived", "notes": "text_bytes_noinline=54 B, stack_bytes=2 (CFunctionAtom.cost; no per-atom cycle count yet)"}, {"name": "uno-sim-rig:loop:adc", "solution": "uno-sim-rig", "task": "adc", "lane": "loop", "order": 22, "trigger": "", "period_ms": 0, "measured_cycles": -1, "isr_vector": "", "provenance": "derived", "notes": "text_bytes_noinline=36 B, stack_bytes=2 (CFunctionAtom.cost; no per-atom cycle count yet)"}, {"name": "uno-sim-rig:loop:temp", "solution": "uno-sim-rig", "task": "temp", "lane": "loop", "order": 23, "trigger": "", "period_ms": 0, "measured_cycles": -1, "isr_vector": "", "provenance": "derived", "notes": "text_bytes_noinline=48 B, stack_bytes=2 (CFunctionAtom.cost; no per-atom cycle count yet)"}, {"name": "uno-sim-rig:loop:send", "solution": "uno-sim-rig", "task": "send", "lane": "loop", "order": 26, "trigger": "", "period_ms": 0, "measured_cycles": -1, "isr_vector": "", "provenance": "derived", "notes": "text_bytes_noinline=34 B, stack_bytes=2 (CFunctionAtom.cost; no per-atom cycle count yet)"}, {"name": "uno-sim-rig:tick:telemetry", "solution": "uno-sim-rig", "task": "telemetry", "lane": "tick", "order": 21, "trigger": "period_ms=TELEMETRY_MS", "period_ms": 0, "measured_cycles": -1, "isr_vector": "", "provenance": "derived", "notes": "period macro 'TELEMETRY_MS' (resolved in board_config.h, not re-typed here)"}];
  const ASSIGNMENTS = [{"name": "uno-sim-rig:clock.return", "solution": "uno-sim-rig", "task": "clock", "port": "return", "target_kind": "memory-field", "controls": "SimRigState.uptime_ms <- milliseconds since hal_tick_init, from the Timer2 1 ms tick", "lives_on": "unbound", "status": "unbound", "provenance": "derived", "notes": ""}, {"name": "uno-sim-rig:temp.return", "solution": "uno-sim-rig", "task": "temp", "port": "return", "target_kind": "memory-field", "controls": "SimRigState.temp_c <- TMP36 temperature (or the raw count when TEMP_TMP36 is 0)", "lives_on": "unbound", "status": "unbound", "provenance": "derived", "notes": ""}, {"name": "uno-sim-rig:apply.r", "solution": "uno-sim-rig", "task": "apply", "port": "r", "target_kind": "pin", "controls": "a parsed PolariPacket SimRigState command (apply a command's PRESENT actuator fields (led_on, pwm_duty); status becomes commanded) \u2014 touches D6", "lives_on": "arduino-uno-r3:D6", "status": "bound", "provenance": "annotation", "notes": ""}, {"name": "uno-sim-rig:rx_pop", "solution": "uno-sim-rig", "task": "rx_pop", "port": "", "target_kind": "pin", "controls": "pop one byte from the USART0 RX ring the RX ISR fills", "lives_on": "unbound", "status": "unbound", "provenance": "annotation", "notes": ""}, {"name": "uno-sim-rig:adc.channel", "solution": "uno-sim-rig", "task": "adc", "port": "channel", "target_kind": "register", "controls": "A0..A5 (0..5) (one blocking ADC conversion, AVcc reference) \u2014 touches A0", "lives_on": "arduino-uno-r3:A0", "status": "bound", "provenance": "annotation", "notes": ""}, {"name": "uno-sim-rig:adc_init", "solution": "uno-sim-rig", "task": "adc_init", "port": "", "target_kind": "register", "controls": "hal_adc_init \u2014 touches A0", "lives_on": "arduino-uno-r3:A0", "status": "bound", "provenance": "annotation", "notes": ""}, {"name": "uno-sim-rig:led.on", "solution": "uno-sim-rig", "task": "led", "port": "on", "target_kind": "register", "controls": "0 = off, anything else = on (set the LED on LED_PIN) \u2014 touches D13", "lives_on": "arduino-uno-r3:D13", "status": "bound", "provenance": "annotation", "notes": ""}, {"name": "uno-sim-rig:led_init", "solution": "uno-sim-rig", "task": "led_init", "port": "", "target_kind": "register", "controls": "hal_led_init", "lives_on": "unbound", "status": "unbound", "provenance": "annotation", "notes": ""}, {"name": "uno-sim-rig:pwm.duty", "solution": "uno-sim-rig", "task": "pwm", "port": "duty", "target_kind": "register", "controls": "requested duty 0..100 (clamped) (set the PWM duty on PWM_PIN (OCR = duty*255/100)) \u2014 touches D6", "lives_on": "arduino-uno-r3:D6", "status": "bound", "provenance": "annotation", "notes": ""}, {"name": "uno-sim-rig:pwm_init", "solution": "uno-sim-rig", "task": "pwm_init", "port": "", "target_kind": "register", "controls": "hal_pwm_init \u2014 touches D6", "lives_on": "arduino-uno-r3:D6", "status": "bound", "provenance": "annotation", "notes": ""}, {"name": "uno-sim-rig:send.b", "solution": "uno-sim-rig", "task": "send", "port": "b", "target_kind": "register", "controls": "the frame to send (send n bytes on USART0, blocking on UDRE0 per byte (115200 8N1)) \u2014 touches D1", "lives_on": "arduino-uno-r3:D1", "status": "bound", "provenance": "annotation", "notes": ""}, {"name": "uno-sim-rig:tick_init", "solution": "uno-sim-rig", "task": "tick_init", "port": "", "target_kind": "register", "controls": "hal_tick_init", "lives_on": "unbound", "status": "unbound", "provenance": "annotation", "notes": ""}, {"name": "uno-sim-rig:usart_init", "solution": "uno-sim-rig", "task": "usart_init", "port": "", "target_kind": "register", "controls": "hal_usart_init \u2014 touches D1", "lives_on": "arduino-uno-r3:D1", "status": "bound", "provenance": "annotation", "notes": ""}];
  const UNREGISTERED_TASKS = [{"name": "uno-sim-rig:clock.return", "solution": "uno-sim-rig", "task": "clock", "port": "return", "target_kind": "memory-field", "controls": "SimRigState.uptime_ms <- milliseconds since hal_tick_init, from the Timer2 1 ms tick", "lives_on": "unbound", "status": "unbound", "provenance": "derived", "notes": ""}, {"name": "uno-sim-rig:temp.return", "solution": "uno-sim-rig", "task": "temp", "port": "return", "target_kind": "memory-field", "controls": "SimRigState.temp_c <- TMP36 temperature (or the raw count when TEMP_TMP36 is 0)", "lives_on": "unbound", "status": "unbound", "provenance": "derived", "notes": ""}, {"name": "uno-sim-rig:rx_pop", "solution": "uno-sim-rig", "task": "rx_pop", "port": "", "target_kind": "pin", "controls": "pop one byte from the USART0 RX ring the RX ISR fills", "lives_on": "unbound", "status": "unbound", "provenance": "annotation", "notes": ""}, {"name": "uno-sim-rig:led_init", "solution": "uno-sim-rig", "task": "led_init", "port": "", "target_kind": "register", "controls": "hal_led_init", "lives_on": "unbound", "status": "unbound", "provenance": "annotation", "notes": ""}, {"name": "uno-sim-rig:tick_init", "solution": "uno-sim-rig", "task": "tick_init", "port": "", "target_kind": "register", "controls": "hal_tick_init", "lives_on": "unbound", "status": "unbound", "provenance": "annotation", "notes": ""}];
  const REGISTERED_TASKS_BY_PIN = {"arduino-uno-r3:D6": [{"task": "apply", "port": "r", "status": "bound", "cooperating": true}, {"task": "pwm", "port": "duty", "status": "bound", "cooperating": true}, {"task": "pwm_init", "port": "", "status": "bound", "cooperating": true}], "arduino-uno-r3:A0": [{"task": "adc", "port": "channel", "status": "bound", "cooperating": true}, {"task": "adc_init", "port": "", "status": "bound", "cooperating": true}], "arduino-uno-r3:D13": [{"task": "led", "port": "on", "status": "bound", "cooperating": true}], "arduino-uno-r3:D1": [{"task": "send", "port": "b", "status": "bound", "cooperating": true}, {"task": "usart_init", "port": "", "status": "bound", "cooperating": true}]};

  // GET /api/firmware/solutions/uno-sim-rig/tasks/adc/valid-targets (real) — kind 'analog-in'; only A0-A5 (an ADCn
  // alternate function) verdict 'valid', every digital pin 'invalid' (no ADC alternate function, target_compat.py).
  const ADC_VALID_TARGETS_PINS = [{"pin": "A0", "verdict": "valid", "reason": "A0: has an ADC alternate function (ADC0) (datasheet fact atmega328p:pin.PC0)", "registered_to": ["adc_init"], "cooperating": true}, {"pin": "A1", "verdict": "valid", "reason": "A1: has an ADC alternate function (ADC1) (datasheet fact atmega328p:pin.PC1)", "registered_to": [], "cooperating": true}, {"pin": "A2", "verdict": "valid", "reason": "A2: has an ADC alternate function (ADC2) (datasheet fact atmega328p:pin.PC2)", "registered_to": [], "cooperating": true}, {"pin": "A3", "verdict": "valid", "reason": "A3: has an ADC alternate function (ADC3) (datasheet fact atmega328p:pin.PC3)", "registered_to": [], "cooperating": true}, {"pin": "A4", "verdict": "valid", "reason": "A4: has an ADC alternate function (ADC4) (datasheet fact atmega328p:pin.PC4)", "registered_to": [], "cooperating": true}, {"pin": "A5", "verdict": "valid", "reason": "A5: has an ADC alternate function (ADC5) (datasheet fact atmega328p:pin.PC5)", "registered_to": [], "cooperating": true}, {"pin": "D8", "verdict": "invalid", "reason": "D8: no ADC alternate function (ICP1/CLKO/PCINT0) (datasheet fact atmega328p:pin.PB0)", "registered_to": [], "cooperating": true}, {"pin": "D9", "verdict": "invalid", "reason": "D9: no ADC alternate function (OC1A/PCINT1) (datasheet fact atmega328p:pin.PB1)", "registered_to": [], "cooperating": true}, {"pin": "D10", "verdict": "invalid", "reason": "D10: no ADC alternate function (SS/OC1B/PCINT2) (datasheet fact atmega328p:pin.PB2)", "registered_to": [], "cooperating": true}, {"pin": "D11", "verdict": "invalid", "reason": "D11: no ADC alternate function (MOSI/OC2A/PCINT3) (datasheet fact atmega328p:pin.PB3)", "registered_to": [], "cooperating": true}, {"pin": "D12", "verdict": "invalid", "reason": "D12: no ADC alternate function (MISO/PCINT4) (datasheet fact atmega328p:pin.PB4)", "registered_to": [], "cooperating": true}, {"pin": "D13", "verdict": "invalid", "reason": "D13: no ADC alternate function (SCK/PCINT5) (datasheet fact atmega328p:pin.PB5)", "registered_to": ["led"], "cooperating": false}, {"pin": "D0", "verdict": "invalid", "reason": "D0: no ADC alternate function (RXD/PCINT16) (datasheet fact atmega328p:pin.PD0)", "registered_to": [], "cooperating": true}, {"pin": "D1", "verdict": "invalid", "reason": "D1: no ADC alternate function (TXD/PCINT17) (datasheet fact atmega328p:pin.PD1)", "registered_to": ["send", "usart_init"], "cooperating": true}, {"pin": "D2", "verdict": "invalid", "reason": "D2: no ADC alternate function (INT0/PCINT18) (datasheet fact atmega328p:pin.PD2)", "registered_to": [], "cooperating": true}, {"pin": "D3", "verdict": "invalid", "reason": "D3: no ADC alternate function (INT1/OC2B/PCINT19) (datasheet fact atmega328p:pin.PD3)", "registered_to": [], "cooperating": true}, {"pin": "D4", "verdict": "invalid", "reason": "D4: no ADC alternate function (XCK/T0/PCINT20) (datasheet fact atmega328p:pin.PD4)", "registered_to": [], "cooperating": true}, {"pin": "D5", "verdict": "invalid", "reason": "D5: no ADC alternate function (T1/OC0B/PCINT21) (datasheet fact atmega328p:pin.PD5)", "registered_to": [], "cooperating": true}, {"pin": "D6", "verdict": "invalid", "reason": "D6: no ADC alternate function (AIN0/OC0A/PCINT22) (datasheet fact atmega328p:pin.PD6)", "registered_to": ["apply", "pwm", "pwm_init"], "cooperating": false}, {"pin": "D7", "verdict": "invalid", "reason": "D7: no ADC alternate function (AIN1/PCINT23) (datasheet fact atmega328p:pin.PD7)", "registered_to": [], "cooperating": true}, {"pin": "GND", "verdict": "invalid", "reason": "GND is a ground pin \u2014 power/ground pins are never assignable to a firmware task (his ruling 2026-10-06)", "registered_to": [], "cooperating": true}, {"pin": "AREF", "verdict": "invalid", "reason": "AREF is a power pin \u2014 power/ground pins are never assignable to a firmware task (his ruling 2026-10-06)", "registered_to": [], "cooperating": true}, {"pin": "+5V", "verdict": "invalid", "reason": "+5V is a power pin \u2014 power/ground pins are never assignable to a firmware task (his ruling 2026-10-06)", "registered_to": [], "cooperating": true}, {"pin": "NC", "verdict": "invalid", "reason": "NC is a power pin \u2014 power/ground pins are never assignable to a firmware task (his ruling 2026-10-06)", "registered_to": [], "cooperating": true}, {"pin": "IOREF", "verdict": "invalid", "reason": "IOREF is a power pin \u2014 power/ground pins are never assignable to a firmware task (his ruling 2026-10-06)", "registered_to": [], "cooperating": true}, {"pin": "+3V3", "verdict": "invalid", "reason": "+3V3 is a power pin \u2014 power/ground pins are never assignable to a firmware task (his ruling 2026-10-06)", "registered_to": [], "cooperating": true}, {"pin": "VIN", "verdict": "invalid", "reason": "VIN is a power pin \u2014 power/ground pins are never assignable to a firmware task (his ruling 2026-10-06)", "registered_to": [], "cooperating": true}];

  // GET .../tasks/tick_init/valid-targets (real) — kind 'pwm-out' (NOT 'digital-out': tick_init's own requirement_kind
  // is derived from its annotation, not guessed); D3/D5/D6/D9/D10/D11 (Output Compare pins) verdict 'valid'.
  const TICK_INIT_VALID_TARGETS_PINS = [{"pin": "A0", "verdict": "invalid", "reason": "A0: no Output Compare function (ADC0/PCINT8) \u2014 not PWM-capable (datasheet fact atmega328p:pin.PC0)", "registered_to": ["adc", "adc_init"], "cooperating": true}, {"pin": "A1", "verdict": "invalid", "reason": "A1: no Output Compare function (ADC1/PCINT9) \u2014 not PWM-capable (datasheet fact atmega328p:pin.PC1)", "registered_to": [], "cooperating": true}, {"pin": "A2", "verdict": "invalid", "reason": "A2: no Output Compare function (ADC2/PCINT10) \u2014 not PWM-capable (datasheet fact atmega328p:pin.PC2)", "registered_to": [], "cooperating": true}, {"pin": "A3", "verdict": "invalid", "reason": "A3: no Output Compare function (ADC3/PCINT11) \u2014 not PWM-capable (datasheet fact atmega328p:pin.PC3)", "registered_to": [], "cooperating": true}, {"pin": "A4", "verdict": "invalid", "reason": "A4: no Output Compare function (ADC4/SDA/PCINT12) \u2014 not PWM-capable (datasheet fact atmega328p:pin.PC4)", "registered_to": [], "cooperating": true}, {"pin": "A5", "verdict": "invalid", "reason": "A5: no Output Compare function (ADC5/SCL/PCINT13) \u2014 not PWM-capable (datasheet fact atmega328p:pin.PC5)", "registered_to": [], "cooperating": true}, {"pin": "D8", "verdict": "invalid", "reason": "D8: no Output Compare function (ICP1/CLKO/PCINT0) \u2014 not PWM-capable (datasheet fact atmega328p:pin.PB0)", "registered_to": [], "cooperating": true}, {"pin": "D9", "verdict": "valid", "reason": "D9: has an Output Compare alternate function (OC1A, timer TIMER1) (datasheet fact atmega328p:pin.PB1)", "registered_to": [], "cooperating": true}, {"pin": "D10", "verdict": "valid", "reason": "D10: has an Output Compare alternate function (OC1B, timer TIMER1) (datasheet fact atmega328p:pin.PB2)", "registered_to": [], "cooperating": true}, {"pin": "D11", "verdict": "valid", "reason": "D11: has an Output Compare alternate function (OC2A, timer TIMER2) (datasheet fact atmega328p:pin.PB3)", "registered_to": [], "cooperating": true}, {"pin": "D12", "verdict": "invalid", "reason": "D12: no Output Compare function (MISO/PCINT4) \u2014 not PWM-capable (datasheet fact atmega328p:pin.PB4)", "registered_to": [], "cooperating": true}, {"pin": "D13", "verdict": "invalid", "reason": "D13: no Output Compare function (SCK/PCINT5) \u2014 not PWM-capable (datasheet fact atmega328p:pin.PB5)", "registered_to": ["led"], "cooperating": true}, {"pin": "D0", "verdict": "invalid", "reason": "D0: no Output Compare function (RXD/PCINT16) \u2014 not PWM-capable (datasheet fact atmega328p:pin.PD0)", "registered_to": [], "cooperating": true}, {"pin": "D1", "verdict": "invalid", "reason": "D1: no Output Compare function (TXD/PCINT17) \u2014 not PWM-capable (datasheet fact atmega328p:pin.PD1)", "registered_to": ["send", "usart_init"], "cooperating": true}, {"pin": "D2", "verdict": "invalid", "reason": "D2: no Output Compare function (INT0/PCINT18) \u2014 not PWM-capable (datasheet fact atmega328p:pin.PD2)", "registered_to": [], "cooperating": true}, {"pin": "D3", "verdict": "valid", "reason": "D3: has an Output Compare alternate function (OC2B, timer TIMER2) (datasheet fact atmega328p:pin.PD3)", "registered_to": [], "cooperating": true}, {"pin": "D4", "verdict": "invalid", "reason": "D4: no Output Compare function (XCK/T0/PCINT20) \u2014 not PWM-capable (datasheet fact atmega328p:pin.PD4)", "registered_to": [], "cooperating": true}, {"pin": "D5", "verdict": "valid", "reason": "D5: has an Output Compare alternate function (OC0B, timer TIMER0) (datasheet fact atmega328p:pin.PD5)", "registered_to": [], "cooperating": true}, {"pin": "D6", "verdict": "valid", "reason": "D6: has an Output Compare alternate function (OC0A, timer TIMER0) (datasheet fact atmega328p:pin.PD6)", "registered_to": ["apply", "pwm", "pwm_init"], "cooperating": true}, {"pin": "D7", "verdict": "invalid", "reason": "D7: no Output Compare function (AIN1/PCINT23) \u2014 not PWM-capable (datasheet fact atmega328p:pin.PD7)", "registered_to": [], "cooperating": true}, {"pin": "GND", "verdict": "invalid", "reason": "GND is a ground pin \u2014 power/ground pins are never assignable to a firmware task (his ruling 2026-10-06)", "registered_to": [], "cooperating": true}, {"pin": "AREF", "verdict": "invalid", "reason": "AREF is a power pin \u2014 power/ground pins are never assignable to a firmware task (his ruling 2026-10-06)", "registered_to": [], "cooperating": true}, {"pin": "+5V", "verdict": "invalid", "reason": "+5V is a power pin \u2014 power/ground pins are never assignable to a firmware task (his ruling 2026-10-06)", "registered_to": [], "cooperating": true}, {"pin": "NC", "verdict": "invalid", "reason": "NC is a power pin \u2014 power/ground pins are never assignable to a firmware task (his ruling 2026-10-06)", "registered_to": [], "cooperating": true}, {"pin": "IOREF", "verdict": "invalid", "reason": "IOREF is a power pin \u2014 power/ground pins are never assignable to a firmware task (his ruling 2026-10-06)", "registered_to": [], "cooperating": true}, {"pin": "+3V3", "verdict": "invalid", "reason": "+3V3 is a power pin \u2014 power/ground pins are never assignable to a firmware task (his ruling 2026-10-06)", "registered_to": [], "cooperating": true}, {"pin": "VIN", "verdict": "invalid", "reason": "VIN is a power pin \u2014 power/ground pins are never assignable to a firmware task (his ruling 2026-10-06)", "registered_to": [], "cooperating": true}];

  // GET /api/board/arduino-uno-r3/pins/D13 (real) — fs-2a's pin-detail door.
  const PIN_DETAIL_D13 = {"ok": true, "board": "arduino-uno-r3", "pin": "D13", "roles": ["led"], "soc_pin": "PB5", "register": {"port": "B", "bit": 5, "package_pin": "19", "default_function": "GPIO", "fact": "atmega328p:pin.PB5"}, "alternate_functions": [{"function": "SCK", "peripheral": "SPI", "signal": "SCK", "kind": "SPI signal", "fact": "atmega328p:pin.PB5"}, {"function": "PCINT5", "peripheral": "PCINT", "signal": "PCINT5", "kind": "pin-change interrupt", "fact": "atmega328p:pin.PB5"}], "current_assignment": {"function": "led", "peripheral": "", "signal": "", "firmware_symbol": "LED_PIN"}, "electrical": {"fact": "arduino-uno-r3:pinout.max_current_io", "max_ma": 20}, "net": "LED_BUILTIN", "connector": "DIGITAL_H", "connector_number": 6, "facts": ["arduino-uno-r3:pinout.D13", "atmega328p:pin.PB5"], "registered_tasks": [{"task": "led", "port": "on", "solution": "uno-sim-rig", "lane": "called", "status": "bound", "cooperating": true}], "unregistered": false};

  // GET /api/board/target-compat (real) — board.custom.target_compat.rows(), global + cited.
  const TARGET_COMPAT_ROWS = [{"name": "analog-in", "kind": "analog-in", "title": "Analog input (ADC)", "roles": "adc", "description": "reads a continuously-varying voltage on one of the SoC's ADC channels", "matches": "pins with an ADCn alternate function (the UNO: A0-A5)", "source_label": "Arduino UNO R3 docs \u2014 Analog In pins", "source_url": "https://docs.arduino.cc/hardware/uno-rev3/", "notes": ""}, {"name": "pwm-out", "kind": "pwm-out", "title": "PWM output", "roles": "pwm", "description": "drives a timer's Output Compare pin to fake an analog output", "matches": "pins with a timer Output Compare alternate function (the UNO: D3, D5, D6, D9, D10, D11)", "source_label": "Arduino UNO R3 docs \u2014 PWM (~) pins", "source_url": "https://docs.arduino.cc/hardware/uno-rev3/", "notes": ""}, {"name": "uart-rx", "kind": "uart-rx", "title": "UART receive", "roles": "uart", "description": "receives a byte stream on USART0's RXD signal", "matches": "the pin with USART0's RXD alternate function (the UNO: D0)", "source_label": "Arduino UNO R3 docs \u2014 RX/TX (D0/D1) pins", "source_url": "https://docs.arduino.cc/hardware/uno-rev3/", "notes": ""}, {"name": "uart-tx", "kind": "uart-tx", "title": "UART transmit", "roles": "uart", "description": "sends a byte stream on USART0's TXD signal", "matches": "the pin with USART0's TXD alternate function (the UNO: D1)", "source_label": "Arduino UNO R3 docs \u2014 RX/TX (D0/D1) pins", "source_url": "https://docs.arduino.cc/hardware/uno-rev3/", "notes": ""}, {"name": "i2c-sda", "kind": "i2c-sda", "title": "I2C data (SDA)", "roles": "i2c", "description": "the 2-wire TWI bus's data line", "matches": "the pin with the TWI SDA alternate function (the UNO: A4)", "source_label": "Arduino UNO R3 docs \u2014 SDA/SCL pins", "source_url": "https://docs.arduino.cc/hardware/uno-rev3/", "notes": ""}, {"name": "i2c-scl", "kind": "i2c-scl", "title": "I2C clock (SCL)", "roles": "i2c", "description": "the 2-wire TWI bus's clock line", "matches": "the pin with the TWI SCL alternate function (the UNO: A5)", "source_label": "Arduino UNO R3 docs \u2014 SDA/SCL pins", "source_url": "https://docs.arduino.cc/hardware/uno-rev3/", "notes": ""}, {"name": "spi-mosi", "kind": "spi-mosi", "title": "SPI MOSI/COPI", "roles": "spi", "description": "the controller-out-peripheral-in line of the SPI bus", "matches": "the pin with the SPI MOSI alternate function (the UNO: D11 / ICSP COPI)", "source_label": "Arduino UNO R3 docs \u2014 ICSP header", "source_url": "https://docs.arduino.cc/hardware/uno-rev3/", "notes": ""}, {"name": "spi-miso", "kind": "spi-miso", "title": "SPI MISO/CIPO", "roles": "spi", "description": "the controller-in-peripheral-out line of the SPI bus", "matches": "the pin with the SPI MISO alternate function (the UNO: D12 / ICSP CIPO)", "source_label": "Arduino UNO R3 docs \u2014 ICSP header", "source_url": "https://docs.arduino.cc/hardware/uno-rev3/", "notes": ""}, {"name": "spi-sck", "kind": "spi-sck", "title": "SPI clock (SCK)", "roles": "spi", "description": "the SPI bus's clock line", "matches": "the pin with the SPI SCK alternate function (the UNO: D13 / ICSP SCK)", "source_label": "Arduino UNO R3 docs \u2014 ICSP header", "source_url": "https://docs.arduino.cc/hardware/uno-rev3/", "notes": ""}, {"name": "spi-ss", "kind": "spi-ss", "title": "SPI slave-select (SS)", "roles": "spi", "description": "the SPI bus's per-device select line", "matches": "the pin with the SPI SS alternate function (the UNO: D10)", "source_label": "Arduino UNO R3 docs \u2014 ICSP header", "source_url": "https://docs.arduino.cc/hardware/uno-rev3/", "notes": ""}, {"name": "digital-in", "kind": "digital-in", "title": "Digital input", "roles": "gpio", "description": "reads a plain 0/1 logic level", "matches": "any non-power/ground I/O pin (every SoC pin can be a plain GPIO input)", "source_label": "Arduino UNO R3 docs \u2014 Digital pins", "source_url": "https://docs.arduino.cc/hardware/uno-rev3/", "notes": ""}, {"name": "digital-out", "kind": "digital-out", "title": "Digital output", "roles": "gpio", "description": "drives a plain 0/1 logic level", "matches": "any non-power/ground I/O pin (every SoC pin can be a plain GPIO output)", "source_label": "Arduino UNO R3 docs \u2014 Digital pins", "source_url": "https://docs.arduino.cc/hardware/uno-rev3/", "notes": ""}, {"name": "interrupt-in", "kind": "interrupt-in", "title": "Interrupt input", "roles": "gpio", "description": "wakes firmware on an edge \u2014 a dedicated external interrupt (INT0/INT1) or a pin-change interrupt (PCINTn)", "matches": "INT0/INT1 pins are valid; a PCINTn-only pin is undetermined (its PCICR/PCMSKn bank is not modeled yet)", "source_label": "Arduino UNO R3 docs \u2014 Digital pins", "source_url": "https://docs.arduino.cc/hardware/uno-rev3/", "notes": "External Interrupts (INT0/INT1) and Pin Change Interrupt (PCINT0..23) chapters \u2014 exact page not reconfirmed this session; see each pin's own SocPin fact for its specific alternate function citation"}, {"name": "power", "kind": "power", "title": "Power", "roles": "power", "description": "a supply pin \u2014 never a firmware task's target", "matches": "(never \u2014 power/ground pins are not assignable to any task)", "source_label": "Arduino UNO R3 docs \u2014 Power pins", "source_url": "https://docs.arduino.cc/hardware/uno-rev3/", "notes": ""}, {"name": "ground", "kind": "ground", "title": "Ground", "roles": "ground", "description": "the 0 V reference \u2014 never a firmware task's target", "matches": "(never \u2014 power/ground pins are not assignable to any task)", "source_label": "Arduino UNO R3 docs \u2014 Power pins (GND)", "source_url": "https://docs.arduino.cc/hardware/uno-rev3/", "notes": ""}];

  // GET /api/board/arduino-uno-r3/pinmap.svg (real, trimmed to the D13/A0/D6/D9 `<g data-pin>` cells).
  const PINMAP_SVG = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 926 322\" width=\"926\" height=\"322\" font-family=\"monospace\" font-size=\"11\"><g class=\"pin-cell\" data-pin=\"D13\" data-role=\"led\"><title>LED_PIN: net=LED_BUILTIN</title><rect x=\"202\" y=\"176\" width=\"170\" height=\"26\" fill=\"#f9a825\" fill-opacity=\"0.16\" stroke=\"#f9a825\" data-pin=\"D13\"/><text x=\"208\" y=\"187\" font-weight=\"bold\">D13</text><text x=\"208\" y=\"198\" font-size=\"9\" fill=\"#37474f\">PB5 / LED_BUILTIN</text></g><g class=\"pin-cell\" data-pin=\"A0\" data-role=\"adc\"><title>ADC_CHANNEL: net=TEMP_SENSE</title><rect x=\"16\" y=\"46\" width=\"170\" height=\"26\" fill=\"#1565c0\" fill-opacity=\"0.16\" stroke=\"#1565c0\" data-pin=\"A0\"/><text x=\"22\" y=\"57\" font-weight=\"bold\">A0</text><text x=\"22\" y=\"68\" font-size=\"9\" fill=\"#37474f\">PC0 / TEMP_SENSE</text></g><g class=\"pin-cell\" data-pin=\"D6\" data-role=\"pwm\"><title>PWM_PIN: net=PWM_LED</title><rect x=\"388\" y=\"202\" width=\"170\" height=\"26\" fill=\"#e65100\" fill-opacity=\"0.16\" stroke=\"#e65100\" data-pin=\"D6\"/><text x=\"394\" y=\"213\" font-weight=\"bold\">D6</text><text x=\"394\" y=\"224\" font-size=\"9\" fill=\"#37474f\">PD6 / PWM_LED</text></g><g class=\"pin-cell\" data-pin=\"D9\" data-role=\"gpio\"><title>net=D9</title><rect x=\"202\" y=\"72\" width=\"170\" height=\"26\" fill=\"#78909c\" fill-opacity=\"0.16\" stroke=\"#78909c\" data-pin=\"D9\"/><text x=\"208\" y=\"83\" font-weight=\"bold\">D9</text><text x=\"208\" y=\"94\" font-size=\"9\" fill=\"#37474f\">PB1 / D9</text></g></svg>";

  function httpGet(url: string): any {
    if (url.endsWith('/pinmap.svg')) { return of(PINMAP_SVG); }
    if (url.endsWith('/api/firmware/solutions')) { return of({ ok: true, solutions: [{ name: 'uno-sim-rig', title: 'UNO sim-rig firmware' }] }); }
    if (url.endsWith('/api/firmware/solutions/uno-sim-rig')) {
      return of({
        ok: true, solution: SOLUTION, schedule: SCHEDULE, assignments: ASSIGNMENTS,
        unregistered_tasks: UNREGISTERED_TASKS, registered_tasks: REGISTERED_TASKS_BY_PIN,
        validation: { ok: true, why: SOLUTION.validation_why } as any, builds: [],
      });
    }
    if (url.endsWith('/tasks/adc/valid-targets')) { return of({ ok: true, solution: 'uno-sim-rig', task: 'adc', kind: 'analog-in', pins: ADC_VALID_TARGETS_PINS }); }
    if (url.endsWith('/tasks/tick_init/valid-targets')) { return of({ ok: true, solution: 'uno-sim-rig', task: 'tick_init', kind: 'pwm-out', pins: TICK_INIT_VALID_TARGETS_PINS }); }
    if (url.endsWith('/pins/D13')) { return of(PIN_DETAIL_D13); }
    if (url.endsWith('/api/board/target-compat')) { return of({ ok: true, rows: TARGET_COMPAT_ROWS }); }
    return of({ ok: false, error: 'unexpected GET ' + url });
  }

  beforeEach(async () => {
    try { localStorage.removeItem(LAYOUT_KEY); } catch { /* ignore */ }
    posts = [];
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
  // 'adc' is already BOUND (to A0) in the real fixture — valid-targets works on any task, registered or not;
  // 'tick_init' IS one of the real Unregistered Tasks. Both are looked up off the full real `assignments` list.
  const chipByTask = (task: string) => component.assignments.find(a => a.task === task)!;

  describe('section/preset layout (fs-2b item 1)', () => {
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

    it('"Two" opens exactly the chosen pair, side by side', () => {
      fixture.detectChanges();
      component.showTwo('tasks', 'detail');
      expect(component.openKeys.sort()).toEqual(['detail', 'tasks']);
    });

    it('a fresh instance reloads the persisted layout from localStorage', () => {
      fixture.detectChanges();
      component.showTwo('pins', 'detail');
      const fixture2 = TestBed.createComponent(FirmwareSolutionPanelComponent);
      const component2 = fixture2.componentInstance;
      fixture2.detectChanges();
      expect(component2.openKeys.sort()).toEqual(['detail', 'pins']);
    });

    it('"All four" reopens every section', () => {
      fixture.detectChanges();
      component.showOne('schedule');
      component.showAll();
      expect(component.openKeys).toEqual(['tasks', 'schedule', 'pins', 'detail']);
    });

    it('renders the "Unregistered Tasks (N)" header and the renamed labels', () => {
      fixture.detectChanges();
      const text = (fixture.nativeElement as HTMLElement).textContent || '';
      expect(text).toContain(`Unregistered Tasks (${UNREGISTERED_TASKS.length})`);
      expect(text).toContain('Pin map');
      expect(text).toContain('Target details');
    });
  });

  describe('valid-targets overlay (fs-2b item 3)', () => {
    it('selecting the ADC task marks exactly A0-A5 valid', () => {
      fixture.detectChanges();
      const adc = chipByTask('adc');
      component.selectTask(adc);
      expect(component.taskValidity?.kind).toBe('analog-in');
      const valid = (component.taskValidity?.pins || []).filter(p => p.verdict === 'valid').map(p => p.pin).sort();
      expect(valid).toEqual(["A0", "A1", "A2", "A3", "A4", "A5"]);
    });

    it('colours valid pins green and invalid pins grey on the map, with the reason on the title', () => {
      fixture.detectChanges();
      component.selectTask(chipByTask('adc'));
      const d13 = pinEl('D13') as HTMLElement;
      expect(d13.getAttribute('data-verdict')).toBe('invalid'); // grey, per the legend
      expect(pinEl('A0').getAttribute('data-verdict')).toBe('valid'); // green
      const title = d13.querySelector('title')!.textContent || '';
      expect(title).toContain('no ADC alternate function');
    });

    it('a drop on a greyed (invalid) pin never POSTs — the reason appears inline', () => {
      fixture.detectChanges();
      const adc = chipByTask('adc');
      component.onDragStart({ dataTransfer: { setData: () => {} } } as any, adc);
      component.onDrop({ preventDefault: () => {}, target: pinEl('D13') } as any);
      expect(posts.length).toBe(0);
      expect(component.assignError).toContain('no ADC alternate function');
    });

    it('a drop on a VALID pin posts the exact assign body fs-0\'s door expects', () => {
      fixture.detectChanges();
      const adc = chipByTask('adc');
      component.onDragStart({ dataTransfer: { setData: () => {} } } as any, adc);
      component.onDrop({ preventDefault: () => {}, target: pinEl('A0') } as any);
      expect(posts.length).toBe(1);
      expect(posts[0].url).toBe('/api/firmware/solutions/uno-sim-rig/assign');
      expect(posts[0].body).toEqual({ task: 'adc', port: 'channel', lives_on: 'arduino-uno-r3:A0' });
    });

    it('selecting tick_init (kind pwm-out) marks the Output Compare pins valid, including D9', () => {
      fixture.detectChanges();
      component.selectTask(chipByTask('tick_init'));
      expect(component.taskValidity?.kind).toBe('pwm-out');
      const valid = (component.taskValidity?.pins || []).filter(p => p.verdict === 'valid').map(p => p.pin).sort();
      expect(valid).toEqual(["D10", "D11", "D3", "D5", "D6", "D9"]);
    });

    it('a 422 the backend still returns shows ITS reason (the door is never re-implemented client-side)', () => {
      fixture.detectChanges();
      postResponse = () => throwError(() => ({ status: 422, error: { ok: false, refused: true, error: 'pin arduino-uno-r3:D9 is already registered to rx_pop (not cooperating) \u2014 conflict', task: 'tick_init', lives_on: 'arduino-uno-r3:D9' } }));
      const tick = chipByTask('tick_init');
      component.onDragStart({ dataTransfer: { setData: () => {} } } as any, tick);
      component.onDrop({ preventDefault: () => {}, target: pinEl('D9') } as any);
      expect(posts.length).toBe(1); // D9 was VALID per the door \u2014 only the backend refused it (stale/raced state)
      expect(component.assignError).toContain('already registered to rx_pop');
    });
  });

  describe('pin detail (fs-2b item 4)', () => {
    it('clicking D13 renders its register detail and Registered Tasks', () => {
      fixture.detectChanges();
      component.onPinClick({ target: pinEl('D13') } as any);
      expect(component.detailMode).toBe('pin');
      expect(component.pinDetail?.soc_pin).toBe('PB5');
      expect(component.pinDetail?.register).toEqual({"port": "B", "bit": 5, "package_pin": "19", "default_function": "GPIO", "fact": "atmega328p:pin.PB5"});
      expect(component.registerNames(component.pinDetail!)).toBe('DDRB / PORTB / PINB');
      expect(component.pinDetail?.registered_tasks.map(r => r.task).sort()).toEqual(["led"]);
      fixture.detectChanges();
      const text = (fixture.nativeElement as HTMLElement).textContent || '';
      expect(text).toContain('led');
    });

    it('filters the globally-cited compatibility rows to the ones this pin\'s own alternate functions support', () => {
      fixture.detectChanges();
      component.onPinClick({ target: pinEl('D13') } as any);
      const kinds = component.compatRowsForSelectedPin.map(r => r.kind).sort();
      expect(kinds).toEqual(['digital-in', 'digital-out', 'interrupt-in', 'spi-sck']);
      expect(kinds).not.toContain('analog-in'); // D13/PB5 has no ADC alternate function
    });

    it('the pin highlights on the map (a selection ring, independent of any valid-targets overlay)', () => {
      fixture.detectChanges();
      component.onPinClick({ target: pinEl('D13') } as any);
      expect((pinEl('D13') as HTMLElement).style.filter).toContain('drop-shadow');
    });
  });

  describe('keyboard (fs-2b item 5)', () => {
    it('Escape clears both the selected task and the selected pin', () => {
      fixture.detectChanges();
      component.selectTask(chipByTask('adc'));
      component.onPinKeydown({ key: 'Escape' } as any);
      expect(component.selectedTask).toBeNull();
      expect(component.detailMode).toBe('none');
    });

    it('selection survives a collapse/expand round trip', () => {
      fixture.detectChanges();
      component.selectTask(chipByTask('adc'));
      component.showOne('schedule');
      component.showAll();
      expect(component.selectedTask?.task).toBe('adc');
      expect(component.taskValidity?.kind).toBe('analog-in');
    });
  });
});
