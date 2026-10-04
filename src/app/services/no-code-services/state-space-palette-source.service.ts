// polari-platform-angular/src/app/services/no-code-services/state-space-palette-source.service.ts
//
// hn-0 (HARDWARE_NOCODE_PLAN.md D-hn-2 ruled: ONE canvas, new node kinds, the palette DATA-DRIVEN from the live endpoint).
//
// The canvas palette (state-tool-sidebar) reads the StateSpaceClassRegistry. The registry's built-in kinds stay STATIC
// (this service never touches them); what this service adds is every class GET /stateSpaceClasses returns WITH a
// `palette` block (a backend class's `statePalette`: display name, category, icon, colour, node kind, overlay, placement,
// slots, variables) that the registry does not already know. So the hardware node kinds — c-atom, hw-interface,
// hardware-subgraph — reach the palette as data, and a future kind needs a backend row/class, not a TS edit.
//
// Failure is quiet and honest: no backend / a 5xx → nothing is added and the static palette works as before.

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import {
  StateSpaceClassMetadata,
  StateSpaceClassRegistry,
  StateSpaceCategory,
} from '../../components/custom-no-code/states/_shared/state-space-class-registry';
import { PolariService } from '../polari-service';

/** One `palette` block as the backend sends it (polyTypedObject.getStateSpaceConfig → statePalette). */
export interface LivePalette {
  nodeKind?: string;
  displayName?: string;
  category?: string;
  icon?: string;
  color?: string;
  description?: string;
  placement?: string;
  language?: string;
  overlay?: string;
  displayFields?: string[];
  variables?: { name: string; displayName?: string; type?: string; defaultValue?: any }[];
  slots?: { inputs?: number; outputs?: number; inputLabels?: string[]; outputLabels?: string[] };
}

/** One entry of GET /stateSpaceClasses. */
export interface LiveStateSpaceConfig {
  className: string;
  isStateSpaceObject?: boolean;
  displayFields?: string[];
  fieldsPerRow?: number;
  variables?: string[];
  palette?: LivePalette | null;
}

const KNOWN_CATEGORIES: StateSpaceCategory[] = [
  'Initial States', 'Conditionals', 'Loops', 'List Operations', 'Math', 'Physics/Chemistry', 'Events',
  'Variables & Calls', 'End States', 'Flow Control', 'Debug', 'Frontend', 'Cross-Runtime', 'Hardware', 'Custom',
];

/**
 * A live config → registry metadata, or null when it carries no palette (classes without one are not palette
 * entries — a /createClass dynamic class keeps its own path). Pure: unit-testable without HTTP.
 */
export function metadataFromLiveConfig(cfg: LiveStateSpaceConfig): StateSpaceClassMetadata | null {
  const p = cfg?.palette;
  if (!cfg?.className || !p || typeof p !== 'object') {
    return null;
  }
  const category = (KNOWN_CATEGORIES as string[]).includes(p.category || '')
    ? (p.category as StateSpaceCategory) : 'Custom';
  const variables = (p.variables || []).map(v => ({
    name: v.name,
    displayName: v.displayName || v.name,
    type: v.type || 'string',
    isEditable: true,
    defaultValue: v.defaultValue ?? '',
  }));
  const inputs = Math.max(0, p.slots?.inputs ?? 1);
  const outputs = Math.max(0, p.slots?.outputs ?? 1);
  const className = cfg.className;
  return {
    className,
    displayName: p.displayName || className,
    description: p.description || '',
    category,
    icon: p.icon || 'extension',
    color: p.color || '#757575',
    isStateSpaceObject: true,
    stateSpaceDisplayFields: p.displayFields || cfg.displayFields || variables.map(v => v.name),
    stateSpaceFieldsPerRow: 1,
    isBuiltIn: false,
    supportedRuntimes: ['python_backend'],
    slotConfiguration: {
      defaultInputCount: inputs,
      defaultOutputCount: outputs,
      allowDynamicInputs: false,
      allowDynamicOutputs: false,
      maxInputSlots: inputs,
      maxOutputSlots: outputs,
      inputLabels: p.slots?.inputLabels,
      outputLabels: p.slots?.outputLabels,
    },
    eventMethods: [],
    variables,
    // A new node starts as its variables' defaults — a plain field bag, the same shape boundObjectFieldValues holds.
    factory: () => variables.reduce((acc, v) => { acc[v.name] = v.defaultValue; return acc; },
                                    { type: className } as { [k: string]: any }),
    // Honest in the ENGINE's terms: the engine never runs a hardware kind (hn-split compiles it for where it is placed).
    executionStatus: 'authoring-only',
    executionNote: `${p.nodeKind || 'node'} — compiled by hn-split, runs on ${p.placement || '?'} (${p.language || '?'}), `
      + 'never in the solution engine; the placement rule decides where',
    runtimeCapability: 'authoring-only',
    source: 'live',
    nodeKind: p.nodeKind,
    overlayKind: p.overlay,
    placement: p.placement,
    language: p.language,
  };
}

@Injectable({ providedIn: 'root' })
export class StateSpacePaletteSourceService {
  private registry = StateSpaceClassRegistry.getInstance();

  constructor(private http: HttpClient, private polariService: PolariService) {}

  /**
   * Fetch the live state-space classes and register the palette entries the registry lacks.
   * Emits the class names ADDED (empty on failure or when everything was already known).
   */
  load(): Observable<string[]> {
    const url = `${this.polariService.getBackendBaseUrl()}/stateSpaceClasses`;
    return this.http.get<{ success?: boolean; stateSpaceClasses?: LiveStateSpaceConfig[] }>(
      url, { headers: (this.polariService.backendRequestOptions as any)?.headers }).pipe(
      map(resp => this.register(resp?.stateSpaceClasses || [])),
      catchError(() => of([] as string[])),
    );
  }

  /** Register what carries a palette and is not already known — the static entries always win. */
  register(configs: LiveStateSpaceConfig[]): string[] {
    const added: string[] = [];
    for (const cfg of configs) {
      if (!cfg?.className || this.registry.getClass(cfg.className)) {
        continue;
      }
      const meta = metadataFromLiveConfig(cfg);
      if (meta) {
        this.registry.registerClass(meta);
        added.push(cfg.className);
      }
    }
    return added;
  }
}
