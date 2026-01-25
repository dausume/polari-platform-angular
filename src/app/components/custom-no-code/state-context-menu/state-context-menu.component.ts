// Author: Dustin Etts
// State Context Menu Component - Right-click menu for state/block modifications
import { Component, EventEmitter, Input, Output, HostListener, ElementRef, OnInit, OnDestroy } from '@angular/core';

export interface StateContextMenuAction {
  type: 'resize' | 'changeShape' | 'delete' | 'duplicate' | 'editProperties' | 'manageSlots';
  stateName: string;
  value?: any;
}

export interface StateSizePreset {
  name: string;
  label: string;
  radius?: number;  // For circles
  width?: number;   // For rectangles
  height?: number;  // For rectangles
}

export const SIZE_PRESETS: StateSizePreset[] = [
  { name: 'small', label: 'Small', radius: 50, width: 80, height: 80 },
  { name: 'medium', label: 'Medium', radius: 80, width: 120, height: 120 },
  { name: 'large', label: 'Large', radius: 110, width: 160, height: 160 },
  { name: 'extra-large', label: 'Extra Large', radius: 140, width: 200, height: 200 }
];

export const SHAPE_OPTIONS = [
  { name: 'circle', label: 'Circle', icon: 'radio_button_unchecked' },
  { name: 'rectangle', label: 'Rectangle', icon: 'crop_square' }
];

@Component({
  selector: 'app-state-context-menu',
  templateUrl: './state-context-menu.component.html',
  styleUrls: ['./state-context-menu.component.css']
})
export class StateContextMenuComponent implements OnInit, OnDestroy {
  @Input() stateName: string = '';
  @Input() currentShapeType: string = 'circle';
  @Input() currentSize: number = 100; // radius for circle, width for rectangle
  @Input() position: { x: number; y: number } = { x: 0, y: 0 };

  @Output() menuAction = new EventEmitter<StateContextMenuAction>();
  @Output() menuClosed = new EventEmitter<void>();

  sizePresets = SIZE_PRESETS;
  shapeOptions = SHAPE_OPTIONS;

  // Submenu states
  showSizeSubmenu = false;
  showShapeSubmenu = false;

  // Reference to host element for body attachment
  private hostElement: HTMLElement;

  constructor(private elementRef: ElementRef) {
    this.hostElement = this.elementRef.nativeElement;
  }

  ngOnInit(): void {
    // Move to document.body to escape any parent stacking contexts
    document.body.appendChild(this.hostElement);
  }

  ngOnDestroy(): void {
    // Remove from document.body when component is destroyed
    if (this.hostElement && this.hostElement.parentElement === document.body) {
      document.body.removeChild(this.hostElement);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    // Close menu if clicking outside
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.closeMenu();
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.closeMenu();
  }

  closeMenu(): void {
    this.menuClosed.emit();
  }

  // Size actions
  toggleSizeSubmenu(): void {
    this.showSizeSubmenu = !this.showSizeSubmenu;
    this.showShapeSubmenu = false;
  }

  selectSize(preset: StateSizePreset): void {
    this.menuAction.emit({
      type: 'resize',
      stateName: this.stateName,
      value: {
        presetName: preset.name,
        radius: preset.radius,
        width: preset.width,
        height: preset.height
      }
    });
    this.closeMenu();
  }

  // Shape actions
  toggleShapeSubmenu(): void {
    this.showShapeSubmenu = !this.showShapeSubmenu;
    this.showSizeSubmenu = false;
  }

  selectShape(shape: { name: string; label: string }): void {
    if (shape.name !== this.currentShapeType) {
      this.menuAction.emit({
        type: 'changeShape',
        stateName: this.stateName,
        value: shape.name
      });
    }
    this.closeMenu();
  }

  // Other actions
  deleteState(): void {
    this.menuAction.emit({
      type: 'delete',
      stateName: this.stateName
    });
    this.closeMenu();
  }

  duplicateState(): void {
    this.menuAction.emit({
      type: 'duplicate',
      stateName: this.stateName
    });
    this.closeMenu();
  }

  editProperties(): void {
    this.menuAction.emit({
      type: 'editProperties',
      stateName: this.stateName
    });
    this.closeMenu();
  }

  manageSlots(): void {
    this.menuAction.emit({
      type: 'manageSlots',
      stateName: this.stateName
    });
    this.closeMenu();
  }

  getCurrentSizeName(): string {
    const tolerance = 15;
    for (const preset of this.sizePresets) {
      if (this.currentShapeType === 'circle' && preset.radius) {
        if (Math.abs(this.currentSize - preset.radius) <= tolerance) {
          return preset.label;
        }
      } else if (preset.width) {
        if (Math.abs(this.currentSize - preset.width) <= tolerance) {
          return preset.label;
        }
      }
    }
    return 'Custom';
  }

  isCurrentShape(shapeName: string): boolean {
    return this.currentShapeType === shapeName;
  }
}
