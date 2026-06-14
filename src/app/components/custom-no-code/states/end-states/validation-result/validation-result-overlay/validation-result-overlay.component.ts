// Author: Dustin Etts
// Inline overlay for ValidationResult terminator. Surfaces the three
// expected verdict bindings (`outcome`, `reason`, `repairedValues`) with
// a value-source-selector per row so the author can wire them to
// whatever upstream computations the validator graph produced.

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
import { ValidationResultMapping } from '../validation-result.model';

/** The fixed verdict fields the runner reads off the final context. */
const REQUIRED_FIELDS = ['outcome', 'reason', 'repairedValues'] as const;
type RequiredField = (typeof REQUIRED_FIELDS)[number];

@Component({
  standalone: false,
  selector: 'validation-result-overlay',
  templateUrl: './validation-result-overlay.component.html',
  styleUrls: ['./validation-result-overlay.component.css'],
})
export class ValidationResultOverlayComponent extends StateOverlayBase implements OnInit {

  @Input() boundClassName: string = 'ValidationResult';
  @Input() boundObjectFieldValues: { [key: string]: any } | null = null;
  @Input() availableInputs: AvailableInput[] = [];
  @Input() sourceObjectFields: SourceObjectField[] = [];

  @Output() fieldValuesChanged = new EventEmitter<{ [key: string]: any }>();

  override hasPopupView: boolean = false;

  readonly fields = REQUIRED_FIELDS;
  mappings: Record<RequiredField, ValidationResultMapping> = {
    outcome:         { outputFieldName: 'outcome',         valueSource: createDefaultValueSourceConfig('from_input') },
    reason:          { outputFieldName: 'reason',          valueSource: createDefaultValueSourceConfig('from_input') },
    repairedValues:  { outputFieldName: 'repairedValues',  valueSource: null },
  };

  override ngOnInit(): void {
    super.ngOnInit();
    this.hydrate();
  }

  private hydrate(): void {
    const raw = (this.boundObjectFieldValues || {})['outputMappings'];
    const list = Array.isArray(raw) ? raw : [];
    for (const f of REQUIRED_FIELDS) {
      const existing = list.find((m: any) => m?.outputFieldName === f);
      if (existing) {
        this.mappings[f] = {
          outputFieldName: f,
          valueSource: (existing.valueSource as ValueSourceConfig) || this.mappings[f].valueSource,
        };
      }
    }
  }

  valueSourceFor(field: RequiredField): ValueSourceConfig {
    return this.mappings[field].valueSource
      || createDefaultValueSourceConfig('from_input');
  }

  sourceSummaryFor(field: RequiredField): string {
    const src = this.mappings[field].valueSource;
    if (!src) return '(unwired)';
    return getSourceLabel(src) || '(unwired)';
  }

  onValueSourceChange(field: RequiredField, config: ValueSourceConfig): void {
    this.mappings[field] = { outputFieldName: field, valueSource: config };
    this.emit();
  }

  fieldHint(field: RequiredField): string {
    switch (field) {
      case 'outcome':         return "String literal or upstream var — must end up equal to 'valid' or 'invalid'.";
      case 'reason':          return 'User-facing failure message. Ignored when outcome=valid.';
      case 'repairedValues':  return 'Optional dict keyed by <ClassName>.<field> to overwrite into step 0. Leave unwired for a pure-veto validator.';
    }
  }

  onCodingCommentChange(value: string): void {
    if (!this.boundObjectFieldValues) this.boundObjectFieldValues = {};
    this.boundObjectFieldValues['codingComment'] = value;
    this.fieldValuesChanged.emit({ ...this.boundObjectFieldValues });
  }

  private emit(): void {
    const updated = {
      ...(this.boundObjectFieldValues || {}),
      outputMappings: REQUIRED_FIELDS.map(f => this.mappings[f]),
    };
    this.boundObjectFieldValues = updated;
    this.fieldValuesChanged.emit(updated);
  }
}
