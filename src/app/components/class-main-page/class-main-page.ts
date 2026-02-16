import { Component, OnDestroy, ViewChild } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
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
import { DisplayItem } from '@models/dashboards/DisplayItem';
import { DisplaySummary } from '@models/dashboards/DisplaySummary';
import { CreateDisplayDialogComponent } from '@components/dashboard/create-display-dialog/create-display-dialog';
import { TableDefinitionService } from '@services/table/table-definition.service';
import { NamedTableConfig, TableDefinitionSummary } from '@models/tables/NamedTableConfig';
import { CreateTableConfigDialogComponent } from '@components/table-config/create-table-config-dialog/create-table-config-dialog';
import { GraphDefinitionService } from '@services/graph/graph-definition.service';
import { NamedGraphConfig, GraphDefinitionSummary } from '@models/graphs/NamedGraphConfig';
import { CreateGraphConfigDialogComponent } from '@components/graph-config/create-graph-config-dialog/create-graph-config-dialog';
import { DisplayRendererComponent } from '@components/dashboard/dashboard-renderer/dashboard-renderer';
import { Subscription } from 'rxjs';

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

  @ViewChild(DisplayRendererComponent) dashboardRenderer?: DisplayRendererComponent;

  /** Display editor mode state */
  displayEditMode: boolean = false;
  displayShowGridlines: boolean = false;
  selectedDisplayCell: {row: DisplayRow, startSegment: number, spanSegments: number, availableWidth: number} | null = null;

  /** Measured width of the dashboard-renderer container */
  rendererContainerWidth: number = 0;

  private componentId: string = 'ClassMainPageComponent';
  private previousClassName?: string;
  private subscriptions: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    protected polariService: PolariService,
    protected typingService: ClassTypingService,
    private crudeManager: CRUDEservicesManager,
    private dashboardFactory: DefaultDisplayFactory,
    private dashboardConfig: DisplayConfigService,
    private displayManager: DisplayManagerService,
    private tableDefService: TableDefinitionService,
    private graphDefService: GraphDefinitionService
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
   * Handle tab change events
   */
  onTabChange(index: number): void {
    this.selectedTabIndex = index;
    // Load table configs when switching to the Tables tab (index 1)
    if (index === 1 && this.className) {
      this.loadTableConfigsForClass();
    }
    // Load graph configs when switching to the Graphs tab (index 2)
    if (index === 2 && this.className) {
      this.loadGraphConfigsForClass();
    }
    // Load displays when switching to the Displays tab (index 3)
    if (index === 3 && this.className) {
      this.loadDisplaysForClass();
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
            console.log('[ClassMainPage] Display created successfully');
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
        console.log('[ClassMainPage] Display saved successfully');
      },
      error: (err: any) => {
        console.error('[ClassMainPage] Save display failed:', err);
      }
    });
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
            console.log('[ClassMainPage] Table config created successfully');
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
            return instances;
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
      return data.data;
    }

    return [];
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
    this.tableDefService.saveConfig(this.selectedTableConfig).subscribe({
      next: () => {
        console.log('[ClassMainPage] Table config saved successfully');
      },
      error: (err: any) => {
        console.error('[ClassMainPage] Save table config failed:', err);
      }
    });
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
            console.log('[ClassMainPage] Graph config created successfully');
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
        console.log('[ClassMainPage] Graph config saved successfully');
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
    }
  }

  /**
   * Handle cell selection from the dashboard renderer
   */
  onDisplayCellSelected(event: {row: DisplayRow, startSegment: number, spanSegments: number, availableWidth: number} | null): void {
    this.selectedDisplayCell = event || null;
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
   * Place a component into the currently selected cell.
   * Sets gridColumnStart so the item appears at the exact grid position.
   */
  placeComponentInCell(type: 'table' | 'graph' | 'text' | 'metric' | 'container', configId?: string, configName?: string): void {
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
    if (this.dashboardRenderer) {
      this.dashboardRenderer.clearSelection();
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
