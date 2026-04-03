import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Display, DisplayType } from '@models/dashboards/Display';

interface DisplayTypeOption {
  type: DisplayType;
  label: string;
  icon: string;
  description: string;
  alwaysOn: boolean;
}

@Component({
  standalone: false,
  selector: 'display-type-config',
  templateUrl: 'display-type-config.html',
  styleUrls: ['./display-type-config.css']
})
export class DisplayTypeConfigComponent {

  @Input() display!: Display;
  @Output() displayChange = new EventEmitter<void>();

  typeOptions: DisplayTypeOption[] = [
    {
      type: 'component',
      label: 'Component',
      icon: 'widgets',
      description: 'Embeddable component within other displays or layouts',
      alwaysOn: true
    },
    {
      type: 'popup',
      label: 'PopUp',
      icon: 'open_in_new',
      description: 'Can be shown in a popup or modal dialog',
      alwaysOn: false
    },
    {
      type: 'row',
      label: 'Row',
      icon: 'table_rows',
      description: 'Single instance display — requires a single-instance input',
      alwaysOn: false
    },
    {
      type: 'page',
      label: 'Page',
      icon: 'public',
      description: 'Standalone page accessible via URL with route parameters',
      alwaysOn: false
    }
  ];

  isTypeActive(type: DisplayType): boolean {
    return this.display.hasType(type);
  }

  onTypeToggle(option: DisplayTypeOption): void {
    if (option.alwaysOn) return;

    this.display.toggleType(option.type);

    // When enabling 'page', generate a default route if none exists
    if (option.type === 'page' && this.display.isPage && !this.display.pageRoute) {
      this.display.pageRoute = this.display.generatePageRoute();
    }

    this.emitChange();
  }

  onPageRouteChange(): void {
    this.emitChange();
  }

  private emitChange(): void {
    this.displayChange.emit();
  }
}
