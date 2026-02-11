import { Component, OnInit, OnDestroy } from '@angular/core';
import { CRUDEservicesManager } from '@services/crude-services-manager';
import { Subscription } from 'rxjs';

@Component({
  standalone: false,
  selector: 'manager-info',
  templateUrl: './manager-info.html',
  styleUrls: ['./manager-info.css']
})
export class ManagerInfoComponent implements OnInit, OnDestroy {
  managerData: any = null;
  loading: boolean = true;
  error: string | null = null;
  private subscription?: Subscription;

  constructor(private crudeManager: CRUDEservicesManager) {}

  ngOnInit(): void {
    this.loadManagerData();
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  loadManagerData(): void {
    this.loading = true;
    this.error = null;

    const service = this.crudeManager.getCRUDEclassService('managerObject');

    this.subscription = service.readAll().subscribe({
      next: (response: any) => {
        console.log('[ManagerInfo] Received response:', response);

        // API returns array format: [{ "managerObject": { "manager": {...} } }]
        if (response && response.length > 0) {
          const managerObj = response[0].managerObject;
          if (managerObj && managerObj.manager) {
            this.managerData = managerObj.manager;
          } else {
            this.error = 'Invalid manager data format';
          }
        } else {
          this.error = 'No manager data received';
        }

        this.loading = false;
      },
      error: (err) => {
        console.error('[ManagerInfo] Error loading manager data:', err);
        this.error = 'Failed to load manager data';
        this.loading = false;
      }
    });
  }

  refresh(): void {
    this.loadManagerData();
  }

  // Helper to get object keys for template iteration
  getObjectKeys(obj: any): string[] {
    return obj ? Object.keys(obj) : [];
  }

  // Determine the database mode label from manager data
  getDatabaseModeLabel(): string {
    if (!this.managerData?.hasDB) {
      return 'Disabled (In-Memory-Tree-Only)';
    }
    // TODO: When Redis & MariaDB support is built out, check for that mode here
    return 'Sqlite DB (Default)';
  }

  // Get the icon for the current database mode
  getDatabaseModeIcon(): string {
    if (!this.managerData?.hasDB) {
      return 'memory';
    }
    return 'storage';
  }
}
