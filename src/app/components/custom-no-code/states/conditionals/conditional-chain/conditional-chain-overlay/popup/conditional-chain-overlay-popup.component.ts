// Author: Dustin Etts
// Full-page popup for the ConditionalChain state. Hosts the existing
// inline overlay component inside a Material Dialog shell so the user has
// a roomier editing surface without duplicating the visual editor's logic.
//
// Convention: see states/_shared/state-overlay/README.md (popup view contract).

import { Component, EventEmitter, Inject, Output } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ConditionalChainLink, LogicalOperator } from '@models/stateSpace';
import {
  AvailableInput,
  SourceObjectField
} from '../../../../../shared/value-source-selector/value-source-selector.component';

export interface ConditionalChainOverlayPopupData {
  stateName: string;
  chainLinks: ConditionalChainLink[];
  defaultLogicalOperator: LogicalOperator;
  availableInputFields: { name: string; type: string; source: string }[];
  availableInputs: AvailableInput[];
  sourceObjectFields: SourceObjectField[];
  inputSlotCount: number;
  allowDynamicInputs: boolean;
  maxInputSlots: number;
}

@Component({
  standalone: false,
  selector: 'conditional-chain-overlay-popup',
  templateUrl: './conditional-chain-overlay-popup.component.html',
  styleUrls: ['./conditional-chain-overlay-popup.component.css']
})
export class ConditionalChainOverlayPopupComponent {
  @Output() chainChanged = new EventEmitter<{ links: ConditionalChainLink[]; defaultOperator: LogicalOperator }>();
  @Output() syntaxChanged = new EventEmitter<string>();

  // Mirrored copies of the live data so edits inside the popup don't mutate the
  // canvas instance until they're emitted upward.
  chainLinks: ConditionalChainLink[] = [];
  defaultLogicalOperator: LogicalOperator = 'AND';

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: ConditionalChainOverlayPopupData,
    private dialogRef: MatDialogRef<ConditionalChainOverlayPopupComponent>
  ) {
    this.chainLinks = JSON.parse(JSON.stringify(data.chainLinks || []));
    this.defaultLogicalOperator = data.defaultLogicalOperator || 'AND';
  }

  onChainChanged(event: { links: ConditionalChainLink[]; defaultOperator: LogicalOperator }): void {
    this.chainLinks = event.links;
    this.defaultLogicalOperator = event.defaultOperator;
    this.chainChanged.emit(event);
  }

  onSyntaxChanged(syntax: string): void {
    this.syntaxChanged.emit(syntax);
  }

  close(): void {
    this.dialogRef.close();
  }
}
