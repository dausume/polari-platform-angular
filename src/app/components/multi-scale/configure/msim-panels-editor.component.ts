import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { MsimPanel } from '@models/multi-scale/NamedMultiScaleSimConfig';
import { MsimAuthoringService } from '@services/multi-scale/msim-authoring.service';

/**
 * Panels editor — the page's default layout as an ordered list of refs
 * to other definition objects (scenes / graphs / IC interfaces). Emits
 * the panels array on change; parent persists.
 */
@Component({
  standalone: true,
  selector: 'msim-panels-editor',
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
    <div class="editor-intro">
      What the page shows, in order. Every panel is a link to another
      configured object — a 3D scene, a graph, or an initial-conditions
      interface.
    </div>

    <div class="item-card" *ngFor="let p of panels; let i = index">
      <div class="field-row">
        <span class="stage-num">{{ i + 1 }}</span>
        <select class="select-input" [(ngModel)]="p.kind" (ngModelChange)="emit()">
          <option value="scene">3D scene</option>
          <option value="graph">graph over time</option>
          <option value="ic">initial-conditions interface</option>
        </select>

        <ng-container [ngSwitch]="p.kind">
          <select *ngSwitchCase="'scene'" class="select-input"
                  [(ngModel)]="p.simSpaceRef" (ngModelChange)="emit()">
            <option value="">(pick a scene)</option>
            <option *ngFor="let s of sceneNames" [value]="s">{{ s }}</option>
          </select>
          <select *ngSwitchCase="'graph'" class="select-input"
                  [(ngModel)]="p.graphRef" (ngModelChange)="emit()">
            <option value="">(pick a graph)</option>
            <option *ngFor="let g of graphNames" [value]="g">{{ g }}</option>
          </select>
          <select *ngSwitchCase="'ic'" class="select-input"
                  [(ngModel)]="p.icInterfaceRef" (ngModelChange)="emit()">
            <option value="">(pick an interface)</option>
            <option *ngFor="let ic of icNames" [value]="ic">{{ ic }}</option>
          </select>
        </ng-container>

        <button mat-icon-button matTooltip="Move up" [disabled]="i === 0"
                (click)="move(i, -1)"><mat-icon>arrow_upward</mat-icon></button>
        <button mat-icon-button matTooltip="Move down" [disabled]="i === panels.length - 1"
                (click)="move(i, 1)"><mat-icon>arrow_downward</mat-icon></button>
        <button mat-icon-button matTooltip="Remove" (click)="remove(i)">
          <mat-icon>delete_outline</mat-icon></button>
      </div>
    </div>

    <button mat-stroked-button (click)="add()"><mat-icon>add</mat-icon> Add a panel</button>
  `,
  styleUrls: ['./msim-editors.scss'],
})
export class MsimPanelsEditorComponent implements OnInit {
  @Input() panels: MsimPanel[] = [];
  @Output() panelsChange = new EventEmitter<MsimPanel[]>();

  sceneNames: string[] = [];
  graphNames: string[] = [];
  icNames: string[] = [];

  constructor(private authoring: MsimAuthoringService) {}

  async ngOnInit(): Promise<void> {
    this.sceneNames = await this.authoring.listNames('SimSpaceDefinition');
    this.graphNames = await this.authoring.listNames('GraphDefinition');
    this.icNames = await this.authoring.listNames('InitialConditionInterfaceDefinition');
  }

  emit(): void { this.panelsChange.emit(this.panels); }

  add(): void {
    this.panels.push({ kind: 'scene', run: 'primary' });
    this.emit();
  }

  remove(i: number): void { this.panels.splice(i, 1); this.emit(); }

  move(i: number, delta: number): void {
    const j = i + delta;
    if (j < 0 || j >= this.panels.length) return;
    [this.panels[i], this.panels[j]] = [this.panels[j], this.panels[i]];
    this.emit();
  }
}
