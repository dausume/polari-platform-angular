// Author: Dustin Etts
// Inline overlay for SimStepNextState terminator.
//
// Renders the target *SimState class + the `outputMappings` table so a
// step solution's commit-row payload is visible at a glance. Each row
// pairs an output field name with a ValueSourceConfig the
// SimulationRunner reads when projecting the new row.
//
// No service integration — class name is a plain text input for now.
// When the binding → state-class refactor lands, this will become a
// dropdown of the simulation's participating *SimState classes.

import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { StateOverlayBase } from '../../../_shared/state-overlay/state-overlay-base';
import {
  ValueSourceConfig,
  createDefaultValueSourceConfig,
  getSourceLabel,
} from '@models/stateSpace';
import {
  AvailableInput,
  SourceObjectField,
} from '../../../../shared/value-source-selector/value-source-selector.component';
import { SimStepNextStateMapping } from '../sim-step-next-state.model';

@Component({
  standalone: false,
  selector: 'sim-step-next-state-overlay',
  templateUrl: './sim-step-next-state-overlay.component.html',
  styleUrls: ['./sim-step-next-state-overlay.component.css'],
})
export class SimStepNextStateOverlayComponent extends StateOverlayBase implements OnInit {

  @Input() boundClassName: string = 'SimStepNextState';
  @Input() boundObjectFieldValues: { [key: string]: any } | null = null;
  @Input() availableInputs: AvailableInput[] = [];
  @Input() sourceObjectFields: SourceObjectField[] = [];

  @Output() fieldValuesChanged = new EventEmitter<{ [key: string]: any }>();

  override hasPopupView: boolean = false;

  simStateClassName: string = '';
  mappings: SimStepNextStateMapping[] = [];

  override ngOnInit(): void {
    super.ngOnInit();
    this.hydrateFromBoundValues();
  }

  private hydrateFromBoundValues(): void {
    const bofv = this.boundObjectFieldValues || {};
    this.simStateClassName = (bofv['simStateClassName'] as string) || '';
    const raw = bofv['outputMappings'];
    this.mappings = Array.isArray(raw) ? raw.map(m => this.normalizeMapping(m)) : [];
  }

  private normalizeMapping(m: any): SimStepNextStateMapping {
    return {
      outputFieldName: (m?.outputFieldName as string) || '',
      valueSource: (m?.valueSource as ValueSourceConfig)
        || createDefaultValueSourceConfig('from_source_object'),
    };
  }

  /** Non-null view of a mapping's valueSource for template binding into
   *  value-source-selector, whose `config` input is non-nullable. */
  valueSourceFor(mapping: SimStepNextStateMapping): ValueSourceConfig {
    return mapping.valueSource || createDefaultValueSourceConfig('from_source_object');
  }

  onClassNameChange(value: string): void {
    this.simStateClassName = value;
    this.emitChange();
  }

  onFieldNameChange(index: number, value: string): void {
    if (!this.mappings[index]) return;
    this.mappings[index] = { ...this.mappings[index], outputFieldName: value };
    this.emitChange();
  }

  onValueSourceChange(index: number, config: ValueSourceConfig): void {
    if (!this.mappings[index]) return;
    this.mappings[index] = { ...this.mappings[index], valueSource: config };
    this.emitChange();
  }

  addMapping(): void {
    this.mappings = [
      ...this.mappings,
      {
        outputFieldName: '',
        valueSource: createDefaultValueSourceConfig('from_source_object'),
      },
    ];
    this.emitChange();
  }

  removeMapping(index: number): void {
    this.mappings = this.mappings.filter((_, i) => i !== index);
    this.emitChange();
  }

  sourceSummary(mapping: SimStepNextStateMapping): string {
    if (!mapping.valueSource) return '(no source)';
    return getSourceLabel(mapping.valueSource) || '(no source)';
  }

  onCodingCommentChange(value: string): void {
    if (!this.boundObjectFieldValues) this.boundObjectFieldValues = {};
    this.boundObjectFieldValues['codingComment'] = value;
    this.fieldValuesChanged.emit({ ...this.boundObjectFieldValues });
  }

  trackByIndex(index: number): number {
    return index;
  }

  private emitChange(): void {
    const updated = {
      ...(this.boundObjectFieldValues || {}),
      simStateClassName: this.simStateClassName,
      outputMappings: this.mappings,
    };
    this.boundObjectFieldValues = updated;
    this.fieldValuesChanged.emit(updated);
  }
}
