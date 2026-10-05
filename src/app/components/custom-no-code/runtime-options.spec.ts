/**
 * selfix 2026-10-05 (demo-4b) — his steer: "the runtime dropdown still did not have hardware/c as
 * an option." custom-no-code.html's "New state runtime" <select> renders one <option> per entry
 * of `runtimeOptions` (component field), which defaults to RUNTIME_OPTIONS_FALLBACK and is
 * overwritten by a live GET /Runtime only on success — so this fallback IS what renders whenever
 * the API is unreachable, and defines the full vocabulary otherwise. A full mount of
 * CustomNoCodeComponent (huge dependency graph: MatDialog, a dozen services) isn't needed to
 * pin this — the constant IS the <select>'s option list, one entry per <option>.
 */
import { RUNTIME_OPTIONS_FALLBACK, RUNTIME_DISPLAY_LABELS } from './custom-no-code';

describe('custom-no-code — hardware-lane Runtime options (demo-4b)', () => {
  it('has exactly the 6 seeded Runtime rows, including "C (Hardware)"', () => {
    expect(RUNTIME_OPTIONS_FALLBACK.length).toBe(6);
    const labels = RUNTIME_OPTIONS_FALLBACK.map(r => r.label);
    expect(labels).toContain('C (Hardware)');
    const values = RUNTIME_OPTIONS_FALLBACK.map(r => r.value).sort();
    expect(values).toEqual(['c-device', 'c-twin', 'java-bridge', 'javafx-native', 'python-backend', 'typescript-browser']);
  });

  it('defaults to python-backend being present and labelled plainly', () => {
    const pythonBackend = RUNTIME_OPTIONS_FALLBACK.find(r => r.value === 'python-backend');
    expect(pythonBackend?.label).toBe('Python (Backend)');
  });

  it('every fallback option\'s label comes from RUNTIME_DISPLAY_LABELS (single source of truth)', () => {
    RUNTIME_OPTIONS_FALLBACK.forEach(r => expect(r.label).toBe(RUNTIME_DISPLAY_LABELS[r.value]));
  });
});
