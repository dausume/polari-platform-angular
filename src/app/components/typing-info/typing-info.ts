import { Component, OnInit, OnDestroy } from '@angular/core';
import { CRUDEservicesManager } from '@services/crude-services-manager';
import { Subscription } from 'rxjs';

interface VariableInfo {
  name: string;
  pythonTypeDefault: string;
  displayName: string;
  recordedTypes: string[];
  recordedFormats: string[];
  isPrimary: boolean;
  isIdentifier: boolean;
}

interface TypeData {
  className: string;
  identifiers: string[];
  requiredParams: string[];
  defaultParams: string[];
  variables: VariableInfo[];
  dataOccupation: {
    json: any;
    python: any;
    db: any;
  };
  objectReferences: { [key: string]: string[] };
}

@Component({
  standalone: false,
  selector: 'typing-info',
  templateUrl: './typing-info.html',
  styleUrls: ['./typing-info.css']
})
export class TypingInfoComponent implements OnInit, OnDestroy {
  typingData: { [className: string]: TypeData } | null = null;
  loading: boolean = true;
  error: string | null = null;
  selectedClass: string | null = null;
  filterText: string = '';
  private subscription?: Subscription;

  constructor(private crudeManager: CRUDEservicesManager) {}

  ngOnInit(): void {
    this.loadTypingData();
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  loadTypingData(): void {
    this.loading = true;
    this.error = null;

    // Use the dedicated typing-analysis endpoint instead of CRUDE
    const service = this.crudeManager.getCRUDEclassService('typing-analysis');

    this.subscription = service.readAll().subscribe({
      next: (response: any) => {
        console.log('[TypingInfo] Received response:', response);

        // API returns array format: [{ "polyTypedObject": { classData } }]
        if (response && response.length > 0) {
          const polyTypedObj = response[0].polyTypedObject;
          if (polyTypedObj) {
            this.typingData = polyTypedObj;
          } else {
            this.error = 'Invalid typing data format';
          }
        } else {
          this.error = 'No typing data received';
        }

        this.loading = false;
      },
      error: (err) => {
        console.error('[TypingInfo] Error loading typing data:', err);
        this.error = 'Failed to load typing data';
        this.loading = false;
      }
    });
  }

  refresh(): void {
    this.loadTypingData();
  }

  getClassNames(): string[] {
    if (!this.typingData) return [];
    const names = Object.keys(this.typingData);
    if (this.filterText) {
      return names.filter(name =>
        name.toLowerCase().includes(this.filterText.toLowerCase())
      );
    }
    return names.sort();
  }

  selectClass(className: string): void {
    this.selectedClass = className;
  }

  getSelectedClassData(): TypeData | null {
    if (!this.typingData || !this.selectedClass) return null;
    return this.typingData[this.selectedClass];
  }

  getObjectKeys(obj: any): string[] {
    return obj ? Object.keys(obj) : [];
  }

  // Calculate total unique types across all variables
  getTotalTypesRecorded(classData: TypeData): number {
    const typesSet = new Set<string>();
    classData.variables.forEach(v => {
      if (v.pythonTypeDefault) {
        typesSet.add(v.pythonTypeDefault);
      }
      v.recordedTypes?.forEach(t => typesSet.add(t));
    });
    return typesSet.size;
  }

  // Calculate total formats recorded across all variables
  getTotalFormatsRecorded(classData: TypeData): number {
    const formatsSet = new Set<string>();
    classData.variables.forEach(v => {
      v.recordedFormats.forEach(f => formatsSet.add(f));
    });
    return formatsSet.size;
  }
}
