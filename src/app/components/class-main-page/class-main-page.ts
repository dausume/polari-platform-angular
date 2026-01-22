import { Component, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { PolariService } from '@services/polari-service';
import { ClassTypingService } from '@services/class-typing-service';
import { CRUDEservicesManager } from '@services/crude-services-manager';
import { CRUDEclassService } from '@services/crude-class-service';
import { DefaultDisplayFactory } from '@services/dashboard/default-dashboard-factory.service';
import { DisplayConfigService } from '@services/dashboard/dashboard-config.service';
import { Display } from '@models/dashboards/Display';
import { Subscription } from 'rxjs';

@Component({
  selector: 'class-main-page',
  templateUrl: 'class-main-page.html',
  styleUrls: ['./class-main-page.css']
})
export class ClassMainPageComponent implements OnDestroy {

  className?: string = "name";
  classTypeData: any = {};  // Initialize to empty object to prevent undefined errors
  crudeService?: CRUDEclassService;

  /** The dashboard to render for this class */
  dashboard: Display | null = null;

  /** Instance count for metrics */
  instanceCount?: number;

  private componentId: string = 'ClassMainPageComponent';
  private previousClassName?: string;
  private subscriptions: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    protected polariService: PolariService,
    protected typingService: ClassTypingService,
    private crudeManager: CRUDEservicesManager,
    private dashboardFactory: DefaultDisplayFactory,
    private dashboardConfig: DisplayConfigService
  ) {}

  ngOnInit() {
    const routeSub = this.route.paramMap.subscribe(paramsMap => {
      Object.keys(paramsMap['params']).forEach(param => {
        if (param == "class") {
          const newClassName = paramsMap["params"][param];

          // If className is changing, clean up old service first
          if (this.previousClassName && this.previousClassName !== newClassName) {
            console.log(`[ClassMainPage] ClassName changing from ${this.previousClassName} to ${newClassName}`);

            // Clear old data
            this.classTypeData = undefined;
            this.dashboard = null;
            this.instanceCount = undefined;

            // Clean up old service
            if (this.crudeService) {
              this.crudeService.removeUtilizer(this.componentId);
              this.crudeManager.decrementUtilizerCounter(this.previousClassName);
              this.crudeManager.cleanupUnusedService(this.previousClassName);
            }
          }

          // Set new className
          this.className = newClassName;
          this.previousClassName = newClassName;

          // Initialize CRUDE service for this class
          if (this.className) {
            console.log(`[ClassMainPage] Getting CRUDE service for: ${this.className}`);

            // Get or create the CRUDE service for this class
            this.crudeService = this.crudeManager.getCRUDEclassService(this.className);

            // Register this component as a utilizer of the service
            this.crudeService.addUtilizer(this.componentId);
            this.crudeManager.incrementUtilizerCounter(this.className);

            console.log(`[ClassMainPage] Service registered for ${this.className}`);

            // Fetch instance count for metrics
            this.fetchInstanceCount();
          }
        }
      });

      // Subscribe to typing data
      const typingSub = this.typingService.polyTypingBehaviorSubject.subscribe(polyTyping => {
        console.log("[ClassMainPage] Typing dict update received");

        if (this.className != undefined) {
          const typingData = polyTyping[this.className];
          if (typingData && Object.keys(typingData).length > 0) {
            this.classTypeData = typingData;
            console.log(`[ClassMainPage] Found typing data for ${this.className}`);

            // Generate dashboard when we have typing data
            this.generateDisplay();
          } else {
            this.classTypeData = this.classTypeData || {};
            console.log(`[ClassMainPage] No typing data yet for ${this.className}`);
          }
        }
      });
      this.subscriptions.push(typingSub);
    });
    this.subscriptions.push(routeSub);
  }

  /**
   * Generates the default dashboard for this class
   */
  private generateDisplay(): void {
    if (!this.className) return;

    console.log(`[ClassMainPage] Generating dashboard for ${this.className}`);

    // Create default dashboard using factory
    this.dashboard = this.dashboardFactory.createDefaultClassDisplay(
      this.className,
      this.classTypeData,
      this.instanceCount
    );

    // Apply any saved configuration
    const config = this.dashboardConfig.loadDisplayConfig(this.dashboard.id);
    if (config) {
      console.log(`[ClassMainPage] Applying saved dashboard config`);
      this.dashboard = this.dashboardConfig.applyConfig(this.dashboard, config);
    }
  }

  /**
   * Fetches the instance count for display in metrics
   */
  private fetchInstanceCount(): void {
    if (!this.crudeService) return;

    this.crudeService.readAll().subscribe({
      next: (data: any) => {
        // Parse different response formats
        let count = 0;

        if (Array.isArray(data)) {
          count = data.length;
        } else if (data && data.data && Array.isArray(data.data)) {
          count = data.data.length;
        } else if (data && this.className && data[this.className]) {
          const classData = data[this.className];
          count = Array.isArray(classData) ? classData.length : 0;
        }

        this.instanceCount = count;
        console.log(`[ClassMainPage] Instance count for ${this.className}: ${count}`);

        // Regenerate dashboard with updated count
        if (this.dashboard) {
          this.generateDisplay();
        }
      },
      error: (err: any) => {
        console.warn(`[ClassMainPage] Failed to fetch instance count:`, err);
        this.instanceCount = undefined;
      }
    });
  }

  /**
   * Gets the context to pass to the dashboard renderer
   */
  get dashboardContext(): { className: string; classTypeData: any } {
    return {
      className: this.className || '',
      classTypeData: this.classTypeData
    };
  }

  ngOnDestroy() {
    // Unsubscribe from all subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());

    // Unregister this component as a utilizer when destroyed
    if (this.crudeService && this.className) {
      console.log(`[ClassMainPage] Cleaning up service for ${this.className}`);
      this.crudeService.removeUtilizer(this.componentId);
      this.crudeManager.decrementUtilizerCounter(this.className);
      this.crudeManager.cleanupUnusedService(this.className);
    }
  }
}
