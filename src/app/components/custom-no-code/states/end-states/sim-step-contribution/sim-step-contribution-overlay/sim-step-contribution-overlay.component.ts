// Author: Dustin Etts
// Inline overlay for SimStepContribution terminator.
//
// Renders the target *SimState class + sparse field-delta table where
// each row has an `op` (set/add/mul/min/max) selecting how the
// SimulationRunner merges this Partial's contribution into the
// baseline before the Composition solution runs.
//
// Op vocabulary matches backend `_apply_step_contributions`:
//   add — default; sum into the baseline (most physics forces)
//   set — overwrite the baseline (constraint solvers)
//   mul — scale the baseline (damping factors)
//   min/max — bounding rules (e.g. position clamps)

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
import {
  SimStepContributionMapping,
  SimStepContributionOp,
} from '../sim-step-contribution.model';

@Component({
  standalone: false,
  selector: 'sim-step-contribution-overlay',
  templateUrl: './sim-step-contribution-overlay.component.html',
  styleUrls: ['./sim-step-contribution-overlay.component.css'],
})
export class SimStepContributionOverlayComponent extends StateOverlayBase implements OnInit {

  @Input() boundClassName: string = 'SimStepContribution';
  @Input() boundObjectFieldValues: { [key: string]: any } | null = null;
  @Input() availableInputs: AvailableInput[] = [];
  @Input() sourceObjectFields: SourceObjectField[] = [];

  @Output() fieldValuesChanged = new EventEmitter<{ [key: string]: any }>();

  override hasPopupView: boolean = false;

  readonly opOptions: SimStepContributionOp[] = ['add', 'set', 'mul', 'min', 'max'];

  simStateClassName: string = '';
  mappings: SimStepContributionMapping[] = [];

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

  private normalizeMapping(m: any): SimStepContributionMapping {
    return {
      outputFieldName: (m?.outputFieldName as string) || '',
      valueSource: (m?.valueSource as ValueSourceConfig)
        || createDefaultValueSourceConfig('from_source_object'),
      op: (this.opOptions as string[]).includes(m?.op) ? m.op : 'add',
    };
  }

  /** Non-null view of a mapping's valueSource for template binding into
   *  value-source-selector, whose `config` input is non-nullable. */
  valueSourceFor(mapping: SimStepContributionMapping): ValueSourceConfig {
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

  onOpChange(index: number, op: SimStepContributionOp): void {
    if (!this.mappings[index]) return;
    this.mappings[index] = { ...this.mappings[index], op };
    this.emitChange();
  }

  addMapping(): void {
    this.mappings = [
      ...this.mappings,
      {
        outputFieldName: '',
        valueSource: createDefaultValueSourceConfig('from_source_object'),
        op: 'add',
      },
    ];
    this.emitChange();
  }

  removeMapping(index: number): void {
    this.mappings = this.mappings.filter((_, i) => i !== index);
    this.emitChange();
  }

  sourceSummary(mapping: SimStepContributionMapping): string {
    if (!mapping.valueSource) return '(no source)';
    return getSourceLabel(mapping.valueSource) || '(no source)';
  }

  opHint(op: SimStepContributionOp): string {
    switch (op) {
      case 'add': return 'Sum into baseline (default — physics forces compose)';
      case 'set': return 'Overwrite baseline (constraint solvers)';
      case 'mul': return 'Scale baseline (damping factors)';
      case 'min': return 'Clamp baseline downward';
      case 'max': return 'Clamp baseline upward';
    }
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
