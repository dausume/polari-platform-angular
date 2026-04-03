import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import { DisplayDataSource } from '@models/dashboards/DisplayStateDefinition';
import { ClassTypingService } from '@services/class-typing-service';
import { ClassSelectorDialogComponent, ClassSelectorDialogResult } from
  '@components/shared/class-selector-dialog/class-selector-dialog';

@Component({
  standalone: false,
  selector: 'display-static-var-editor',
  templateUrl: 'static-var-editor.html',
  styleUrls: ['./static-var-editor.css']
})
export class StaticVarEditorComponent implements OnInit, OnDestroy {

  @Input() dataSource!: DisplayDataSource;
  @Output() valueChange = new EventEmitter<void>();

  /** Same type list used in VariableModifierComponent / class creation */
  typesAllowed = [
    'String', 'Integer', 'Decimal', 'Boolean',
    'Date', 'Date & Time', 'Date Duration', 'Date & Time Duration',
    'Time', 'Time Duration', 'Precision Time', 'Schedule',
    'List', 'Dictionary',
    'Reference', 'Reference List',
    'Map Coordinate', 'Map Line Segment', 'Map Polygon',
    'Unique Identifier - Alphanumeric', 'Numeric Index'
  ];

  /** Display name for the currently selected ref class */
  refClassDisplayName = '';

  private subscriptions: Subscription[] = [];

  constructor(
    private dialog: MatDialog,
    private typingService: ClassTypingService
  ) {}

  ngOnInit(): void {
    this.updateRefClassDisplayName();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  get isReferenceType(): boolean {
    const t = this.dataSource.staticVarType;
    return t === 'Reference' || t === 'Reference List';
  }

  onTypeChange(): void {
    // Clear ref class when switching away from reference types
    if (!this.isReferenceType) {
      this.dataSource.staticVarRefClass = undefined;
      this.refClassDisplayName = '';
    }
    // Clear value when type changes
    this.dataSource.staticVarValue = undefined;
    this.emitChange();
  }

  onValueChange(): void {
    this.emitChange();
  }

  openRefClassSelector(): void {
    const dialogRef = this.dialog.open(ClassSelectorDialogComponent, {
      width: '480px',
      data: {
        title: 'Select Referenced Class',
        subtitle: 'Choose the class this static variable references'
      }
    });

    dialogRef.afterClosed().subscribe((result: ClassSelectorDialogResult) => {
      if (result?.action === 'select' && result.className) {
        this.dataSource.staticVarRefClass = result.className;
        this.refClassDisplayName = result.displayName || result.className;
        this.emitChange();
      }
    });
  }

  clearRefClass(): void {
    this.dataSource.staticVarRefClass = undefined;
    this.refClassDisplayName = '';
    this.emitChange();
  }

  /** Returns the HTML input type for the value editor based on variable type */
  getInputType(): string {
    switch (this.dataSource.staticVarType) {
      case 'Integer':
      case 'Decimal':
      case 'Numeric Index':
        return 'number';
      case 'Date':
        return 'date';
      case 'Date & Time':
        return 'datetime-local';
      case 'Time':
      case 'Precision Time':
        return 'time';
      default:
        return 'text';
    }
  }

  /** Whether the current type uses a boolean toggle instead of a text input */
  get isBooleanType(): boolean {
    return this.dataSource.staticVarType === 'Boolean';
  }

  /** Whether the current type should show a text/number value input */
  get showValueInput(): boolean {
    const t = this.dataSource.staticVarType;
    return !!t && t !== 'Boolean' && t !== 'List' && t !== 'Dictionary'
      && t !== 'Reference' && t !== 'Reference List';
  }

  private updateRefClassDisplayName(): void {
    const refClass = this.dataSource.staticVarRefClass;
    if (!refClass) {
      this.refClassDisplayName = '';
      return;
    }
    const typing = this.typingService.getClassPolyTyping(refClass);
    this.refClassDisplayName = typing?.displayClassName || refClass;
  }

  private emitChange(): void {
    this.valueChange.emit();
  }
}
