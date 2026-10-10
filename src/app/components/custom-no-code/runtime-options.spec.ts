/**
 * selfix 2026-10-05 (demo-4b) — his steer: "the runtime dropdown still did not have hardware/c as
 * an option." custom-no-code.html's "New state runtime" <select> renders one <option> per entry
 * of `runtimeOptions` (component field), which defaults to RUNTIME_OPTIONS_FALLBACK and is
 * overwritten by a live GET /Runtime only on success — so this fallback IS what renders whenever
 * the API is unreachable, and defines the full vocabulary otherwise. A full mount of
 * CustomNoCodeComponent (huge dependency graph: MatDialog, a dozen services) isn't needed to
 * pin this — the constant IS the <select>'s option list, one entry per <option>.
 */
import {
  RUNTIME_OPTIONS_FALLBACK, RUNTIME_DISPLAY_LABELS, RUNTIME_TO_LEGACY_TARGET, LEGACY_TARGET_TO_RUNTIME,
  commandGroupForRuntime, deriveRuntimeForSolution,
} from './custom-no-code';

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

/**
 * selfix round 3 (2026-10-05) — the toolbar's two Runtime selects (legacy solution-level code-gen
 * target, python_backend/typescript_frontend; and the new hardware-lane picker) are now ONE
 * select, fed by the 6 Runtime rows. onRuntimeSelectChange() (custom-no-code.ts) maps the two
 * legacy-equivalent values through onRuntimeChange() so the old select's filter/run-target
 * behavior keeps working; the other four have no legacy equivalent. A full mount of
 * CustomNoCodeComponent isn't needed to pin the mapping itself — RUNTIME_TO_LEGACY_TARGET /
 * LEGACY_TARGET_TO_RUNTIME ARE what onRuntimeSelectChange() and the loaded-solution sync consult.
 */
describe('custom-no-code — ONE merged Runtime select: legacy TargetRuntime mapping', () => {
  it('maps exactly python-backend/typescript-browser to the legacy python_backend/typescript_frontend values', () => {
    expect(RUNTIME_TO_LEGACY_TARGET).toEqual({
      'python-backend': 'python_backend',
      'typescript-browser': 'typescript_frontend',
    });
  });

  it('the four hardware-lane-only values have NO legacy equivalent (no filter/run-target side effect)', () => {
    ['c-device', 'c-twin', 'java-bridge', 'javafx-native'].forEach(v => {
      expect(RUNTIME_TO_LEGACY_TARGET[v]).toBeUndefined();
    });
  });

  it('is invertible both ways (round-trips through both maps)', () => {
    Object.entries(RUNTIME_TO_LEGACY_TARGET).forEach(([runtime, legacy]) => {
      expect(LEGACY_TARGET_TO_RUNTIME[legacy]).toBe(runtime);
    });
  });
});

/**
 * ucd-hdr (his ruling 2026-10-10) — the header's runtime-scoped command group: ONE declarative
 * table (RUNTIME_COMMAND_GROUPS), looked up by commandGroupForRuntime(), decides which pieces of
 * the toolbar show. Exported standalone (same reasoning as RUNTIME_OPTIONS_FALLBACK above) so this
 * specs without mounting CustomNoCodeComponent.
 */
describe('custom-no-code — commandGroupFor (runtime-scoped command group)', () => {
  it('c-device shows the C command group', () => {
    expect(commandGroupForRuntime('c-device')).toEqual({ cCommands: true });
  });

  it('typescript-browser hides the C command group (nothing of C\'s)', () => {
    expect(commandGroupForRuntime('typescript-browser')).toEqual({ cCommands: false });
  });

  it('python-backend and java-bridge also hide the C command group', () => {
    expect(commandGroupForRuntime('python-backend')).toEqual({ cCommands: false });
    expect(commandGroupForRuntime('java-bridge')).toEqual({ cCommands: false });
  });

  it('an unknown runtime degrades to no command group, never throws', () => {
    expect(commandGroupForRuntime('not-a-real-runtime')).toEqual({ cCommands: false });
  });
});

/**
 * ucd-hdr requirement 2 — the Runtime select is DERIVED from the loaded Object/Solution's own
 * payload, never guessed from a name: a CGraph (`graph` input) is c-device by construction; a
 * solution whose states all agree on one tagged runtime takes that; otherwise the solution's own
 * legacy targetRuntime; otherwise null (caller keeps the current default and shows "(default)").
 */
describe('custom-no-code — deriveRuntimeForSolution (the Runtime select derivation)', () => {
  it('a CGraph always derives c-device, even before any state is tagged', () => {
    expect(deriveRuntimeForSolution('uno-sim-rig-graph', null, [])).toBe('c-device');
  });

  it('a CGraph wins even over states that would otherwise tag a different runtime', () => {
    expect(deriveRuntimeForSolution('uno-sim-rig-graph', { targetRuntime: 'python_backend' }, [{ runtime: 'typescript-browser' }]))
      .toBe('c-device');
  });

  it('no graph: every state agreeing on ONE tagged runtime derives that runtime', () => {
    expect(deriveRuntimeForSolution('', null, [{ runtime: 'java-bridge' }, { runtime: 'java-bridge' }])).toBe('java-bridge');
  });

  it('no graph, states disagree: falls through to the legacy targetRuntime', () => {
    expect(deriveRuntimeForSolution('', { targetRuntime: 'typescript_frontend' }, [{ runtime: 'java-bridge' }, { runtime: 'c-device' }]))
      .toBe('typescript-browser');
  });

  it('no graph, no tagged states, legacy targetRuntime present: derives from it', () => {
    expect(deriveRuntimeForSolution('', { targetRuntime: 'python_backend' }, [])).toBe('python-backend');
  });

  it('nothing says which runtime: returns null (the caller keeps the current default)', () => {
    expect(deriveRuntimeForSolution('', {}, [])).toBeNull();
    expect(deriveRuntimeForSolution('', null, [{ runtime: undefined }])).toBeNull();
  });

  it('an untagged/unknown state runtime value is ignored, not treated as agreement', () => {
    expect(deriveRuntimeForSolution('', {}, [{ runtime: 'not-a-real-runtime' }])).toBeNull();
  });
});
