import { Component, OnDestroy, ViewChild } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PolariService } from '@services/polari-service';
import { ClassTypingService } from '@services/class-typing-service';
import { CRUDEservicesManager } from '@services/crude-services-manager';
import { CRUDEclassService } from '@services/crude-class-service';
import { DefaultDisplayFactory } from '@services/dashboard/default-dashboard-factory.service';
import { DisplayConfigService } from '@services/dashboard/dashboard-config.service';
import { DisplayManagerService } from '@services/dashboard/display-manager.service';
import { Display } from '@models/dashboards/Display';
import { DisplayRow } from '@models/dashboards/DisplayRow';
import { DisplayColumn } from '@models/dashboards/DisplayColumn';
import { DisplayItem } from '@models/dashboards/DisplayItem';
import { DisplaySummary } from '@models/dashboards/DisplaySummary';
import { CreateDisplayDialogComponent } from '@components/dashboard/create-display-dialog/create-display-dialog';
import { TableDefinitionService } from '@services/table/table-definition.service';
import { NamedTableConfig, TableDefinitionSummary } from '@models/tables/NamedTableConfig';
import { ColumnConfiguration } from '@models/tables/ColumnConfiguration';
import { CreateTableConfigDialogComponent } from '@components/table-config/create-table-config-dialog/create-table-config-dialog';
import { GraphDefinitionService } from '@services/graph/graph-definition.service';
import { NamedGraphConfig, GraphDefinitionSummary } from '@models/graphs/NamedGraphConfig';
import { CreateGraphConfigDialogComponent } from '@components/graph-config/create-graph-config-dialog/create-graph-config-dialog';
import { GeoJsonDefinitionService } from '@services/geojson/geojson-definition.service';
import { NamedGeoJsonConfig, GeoJsonDefinitionSummary } from '@models/geojson/NamedGeoJsonConfig';
import { CreateGeoJsonConfigDialogComponent } from '@components/geojson-config/create-geojson-config-dialog/create-geojson-config-dialog';
import { DataSetDefinitionService } from '@services/dataset/dataset-definition.service';
import { NamedDataSetConfig, DataSetDefinitionSummary } from '@models/datasets/NamedDataSetConfig';
import { CreateDataSetConfigDialogComponent } from '@components/dataset-config/create-dataset-config-dialog/create-dataset-config-dialog';
import { FieldProfileDefinitionService } from '@services/dataset/field-profile-definition.service';
import { NamedFieldProfileConfig, FieldProfileDefinitionSummary } from '@models/datasets/NamedFieldProfileConfig';
import { CreateFieldProfileDialogComponent } from '@components/dataset-config/create-field-profile-dialog/create-field-profile-dialog';
import { FilterChainDefinitionService } from '@services/dataset/filter-chain-definition.service';
import { NamedFilterChainConfig, FilterChainDefinitionSummary } from '@models/datasets/NamedFilterChainConfig';
import { CreateFilterChainDialogComponent } from '@components/dataset-config/create-filter-chain-dialog/create-filter-chain-dialog';
import { FilterChainEditable } from '@components/dataset-config/dataset-config-sidebar/dataset-config-sidebar';
import { classPolyTyping } from '@models/polyTyping/classPolyTyping';
import { getMapPolygonStyle, getMapLineStyle } from '@models/shared/SvgIconLibrary';
import { DisplayRendererComponent } from '@components/dashboard/dashboard-renderer/dashboard-renderer';
import { EditClassDialogComponent } from '@components/class-main-page/edit-class-dialog/edit-class-dialog';
import { NoCodeSolutionStateService } from '@services/no-code-services/no-code-solution-state.service';
import { NoCodeSolutionRawData } from '@models/noCode/mock-NCS-data';
import { Subscription, forkJoin, Observable } from 'rxjs';

@Component({
  standalone: false,
  selector: 'class-main-page',
  templateUrl: 'class-main-page.html',
  styleUrls: ['./class-main-page.css']
})
export class ClassMainPageComponent implements OnDestroy {

  className?: string = "name";
  classTypeData: any = {};
  crudeService?: CRUDEclassService;

  /** The auto-generated dashboard to render for this class */
  dashboard: Display | null = null;

  /** Instance count for metrics */
  instanceCount?: number;

  /** Overview tab: default dataset display */
  overviewInstanceData: any[] = [];
  defaultDatasetConfig: NamedTableConfig | null = null;
  overviewLoading: boolean = false;

  /** Current tab index */
  selectedTabIndex: number = 0;

  /** Display management state */
  displayList: DisplaySummary[] = [];
  selectedDisplay: Display | null = null;
  hasDraftChanges: boolean = false;
  configPanelOpen: boolean = false;
  displaysLoading: boolean = false;

  /** Table config management state */
  tableConfigList: TableDefinitionSummary[] = [];
  selectedTableConfig: NamedTableConfig | null = null;
  hasTableDraftChanges: boolean = false;
  tableConfigPanelOpen: boolean = false;
  tableConfigsLoading: boolean = false;
  previewInstanceData: any[] = [];

  /** Graph config management state */
  graphConfigList: GraphDefinitionSummary[] = [];
  selectedGraphConfig: NamedGraphConfig | null = null;
  hasGraphDraftChanges: boolean = false;
  graphConfigPanelOpen: boolean = false;
  graphConfigsLoading: boolean = false;
  graphPreviewData: any[] = [];

  /** GeoJSON config management state */
  geoJsonConfigList: GeoJsonDefinitionSummary[] = [];
  selectedGeoJsonConfig: NamedGeoJsonConfig | null = null;
  hasGeoJsonDraftChanges: boolean = false;
  geoJsonConfigPanelOpen: boolean = false;
  geoJsonConfigsLoading: boolean = false;
  geoJsonPreviewData: any[] = [];
  geoJsonViewMode: 'config' | 'data' | 'features' = 'config';
  geoJsonMixedFeatures: GeoJSON.FeatureCollection | null = null;

  /** DataSet config management state */
  dataSetConfigList: DataSetDefinitionSummary[] = [];
  selectedDataSetConfig: NamedDataSetConfig | null = null;
  hasDataSetDraftChanges: boolean = false;
  dataSetConfigPanelOpen: boolean = false;
  dataSetConfigsLoading: boolean = false;
  dataSetPreviewInstanceData: any[] = [];
  dataSetFilteredPreviewData: any[] = [];

  /** DataSets sub-tab state */
  dataSetSubTabIndex: number = 0;

  /** Standalone filter chain (Filter Chains sub-tab) — kept for backwards compat */
  standaloneFilterConfig: NamedDataSetConfig | null = null;
  standaloneFilterPreviewData: any[] = [];
  standaloneFilteredPreviewData: any[] = [];

  /** Field Profile config management state */
  fieldProfileConfigList: FieldProfileDefinitionSummary[] = [];
  selectedFieldProfileConfig: NamedFieldProfileConfig | null = null;
  hasFieldProfileDraftChanges: boolean = false;
  fieldProfileConfigPanelOpen: boolean = false;
  fieldProfileConfigsLoading: boolean = false;
  fieldProfilePreviewData: any[] = [];
  fieldProfilePreviewTableConfig: NamedTableConfig | null = null;

  /** Filter Chain config management state */
  filterChainConfigList: FilterChainDefinitionSummary[] = [];
  selectedFilterChainConfig: NamedFilterChainConfig | null = null;
  hasFilterChainDraftChanges: boolean = false;
  filterChainConfigPanelOpen: boolean = false;
  filterChainConfigsLoading: boolean = false;
  filterChainPreviewData: any[] = [];
  filterChainFilteredPreviewData: any[] = [];
  filterChainSampleProfile: NamedFieldProfileConfig | null = null;
  filterChainPreviewTableConfig: NamedTableConfig | null = null;
  filterChainApplyFilters: boolean = true;

  /** Loaded field profile configs (full objects, for compatibility checks) */
  loadedFieldProfileConfigs: NamedFieldProfileConfig[] = [];
  /** Loaded filter chain configs (full objects, for compatibility checks) */
  loadedFilterChainConfigs: NamedFilterChainConfig[] = [];

  /** Class poly typing for Configuration tab */
  classPolyTypingObj: classPolyTyping | null = null;

  /** Configuration tab toggle state */
  stateSpaceUpdating: boolean = false;
  geoJsonAutoCreating: boolean = false;
  editClassLoading: boolean = false;
  get isGeoJsonEnabled(): boolean { return this.geoJsonConfigList.length > 0; }

  /** Available frontend solutions for the current class */
  availableFrontendSolutions: { name: string; data: NoCodeSolutionRawData }[] = [];

  @ViewChild(DisplayRendererComponent) dashboardRenderer?: DisplayRendererComponent;

  /** Display editor mode state */
  displayEditMode: boolean = false;
  displayShowGridlines: boolean = false;
  selectedDisplayCell: {row: DisplayRow, startSegment: number, spanSegments: number, availableWidth: number} | null = null;
  selectedDisplayColumnCell: {column: DisplayColumn, startSegment: number, spanSegments: number, availableHeight: number} | null = null;

  /** Measured width of the dashboard-renderer container */
  rendererContainerWidth: number = 0;

  private componentId: string = 'ClassMainPageComponent';
  private previousClassName?: string;
  private subscriptions: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    protected polariService: PolariService,
    protected typingService: ClassTypingService,
    private crudeManager: CRUDEservicesManager,
    private dashboardFactory: DefaultDisplayFactory,
    private dashboardConfig: DisplayConfigService,
    private displayManager: DisplayManagerService,
    private tableDefService: TableDefinitionService,
    private graphDefService: GraphDefinitionService,
    private geoJsonDefService: GeoJsonDefinitionService,
    private dataSetDefService: DataSetDefinitionService,
    private fieldProfileDefService: FieldProfileDefinitionService,
    private filterChainDefService: FilterChainDefinitionService,
    private noCodeSolutionService: NoCodeSolutionStateService
  ) {}

  ngOnInit() {
    // Subscribe to display list updates
    const displayListSub = this.displayManager.displayList$.subscribe(list => {
      this.displayList = list;
    });
    this.subscriptions.push(displayListSub);

    const displayLoadingSub = this.displayManager.loading$.subscribe(l => {
      this.displaysLoading = l;
    });
    this.subscriptions.push(displayLoadingSub);

    const draftChangesSub = this.displayManager.hasDraftChanges$.subscribe(dirty => {
      this.hasDraftChanges = dirty;
    });
    this.subscriptions.push(draftChangesSub);

    // Table config subscriptions
    const tableListSub = this.tableDefService.configList$.subscribe(list => {
      this.tableConfigList = list;
      this.loadDefaultDatasetDisplay(list);
    });
    this.subscriptions.push(tableListSub);

    const tableLoadingSub = this.tableDefService.loading$.subscribe(l => {
      this.tableConfigsLoading = l;
    });
    this.subscriptions.push(tableLoadingSub);

    const tableDraftSub = this.tableDefService.hasDraftChanges$.subscribe(dirty => {
      this.hasTableDraftChanges = dirty;
    });
    this.subscriptions.push(tableDraftSub);

    // Graph config subscriptions
    const graphListSub = this.graphDefService.configList$.subscribe(list => {
      this.graphConfigList = list;
    });
    this.subscriptions.push(graphListSub);

    const graphLoadingSub = this.graphDefService.loading$.subscribe(l => {
      this.graphConfigsLoading = l;
    });
    this.subscriptions.push(graphLoadingSub);

    const graphDraftSub = this.graphDefService.hasDraftChanges$.subscribe(dirty => {
      this.hasGraphDraftChanges = dirty;
    });
    this.subscriptions.push(graphDraftSub);

    // GeoJSON config subscriptions
    const geoJsonListSub = this.geoJsonDefService.configList$.subscribe(list => {
      this.geoJsonConfigList = list;
    });
    this.subscriptions.push(geoJsonListSub);

    const geoJsonLoadingSub = this.geoJsonDefService.loading$.subscribe(l => {
      this.geoJsonConfigsLoading = l;
    });
    this.subscriptions.push(geoJsonLoadingSub);

    const geoJsonDraftSub = this.geoJsonDefService.hasDraftChanges$.subscribe(dirty => {
      this.hasGeoJsonDraftChanges = dirty;
    });
    this.subscriptions.push(geoJsonDraftSub);

    // DataSet config subscriptions
    const dataSetListSub = this.dataSetDefService.configList$.subscribe(list => {
      this.dataSetConfigList = list;
    });
    this.subscriptions.push(dataSetListSub);

    const dataSetLoadingSub = this.dataSetDefService.loading$.subscribe(l => {
      this.dataSetConfigsLoading = l;
    });
    this.subscriptions.push(dataSetLoadingSub);

    const dataSetDraftSub = this.dataSetDefService.hasDraftChanges$.subscribe(dirty => {
      this.hasDataSetDraftChanges = dirty;
    });
    this.subscriptions.push(dataSetDraftSub);

    // Field Profile config subscriptions
    const fpListSub = this.fieldProfileDefService.configList$.subscribe(list => {
      this.fieldProfileConfigList = list;
      // When on DataSets sub-tab, load full configs for compatibility checks
      if (this.dataSetSubTabIndex === 2 && list.length > 0) {
        this.loadFullFieldProfileConfigs();
      }
    });
    this.subscriptions.push(fpListSub);

    const fpLoadingSub = this.fieldProfileDefService.loading$.subscribe(l => {
      this.fieldProfileConfigsLoading = l;
    });
    this.subscriptions.push(fpLoadingSub);

    const fpDraftSub = this.fieldProfileDefService.hasDraftChanges$.subscribe(dirty => {
      this.hasFieldProfileDraftChanges = dirty;
    });
    this.subscriptions.push(fpDraftSub);

    // Filter Chain config subscriptions
    const fcListSub = this.filterChainDefService.configList$.subscribe(list => {
      this.filterChainConfigList = list;
      if (this.dataSetSubTabIndex === 2 && list.length > 0) {
        this.loadFullFilterChainConfigs();
      }
    });
    this.subscriptions.push(fcListSub);

    const fcLoadingSub = this.filterChainDefService.loading$.subscribe(l => {
      this.filterChainConfigsLoading = l;
    });
    this.subscriptions.push(fcLoadingSub);

    const fcDraftSub = this.filterChainDefService.hasDraftChanges$.subscribe(dirty => {
      this.hasFilterChainDraftChanges = dirty;
    });
    this.subscriptions.push(fcDraftSub);

    // Read query params for tab targeting (e.g., ?tab=tables)
    const queryParamSub = this.route.queryParamMap.subscribe(queryParams => {
      const tab = queryParams.get('tab');
      if (tab) {
        const tabMap: { [key: string]: number } = {
          'overview': 0, 'tables': 1, 'graphs': 2, 'displays': 3,
          'configuration': 4, 'maps': 5, 'datasets': 6
        };
        const idx = tabMap[tab.toLowerCase()];
        if (idx !== undefined) {
          this.selectedTabIndex = idx;
          this.onTabChange(idx);
        }
      }
    });
    this.subscriptions.push(queryParamSub);

    const routeSub = this.route.paramMap.subscribe(paramsMap => {
      Object.keys(paramsMap['params']).forEach(param => {
        if (param == "class") {
          const newClassName = paramsMap["params"][param];

          // If className is changing, clean up old service first
          if (this.previousClassName && this.previousClassName !== newClassName) {
            // console.log(`[ClassMainPage] ClassName changing from ${this.previousClassName} to ${newClassName}`);

            // Clear old data
            this.classTypeData = undefined;
            this.dashboard = null;
            this.instanceCount = undefined;
            this.selectedDisplay = null;
            this.hasDraftChanges = false;
            this.configPanelOpen = false;
            this.selectedTableConfig = null;
            this.hasTableDraftChanges = false;
            this.tableConfigPanelOpen = false;
            this.previewInstanceData = [];
            this.selectedGraphConfig = null;
            this.hasGraphDraftChanges = false;
            this.graphConfigPanelOpen = false;
            this.selectedGeoJsonConfig = null;
            this.hasGeoJsonDraftChanges = false;
            this.geoJsonConfigPanelOpen = false;
            this.geoJsonPreviewData = [];
            this.geoJsonViewMode = 'config';
            this.selectedDataSetConfig = null;
            this.hasDataSetDraftChanges = false;
            this.dataSetConfigPanelOpen = false;
            this.dataSetPreviewInstanceData = [];
            this.dataSetFilteredPreviewData = [];
            this.dataSetSubTabIndex = 0;
            this.standaloneFilterConfig = null;
            this.standaloneFilterPreviewData = [];
            this.standaloneFilteredPreviewData = [];
            this.selectedFieldProfileConfig = null;
            this.hasFieldProfileDraftChanges = false;
            this.fieldProfileConfigPanelOpen = false;
            this.fieldProfilePreviewData = [];
            this.fieldProfilePreviewTableConfig = null;
            this.selectedFilterChainConfig = null;
            this.hasFilterChainDraftChanges = false;
            this.filterChainConfigPanelOpen = false;
            this.filterChainPreviewData = [];
            this.filterChainFilteredPreviewData = [];
            this.filterChainSampleProfile = null;
            this.filterChainPreviewTableConfig = null;
            this.loadedFieldProfileConfigs = [];
            this.loadedFilterChainConfigs = [];
            this.classPolyTypingObj = null;
            this.selectedTabIndex = 0;

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
            // console.log(`[ClassMainPage] Getting CRUDE service for: ${this.className}`);

            // Get or create the CRUDE service for this class
            this.crudeService = this.crudeManager.getCRUDEclassService(this.className);

            // Register this component as a utilizer of the service
            this.crudeService.addUtilizer(this.componentId);
            this.crudeManager.incrementUtilizerCounter(this.className);

            // console.log(`[ClassMainPage] Service registered for ${this.className}`);

            // Fetch instance count for metrics
            this.fetchInstanceCount();

            // Load table configs so Overview tab can find the default dataset display
            this.loadTableConfigsForClass();
          }
        }
      });

      // Subscribe to typing data
      const typingSub = this.typingService.polyTypingBehaviorSubject.subscribe(polyTyping => {
        // console.log("[ClassMainPage] Typing dict update received");

        if (this.className != undefined) {
          const typingData = polyTyping[this.className];
          if (typingData && Object.keys(typingData).length > 0) {
            this.classTypeData = typingData;
            this.classPolyTypingObj = this.typingService.getClassPolyTyping(this.className!);
            // console.log(`[ClassMainPage] Found typing data for ${this.className}`);

            // Generate dashboard when we have typing data
            this.generateDisplay();
          } else {
            this.classTypeData = this.classTypeData || {};
            // console.log(`[ClassMainPage] No typing data yet for ${this.className}`);
          }
        }
      });
      this.subscriptions.push(typingSub);
    });
    this.subscriptions.push(routeSub);
  }

  /**
   * Handle tab change events
   */
  onTabChange(index: number): void {
    this.selectedTabIndex = index;
    // Load table configs when switching to Overview (index 0) or Tables tab (index 1)
    if ((index === 0 || index === 1) && this.className) {
      this.loadTableConfigsForClass();
      if (index === 0) {
        this.fetchInstanceCount();
      }
    }
    // Load graph configs when switching to the Graphs tab (index 2)
    if (index === 2 && this.className) {
      this.loadGraphConfigsForClass();
    }
    // Load displays when switching to the Displays tab (index 3)
    if (index === 3 && this.className) {
      this.loadDisplaysForClass();
    }
    // Load GeoJSON configs on Configuration tab so toggle state is current
    if (index === 4 && this.className) {
      this.loadGeoJsonConfigsForClass();
    }
    // Load GeoJSON configs when switching to the GeoJSON tab (index 5)
    if (index === 5 && this.className) {
      this.loadGeoJsonConfigsForClass();
    }
    // Load configs when switching to the DataSets tab (index 6)
    if (index === 6 && this.className) {
      this.loadFieldProfileConfigsForClass();
      this.loadFilterChainConfigsForClass();
      this.loadDataSetConfigsForClass();
      // Ensure classPolyTypingObj is loaded for Field Profiles sub-tab
      if (!this.classPolyTypingObj) {
        this.classPolyTypingObj = this.typingService.getClassPolyTyping(this.className);
      }
    }
  }

  /**
   * Load displays for the current class
   */
  loadDisplaysForClass(): void {
    if (!this.className) return;
    this.displayManager.fetchDisplaysForClass(this.className);
  }

  /**
   * Open the create display dialog
   */
  openCreateDisplayDialog(): void {
    const dialogRef = this.dialog.open(CreateDisplayDialogComponent, {
      width: '480px',
      data: {}
    });

    const dialogSub = dialogRef.afterClosed().subscribe((result: { name: string; description: string } | null) => {
      if (result && this.className) {
        this.displayManager.createDisplay(result.name, result.description, this.className).subscribe({
          next: () => {
            // console.log('[ClassMainPage] Display created successfully');
          },
          error: (err: any) => {
            console.error('[ClassMainPage] Create display failed:', err);
          }
        });
      }
    });
    this.subscriptions.push(dialogSub);
  }

  /**
   * Select a display to edit inline
   */
  selectDisplay(summary: DisplaySummary): void {
    this.displayManager.loadDisplay(summary.id).subscribe({
      next: (display: Display) => {
        this.selectedDisplay = display;
        this.configPanelOpen = true;
        this.loadAvailableFrontendSolutions();
      },
      error: (err: any) => {
        console.error('[ClassMainPage] Failed to load display:', err);
      }
    });
  }

  /**
   * Deselect the current display and go back to the list
   */
  deselectDisplay(): void {
    this.selectedDisplay = null;
    this.hasDraftChanges = false;
    this.configPanelOpen = false;
    this.displayEditMode = false;
    this.displayShowGridlines = false;
    this.selectedDisplayCell = null;
    this.displayManager.draftDisplay$.next(null);
    this.displayManager.hasDraftChanges$.next(false);
    // Refresh the list
    if (this.className) {
      this.loadDisplaysForClass();
    }
  }

  /**
   * Called when a display property changes in the config panel
   */
  onDisplayPropertyChange(): void {
    if (this.selectedDisplay) {
      this.displayManager.updateDraft(this.selectedDisplay);
    }
  }

  /**
   * Add a row to the selected display
   */
  addDisplayRow(): void {
    if (!this.selectedDisplay) return;
    const row = new DisplayRow(this.selectedDisplay.rows.length, 12, 250);
    row.autoHeight = true;
    this.selectedDisplay.addRow(row);
    this.onDisplayPropertyChange();
  }

  /**
   * Remove a row from the selected display
   */
  removeDisplayRow(index: number): void {
    if (!this.selectedDisplay) return;
    this.selectedDisplay.removeRow(index);
    this.onDisplayPropertyChange();
  }

  /**
   * Save the selected display
   */
  saveDisplay(): void {
    if (!this.selectedDisplay) return;
    this.displayManager.saveDisplay(this.selectedDisplay).subscribe({
      next: () => {
        // console.log('[ClassMainPage] Display saved successfully');
        this.displayManager.fetchPublishedDisplays();
      },
      error: (err: any) => {
        console.error('[ClassMainPage] Save display failed:', err);
      }
    });
  }

  /**
   * Load frontend solutions bound to the current class
   */
  loadAvailableFrontendSolutions(): void {
    if (!this.className) {
      this.availableFrontendSolutions = [];
      return;
    }
    this.availableFrontendSolutions = this.noCodeSolutionService.getFrontendSolutionsForClass(this.className);
  }

  /**
   * Toggle linking a solution to the selected display
   */
  toggleSolutionLink(solutionName: string): void {
    if (!this.selectedDisplay) return;
    if (this.selectedDisplay.linkedSolutions.includes(solutionName)) {
      this.selectedDisplay.unlinkSolution(solutionName);
    } else {
      this.selectedDisplay.linkSolution(solutionName);
    }
    this.onDisplayPropertyChange();
  }

  /**
   * Check if a solution is linked to the selected display
   */
  isSolutionLinked(solutionName: string): boolean {
    return this.selectedDisplay?.linkedSolutions.includes(solutionName) || false;
  }

  /**
   * Toggle publish/unpublish display as standalone page
   */
  togglePublishAsPage(publish: boolean): void {
    if (!this.selectedDisplay) return;
    if (publish) {
      this.selectedDisplay.publishAsPage();
    } else {
      this.selectedDisplay.unpublishAsPage();
    }
    this.onDisplayPropertyChange();
  }

  /**
   * Delete a display
   */
  deleteDisplay(summary: DisplaySummary, event: Event): void {
    event.stopPropagation();
    this.displayManager.deleteDisplay(summary.id).subscribe({
      next: () => {
        if (this.selectedDisplay && this.selectedDisplay.id === summary.id) {
          this.deselectDisplay();
        }
        if (this.className) {
          this.loadDisplaysForClass();
        }
      },
      error: (err: any) => {
        console.error('[ClassMainPage] Delete display failed:', err);
      }
    });
  }

  // ==================== Table Config Management ====================

  /**
   * Load table configs for the current class
   */
  loadTableConfigsForClass(): void {
    if (!this.className) return;
    this.tableDefService.fetchConfigsForClass(this.className);
  }

  /**
   * Open the create table config dialog
   */
  openCreateTableConfigDialog(): void {
    const dialogRef = this.dialog.open(CreateTableConfigDialogComponent, {
      width: '480px',
      data: {}
    });

    const dialogSub = dialogRef.afterClosed().subscribe((result: { name: string; description: string } | null) => {
      if (result && this.className) {
        this.tableDefService.createConfig(result.name, result.description, this.className).subscribe({
          next: () => {
            // console.log('[ClassMainPage] Table config created successfully');
          },
          error: (err: any) => {
            console.error('[ClassMainPage] Create table config failed:', err);
          }
        });
      }
    });
    this.subscriptions.push(dialogSub);
  }

  /**
   * Select a table config to edit
   */
  selectTableConfig(summary: TableDefinitionSummary): void {
    this.tableDefService.loadConfig(summary.id, this.classTypeData).subscribe({
      next: (config: NamedTableConfig) => {
        // Initialize columns from class type data if empty
        if (config.tableConfiguration.columns.length === 0 && this.classTypeData) {
          config.tableConfiguration.initializeFromClassTypeData(this.classTypeData);
        }
        this.selectedTableConfig = config;
        this.tableConfigPanelOpen = true;

        // Load preview instance data
        this.loadPreviewData();
      },
      error: (err: any) => {
        console.error('[ClassMainPage] Failed to load table config:', err);
      }
    });
  }

  /**
   * Load preview instance data for the table config editor.
   * Parses all CRUDE response formats (mirrors templateClassTable.loadInstanceData).
   */
  private loadPreviewData(): void {
    if (!this.crudeService) return;
    this.crudeService.readAll().subscribe({
      next: (data: any) => {
        this.previewInstanceData = this.parseCrudeInstances(data);
      },
      error: () => {
        this.previewInstanceData = [];
      }
    });
  }

  /**
   * Parse CRUDE response into a flat array of instances.
   * Handles all backend response formats:
   *   Format 1: { class: "Name", data: [...] }
   *   Format 2: [{ "ClassName": [{ class, data }] }]  (wrapped dataSets)
   *   Format 3: Direct array of instances
   */
  private parseCrudeInstances(data: any): any[] {
    if (!data) return [];

    // Format 1: { class: "Name", varsLimited: [], data: [...instances] }
    if (typeof data === 'object' && !Array.isArray(data) && data.hasOwnProperty('data') && data.hasOwnProperty('class')) {
      return Array.isArray(data.data) ? data.data : [];
    }

    // Format 2: Array — could be wrapped dataSets or direct instances
    if (Array.isArray(data) && data.length > 0) {
      // Format 1 wrapped in an array: [{ class, data }]
      if (data.length === 1 && data[0].hasOwnProperty('class') && data[0].hasOwnProperty('data')) {
        return Array.isArray(data[0].data) ? data[0].data : [];
      }

      // Keyed by className: [{ "ClassName": [...dataSets] }]
      if (this.className && data[0][this.className]) {
        const classData = data[0][this.className];

        if (typeof classData === 'object' && !Array.isArray(classData) && Object.keys(classData).length === 0) {
          return [];
        }

        if (Array.isArray(classData)) {
          // Array of dataSets: [{ class, data: [...] }]
          if (classData.length > 0 && classData[0].hasOwnProperty('data') && classData[0].hasOwnProperty('class')) {
            const instances: any[] = [];
            classData.forEach((ds: any) => {
              if (Array.isArray(ds.data)) {
                instances.push(...ds.data);
              }
            });
            return this.deduplicateInstances(instances);
          }
          // Direct array of instances
          return classData;
        }
      }

      // Check if array items look like instances (have id fields)
      if (data[0].id !== undefined || data[0]._id !== undefined) {
        return data;
      }
    }

    // Fallback: { data: [...] }
    if (data && data.data && Array.isArray(data.data)) {
      return this.deduplicateInstances(data.data);
    }

    return [];
  }

  /** Remove duplicate instances by id/_id */
  private deduplicateInstances(instances: any[]): any[] {
    if (instances.length === 0) return instances;
    const seen = new Set<string>();
    return instances.filter((inst: any) => {
      const id = inst?.id ?? inst?._id;
      if (id == null) return true;
      const key = String(id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Deselect table config and go back to list
   */
  deselectTableConfig(): void {
    this.selectedTableConfig = null;
    this.hasTableDraftChanges = false;
    this.tableConfigPanelOpen = false;
    this.previewInstanceData = [];
    this.tableDefService.draftConfig$.next(null);
    this.tableDefService.hasDraftChanges$.next(false);
    if (this.className) {
      this.loadTableConfigsForClass();
    }
  }

  /**
   * Handle table config changes from sidebar.
   * Creates a new object reference so class-data-table's ngOnChanges detects
   * the update and re-initializes the table with the new configuration.
   */
  onTableConfigChange(config: NamedTableConfig): void {
    // Create a new reference so Angular change detection picks it up
    const updated = Object.assign(new NamedTableConfig(config.id, config.name, config.description, config.source_class), config);
    this.selectedTableConfig = updated;
    this.tableDefService.updateDraft(updated);
  }

  /**
   * Save the selected table config
   */
  saveTableConfig(): void {
    if (!this.selectedTableConfig) return;
    const config = this.selectedTableConfig;
    const sourceClass = config.source_class;

    // If this config is being set as a default, clear other defaults first
    const clearOps: Observable<void>[] = [];
    if (config.is_default_table) {
      clearOps.push(this.tableDefService.clearOtherDefaults(sourceClass, config.id, 'is_default_table'));
    }
    if (config.is_default_instance_display) {
      clearOps.push(this.tableDefService.clearOtherDefaults(sourceClass, config.id, 'is_default_instance_display'));
    }
    if (config.is_default_dataset_display) {
      clearOps.push(this.tableDefService.clearOtherDefaults(sourceClass, config.id, 'is_default_dataset_display'));
    }

    const doSave = () => {
      this.tableDefService.saveConfig(config).subscribe({
        next: () => {
          // Refresh the list to reflect updated default flags
          this.tableDefService.fetchConfigsForClass(sourceClass);
        },
        error: (err: any) => {
          console.error('[ClassMainPage] Save table config failed:', err);
        }
      });
    };

    if (clearOps.length > 0) {
      forkJoin(clearOps).subscribe({ next: doSave, error: doSave });
    } else {
      doSave();
    }
  }

  /**
   * Delete a table config
   */
  deleteTableConfig(summary: TableDefinitionSummary, event: Event): void {
    event.stopPropagation();
    this.tableDefService.deleteConfig(summary.id).subscribe({
      next: () => {
        if (this.selectedTableConfig && this.selectedTableConfig.id === summary.id) {
          this.deselectTableConfig();
        }
        if (this.className) {
          this.loadTableConfigsForClass();
        }
      },
      error: (err: any) => {
        console.error('[ClassMainPage] Delete table config failed:', err);
      }
    });
  }

  // ==================== Graph Config Management ====================

  /**
   * Load graph configs for the current class
   */
  loadGraphConfigsForClass(): void {
    if (!this.className) return;
    this.graphDefService.fetchConfigsForClass(this.className);
  }

  /**
   * Open the create graph config dialog
   */
  openCreateGraphConfigDialog(): void {
    const dialogRef = this.dialog.open(CreateGraphConfigDialogComponent, {
      width: '480px',
      data: {}
    });

    const dialogSub = dialogRef.afterClosed().subscribe((result: { name: string; description: string } | null) => {
      if (result && this.className) {
        this.graphDefService.createConfig(result.name, result.description, this.className).subscribe({
          next: () => {
            // console.log('[ClassMainPage] Graph config created successfully');
          },
          error: (err: any) => {
            console.error('[ClassMainPage] Create graph config failed:', err);
          }
        });
      }
    });
    this.subscriptions.push(dialogSub);
  }

  /**
   * Select a graph config to edit
   */
  selectGraphConfig(summary: GraphDefinitionSummary): void {
    this.graphDefService.loadConfig(summary.id).subscribe({
      next: (config: NamedGraphConfig) => {
        this.selectedGraphConfig = config;
        this.graphConfigPanelOpen = true;
        this.loadGraphPreviewData();
      },
      error: (err: any) => {
        console.error('[ClassMainPage] Failed to load graph config:', err);
      }
    });
  }

  /**
   * Load preview instance data for graph rendering.
   */
  private loadGraphPreviewData(): void {
    if (!this.crudeService) return;
    this.crudeService.readAll().subscribe({
      next: (data: any) => {
        this.graphPreviewData = this.parseCrudeInstances(data);
      },
      error: () => {
        this.graphPreviewData = [];
      }
    });
  }

  /**
   * Deselect graph config and go back to list
   */
  deselectGraphConfig(): void {
    this.selectedGraphConfig = null;
    this.hasGraphDraftChanges = false;
    this.graphConfigPanelOpen = false;
    this.graphPreviewData = [];
    this.graphDefService.draftConfig$.next(null);
    this.graphDefService.hasDraftChanges$.next(false);
    if (this.className) {
      this.loadGraphConfigsForClass();
    }
  }

  /**
   * Handle graph config changes from sidebar.
   * Creates a new object reference so Angular change detection picks it up.
   */
  onGraphConfigChange(config: NamedGraphConfig): void {
    const updated = Object.assign(
      new NamedGraphConfig(config.id, config.name, config.description, config.source_class),
      config
    );
    this.selectedGraphConfig = updated;
    this.graphDefService.updateDraft(updated);
  }

  /**
   * Save the selected graph config
   */
  saveGraphConfig(): void {
    if (!this.selectedGraphConfig) return;
    this.graphDefService.saveConfig(this.selectedGraphConfig).subscribe({
      next: () => {
        // console.log('[ClassMainPage] Graph config saved successfully');
      },
      error: (err: any) => {
        console.error('[ClassMainPage] Save graph config failed:', err);
      }
    });
  }

  /**
   * Delete a graph config
   */
  deleteGraphConfig(summary: GraphDefinitionSummary, event: Event): void {
    event.stopPropagation();
    this.graphDefService.deleteConfig(summary.id).subscribe({
      next: () => {
        if (this.selectedGraphConfig && this.selectedGraphConfig.id === summary.id) {
          this.deselectGraphConfig();
        }
        if (this.className) {
          this.loadGraphConfigsForClass();
        }
      },
      error: (err: any) => {
        console.error('[ClassMainPage] Delete graph config failed:', err);
      }
    });
  }

  // ==================== GeoJSON Config Management ====================

  /**
   * Load GeoJSON configs for the current class
   */
  loadGeoJsonConfigsForClass(): void {
    if (!this.className) return;
    this.geoJsonDefService.fetchConfigsForClass(this.className);
  }

  /**
   * Open the create GeoJSON config dialog
   */
  openCreateGeoJsonConfigDialog(): void {
    const dialogRef = this.dialog.open(CreateGeoJsonConfigDialogComponent, {
      width: '480px',
      data: {}
    });

    const dialogSub = dialogRef.afterClosed().subscribe((result: { name: string; description: string } | null) => {
      if (result && this.className) {
        this.geoJsonDefService.createConfig(result.name, result.description, this.className).subscribe({
          next: () => {
            // console.log('[ClassMainPage] GeoJSON config created successfully');
          },
          error: (err: any) => {
            console.error('[ClassMainPage] Create GeoJSON config failed:', err);
          }
        });
      }
    });
    this.subscriptions.push(dialogSub);
  }

  /**
   * Select a GeoJSON config to edit
   */
  selectGeoJsonConfig(summary: GeoJsonDefinitionSummary): void {
    this.geoJsonDefService.loadConfig(summary.id).subscribe({
      next: (config: NamedGeoJsonConfig) => {
        this.selectedGeoJsonConfig = config;
        this.geoJsonConfigPanelOpen = true;
        this.loadGeoJsonPreviewData();
      },
      error: (err: any) => {
        console.error('[ClassMainPage] Failed to load GeoJSON config:', err);
      }
    });
  }

  /**
   * Load preview instance data for GeoJSON map rendering.
   */
  private loadGeoJsonPreviewData(): void {
    if (!this.crudeService) return;
    this.crudeService.readAll().subscribe({
      next: (data: any) => {
        this.geoJsonPreviewData = this.parseCrudeInstances(data);
        this.buildGeoJsonMixedFeatures();
      },
      error: () => {
        this.geoJsonPreviewData = [];
        this.geoJsonMixedFeatures = null;
      }
    });
  }

  /**
   * Build a mixed GeoJSON FeatureCollection from polygon/line geometry variables in the preview data.
   * This enables polygon/line shape rendering in both the config tab and data view map-renderers.
   */
  private buildGeoJsonMixedFeatures(): void {
    const gc = this.selectedGeoJsonConfig?.geoJsonConfig;
    if (!gc || !gc.geometryVariable || !this.geoJsonPreviewData?.length) {
      this.geoJsonMixedFeatures = null;
      return;
    }
    if (gc.coordinateMode !== 'polygon_center' && gc.coordinateMode !== 'line_center') {
      this.geoJsonMixedFeatures = null;
      return;
    }

    const features: GeoJSON.Feature[] = [];
    const unresolvedRefs: { refClass: string; instanceIds: string[]; styleName: string }[] = [];

    for (const instance of this.geoJsonPreviewData) {
      const rawValue = instance[gc.geometryVariable];
      if (!rawValue) continue;
      try {
        const parsed = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;

        if (gc.coordinateMode === 'polygon_center') {
          if (parsed.vertices && Array.isArray(parsed.vertices) && parsed.vertices.length >= 3) {
            const ring: [number, number][] = [...parsed.vertices];
            const first = ring[0];
            const last = ring[ring.length - 1];
            if (first[0] !== last[0] || first[1] !== last[1]) {
              ring.push([...first] as [number, number]);
            }
            const polyStyle = getMapPolygonStyle(parsed.style_name || 'default-polygon');
            features.push({
              type: 'Feature',
              geometry: { type: 'Polygon', coordinates: [ring] },
              properties: {
                _geometryType: 'polygon',
                _fillColor: polyStyle?.fillColor || '#1976d2',
                _fillOpacity: polyStyle?.fillOpacity ?? 0.25,
                _outlineColor: polyStyle?.outlineColor || '#0d47a1',
                _outlineWidth: polyStyle?.outlineWidth ?? 2,
                _outlineOpacity: polyStyle?.outlineOpacity ?? 1,
                _centerLng: parsed.center_lng,
                _centerLat: parsed.center_lat,
                _effectiveCenterLng: (parsed.center_lng || 0) + (parsed.center_offset_lng || 0),
                _effectiveCenterLat: (parsed.center_lat || 0) + (parsed.center_offset_lat || 0),
                _areaSqMeters: parsed.area_sq_meters || 0
              }
            });
          } else if (parsed.ref_class && parsed.instance_ids?.length >= 3) {
            unresolvedRefs.push({
              refClass: parsed.ref_class,
              instanceIds: parsed.instance_ids,
              styleName: parsed.style_name || 'default-polygon'
            });
          }
        } else if (gc.coordinateMode === 'line_center') {
          if (parsed.vertices && Array.isArray(parsed.vertices) && parsed.vertices.length >= 2) {
            const lineStyle = getMapLineStyle(parsed.style_name || 'default-line');
            features.push({
              type: 'Feature',
              geometry: { type: 'LineString', coordinates: parsed.vertices },
              properties: {
                _geometryType: 'line',
                _lineColor: lineStyle?.lineColor || '#1976d2',
                _lineWidth: lineStyle?.lineWidth ?? 3,
                _lineOpacity: lineStyle?.lineOpacity ?? 1
              }
            });
          } else if (parsed.ref_class && parsed.instance_ids?.length >= 2) {
            unresolvedRefs.push({
              refClass: parsed.ref_class,
              instanceIds: parsed.instance_ids,
              styleName: parsed.style_name || 'default-line'
            });
          }
        }
      } catch { /* invalid JSON */ }
    }

    if (features.length > 0) {
      this.geoJsonMixedFeatures = { type: 'FeatureCollection', features };
    } else {
      this.geoJsonMixedFeatures = null;
    }

    // Resolve legacy refs without inline vertices
    if (unresolvedRefs.length > 0) {
      this.resolveLegacyGeoJsonRefs(unresolvedRefs, features);
    }
  }

  /**
   * Resolve legacy geometry references (ref_class + instance_ids without vertices)
   * by fetching the referenced class instances and extracting coordinates.
   */
  private resolveLegacyGeoJsonRefs(
    refs: { refClass: string; instanceIds: string[]; styleName: string }[],
    existingFeatures: GeoJSON.Feature[]
  ): void {
    const gc = this.selectedGeoJsonConfig!.geoJsonConfig;
    const byClass = new Map<string, typeof refs>();
    for (const ref of refs) {
      if (!byClass.has(ref.refClass)) byClass.set(ref.refClass, []);
      byClass.get(ref.refClass)!.push(ref);
    }

    for (const [refClass, classRefs] of byClass) {
      const backendUrl = this.polariService.getBackendBaseUrl();
      this.geoJsonDefService.fetchAllGeoJsonDefs().subscribe({
        next: (defs) => {
          const matchingDef = defs.find((d: any) => d.source_class === refClass);
          if (!matchingDef) return;

          const refConfig = NamedGeoJsonConfig.fromBackend(matchingDef);
          const refGc = refConfig.geoJsonConfig;

          this.http.get<any>(`${backendUrl}/${refClass}`).subscribe({
            next: (response: any) => {
              const instances = this.parseCrudeInstances(response);
              const instanceMap = new Map<string, any>();
              for (const inst of instances) {
                const id = inst.id || inst._id || inst._instanceId;
                if (id) instanceMap.set(String(id), inst);
              }

              const newFeatures = [...existingFeatures];
              for (const ref of classRefs) {
                const coords: [number, number][] = [];
                for (const instId of ref.instanceIds) {
                  const inst = instanceMap.get(instId);
                  if (!inst) continue;
                  const coord = refConfig.extractCoordinates(inst, refGc);
                  if (coord) coords.push(coord);
                }

                if (gc.coordinateMode === 'polygon_center' && coords.length >= 3) {
                  const ring = [...coords];
                  const first = ring[0]; const last = ring[ring.length - 1];
                  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([...first] as [number, number]);
                  const polyStyle = getMapPolygonStyle(ref.styleName);
                  const avgLng = coords.reduce((s, c) => s + c[0], 0) / coords.length;
                  const avgLat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
                  newFeatures.push({
                    type: 'Feature',
                    geometry: { type: 'Polygon', coordinates: [ring] },
                    properties: {
                      _geometryType: 'polygon',
                      _fillColor: polyStyle?.fillColor || '#1976d2',
                      _fillOpacity: polyStyle?.fillOpacity ?? 0.25,
                      _outlineColor: polyStyle?.outlineColor || '#0d47a1',
                      _outlineWidth: polyStyle?.outlineWidth ?? 2,
                      _outlineOpacity: polyStyle?.outlineOpacity ?? 1,
                      _centerLng: avgLng, _centerLat: avgLat,
                      _effectiveCenterLng: avgLng, _effectiveCenterLat: avgLat
                    }
                  });
                } else if (gc.coordinateMode === 'line_center' && coords.length >= 2) {
                  const lineStyle = getMapLineStyle(ref.styleName);
                  newFeatures.push({
                    type: 'Feature',
                    geometry: { type: 'LineString', coordinates: coords },
                    properties: {
                      _geometryType: 'line',
                      _lineColor: lineStyle?.lineColor || '#1976d2',
                      _lineWidth: lineStyle?.lineWidth ?? 3,
                      _lineOpacity: lineStyle?.lineOpacity ?? 1
                    }
                  });
                }
              }

              if (newFeatures.length > 0) {
                this.geoJsonMixedFeatures = { type: 'FeatureCollection', features: newFeatures };
              }
            }
          });
        }
      });
    }
  }

  /**
   * Deselect GeoJSON config and go back to list
   */
  deselectGeoJsonConfig(): void {
    this.selectedGeoJsonConfig = null;
    this.hasGeoJsonDraftChanges = false;
    this.geoJsonConfigPanelOpen = false;
    this.geoJsonPreviewData = [];
    this.geoJsonMixedFeatures = null;
    this.geoJsonViewMode = 'config';
    this.geoJsonDefService.draftConfig$.next(null);
    this.geoJsonDefService.hasDraftChanges$.next(false);
    if (this.className) {
      this.loadGeoJsonConfigsForClass();
    }
  }

  /**
   * Handle GeoJSON config changes from sidebar.
   * Creates a new object reference so Angular change detection picks it up.
   */
  onGeoJsonConfigChange(config: NamedGeoJsonConfig): void {
    const updated = Object.assign(
      new NamedGeoJsonConfig(config.id, config.name, config.description, config.source_class),
      config
    );
    this.selectedGeoJsonConfig = updated;
    this.geoJsonDefService.updateDraft(updated);
    this.buildGeoJsonMixedFeatures();
  }

  /**
   * Save the selected GeoJSON config
   */
  saveGeoJsonConfig(): void {
    if (!this.selectedGeoJsonConfig) return;
    this.geoJsonDefService.saveConfig(this.selectedGeoJsonConfig).subscribe({
      next: () => {
        // console.log('[ClassMainPage] GeoJSON config saved successfully');
      },
      error: (err: any) => {
        console.error('[ClassMainPage] Save GeoJSON config failed:', err);
      }
    });
  }

  /**
   * Delete a GeoJSON config
   */
  deleteGeoJsonConfig(summary: GeoJsonDefinitionSummary, event: Event): void {
    event.stopPropagation();
    this.geoJsonDefService.deleteConfig(summary.id).subscribe({
      next: () => {
        if (this.selectedGeoJsonConfig && this.selectedGeoJsonConfig.id === summary.id) {
          this.deselectGeoJsonConfig();
        }
        if (this.className) {
          this.loadGeoJsonConfigsForClass();
        }
      },
      error: (err: any) => {
        console.error('[ClassMainPage] Delete GeoJSON config failed:', err);
      }
    });
  }

  /**
   * Switch GeoJSON view mode, loading data if needed.
   */
  onGeoJsonViewModeChange(mode: 'config' | 'data' | 'features'): void {
    this.geoJsonViewMode = mode;
    if ((mode === 'data' || mode === 'features') && this.geoJsonPreviewData.length === 0) {
      this.loadGeoJsonPreviewData();
    }
  }

  /**
   * Handle instance data changes from the data view (after location updates).
   */
  onGeoJsonInstanceDataChange(data: any[]): void {
    this.geoJsonPreviewData = data;
  }

  // ==================== DataSets Sub-Tab Management ====================

  onDataSetSubTabChange(index: number): void {
    this.dataSetSubTabIndex = index;
    // Field Profiles sub-tab (index 0)
    if (index === 0 && this.className) {
      this.loadFieldProfileConfigsForClass();
    }
    // Filter Chains sub-tab (index 1)
    if (index === 1 && this.className) {
      this.loadFilterChainConfigsForClass();
    }
    // Filter Chains sub-tab: also load field profiles for the sample dropdown
    if (index === 1 && this.className) {
      this.loadFieldProfileConfigsForClass();
    }
    // Data Sets sub-tab (index 2): load everything + full configs for compatibility
    if (index === 2 && this.className) {
      this.loadDataSetConfigsForClass();
      this.loadFieldProfileConfigsForClass();
      this.loadFilterChainConfigsForClass();
    }
  }

  // ===== Field Profiles helpers =====

  getFieldProfileNames(): string[] {
    if (!this.classPolyTypingObj?.fieldProfiles) return [];
    return Object.keys(this.classPolyTypingObj.fieldProfiles);
  }

  getFieldProfileEntryCount(profileName: string): number {
    const profile = this.classPolyTypingObj?.fieldProfiles?.[profileName];
    return profile ? Object.keys(profile).length : 0;
  }

  getFieldProfileEntries(profileName: string): { varName: string; config: any }[] {
    const profile = this.classPolyTypingObj?.fieldProfiles?.[profileName];
    if (!profile) return [];
    return Object.entries(profile).map(([varName, config]) => ({ varName, config }));
  }

  // ===== Standalone Filter Chain helpers =====

  private loadStandaloneFilterPreviewData(): void {
    if (!this.crudeService) return;
    this.crudeService.readAll().subscribe({
      next: (data: any) => {
        this.standaloneFilterPreviewData = this.parseCrudeInstances(data);
        this.applyStandaloneFilters();
      },
      error: () => {
        this.standaloneFilterPreviewData = [];
        this.standaloneFilteredPreviewData = [];
      }
    });
  }

  onStandaloneFilterChange(editable: FilterChainEditable): void {
    if (!this.standaloneFilterConfig) return;
    this.standaloneFilterConfig.filterChainLinks = editable.filterChainLinks;
    this.standaloneFilterConfig.segments = editable.segments || [];
    this.standaloneFilterConfig.disableUserConfigChanges = editable.disableUserConfigChanges;
    this.applyStandaloneFilters();
  }

  private applyStandaloneFilters(): void {
    if (!this.standaloneFilterConfig) {
      this.standaloneFilteredPreviewData = this.standaloneFilterPreviewData;
      return;
    }
    this.standaloneFilteredPreviewData = this.standaloneFilterConfig.applyToInstances(this.standaloneFilterPreviewData);
  }

  // ==================== Field Profile Config Management ====================

  loadFieldProfileConfigsForClass(): void {
    if (!this.className) return;
    this.fieldProfileDefService.fetchConfigsForClass(this.className);
  }

  openCreateFieldProfileDialog(): void {
    const dialogRef = this.dialog.open(CreateFieldProfileDialogComponent, {
      width: '480px',
      data: {}
    });

    const dialogSub = dialogRef.afterClosed().subscribe((result: { name: string; description: string } | null) => {
      if (result && this.className) {
        this.fieldProfileDefService.createConfig(result.name, result.description, this.className).subscribe({
          next: () => {},
          error: (err: any) => {
            console.error('[ClassMainPage] Create field profile config failed:', err);
          }
        });
      }
    });
    this.subscriptions.push(dialogSub);
  }

  selectFieldProfileConfig(summary: FieldProfileDefinitionSummary): void {
    this.fieldProfileDefService.loadConfig(summary.id).subscribe({
      next: (config: NamedFieldProfileConfig) => {
        this.selectedFieldProfileConfig = config;
        this.fieldProfileConfigPanelOpen = true;
        // Auto-initialize own fields and references if empty
        if (config.ownFields.length === 0 && this.classTypeData) {
          config.initializeOwnFields(this.classTypeData);
        }
        if (config.referencedObjects.length === 0) {
          config.initializeReferencedObjects(this.classTypeData, this.classPolyTypingObj?.inheritsFrom);
        }
        this.buildFieldProfilePreviewTableConfig();
        this.loadFieldProfilePreviewData();
      },
      error: (err: any) => {
        console.error('[ClassMainPage] Failed to load field profile config:', err);
      }
    });
  }

  deselectFieldProfileConfig(): void {
    this.selectedFieldProfileConfig = null;
    this.hasFieldProfileDraftChanges = false;
    this.fieldProfileConfigPanelOpen = false;
    this.fieldProfilePreviewData = [];
    this.fieldProfilePreviewTableConfig = null;
    this.fieldProfileDefService.draftConfig$.next(null);
    this.fieldProfileDefService.hasDraftChanges$.next(false);
    if (this.className) {
      this.loadFieldProfileConfigsForClass();
    }
  }

  onFieldProfileConfigChange(config: NamedFieldProfileConfig): void {
    this.selectedFieldProfileConfig = config;
    this.fieldProfileDefService.updateDraft(config);
    this.buildFieldProfilePreviewTableConfig();
  }

  saveFieldProfileConfig(): void {
    if (!this.selectedFieldProfileConfig) return;
    this.fieldProfileDefService.saveConfig(this.selectedFieldProfileConfig).subscribe({
      next: () => {},
      error: (err: any) => {
        console.error('[ClassMainPage] Save field profile config failed:', err);
      }
    });
  }

  deleteFieldProfileConfig(summary: FieldProfileDefinitionSummary, event: Event): void {
    event.stopPropagation();
    this.fieldProfileDefService.deleteConfig(summary.id).subscribe({
      next: () => {
        if (this.selectedFieldProfileConfig && this.selectedFieldProfileConfig.id === summary.id) {
          this.deselectFieldProfileConfig();
        }
        if (this.className) {
          this.loadFieldProfileConfigsForClass();
        }
      },
      error: (err: any) => {
        console.error('[ClassMainPage] Delete field profile config failed:', err);
      }
    });
  }

  private loadFieldProfilePreviewData(): void {
    if (!this.crudeService) return;
    this.crudeService.readAll().subscribe({
      next: (data: any) => {
        this.fieldProfilePreviewData = this.parseCrudeInstances(data);
      },
      error: () => {
        this.fieldProfilePreviewData = [];
      }
    });
  }

  /**
   * Builds a transient (non-saveable) NamedTableConfig that reflects the field profile's
   * included own fields AND enabled referenced object fields.
   *
   * We build explicit ColumnConfiguration entries for every column that should appear,
   * and mark everything else as removed so the data table doesn't auto-add them.
   */
  private buildFieldProfilePreviewTableConfig(): void {
    if (!this.selectedFieldProfileConfig || !this.className) {
      this.fieldProfilePreviewTableConfig = null;
      return;
    }
    const fp = this.selectedFieldProfileConfig;
    const preview = new NamedTableConfig('_fp_preview', 'Field Profile Preview', '', this.className);

    // Collect the set of reference variable names so we can exclude them from own-field columns.
    // (The data table would strip these anyway for parent refs, but being explicit avoids confusion.)
    const refVarNames = new Set(fp.referencedObjects.map(r => r.varName));

    // Build the column list from scratch — only what the profile says should be visible.
    const columns: ColumnConfiguration[] = [];
    let order = 0;

    // 1. Own fields (excluding reference-type variables that have a referencedObjects entry)
    for (const field of fp.ownFields) {
      if (!field.included) continue;
      if (refVarNames.has(field.name)) continue; // skip — handled as ref below
      columns.push(new ColumnConfiguration(field.name, {
        visible: true,
        order: order++,
        dataType: field.dataType
      }));
    }

    // 2. Referenced object fields as dot-notation columns
    for (const ref of fp.referencedObjects) {
      if (!ref.enabled) continue;
      for (const field of ref.fields) {
        if (!field.included) continue;
        columns.push(new ColumnConfiguration(`${ref.varName}.${field.name}`, {
          visible: true,
          order: order++,
          dataType: field.dataType
        }));
      }
    }

    preview.tableConfiguration.columns = columns;

    // Disable CRUD since this is just a preview
    preview.crudPermissions = { allowCreate: false, allowEdit: false, allowDelete: false };

    this.fieldProfilePreviewTableConfig = preview;
  }

  /**
   * Quick-save the current field profile preview as a named table config.
   * Creates a table named "{fieldProfileName}-table" from the current preview state.
   */
  quickSaveFieldProfileAsTable(): void {
    if (!this.selectedFieldProfileConfig || !this.fieldProfilePreviewTableConfig || !this.className) return;

    const tableName = `${this.selectedFieldProfileConfig.name}-table`;
    const tableDesc = `Auto-generated from field profile "${this.selectedFieldProfileConfig.name}"`;

    this.tableDefService.createConfig(tableName, tableDesc, this.className).subscribe({
      next: (response: any) => {
        // Extract the created ID
        const createdId = response?.id;
        if (!createdId) {
          this.snackBar.open('Table created but could not retrieve ID to save config', 'OK', { duration: 4000 });
          return;
        }

        // Build a saveable table config from the preview
        const tableConfig = new NamedTableConfig(createdId, tableName, tableDesc, this.className!);
        if (this.classTypeData) {
          tableConfig.tableConfiguration.initializeFromClassTypeData(this.classTypeData);
        }

        // Apply own-field visibility
        const includedOwnFields = new Set(
          this.selectedFieldProfileConfig!.ownFields.filter(f => f.included).map(f => f.name)
        );
        for (const col of tableConfig.tableConfiguration.columns) {
          col.visible = includedOwnFields.has(col.name);
        }

        // Save the definition
        this.tableDefService.saveConfig(tableConfig).subscribe({
          next: () => {
            this.snackBar.open(`Table "${tableName}" created`, 'OK', { duration: 3000 });
          },
          error: (err: any) => {
            console.error('[ClassMainPage] Failed to save quick table config:', err);
            this.snackBar.open('Failed to save table configuration', 'OK', { duration: 4000 });
          }
        });
      },
      error: (err: any) => {
        console.error('[ClassMainPage] Failed to create quick table:', err);
        this.snackBar.open('Failed to create table', 'OK', { duration: 4000 });
      }
    });
  }

  // ==================== Filter Chain Config Management ====================

  loadFilterChainConfigsForClass(): void {
    if (!this.className) return;
    this.filterChainDefService.fetchConfigsForClass(this.className);
  }

  openCreateFilterChainDialog(): void {
    const dialogRef = this.dialog.open(CreateFilterChainDialogComponent, {
      width: '480px',
      data: {}
    });

    const dialogSub = dialogRef.afterClosed().subscribe((result: { name: string; description: string } | null) => {
      if (result && this.className) {
        this.filterChainDefService.createConfig(result.name, result.description, this.className).subscribe({
          next: () => {},
          error: (err: any) => {
            console.error('[ClassMainPage] Create filter chain config failed:', err);
          }
        });
      }
    });
    this.subscriptions.push(dialogSub);
  }

  selectFilterChainConfig(summary: FilterChainDefinitionSummary): void {
    this.filterChainDefService.loadConfig(summary.id).subscribe({
      next: (config: NamedFilterChainConfig) => {
        this.selectedFilterChainConfig = config;
        this.filterChainConfigPanelOpen = true;
        this.filterChainSampleProfile = null;
        this.filterChainPreviewTableConfig = null;
        // If the chain has a saved sample profile, load it
        if (config.sampleFieldProfileId) {
          this.loadFilterChainSampleProfile(config.sampleFieldProfileId);
        }
        this.loadFilterChainPreviewData();
      },
      error: (err: any) => {
        console.error('[ClassMainPage] Failed to load filter chain config:', err);
      }
    });
  }

  deselectFilterChainConfig(): void {
    this.selectedFilterChainConfig = null;
    this.hasFilterChainDraftChanges = false;
    this.filterChainConfigPanelOpen = false;
    this.filterChainPreviewData = [];
    this.filterChainFilteredPreviewData = [];
    this.filterChainSampleProfile = null;
    this.filterChainPreviewTableConfig = null;
    this.filterChainApplyFilters = true;
    this.filterChainDefService.draftConfig$.next(null);
    this.filterChainDefService.hasDraftChanges$.next(false);
    if (this.className) {
      this.loadFilterChainConfigsForClass();
    }
  }

  onFilterChainConfigChange(editable: FilterChainEditable): void {
    if (!this.selectedFilterChainConfig) return;
    this.selectedFilterChainConfig.filterChainLinks = editable.filterChainLinks;
    this.selectedFilterChainConfig.segments = editable.segments || [];
    this.selectedFilterChainConfig.disableUserConfigChanges = editable.disableUserConfigChanges;
    this.filterChainDefService.updateDraft(this.selectedFilterChainConfig);
    this.applyFilterChainFilters();
  }

  saveFilterChainConfig(): void {
    if (!this.selectedFilterChainConfig) return;
    this.filterChainDefService.saveConfig(this.selectedFilterChainConfig).subscribe({
      next: () => {},
      error: (err: any) => {
        console.error('[ClassMainPage] Save filter chain config failed:', err);
      }
    });
  }

  deleteFilterChainConfig(summary: FilterChainDefinitionSummary, event: Event): void {
    event.stopPropagation();
    this.filterChainDefService.deleteConfig(summary.id).subscribe({
      next: () => {
        if (this.selectedFilterChainConfig && this.selectedFilterChainConfig.id === summary.id) {
          this.deselectFilterChainConfig();
        }
        if (this.className) {
          this.loadFilterChainConfigsForClass();
        }
      },
      error: (err: any) => {
        console.error('[ClassMainPage] Delete filter chain config failed:', err);
      }
    });
  }

  private loadFilterChainPreviewData(): void {
    if (!this.crudeService) return;
    this.crudeService.readAll().subscribe({
      next: (data: any) => {
        this.filterChainPreviewData = this.parseCrudeInstances(data);
        this.applyFilterChainFilters();
      },
      error: () => {
        this.filterChainPreviewData = [];
        this.filterChainFilteredPreviewData = [];
      }
    });
  }

  applyFilterChainFilters(): void {
    if (!this.selectedFilterChainConfig || !this.filterChainApplyFilters) {
      this.filterChainFilteredPreviewData = this.filterChainPreviewData;
      return;
    }
    this.filterChainFilteredPreviewData = this.selectedFilterChainConfig.applyToInstances(this.filterChainPreviewData);
  }

  onFilterChainApplyToggle(checked: boolean): void {
    this.filterChainApplyFilters = checked;
    this.applyFilterChainFilters();
  }

  onFilterChainSampleProfileChange(profileId: string): void {
    if (!this.selectedFilterChainConfig) return;
    this.selectedFilterChainConfig.sampleFieldProfileId = profileId;
    this.filterChainDefService.updateDraft(this.selectedFilterChainConfig);
    if (profileId) {
      this.loadFilterChainSampleProfile(profileId);
    } else {
      this.filterChainSampleProfile = null;
      this.filterChainPreviewTableConfig = null;
    }
  }

  private loadFilterChainSampleProfile(profileId: string): void {
    this.fieldProfileDefService.loadConfig(profileId).subscribe({
      next: (profile: NamedFieldProfileConfig) => {
        // Initialize the profile if needed
        if (profile.ownFields.length === 0 && this.classTypeData) {
          profile.initializeOwnFields(this.classTypeData);
        }
        if (profile.referencedObjects.length === 0) {
          profile.initializeReferencedObjects(this.classTypeData, this.classPolyTypingObj?.inheritsFrom);
        }
        this.filterChainSampleProfile = profile;
        this.buildFilterChainPreviewTableConfig();
      },
      error: () => {
        this.filterChainSampleProfile = null;
        this.filterChainPreviewTableConfig = null;
      }
    });
  }

  /**
   * Build a preview table config for the filter chain editor using the sample profile.
   * Reuses the same logic as the field profile preview builder.
   */
  private buildFilterChainPreviewTableConfig(): void {
    if (!this.filterChainSampleProfile || !this.className) {
      this.filterChainPreviewTableConfig = null;
      return;
    }
    const fp = this.filterChainSampleProfile;
    const preview = new NamedTableConfig('_fc_preview', 'Filter Chain Preview', '', this.className);
    const refVarNames = new Set(fp.referencedObjects.map(r => r.varName));
    const columns: ColumnConfiguration[] = [];
    let order = 0;
    for (const field of fp.ownFields) {
      if (!field.included) continue;
      if (refVarNames.has(field.name)) continue;
      columns.push(new ColumnConfiguration(field.name, { visible: true, order: order++, dataType: field.dataType }));
    }
    for (const ref of fp.referencedObjects) {
      if (!ref.enabled) continue;
      for (const field of ref.fields) {
        if (!field.included) continue;
        columns.push(new ColumnConfiguration(`${ref.varName}.${field.name}`, { visible: true, order: order++, dataType: field.dataType }));
      }
    }
    preview.tableConfiguration.columns = columns;
    preview.crudPermissions = { allowCreate: false, allowEdit: false, allowDelete: false };
    this.filterChainPreviewTableConfig = preview;
  }

  // ==================== Full Config Loading (for compatibility) ====================

  /**
   * Load full NamedFieldProfileConfig objects for all profiles in the current class.
   * Used for compatibility checking in the DataSet editor.
   */
  loadFullFieldProfileConfigs(): void {
    this.loadedFieldProfileConfigs = [];
    for (const summary of this.fieldProfileConfigList) {
      this.fieldProfileDefService.loadConfig(summary.id).subscribe({
        next: (config: NamedFieldProfileConfig) => {
          if (config.ownFields.length === 0 && this.classTypeData) {
            config.initializeOwnFields(this.classTypeData);
          }
          if (config.referencedObjects.length === 0) {
            config.initializeReferencedObjects(this.classTypeData, this.classPolyTypingObj?.inheritsFrom);
          }
          // Replace or add
          const idx = this.loadedFieldProfileConfigs.findIndex(c => c.id === config.id);
          if (idx >= 0) this.loadedFieldProfileConfigs[idx] = config;
          else this.loadedFieldProfileConfigs.push(config);
        }
      });
    }
  }

  loadFullFilterChainConfigs(): void {
    this.loadedFilterChainConfigs = [];
    for (const summary of this.filterChainConfigList) {
      this.filterChainDefService.loadConfig(summary.id).subscribe({
        next: (config: NamedFilterChainConfig) => {
          const idx = this.loadedFilterChainConfigs.findIndex(c => c.id === config.id);
          if (idx >= 0) this.loadedFilterChainConfigs[idx] = config;
          else this.loadedFilterChainConfigs.push(config);
        }
      });
    }
  }

  /**
   * Get filter chains compatible with the currently selected field profile in the DataSet editor.
   * A chain is compatible if the profile includes all the fields the chain filters on.
   */
  getCompatibleFilterChains(): FilterChainDefinitionSummary[] {
    if (!this.selectedDataSetConfig) return this.filterChainConfigList;
    const profileId = this.selectedDataSetConfig.field_profile_id;
    if (!profileId) return this.filterChainConfigList; // no profile = all fields available

    const profile = this.loadedFieldProfileConfigs.find(p => p.id === profileId);
    if (!profile) return this.filterChainConfigList; // profile not loaded yet, show all

    return this.filterChainConfigList.filter(summary => {
      const chain = this.loadedFilterChainConfigs.find(c => c.id === summary.id);
      if (!chain) return true; // not loaded yet, show as option
      if (chain.filterChainLinks.length === 0) return true; // no filters = always compatible
      return profile.includesAllFields(chain.getUsedFieldNames());
    });
  }

  /**
   * Get field profiles compatible with the currently selected filter chain in the DataSet editor.
   * A profile is compatible if it includes all the fields the chain filters on.
   */
  getCompatibleFieldProfiles(): FieldProfileDefinitionSummary[] {
    if (!this.selectedDataSetConfig) return this.fieldProfileConfigList;
    const chainId = this.selectedDataSetConfig.filter_chain_id;
    if (!chainId) return this.fieldProfileConfigList; // no chain = any profile works

    const chain = this.loadedFilterChainConfigs.find(c => c.id === chainId);
    if (!chain) return this.fieldProfileConfigList; // not loaded yet
    if (chain.filterChainLinks.length === 0) return this.fieldProfileConfigList; // no filters

    const usedFields = chain.getUsedFieldNames();
    return this.fieldProfileConfigList.filter(summary => {
      const profile = this.loadedFieldProfileConfigs.find(p => p.id === summary.id);
      if (!profile) return true; // not loaded yet
      return profile.includesAllFields(usedFields);
    });
  }

  // ==================== DataSet Config Management ====================

  loadDataSetConfigsForClass(): void {
    if (!this.className) return;
    this.dataSetDefService.fetchConfigsForClass(this.className);
  }

  openCreateDataSetConfigDialog(): void {
    const dialogRef = this.dialog.open(CreateDataSetConfigDialogComponent, {
      width: '480px',
      data: {}
    });

    const dialogSub = dialogRef.afterClosed().subscribe((result: { name: string; description: string } | null) => {
      if (result && this.className) {
        this.dataSetDefService.createConfig(result.name, result.description, this.className).subscribe({
          next: () => {},
          error: (err: any) => {
            console.error('[ClassMainPage] Create dataset config failed:', err);
          }
        });
      }
    });
    this.subscriptions.push(dialogSub);
  }

  selectDataSetConfig(summary: DataSetDefinitionSummary): void {
    this.dataSetDefService.loadConfig(summary.id).subscribe({
      next: (config: NamedDataSetConfig) => {
        this.selectedDataSetConfig = config;
        this.dataSetConfigPanelOpen = true;
        this.loadDataSetPreviewData();
      },
      error: (err: any) => {
        console.error('[ClassMainPage] Failed to load dataset config:', err);
      }
    });
  }

  private loadDataSetPreviewData(): void {
    if (!this.crudeService) return;
    this.crudeService.readAll().subscribe({
      next: (data: any) => {
        this.dataSetPreviewInstanceData = this.parseCrudeInstances(data);
        this.applyDataSetFilters();
      },
      error: () => {
        this.dataSetPreviewInstanceData = [];
        this.dataSetFilteredPreviewData = [];
      }
    });
  }

  applyDataSetFilters(): void {
    if (!this.selectedDataSetConfig) {
      this.dataSetFilteredPreviewData = this.dataSetPreviewInstanceData;
      return;
    }
    this.dataSetFilteredPreviewData = this.selectedDataSetConfig.applyToInstances(this.dataSetPreviewInstanceData);
  }

  deselectDataSetConfig(): void {
    this.selectedDataSetConfig = null;
    this.hasDataSetDraftChanges = false;
    this.dataSetConfigPanelOpen = false;
    this.dataSetPreviewInstanceData = [];
    this.dataSetFilteredPreviewData = [];
    this.dataSetDefService.draftConfig$.next(null);
    this.dataSetDefService.hasDraftChanges$.next(false);
    if (this.className) {
      this.loadDataSetConfigsForClass();
    }
  }

  onDataSetConfigChange(editable: FilterChainEditable): void {
    if (!this.selectedDataSetConfig) return;
    this.selectedDataSetConfig.filterChainLinks = editable.filterChainLinks;
    this.selectedDataSetConfig.segments = editable.segments || [];
    this.selectedDataSetConfig.disableUserConfigChanges = editable.disableUserConfigChanges;
    this.dataSetDefService.updateDraft(this.selectedDataSetConfig);
    this.applyDataSetFilters();
  }

  onDataSetFieldProfileChange(profileId: string): void {
    if (!this.selectedDataSetConfig) return;
    this.selectedDataSetConfig.field_profile_id = profileId;
    this.dataSetDefService.updateDraft(this.selectedDataSetConfig);
  }

  onDataSetFilterChainChange(chainId: string): void {
    if (!this.selectedDataSetConfig) return;
    this.selectedDataSetConfig.filter_chain_id = chainId;
    this.dataSetDefService.updateDraft(this.selectedDataSetConfig);
  }

  saveDataSetConfig(): void {
    if (!this.selectedDataSetConfig) return;
    this.dataSetDefService.saveConfig(this.selectedDataSetConfig).subscribe({
      next: () => {},
      error: (err: any) => {
        console.error('[ClassMainPage] Save dataset config failed:', err);
      }
    });
  }

  deleteDataSetConfig(summary: DataSetDefinitionSummary, event: Event): void {
    event.stopPropagation();
    this.dataSetDefService.deleteConfig(summary.id).subscribe({
      next: () => {
        if (this.selectedDataSetConfig && this.selectedDataSetConfig.id === summary.id) {
          this.deselectDataSetConfig();
        }
        if (this.className) {
          this.loadDataSetConfigsForClass();
        }
      },
      error: (err: any) => {
        console.error('[ClassMainPage] Delete dataset config failed:', err);
      }
    });
  }

  // ==================== Configuration Tab Toggle Handlers ====================

  onStateSpaceToggle(newValue: boolean): void {
    if (!this.className || !this.classPolyTypingObj) return;
    const previousValue = this.classPolyTypingObj.config.isStateSpaceObject;
    // Optimistically update so the toggle reflects the new state
    this.classPolyTypingObj.config.isStateSpaceObject = newValue;
    this.stateSpaceUpdating = true;
    const baseUrl = this.polariService.getBackendBaseUrl();
    this.http.post(`${baseUrl}/updateClassConfig`, {
      className: this.className,
      config: { isStateSpaceObject: newValue }
    }).subscribe({
      next: () => {
        this.stateSpaceUpdating = false;
        this.snackBar.open(
          `State-Space ${newValue ? 'enabled' : 'disabled'} for ${this.className}`,
          'OK', { duration: 3000 }
        );
      },
      error: (err: any) => {
        // Revert on failure
        this.classPolyTypingObj!.config.isStateSpaceObject = previousValue;
        this.stateSpaceUpdating = false;
        if (err.status === 404 || err.status === 0) {
          this.snackBar.open(
            'Could not update class config — backend may need to be updated to support this endpoint.',
            'Dismiss', { duration: 6000 }
          );
        } else {
          this.snackBar.open(
            `Failed to update State-Space config: ${err.statusText || err.message || 'Unknown error'}`,
            'Dismiss', { duration: 5000 }
          );
        }
      }
    });
  }

  onGeoJsonToggle(newValue: boolean): void {
    if (!this.className) return;

    if (newValue && this.geoJsonConfigList.length === 0) {
      this.geoJsonAutoCreating = true;
      this.geoJsonDefService.createConfig(
        'Default Map Config',
        'Auto-created GeoJSON configuration',
        this.className
      ).subscribe({
        next: () => {
          this.geoJsonAutoCreating = false;
          this.snackBar.open(
            'Default GeoJSON configuration created.',
            'OK', { duration: 3000 }
          );
        },
        error: (err: any) => {
          this.geoJsonAutoCreating = false;
          if (err.status === 404 || err.status === 0) {
            this.snackBar.open(
              'Could not create GeoJSON config — the GeoJsonDefinition backend class may not be available.',
              'Dismiss', { duration: 6000 }
            );
          } else {
            this.snackBar.open(
              `Failed to create GeoJSON config: ${err.statusText || err.message || 'Unknown error'}`,
              'Dismiss', { duration: 5000 }
            );
          }
        }
      });
    } else if (!newValue) {
      this.snackBar.open(
        'Existing GeoJSON configurations are preserved. Remove them from the GeoJSON tab if needed.',
        'OK', { duration: 4000 }
      );
    }
  }

  navigateToGeoJsonTab(): void {
    this.selectedTabIndex = 5;
  }

  // ==================== Edit Class Definition ====================

  openEditClassDialog(): void {
    if (!this.className || !this.classPolyTypingObj) return;

    this.editClassLoading = true;
    const baseUrl = this.polariService.getBackendBaseUrl();

    this.http.get<any>(`${baseUrl}/createClass`).subscribe({
      next: (response) => {
        this.editClassLoading = false;
        const classInfo = response.dynamicClasses?.[this.className!];
        if (!classInfo) {
          this.snackBar.open('Could not load class definition for editing.', 'Dismiss', { duration: 5000 });
          return;
        }

        const dialogRef = this.dialog.open(EditClassDialogComponent, {
          width: '900px',
          maxHeight: '80vh',
          data: {
            className: this.className,
            displayName: classInfo.displayName,
            variables: classInfo.variables
          }
        });

        const dialogSub = dialogRef.afterClosed().subscribe(result => {
          if (result) {
            this.snackBar.open(`Class "${this.className}" updated successfully.`, 'OK', { duration: 3000 });
            // Refresh typing data by re-fetching instance counts (triggers nav rebuild)
            this.typingService.fetchClassInstanceCounts();
          }
        });
        this.subscriptions.push(dialogSub);
      },
      error: (err) => {
        this.editClassLoading = false;
        this.snackBar.open('Failed to load class definition.', 'Dismiss', { duration: 5000 });
      }
    });
  }

  // ==================== Display Editor Mode ====================

  /**
   * Toggle grid guidelines visibility
   */
  toggleDisplayGridlines(): void {
    this.displayShowGridlines = !this.displayShowGridlines;
  }

  /**
   * Toggle edit mode (also enables gridlines when entering edit mode)
   */
  toggleDisplayEditMode(): void {
    this.displayEditMode = !this.displayEditMode;
    if (this.displayEditMode) {
      this.displayShowGridlines = true;
      // Load table & graph configs for the palette
      if (this.className) {
        this.loadTableConfigsForClass();
        this.loadGraphConfigsForClass();
      }
    } else {
      this.selectedDisplayCell = null;
      this.selectedDisplayColumnCell = null;
    }
  }

  /**
   * Handle cell selection from the dashboard renderer
   */
  onDisplayCellSelected(event: {row: DisplayRow, startSegment: number, spanSegments: number, availableWidth: number} | null): void {
    this.selectedDisplayCell = event || null;
    // Clear column selection when a row cell is selected
    if (event) this.selectedDisplayColumnCell = null;
  }

  /**
   * Handle column cell selection from the dashboard renderer
   */
  onDisplayColumnCellSelected(event: {column: DisplayColumn, startSegment: number, spanSegments: number, availableHeight: number} | null): void {
    this.selectedDisplayColumnCell = event || null;
    // Clear row selection when a column cell is selected
    if (event) this.selectedDisplayCell = null;
  }

  /**
   * Handle container width measurement from the dashboard renderer
   */
  onRendererWidthMeasured(width: number): void {
    this.rendererContainerWidth = width;
  }

  /**
   * Handle item removal from the dashboard renderer
   */
  onDisplayItemRemoved(event: {row: DisplayRow, itemIndex: number}): void {
    event.row.removeItem(event.itemIndex);
    this.selectedDisplayCell = null;
    if (this.dashboardRenderer) {
      this.dashboardRenderer.clearSelection();
    }
    this.onDisplayPropertyChange();
  }

  /**
   * Handle item removal from a column in the dashboard renderer
   */
  onDisplayColumnItemRemoved(event: {column: DisplayColumn, itemIndex: number}): void {
    event.column.removeItem(event.itemIndex);
    this.selectedDisplayColumnCell = null;
    if (this.dashboardRenderer) {
      this.dashboardRenderer.clearColumnSelection();
    }
    this.onDisplayPropertyChange();
  }

  /**
   * Place a component into the currently selected cell.
   * Sets gridColumnStart so the item appears at the exact grid position.
   */
  placeComponentInCell(type: 'table' | 'graph' | 'text' | 'metric' | 'container' | 'column-container', configId?: string, configName?: string): void {
    // Column container: adds a column to the selected row
    if (type === 'column-container') {
      this.placeColumnContainerInCell();
      return;
    }

    // For placing items into a column's vertical cell
    if (this.selectedDisplayColumnCell && !this.selectedDisplayCell) {
      this.placeComponentInColumnCell(type, configId, configName);
      return;
    }

    if (!this.selectedDisplayCell || !this.selectedDisplay) {
      this.snackBar.open('Select an empty cell in the grid first', 'OK', { duration: 3000 });
      return;
    }

    const { row, startSegment, spanSegments } = this.selectedDisplayCell;

    let item: DisplayItem;
    switch (type) {
      case 'table':
        item = DisplayItem.createComponentItem('embeddedTable', { tableConfigId: configId }, spanSegments);
        if (configName) item.setTitle(configName);
        break;
      case 'graph':
        item = DisplayItem.createComponentItem('embeddedGraph', { graphConfigId: configId }, spanSegments);
        if (configName) item.setTitle(configName);
        break;
      case 'text':
        item = DisplayItem.createTextItem('New text block', spanSegments);
        break;
      case 'metric':
        item = DisplayItem.createMetricItem('Metric', 0, spanSegments);
        break;
      case 'container': {
        const containerAvailableWidth = this.selectedDisplayCell.availableWidth;
        const maxCols = this.calculateMaxColumnsForConfig(
          this.calculateNestedWidthForConfig(containerAvailableWidth, spanSegments, row.rowSegments)
        );
        if (maxCols === 0) {
          this.snackBar.open('Container too narrow to hold any grid columns', 'OK', { duration: 3000 });
          return;
        }
        const initialSegments = Math.min(12, maxCols);
        item = DisplayItem.createRowContainerItem(spanSegments, initialSegments);
        item.setTitle('Row Container');
        break;
      }
      default:
        return;
    }

    // Pin the item to the selected grid position
    item.gridColumnStart = startSegment;
    row.addItem(item);
    this.selectedDisplayCell = null;
    this.selectedDisplayColumnCell = null;
    if (this.dashboardRenderer) {
      this.dashboardRenderer.clearSelection();
      this.dashboardRenderer.clearColumnSelection();
    }
    this.onDisplayPropertyChange();
  }

  /**
   * Place a Column Container into the currently selected row cell.
   * Adds a DisplayColumn to the row using the selected horizontal segments.
   */
  private placeColumnContainerInCell(): void {
    if (!this.selectedDisplayCell || !this.selectedDisplay) {
      this.snackBar.open('Select an empty cell in a row first', 'OK', { duration: 3000 });
      return;
    }

    const { row, startSegment, spanSegments } = this.selectedDisplayCell;
    const column = new DisplayColumn(row.columns.length, spanSegments, 12, 250);
    column.gridColumnStart = startSegment;
    row.addColumn(column);

    this.selectedDisplayCell = null;
    this.selectedDisplayColumnCell = null;
    if (this.dashboardRenderer) {
      this.dashboardRenderer.clearSelection();
      this.dashboardRenderer.clearColumnSelection();
    }
    this.onDisplayPropertyChange();
  }

  /**
   * Place a component into the currently selected column cell (vertical placement).
   */
  private placeComponentInColumnCell(type: 'table' | 'graph' | 'text' | 'metric' | 'container', configId?: string, configName?: string): void {
    if (!this.selectedDisplayColumnCell || !this.selectedDisplay) {
      this.snackBar.open('Select an empty cell in a column first', 'OK', { duration: 3000 });
      return;
    }

    const { column, startSegment, spanSegments } = this.selectedDisplayColumnCell;

    let item: DisplayItem;
    switch (type) {
      case 'table':
        item = DisplayItem.createComponentItem('embeddedTable', { tableConfigId: configId }, spanSegments);
        if (configName) item.setTitle(configName);
        break;
      case 'graph':
        item = DisplayItem.createComponentItem('embeddedGraph', { graphConfigId: configId }, spanSegments);
        if (configName) item.setTitle(configName);
        break;
      case 'text':
        item = DisplayItem.createTextItem('New text block', spanSegments);
        break;
      case 'metric':
        item = DisplayItem.createMetricItem('Metric', 0, spanSegments);
        break;
      case 'container':
        item = DisplayItem.createContainerItem(spanSegments);
        item.setTitle('Container');
        break;
      default:
        return;
    }

    // Pin the item to the selected vertical position
    item.gridColumnStart = startSegment;
    column.addItem(item);
    this.selectedDisplayCell = null;
    this.selectedDisplayColumnCell = null;
    if (this.dashboardRenderer) {
      this.dashboardRenderer.clearSelection();
      this.dashboardRenderer.clearColumnSelection();
    }
    this.onDisplayPropertyChange();
  }

  /**
   * Add a nested row to a container item
   */
  addNestedRow(containerItem: DisplayItem, parentAvailableWidth: number, parentRowSegments: number): void {
    if (!containerItem || containerItem.type !== 'container') return;
    const maxCols = this.calculateMaxColumnsForConfig(
      this.calculateNestedWidthForConfig(parentAvailableWidth, containerItem.rowSegmentsUsed, parentRowSegments)
    );
    const segments = maxCols > 0 ? Math.min(12, maxCols) : 12;
    const newRow = new DisplayRow(containerItem.nestedRows.length, segments, 150);
    newRow.autoHeight = true;
    containerItem.addNestedRow(newRow);
    this.onDisplayPropertyChange();
  }

  /**
   * Remove a nested row from a container item
   */
  removeNestedRow(containerItem: DisplayItem, rowIndex: number): void {
    if (!containerItem || containerItem.type !== 'container') return;
    containerItem.removeNestedRow(rowIndex);
    this.onDisplayPropertyChange();
  }

  /**
   * Add a column to a row from the config panel
   */
  addColumnToRow(row: DisplayRow): void {
    // Calculate total segments used by items and existing columns
    const itemSegments = row.getUsedSegments();
    const columnSegments = row.getColumnsUsedSegments();
    const totalUsed = itemSegments + columnSegments;
    const remainingSegments = row.rowSegments - totalUsed;
    if (remainingSegments <= 0) {
      this.snackBar.open('No remaining segments in this row', 'OK', { duration: 3000 });
      return;
    }
    const segmentsForColumn = Math.min(remainingSegments, 6);
    const column = new DisplayColumn(row.columns.length, segmentsForColumn, 12, 250);
    // Auto-place after all existing occupied segments
    column.gridColumnStart = totalUsed + 1;
    row.addColumn(column);
    this.onDisplayPropertyChange();
  }

  /**
   * Remove a column from a row
   */
  removeColumnFromRow(row: DisplayRow, columnIndex: number): void {
    row.removeColumn(columnIndex);
    this.onDisplayPropertyChange();
  }

  // ==================== Display State Definition ====================

  addDisplayDataSource(): void {
    if (!this.selectedDisplay) return;
    this.selectedDisplay.stateDefinition.addDataSource({
      id: crypto.randomUUID(),
      label: '',
      sourceType: 'class',
      autoLoad: true
    });
    this.onDisplayPropertyChange();
  }

  removeDisplayDataSource(index: number): void {
    if (!this.selectedDisplay) return;
    this.selectedDisplay.stateDefinition.dataSources.splice(index, 1);
    this.onDisplayPropertyChange();
  }

  addDisplayInput(): void {
    if (!this.selectedDisplay) return;
    this.selectedDisplay.stateDefinition.addInput({
      name: '',
      label: '',
      dataType: 'string',
      required: false
    });
    this.onDisplayPropertyChange();
  }

  removeDisplayInput(index: number): void {
    if (!this.selectedDisplay) return;
    this.selectedDisplay.stateDefinition.inputs.splice(index, 1);
    this.onDisplayPropertyChange();
  }

  // ==================== Width Calculation (Config Panel) ====================

  private static readonly EDIT_GAP = 6;
  private static readonly NORMAL_GAP = 16;
  private static readonly NESTED_PAD = 8;
  private static readonly MIN_CELL = 40;

  /**
   * Calculate nested width for config panel hints.
   * Mirrors DisplayRendererComponent.calculateNestedWidth.
   */
  calculateNestedWidthForConfig(parentWidthPx: number, itemSegments: number, parentSegments: number): number {
    const gap = this.displayEditMode ? ClassMainPageComponent.EDIT_GAP : ClassMainPageComponent.NORMAL_GAP;
    const colWidth = (parentWidthPx - gap * (parentSegments - 1)) / parentSegments;
    const itemWidth = colWidth * itemSegments + gap * (itemSegments - 1);
    return itemWidth - 2 * ClassMainPageComponent.NESTED_PAD;
  }

  /**
   * Calculate max columns for config panel hints.
   * Mirrors DisplayRendererComponent.calculateMaxColumns.
   */
  calculateMaxColumnsForConfig(availableWidthPx: number): number {
    const gap = this.displayEditMode ? ClassMainPageComponent.EDIT_GAP : ClassMainPageComponent.NORMAL_GAP;
    if (availableWidthPx < ClassMainPageComponent.MIN_CELL) return 0;
    return Math.max(1, Math.floor((availableWidthPx + gap) / (ClassMainPageComponent.MIN_CELL + gap)));
  }

  /**
   * Get icon for a display item type
   */
  getItemIcon(type: string): string {
    switch (type) {
      case 'metric': return 'analytics';
      case 'text': return 'text_fields';
      case 'component': return 'widgets';
      case 'table': return 'table_chart';
      case 'graph': return 'show_chart';
      case 'container': return 'view_module';
      default: return 'help_outline';
    }
  }

  /**
   * Generates the default dashboard for this class
   */
  private generateDisplay(): void {
    if (!this.className) return;

    // console.log(`[ClassMainPage] Generating dashboard for ${this.className}`);

    // Create default dashboard using factory
    this.dashboard = this.dashboardFactory.createDefaultClassDisplay(
      this.className,
      this.classTypeData,
      this.instanceCount
    );

    // Apply any saved configuration
    const config = this.dashboardConfig.loadDisplayConfig(this.dashboard.id);
    if (config) {
      // console.log(`[ClassMainPage] Applying saved dashboard config`);
      this.dashboard = this.dashboardConfig.applyConfig(this.dashboard, config);
    }
  }

  /**
   * Load the default dataset display config when the table config list updates.
   */
  private loadDefaultDatasetDisplay(list: TableDefinitionSummary[]): void {
    const defaultSummary = list.find(s => s.is_default_dataset_display);
    if (!defaultSummary) {
      this.defaultDatasetConfig = null;
      return;
    }
    // Only reload if the ID changed
    if (this.defaultDatasetConfig && this.defaultDatasetConfig.id === defaultSummary.id) {
      return;
    }
    this.tableDefService.loadConfigSilent(defaultSummary.id, this.classTypeData).subscribe({
      next: (config: NamedTableConfig) => {
        this.defaultDatasetConfig = config;
      },
      error: (err: any) => {
        console.warn('[ClassMainPage] Failed to load default dataset display config:', err);
        this.defaultDatasetConfig = null;
      }
    });
  }

  /**
   * Fetches the instance count for display in metrics
   */
  private fetchInstanceCount(): void {
    if (!this.crudeService) return;

    this.crudeService.readAll().subscribe({
      next: (data: any) => {
        const instances = this.parseCrudeInstances(data);
        this.instanceCount = instances.length;
        this.overviewInstanceData = instances;

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
      // console.log(`[ClassMainPage] Cleaning up service for ${this.className}`);
      this.crudeService.removeUtilizer(this.componentId);
      this.crudeManager.decrementUtilizerCounter(this.className);
      this.crudeManager.cleanupUnusedService(this.className);
    }
  }
}
