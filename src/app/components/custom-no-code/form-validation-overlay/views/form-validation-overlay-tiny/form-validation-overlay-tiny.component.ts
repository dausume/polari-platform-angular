// Author: Dustin Etts
// Smallest tier (< 60px): shows just the checklist icon with the display name as a tooltip.

import { Component, Input } from '@angular/core';

@Component({
  standalone: false,
  selector: 'form-validation-overlay-tiny',
  templateUrl: './form-validation-overlay-tiny.component.html',
  styleUrls: ['./form-validation-overlay-tiny.component.css']
})
export class FormValidationOverlayTinyComponent {
  @Input() displayName: string = 'Validate Form Fields';
  @Input() enabledCount: number = 0;
}
