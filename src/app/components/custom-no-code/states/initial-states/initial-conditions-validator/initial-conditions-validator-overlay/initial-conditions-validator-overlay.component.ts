// Author: Dustin Etts
// Inline overlay for InitialConditionsValidatorEntry. Renders the
// target simulation + a short summary of what the validator checks.
// Editable so the author can document the validator inline; the
// SimulationRunner reads the underlying solution graph regardless of
// this text.

import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { StateOverlayBase } from '../../../_shared/state-overlay/state-overlay-base';

@Component({
  standalone: false,
  selector: 'initial-conditions-validator-overlay',
  templateUrl: './initial-conditions-validator-overlay.component.html',
  styleUrls: ['./initial-conditions-validator-overlay.component.css'],
})
export class InitialConditionsValidatorOverlayComponent extends StateOverlayBase implements OnInit {

  @Input() boundClassName: string = 'InitialConditionsValidatorEntry';
  @Input() boundObjectFieldValues: { [key: string]: any } | null = null;

  @Output() fieldValuesChanged = new EventEmitter<{ [key: string]: any }>();

  override hasPopupView: boolean = false;

  simulationDefinitionName: string = '';
  validationSummary: string = '';

  override ngOnInit(): void {
    super.ngOnInit();
    const bofv = this.boundObjectFieldValues || {};
    this.simulationDefinitionName = (bofv['simulationDefinitionName'] as string) || '';
    this.validationSummary = (bofv['validationSummary'] as string) || '';
  }

  onSimulationChange(value: string): void {
    this.simulationDefinitionName = value;
    this.emit();
  }

  onSummaryChange(value: string): void {
    this.validationSummary = value;
    this.emit();
  }

  onCodingCommentChange(value: string): void {
    if (!this.boundObjectFieldValues) this.boundObjectFieldValues = {};
    this.boundObjectFieldValues['codingComment'] = value;
    this.fieldValuesChanged.emit({ ...this.boundObjectFieldValues });
  }

  private emit(): void {
    const updated = {
      ...(this.boundObjectFieldValues || {}),
      simulationDefinitionName: this.simulationDefinitionName,
      validationSummary: this.validationSummary,
    };
    this.boundObjectFieldValues = updated;
    this.fieldValuesChanged.emit(updated);
  }
}
