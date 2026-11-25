import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

/**
 * cb-1 / cb-6: ONE schematic symbol, drawn about (0,0) and pointing left to right (14 units each way), shared by the component card and
 * the whole-solution drawing. Used as an SVG group: `<g schematicSymbol [kind]="s.kind" [attr.transform]="...">`. It strokes in
 * `currentColor`, so the host's `color` decides it (the card and the solution view turn it red where a component is not solved).
 */
@Component({
  standalone: true,
  selector: 'g[schematicSymbol]',
  imports: [CommonModule],
  template: `
    <ng-container [ngSwitch]="kind">
      <svg:g *ngSwitchCase="'capacitor'"><svg:line x1="-14" y1="0" x2="-4" y2="0"></svg:line><svg:line x1="-4" y1="-9" x2="-4" y2="9"></svg:line>
        <svg:line x1="4" y1="-9" x2="4" y2="9"></svg:line><svg:line x1="4" y1="0" x2="14" y2="0"></svg:line></svg:g>
      <svg:g *ngSwitchCase="'diode'"><svg:line x1="-14" y1="0" x2="-6" y2="0"></svg:line><svg:polygon points="-6,-7 -6,7 6,0" class="fill"></svg:polygon>
        <svg:line x1="6" y1="-7" x2="6" y2="7"></svg:line><svg:line x1="6" y1="0" x2="14" y2="0"></svg:line></svg:g>
      <svg:g *ngSwitchCase="'resistor'"><svg:polyline points="-14,0 -9,0 -7,-6 -3,6 1,-6 5,6 7,0 14,0"></svg:polyline></svg:g>
      <svg:g *ngSwitchCase="'led'"><svg:line x1="-14" y1="0" x2="-6" y2="0"></svg:line><svg:polygon points="-6,-7 -6,7 6,0" class="fill"></svg:polygon>
        <svg:line x1="6" y1="-7" x2="6" y2="7"></svg:line><svg:line x1="6" y1="0" x2="14" y2="0"></svg:line>
        <svg:line x1="-1" y1="-9" x2="4" y2="-15"></svg:line><svg:line x1="4" y1="-9" x2="9" y2="-15"></svg:line></svg:g>
      <svg:g *ngSwitchCase="'pushbutton'"><svg:line x1="-14" y1="0" x2="-8" y2="0"></svg:line><svg:rect x="-8" y="-8" width="16" height="16"></svg:rect>
        <svg:circle cx="0" cy="0" r="4"></svg:circle><svg:line x1="8" y1="0" x2="14" y2="0"></svg:line></svg:g>
      <svg:g *ngSwitchCase="'battery'"><svg:line x1="-14" y1="0" x2="-3" y2="0"></svg:line><svg:line x1="-3" y1="-10" x2="-3" y2="10"></svg:line>
        <svg:line x1="3" y1="-5" x2="3" y2="5"></svg:line></svg:g>
      <svg:g *ngSwitchCase="'ground'"><svg:line x1="-14" y1="0" x2="0" y2="0"></svg:line><svg:line x1="0" y1="-9" x2="0" y2="9"></svg:line>
        <svg:line x1="4" y1="-5" x2="4" y2="5"></svg:line><svg:line x1="8" y1="-2" x2="8" y2="2"></svg:line></svg:g>
      <svg:g *ngSwitchDefault><svg:rect x="-10" y="-7" width="20" height="14"></svg:rect></svg:g>
    </ng-container>
  `,
  styles: [`
    line, polyline, rect, circle, polygon { stroke: currentColor; stroke-width: 1.6; fill: none; }
    .fill { fill: currentColor; }
  `],
})
export class SchematicSymbolComponent {
  @Input() kind = '';
}
