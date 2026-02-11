// Author: Dustin Etts
// polari-platform-angular/src/app/components/custom-no-code/custom-no-code.ts
import { Component, Renderer2, HostListener, ElementRef, ChangeDetectorRef, ViewChild, ViewContainerRef, AfterViewInit, OnDestroy, OnInit } from '@angular/core';
import { NoCodeState } from '@models/noCode/NoCodeState';
import { NoCodeSolution } from '@models/noCode/NoCodeSolution';
import { Slot } from '@models/noCode/Slot';
import { CdkDragStart, CdkDragEnd } from '@angular/cdk/drag-drop';
import { BehaviorSubject, Subject } from "rxjs";
import { debounceTime, takeUntil } from 'rxjs/operators';
import { OverlayComponentService } from '../../services/no-code-services/overlay-component-service';
import * as d3 from 'd3';
import { NoCodeStateInstanceComponent } from './no-code-state-instance/no-code-state-instance';
import { NoCodeStateRendererManager } from '@services/no-code-services/no-code-state-renderer-manager';
import { InteractionStateService } from '@services/no-code-services/interaction-state-service';
import { NoCodeSolutionStateService } from '@services/no-code-services/no-code-solution-state.service';
import { StateOverlayManager } from '@services/no-code-services/state-overlay-manager.service';
import { StateOverlayComponent } from './state-overlay/state-overlay.component';
import { ConditionalChainOverlayComponent } from './conditional-chain-overlay/conditional-chain-overlay.component';
import { FilterListOverlayComponent } from './filter-list-overlay/filter-list-overlay.component';
import { VariableAssignmentOverlayComponent } from './variable-assignment-overlay/variable-assignment-overlay.component';
import { InitialStateOverlayComponent } from './initial-state-overlay/initial-state-overlay.component';
import { MathOperationOverlayComponent } from './math-operation-overlay/math-operation-overlay.component';
import { CircleStateLayer } from '@models/noCode/d3-extensions/CircleStateLayer';
import { RectangleStateLayer } from '@models/noCode/d3-extensions/RectangleStateLayer';
import { DiamondStateLayer } from '@models/noCode/d3-extensions/DiamondStateLayer';
import { StateDefinition } from '@models/noCode/StateDefinition';
import { StateDefinitionService } from '@services/no-code-services/state-definition.service';
import { StateToolItem, BoundClassDefinition, ClassMemberStateRequest, HelperClassDefinition, SubSolutionDefinition } from './state-tool-sidebar/state-tool-sidebar.component';
import { StateSpaceClassRegistry } from '@models/stateSpace/stateSpaceClassRegistry';
import { PythonCodeGeneratorService } from '@services/no-code-services/python-code-generator.service';
import { StateContextMenuAction, SIZE_PRESETS } from './state-context-menu/state-context-menu.component';
import { SlotConfiguration, InputMappingMode, OutputMappingMode, ProducedVariable } from './slot-configuration-popup/slot-configuration-popup.component';
import { StateSlotManagerConfig, SolutionSlotDefaults } from './state-slot-manager-popup/state-slot-manager-popup.component';
import { PotentialContext } from '@models/stateSpace/solutionContext';

// An Editor which creates a new No-Code Solution by default.
@Component({
  standalone: false,
  selector: 'custom-no-code',
  templateUrl: 'custom-no-code.html',
  styleUrls: ['./custom-no-code.css']
})
export class CustomNoCodeComponent implements OnInit, AfterViewInit, OnDestroy
{
  @ViewChild('graphContainer', { read: ViewContainerRef, static: false }) graphContainerRef!: ViewContainerRef;

  boxes: any[] = [
    { x: 100, y: 100, width: 100, height: 100, id: 1 },
    { x: 300, y: 200, width: 100, height: 100, id: 2 }
  ];

  //@ts-ignore
  @ViewChild('d3Graph', { static: true }) d3Graph: ElementRef;

  polariAccessNodeSubject = new BehaviorSubject<NoCodeState>(new NoCodeState());

  contextMenu: boolean = false;
  stateInstances: NoCodeState[] = [];

  noCodeSolution: NoCodeSolution | undefined;

  // Solution selector state
  availableSolutions: { id: number; name: string }[] = [];
  selectedSolutionName: string | null = null;

  // Used for binding the overlay which displays State Object UIs and their container elements to the d3 Objects.
  overlayStateSegments: { [key: number]: HTMLElement | null } = {};

  makeConnectionsMode: boolean = false;
  sourceNode: any = null;
  d3GraphRenderingSVG: any;

  // For cleanup
  private destroy$ = new Subject<void>();
  private resizeSubject = new Subject<void>();

  // Default viewBox dimensions (logical coordinate space)
  private viewBoxWidth = 1200;
  private viewBoxHeight = 800;

  // Zoom/pan related
  private zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown> | null = null;
  private zoomContainer: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
  private currentZoom = 1;
  zoomPercent = 100; // For template binding
  private readonly minZoom = 0.1;
  private readonly maxZoom = 4;

  // Solution options - rendering debug visibility
  showRenderingDebug = false;  // Toggle visibility of bounding boxes and paths
  showSlotLabels = true;       // Toggle visibility of slot labels
  showConnectorLabels = false; // Toggle visibility of connector labels

  // Current state layers for overlay callbacks
  private currentCircleStateLayer: CircleStateLayer | null = null;
  private currentRectangleStateLayer: RectangleStateLayer | null = null;
  private currentDiamondStateLayer: DiamondStateLayer | null = null;

  // State context menu
  stateContextMenuVisible = false;
  contextMenuPosition = { x: 0, y: 0 };
  contextMenuStateName = '';
  contextMenuStateGroup: SVGGElement | null = null;
  contextMenuShapeType = 'circle';
  contextMenuCurrentSize = 100;

  // Slot manager popup
  slotManagerVisible = false;
  slotManagerPosition = { x: 0, y: 0 };
  slotManagerStateName = '';
  slotManagerInputSlots: SlotConfiguration[] = [];
  slotManagerOutputSlots: SlotConfiguration[] = [];
  slotConfigPopupVisible = false;
  slotConfigPosition = { x: 0, y: 0 };
  currentSlotConfig: SlotConfiguration | null = null;
  slotConfigStateContext: PotentialContext | null = null;
  slotConfigStateClass: string = '';
  slotConfigProducedVariables: ProducedVariable[] = [];
  solutionSlotDefaults: SolutionSlotDefaults = {
    inputColor: '#2196f3',
    outputColor: '#4caf50',
    inputMappingMode: 'object_state',
    outputMappingMode: 'function_return'
  };

  // Full view popup state
  fullViewPopupVisible = false;
  fullViewPopupPosition = { x: 0, y: 0 };
  fullViewPopupState: NoCodeState | null = null;

  // View context overlay state (for debugging)
  viewContextOverlayVisible = false;
  viewContextOverlayPosition = { x: 0, y: 0 };
  viewContextOverlayStateName = '';
  viewContextOverlayContext: PotentialContext | null = null;

  // Overlay creation cancellation token
  private overlayCreationToken: number = 0;

  // Sidebar state
  sidebarExpanded = true;

  // Definition creator panel state
  showDefinitionCreator = false;
  editingDefinition: StateDefinition | undefined;

  // State-space class registry
  private stateSpaceRegistry = StateSpaceClassRegistry.getInstance();

  // Bound class for the current solution (Solution Class)
  boundClass: BoundClassDefinition | null = null;

  // Available helper classes that can be used in this solution
  availableHelperClasses: HelperClassDefinition[] = [];

  // Helper classes currently enabled for this solution
  enabledHelperClasses: HelperClassDefinition[] = [];

  // Available sub-solutions that can be used as states
  availableSubSolutions: SubSolutionDefinition[] = [];

  // Generated Python code for the current solution
  generatedPythonCode: string = '';

  // Track unique states (InitialState, ReturnStatement) that already exist in the solution
  // Used to filter these from the sidebar when they're already present
  existingUniqueStates: Set<string> = new Set();

  constructor(
      private elementRef: ElementRef,
      private changeDetectorRef: ChangeDetectorRef,
      private renderer: Renderer2,
      private overlayComponentService: OverlayComponentService,
      private noCodeStateRendererManager: NoCodeStateRendererManager,
      private hostViewContainerRef: ViewContainerRef,
      private interactionStateManager: InteractionStateService,
      private solutionStateService: NoCodeSolutionStateService,
      private stateOverlayManager: StateOverlayManager,
      private stateDefinitionService: StateDefinitionService,
      private pythonCodeGenerator: PythonCodeGeneratorService
  )
  {
    // Debounce resize events to avoid excessive updates
    this.resizeSubject.pipe(
      debounceTime(100),
      takeUntil(this.destroy$)
    ).subscribe(() => this.onResize());
  }

  // To do our initial rendering we should use the NoCodeStateRendererManager and ensure all
  // NoCodeState objects in our current NoCodeSolution
  ngOnInit(): void {
    // IMPORTANT: Create SVG FIRST before subscribing to solutions
    // because BehaviorSubject will emit immediately and loadSelectedSolution needs the zoomContainer
    this.createSvg();

    // Pass the zoom container as the base layer so all content gets zoom/pan transforms
    this.noCodeStateRendererManager.setD3SvgBaseLayer(this.zoomContainer as any);

    // Subscribe to available solutions for the selector
    this.solutionStateService.availableSolutions$
      .pipe(takeUntil(this.destroy$))
      .subscribe(solutions => {
        this.availableSolutions = solutions;
        this.changeDetectorRef.markForCheck();
      });

    // Subscribe to selected solution changes
    // This will fire immediately with the current selected solution
    this.solutionStateService.selectedSolutionName$
      .pipe(takeUntil(this.destroy$))
      .subscribe(solutionName => {
        console.log('[DEBUG] selectedSolutionName$ subscription fired with:', solutionName);
        console.log('[DEBUG] Current selectedSolutionName:', this.selectedSolutionName);
        if (solutionName && solutionName !== this.selectedSolutionName) {
          this.selectedSolutionName = solutionName;
          // Trigger change detection immediately so dropdown updates
          this.changeDetectorRef.detectChanges();
          this.loadSelectedSolution();
        }
      });
  }

  // Track the last loaded solution to prevent unnecessary reloads
  private lastLoadedSolutionName: string | null = null;
  private lastLoadedTimestamp: number = 0;

  /**
   * Load and render the currently selected solution from the state service
   */
  private loadSelectedSolution(): void {
    console.log('[loadSelectedSolution] ========== STARTING ==========');

    // Get state instances from the state service
    this.stateInstances = this.solutionStateService.getSelectedSolutionStateInstances();
    const solutionData = this.solutionStateService.getSelectedSolutionData();
    const solutionName = solutionData?.solutionName || null;

    console.log('[loadSelectedSolution] solutionData:', solutionData?.solutionName);
    console.log('[loadSelectedSolution] stateInstances count:', this.stateInstances.length);
    console.log('[loadSelectedSolution] stateInstances:', this.stateInstances.map(s => s.stateName));

    if (!solutionData) {
      console.warn('[loadSelectedSolution] No solution data available - aborting');
      return;
    }

    // Prevent reloading the same solution within a short time frame
    // This avoids destroying overlays that were just created
    const now = Date.now();
    if (this.lastLoadedSolutionName === solutionName && (now - this.lastLoadedTimestamp) < 1000) {
      console.log('[loadSelectedSolution] Skipping - same solution loaded recently');
      return;
    }
    this.lastLoadedSolutionName = solutionName;
    this.lastLoadedTimestamp = now;

    // Cancel any pending overlay creation and destroy existing overlays
    this.overlayCreationToken++;
    this.stateOverlayManager.destroyAllOverlays();
    this.currentCircleStateLayer = null;
    this.currentRectangleStateLayer = null;
    this.currentDiamondStateLayer = null;

    // Clear the existing SVG content (except the zoom container itself)
    console.log('[loadSelectedSolution] Clearing zoom container...');
    console.log('[loadSelectedSolution] zoomContainer before clear:', this.zoomContainer?.node());
    console.log('[loadSelectedSolution] zoomContainer children before clear:', this.zoomContainer?.selectAll('*').size());

    if (this.zoomContainer) {
      this.zoomContainer.selectAll('*').remove();
    }

    console.log('[loadSelectedSolution] zoomContainer children after clear:', this.zoomContainer?.selectAll('*').size());

    // Clear the renderer manager's solution cache
    console.log('[loadSelectedSolution] Clearing solutions from renderer manager...');
    this.noCodeStateRendererManager.clearSolutions();

    console.log('[loadSelectedSolution] Creating new NoCodeSolution:', solutionData.solutionName);
    // Create new NoCodeSolution with state instances from the service
    this.noCodeSolution = new NoCodeSolution(
      this.noCodeStateRendererManager,
      this.interactionStateManager,
      solutionData.xBounds || this.viewBoxWidth,
      solutionData.yBounds || this.viewBoxHeight,
      solutionData.solutionName,
      this.stateInstances
    );

    console.log('[loadSelectedSolution] NoCodeSolution created');
    console.log('[loadSelectedSolution] noCodeSolution.stateInstances:', this.noCodeSolution.stateInstances.length);

    // Register the solution with the renderer manager
    console.log('[loadSelectedSolution] Registering solution with renderer manager...');
    this.noCodeStateRendererManager.addNoCodeSolution(this.noCodeSolution);

    // Verify SVG content was created
    console.log('[loadSelectedSolution] zoomContainer children after creation:', this.zoomContainer?.selectAll('*').size());
    console.log('[loadSelectedSolution] state-group elements in DOM:', this.zoomContainer?.selectAll('g.state-group').size());

    // Update tracking of unique states (InitialState, ReturnStatement) for sidebar filtering
    // This must happen BEFORE overlays are created so they receive the correct unique states set
    this.updateExistingUniqueStates();

    // Get the CircleStateLayer and set up overlay callbacks
    this.setupOverlayCallbacks();

    // Reset zoom to default view
    this.resetZoom();

    // Extract bound class and generate Python code
    this.updateBoundClassAndCode(solutionData);

    this.changeDetectorRef.markForCheck();

    console.log('[loadSelectedSolution] ========== COMPLETE ==========');
  }

  /**
   * Update bound class and generate Python code from solution data
   */
  private updateBoundClassAndCode(solutionData: any): void {
    // Extract bound class from solution data
    if (solutionData.boundClass) {
      this.boundClass = {
        className: solutionData.boundClass.className,
        displayName: solutionData.boundClass.displayName,
        description: solutionData.boundClass.description,
        fields: solutionData.boundClass.fields || [],
        methods: solutionData.boundClass.methods || [],
        pythonImports: solutionData.boundClass.pythonImports
      };
    } else {
      this.boundClass = null;
    }

    // Generate Python code
    const functionName = solutionData.functionName ||
      solutionData.solutionName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

    this.generatedPythonCode = this.pythonCodeGenerator.generateFromSolution(
      this.noCodeSolution || null,
      this.boundClass,
      functionName
    );

    console.log('[updateBoundClassAndCode] Bound class:', this.boundClass?.className);
    console.log('[updateBoundClassAndCode] Generated code length:', this.generatedPythonCode.length);
  }

  /**
   * Update the tracking of unique states (InitialState, ReturnStatement) that exist in the solution.
   * This is used to filter these states from the sidebar when they're already present.
   */
  private updateExistingUniqueStates(): void {
    this.existingUniqueStates = new Set();

    if (!this.noCodeSolution) return;

    // Check each state instance to see if it's a unique state type
    for (const state of this.noCodeSolution.stateInstances) {
      const stateClass = state.stateClass;
      if (!stateClass) continue;

      // Get the metadata for this class from the registry
      const metadata = this.stateSpaceRegistry.getClass(stateClass);
      if (metadata?.specialStateType === 'initial' || metadata?.specialStateType === 'end') {
        this.existingUniqueStates.add(stateClass);
      }
    }
  }

  /**
   * Set up callbacks from state layers to manage overlays and context menus
   */
  private setupOverlayCallbacks(): void {
    if (!this.noCodeSolution) {
      return;
    }

    // Get the CircleStateLayer from the solution's render layers
    const circleLayer = this.noCodeSolution.renderLayers.get('circle');
    if (circleLayer && circleLayer instanceof CircleStateLayer) {
      this.currentCircleStateLayer = circleLayer;

      // Set up click callback to toggle overlay visibility/editing
      circleLayer.setOnStateOverlayClick((stateName: string, stateGroup: SVGGElement) => {
        console.log('[overlay callback] State clicked for overlay:', stateName);
        this.handleStateOverlayClick(stateName, stateGroup);
      });

      // Set up drag start callback to hide overlay during drag
      circleLayer.setOnStateDragStart((stateName: string) => {
        console.log('[overlay callback] State drag started, hiding overlay:', stateName);
        this.stateOverlayManager.hideOverlayForState(stateName);
      });

      // Set up drag end callback to show/reposition overlay after drag
      circleLayer.setOnStateDragEnd((stateName: string, stateGroup: SVGGElement) => {
        console.log('[overlay callback] State drag ended, updating overlay:', stateName);
        if (this.stateOverlayManager.hasOverlay(stateName)) {
          this.stateOverlayManager.updateOverlayPosition(stateName, stateGroup);
          this.stateOverlayManager.showOverlayForState(stateName);
        }
      });

      // Set up context menu callback
      circleLayer.setOnStateContextMenu((event: MouseEvent, stateName: string, stateGroup: SVGGElement) => {
        this.handleStateContextMenu(event, stateName, stateGroup, 'circle');
      });

      // Set up slot context menu callback
      circleLayer.setOnSlotContextMenu((event: MouseEvent, stateName: string, slotIndex: number, isInput: boolean) => {
        this.handleSlotContextMenu(event, stateName, slotIndex, isInput);
      });

      console.log('[setupOverlayCallbacks] Overlay callbacks configured for CircleStateLayer');
    }

    // Get the RectangleStateLayer from the solution's render layers
    const rectangleLayer = this.noCodeSolution.renderLayers.get('rectangle');
    if (rectangleLayer && rectangleLayer instanceof RectangleStateLayer) {
      this.currentRectangleStateLayer = rectangleLayer;

      // Set up click callback
      rectangleLayer.setOnStateOverlayClick((stateName: string, stateGroup: SVGGElement) => {
        console.log('[overlay callback] Rectangle state clicked for overlay:', stateName);
        this.handleStateOverlayClick(stateName, stateGroup);
      });

      // Set up drag callbacks
      rectangleLayer.setOnStateDragStart((stateName: string) => {
        this.stateOverlayManager.hideOverlayForState(stateName);
      });

      rectangleLayer.setOnStateDragEnd((stateName: string, stateGroup: SVGGElement) => {
        if (this.stateOverlayManager.hasOverlay(stateName)) {
          this.stateOverlayManager.updateOverlayPosition(stateName, stateGroup);
          this.stateOverlayManager.showOverlayForState(stateName);
        }
      });

      // Set up context menu callback
      rectangleLayer.setOnStateContextMenu((event: MouseEvent, stateName: string, stateGroup: SVGGElement) => {
        this.handleStateContextMenu(event, stateName, stateGroup, 'rectangle');
      });

      // Set up slot context menu callback
      rectangleLayer.setOnSlotContextMenu((event: MouseEvent, stateName: string, slotIndex: number, isInput: boolean) => {
        this.handleSlotContextMenu(event, stateName, slotIndex, isInput);
      });

      console.log('[setupOverlayCallbacks] Overlay callbacks configured for RectangleStateLayer');
    }

    // Get the DiamondStateLayer from the solution's render layers
    const diamondLayer = this.noCodeSolution.renderLayers.get('diamond');
    if (diamondLayer && diamondLayer instanceof DiamondStateLayer) {
      this.currentDiamondStateLayer = diamondLayer;

      // Set up click callback
      diamondLayer.setOnStateOverlayClick((stateName: string, stateGroup: SVGGElement) => {
        console.log('[overlay callback] Diamond state clicked for overlay:', stateName);
        this.handleStateOverlayClick(stateName, stateGroup);
      });

      // Set up drag callbacks
      diamondLayer.setOnStateDragStart((stateName: string) => {
        this.stateOverlayManager.hideOverlayForState(stateName);
      });

      diamondLayer.setOnStateDragEnd((stateName: string, stateGroup: SVGGElement) => {
        if (this.stateOverlayManager.hasOverlay(stateName)) {
          this.stateOverlayManager.updateOverlayPosition(stateName, stateGroup);
          this.stateOverlayManager.showOverlayForState(stateName);
        }
      });

      // Set up context menu callback
      diamondLayer.setOnStateContextMenu((event: MouseEvent, stateName: string, stateGroup: SVGGElement) => {
        this.handleStateContextMenu(event, stateName, stateGroup, 'diamond');
      });

      // Set up slot context menu callback
      diamondLayer.setOnSlotContextMenu((event: MouseEvent, stateName: string, slotIndex: number, isInput: boolean) => {
        this.handleSlotContextMenu(event, stateName, slotIndex, isInput);
      });

      console.log('[setupOverlayCallbacks] Overlay callbacks configured for DiamondStateLayer');
    }

    // Auto-create overlays for all states after D3 rendering is complete
    // Use a longer delay and requestAnimationFrame to ensure DOM is fully updated
    this.scheduleOverlayCreation();
  }

  /**
   * Schedule overlay creation with retry logic to handle D3 rendering timing
   */
  private scheduleOverlayCreation(attempt: number = 0): void {
    const maxAttempts = 5;
    const delayMs = 200 + (attempt * 100); // Increasing delay with each attempt
    const currentToken = this.overlayCreationToken; // Capture token at scheduling time

    setTimeout(() => {
      // Check if the solution was reloaded while we were waiting
      if (this.overlayCreationToken !== currentToken) {
        console.log('[scheduleOverlayCreation] Cancelled - solution was reloaded');
        return;
      }

      requestAnimationFrame(() => {
        // Double-check after animation frame
        if (this.overlayCreationToken !== currentToken) {
          console.log('[scheduleOverlayCreation] Cancelled - solution was reloaded');
          return;
        }

        const success = this.createOverlaysForAllStates();
        if (!success && attempt < maxAttempts) {
          console.log(`[scheduleOverlayCreation] Retrying overlay creation, attempt ${attempt + 1}/${maxAttempts}`);
          this.scheduleOverlayCreation(attempt + 1);
        }
      });
    }, delayMs);
  }

  /**
   * Create overlays for all states in the current solution
   * @returns true if at least one overlay was created or all states have overlays
   */
  private createOverlaysForAllStates(): boolean {
    if (!this.noCodeSolution) {
      console.warn('[createOverlaysForAllStates] No solution loaded');
      return false;
    }

    console.log('[createOverlaysForAllStates] Creating overlays for', this.stateInstances.length, 'states');
    console.log('[createOverlaysForAllStates] Circle layer:', !!this.currentCircleStateLayer);
    console.log('[createOverlaysForAllStates] Rectangle layer:', !!this.currentRectangleStateLayer);
    console.log('[createOverlaysForAllStates] Diamond layer:', !!this.currentDiamondStateLayer);

    let createdCount = 0;
    let foundCount = 0;

    for (const stateInstance of this.stateInstances) {
      const stateName = stateInstance.stateName;
      if (!stateName) continue;

      // Skip if overlay already exists
      if (this.stateOverlayManager.hasOverlay(stateName)) {
        foundCount++;
        continue;
      }

      // Find the state group in the DOM
      let stateGroup: SVGGElement | null = null;

      // Check circle layer first
      if (this.currentCircleStateLayer) {
        stateGroup = this.currentCircleStateLayer.getStateGroupByName(stateName);
        if (stateGroup) {
          console.log('[createOverlaysForAllStates] Found', stateName, 'in circle layer');
        }
      }

      // Check rectangle layer if not found
      if (!stateGroup && this.currentRectangleStateLayer) {
        stateGroup = this.currentRectangleStateLayer.getStateGroupByName(stateName);
        if (stateGroup) {
          console.log('[createOverlaysForAllStates] Found', stateName, 'in rectangle layer');
        }
      }

      // Check diamond layer if not found
      if (!stateGroup && this.currentDiamondStateLayer) {
        stateGroup = this.currentDiamondStateLayer.getStateGroupByName(stateName);
        if (stateGroup) {
          console.log('[createOverlaysForAllStates] Found', stateName, 'in diamond layer');
        }
      }

      if (stateGroup) {
        // Check if overlay-component rect exists
        const overlayRect = stateGroup.querySelector('rect.overlay-component');
        if (!overlayRect) {
          console.warn('[createOverlaysForAllStates] State group found but no overlay-component rect:', stateName);
          continue;
        }

        console.log('[createOverlaysForAllStates] Creating overlay for:', stateName);
        const result = this.createOverlayForState(stateName, stateGroup, stateInstance);
        if (result) {
          createdCount++;
        }
      } else {
        console.warn('[createOverlaysForAllStates] Could not find state group for:', stateName);
      }
    }

    console.log(`[createOverlaysForAllStates] Created ${createdCount} overlays, ${foundCount} already existed`);
    return createdCount > 0 || foundCount === this.stateInstances.length;
  }

  /**
   * Create an overlay for a specific state with its bound object info
   * Uses different overlay components for specific state types (ConditionalChain, FilterList)
   * @returns true if the overlay was successfully created
   */
  private createOverlayForState(stateName: string, stateGroup: SVGGElement, stateInstance: NoCodeState): boolean {
    const stateClass = stateInstance.stateClass || stateInstance.boundObjectClass || '';

    console.log('[createOverlayForState] Creating overlay for:', stateName, 'stateClass:', stateClass);

    // Determine which overlay component to use based on state class
    if (stateClass === 'ConditionalChain') {
      return this.createConditionalChainOverlay(stateName, stateGroup, stateInstance);
    } else if (stateClass === 'FilterList') {
      return this.createFilterListOverlay(stateName, stateGroup, stateInstance);
    } else if (stateClass === 'VariableAssignment') {
      return this.createVariableAssignmentOverlay(stateName, stateGroup, stateInstance);
    } else if (stateClass === 'InitialState') {
      return this.createInitialStateOverlay(stateName, stateGroup, stateInstance);
    } else if (stateClass === 'MathOperation') {
      return this.createMathOperationOverlay(stateName, stateGroup, stateInstance);
    } else {
      return this.createDefaultOverlay(stateName, stateGroup, stateInstance);
    }
  }

  /**
   * Create the default StateOverlayComponent for general states
   */
  private createDefaultOverlay(stateName: string, stateGroup: SVGGElement, stateInstance: NoCodeState): boolean {
    const boundObjectInfo = this.buildBoundObjectInfo(stateInstance);
    const inputSlotCount = stateInstance.slots?.filter(s => s.isInput).length || 0;
    const outputSlotCount = stateInstance.slots?.filter(s => !s.isInput).length || 0;

    const componentRef = this.stateOverlayManager.createOverlayForState(
      stateName,
      stateGroup,
      StateOverlayComponent,
      {
        stateName: stateName,
        boundClassName: stateInstance.boundObjectClass || stateInstance.stateClass || '',
        boundObjectInfo: boundObjectInfo,
        availableClasses: this.getAvailableClasses(),
        inputSlotCount: inputSlotCount,
        outputSlotCount: outputSlotCount,
        isEditable: true,
        existingUniqueStates: this.existingUniqueStates
      }
    );

    if (componentRef) {
      // Subscribe to component events
      componentRef.instance.classSelected.subscribe((event: { className: string }) => {
        stateInstance.boundObjectClass = event.className;
      });

      componentRef.instance.fieldChanged.subscribe((event: { fieldName: string; value: any }) => {
        if (!stateInstance.boundObjectFieldValues) {
          stateInstance.boundObjectFieldValues = {};
        }
        stateInstance.boundObjectFieldValues[event.fieldName] = event.value;
      });

      componentRef.instance.fullViewRequested.subscribe((event: { x: number; y: number; stateName: string }) => {
        this.showFullViewPopup(event.x, event.y, stateInstance);
      });

      return true;
    }
    return false;
  }

  /**
   * Create a ConditionalChainOverlayComponent for ConditionalChain states
   */
  private createConditionalChainOverlay(stateName: string, stateGroup: SVGGElement, stateInstance: NoCodeState): boolean {
    const fieldValues = stateInstance.boundObjectFieldValues || {};

    // Get slot configuration from registry
    const registry = StateSpaceClassRegistry.getInstance();
    const metadata = registry.getClass('ConditionalChain');
    const slotConfig = metadata?.slotConfiguration;

    // Count current input slots
    const inputSlotCount = stateInstance.slots?.filter(s => s.isInput).length || 0;

    const componentRef = this.stateOverlayManager.createOverlayForState(
      stateName,
      stateGroup,
      ConditionalChainOverlayComponent,
      {
        stateName: stateName,
        boundClassName: 'ConditionalChain',
        chainLinks: fieldValues.links || [],
        defaultLogicalOperator: fieldValues.defaultLogicalOperator || 'AND',
        availableInputFields: this.getAvailableInputFieldsForState(stateInstance),
        // NEW: Pass flow-based inputs and object fields for ValueSourceSelector
        availableInputs: this.getAvailableInputsForState(stateInstance),
        sourceObjectFields: this.getSourceObjectFieldsForState(stateInstance),
        inputSlotCount: inputSlotCount,
        allowDynamicInputs: slotConfig?.allowDynamicInputs ?? true,
        maxInputSlots: slotConfig?.maxInputSlots ?? 0
      }
    );

    if (componentRef) {
      // Enable pointer events for this interactive custom overlay
      this.stateOverlayManager.setOverlayPointerEvents(stateName, true);

      // Subscribe to chain change events
      componentRef.instance.chainChanged.subscribe((event: { links: any[]; defaultOperator: string }) => {
        if (!stateInstance.boundObjectFieldValues) {
          stateInstance.boundObjectFieldValues = {};
        }
        stateInstance.boundObjectFieldValues.links = event.links;
        stateInstance.boundObjectFieldValues.defaultLogicalOperator = event.defaultOperator;
      });

      componentRef.instance.syntaxChanged.subscribe((syntax: string) => {
        if (!stateInstance.boundObjectFieldValues) {
          stateInstance.boundObjectFieldValues = {};
        }
        stateInstance.boundObjectFieldValues.syntaxExpression = syntax;
      });

      // Subscribe to add input slot events
      componentRef.instance.addInputSlot.subscribe(() => {
        this.addInputSlotToState(stateInstance, stateGroup, componentRef);
      });

      return true;
    }
    return false;
  }

  /**
   * Create a FilterListOverlayComponent for FilterList states
   */
  private createFilterListOverlay(stateName: string, stateGroup: SVGGElement, stateInstance: NoCodeState): boolean {
    const fieldValues = stateInstance.boundObjectFieldValues || {};

    // Get slot configuration from registry
    const registry = StateSpaceClassRegistry.getInstance();
    const metadata = registry.getClass('FilterList');
    const slotConfig = metadata?.slotConfiguration;

    // Count current input slots
    const inputSlotCount = stateInstance.slots?.filter(s => s.isInput).length || 0;

    const componentRef = this.stateOverlayManager.createOverlayForState(
      stateName,
      stateGroup,
      FilterListOverlayComponent,
      {
        stateName: stateName,
        boundClassName: 'FilterList',
        displayName: fieldValues.displayName || 'Filter',
        filterType: fieldValues.filterType || 'byCondition',
        objectType: fieldValues.objectType || '',
        filterConditions: fieldValues.filterConditions || [],
        availableInputFields: this.getAvailableInputFieldsForState(stateInstance),
        // TODO: Add availableInputs and sourceObjectFields when FilterListOverlay supports ValueSourceSelector
        inputSlotCount: inputSlotCount,
        allowDynamicInputs: slotConfig?.allowDynamicInputs ?? true,
        maxInputSlots: slotConfig?.maxInputSlots ?? 0
      }
    );

    if (componentRef) {
      // Enable pointer events for this interactive custom overlay
      this.stateOverlayManager.setOverlayPointerEvents(stateName, true);

      // Subscribe to filter change events
      componentRef.instance.filterChanged.subscribe((event: { filterType: string; objectType: string; conditions: any[] }) => {
        if (!stateInstance.boundObjectFieldValues) {
          stateInstance.boundObjectFieldValues = {};
        }
        stateInstance.boundObjectFieldValues.filterType = event.filterType;
        stateInstance.boundObjectFieldValues.objectType = event.objectType;
        stateInstance.boundObjectFieldValues.filterConditions = event.conditions;
      });

      componentRef.instance.displayNameChanged.subscribe((name: string) => {
        if (!stateInstance.boundObjectFieldValues) {
          stateInstance.boundObjectFieldValues = {};
        }
        stateInstance.boundObjectFieldValues.displayName = name;
      });

      // Subscribe to add input slot events
      componentRef.instance.addInputSlot.subscribe(() => {
        this.addInputSlotToState(stateInstance, stateGroup, componentRef);
      });

      return true;
    }
    return false;
  }

  /**
   * Create a VariableAssignmentOverlayComponent for VariableAssignment states
   */
  private createVariableAssignmentOverlay(stateName: string, stateGroup: SVGGElement, stateInstance: NoCodeState): boolean {
    const fieldValues = stateInstance.boundObjectFieldValues || {};

    // Get available input fields from connected states
    const availableInputs = this.getAvailableInputsForSelector(stateInstance);

    // Get Solution Object fields from the bound class
    const solutionObjectFields = this.getSolutionObjectFieldsForState(stateInstance);

    // Get existing variables from context
    const existingVariables = this.getAvailableInputFieldsForState(stateInstance);

    const componentRef = this.stateOverlayManager.createOverlayForState(
      stateName,
      stateGroup,
      VariableAssignmentOverlayComponent,
      {
        stateName: stateName,
        boundClassName: 'VariableAssignment',
        availableInputs: availableInputs,
        solutionObjectFields: solutionObjectFields,
        existingVariables: existingVariables,
        boundObjectFieldValues: fieldValues
      }
    );

    if (componentRef) {
      // Enable pointer events for this interactive custom overlay
      this.stateOverlayManager.setOverlayPointerEvents(stateName, true);

      // Subscribe to assignment change events
      componentRef.instance.assignmentChanged.subscribe((config: any) => {
        if (!stateInstance.boundObjectFieldValues) {
          stateInstance.boundObjectFieldValues = {};
        }
        // Store the assignment configuration
        stateInstance.boundObjectFieldValues.assignmentConfig = config;

        // Also update the service cache
        if (this.selectedSolutionName) {
          this.solutionStateService.updateStateFieldValues(
            this.selectedSolutionName,
            stateName,
            { assignmentConfig: config }
          );
        }
      });

      // Subscribe to field values change events
      componentRef.instance.fieldValuesChanged.subscribe((fieldValues: { [key: string]: any }) => {
        if (!stateInstance.boundObjectFieldValues) {
          stateInstance.boundObjectFieldValues = {};
        }
        // Merge field values
        Object.assign(stateInstance.boundObjectFieldValues, fieldValues);

        // Also update the service cache
        if (this.selectedSolutionName) {
          this.solutionStateService.updateStateFieldValues(
            this.selectedSolutionName,
            stateName,
            fieldValues
          );
        }
      });

      // Subscribe to new variable created events
      componentRef.instance.newVariableCreated.subscribe((variable: { name: string; type: string }) => {
        console.log('[VariableAssignment] ===== NEW VARIABLE EVENT RECEIVED =====');
        console.log('[VariableAssignment] Variable:', variable);
        console.log('[VariableAssignment] State Name:', stateName);
        console.log('[VariableAssignment] State Instance:', stateInstance);

        // Store the output variable info
        if (!stateInstance.boundObjectFieldValues) {
          stateInstance.boundObjectFieldValues = {};
        }
        stateInstance.boundObjectFieldValues.outputVariable = variable;
        console.log('[VariableAssignment] Stored outputVariable in boundObjectFieldValues:', stateInstance.boundObjectFieldValues);

        // IMPORTANT: Also update the service cache so context resolution can see the variable
        if (this.selectedSolutionName) {
          this.solutionStateService.updateStateFieldValues(
            this.selectedSolutionName,
            stateName,
            { outputVariable: variable }
          );
          console.log('[VariableAssignment] Updated service cache with outputVariable');
        }

        // Ensure an output slot exists
        if (!stateInstance.slots) {
          stateInstance.slots = [];
        }

        // Find or create the output slot
        let outputSlot = stateInstance.slots.find(s => !s.isInput);
        if (!outputSlot) {
          // Create an output slot
          const slotIndex = stateInstance.slots.length;
          outputSlot = {
            index: slotIndex,
            stateName: stateName,
            slotAngularPosition: 0, // Right side
            connectors: [],
            isInput: false,
            isOutput: true,
            allowOneToMany: true,
            allowManyToOne: false
          };
          stateInstance.slots.push(outputSlot);
          console.log('[VariableAssignment] Created output slot for variable:', variable.name);
        }

        // Configure the output slot with the variable info
        (outputSlot as any).parameterName = variable.name;
        (outputSlot as any).parameterType = variable.type;
        (outputSlot as any).returnType = variable.type;
        (outputSlot as any).label = variable.name;

        console.log('[VariableAssignment] Configured output slot:', outputSlot);
      });

      return true;
    }
    return false;
  }

  /**
   * Create an InitialStateOverlayComponent for InitialState states
   */
  private createInitialStateOverlay(stateName: string, stateGroup: SVGGElement, stateInstance: NoCodeState): boolean {
    const fieldValues = stateInstance.boundObjectFieldValues || {};

    // Get Solution Object fields
    const solutionFields = this.getSolutionObjectFieldsForState(stateInstance);

    // Get solution info
    const solutionData = this.selectedSolutionName
      ? this.solutionStateService.getSolutionData(this.selectedSolutionName)
      : null;

    const boundClass = solutionData?.boundClass;

    // Get input params from bound field values
    const inputParams = fieldValues.inputParams || [];

    const componentRef = this.stateOverlayManager.createOverlayForState(
      stateName,
      stateGroup,
      InitialStateOverlayComponent,
      {
        stateName: stateName,
        boundClassName: 'InitialState',
        solutionName: this.selectedSolutionName || '',
        solutionClassName: boundClass?.className || boundClass?.displayName || '',
        solutionDescription: boundClass?.description || '',
        solutionFields: solutionFields,
        inputParams: inputParams
      }
    );

    if (componentRef) {
      // InitialState overlay is read-only, no events to subscribe to
      return true;
    }
    return false;
  }

  /**
   * Create a MathOperationOverlayComponent for MathOperation states
   */
  private createMathOperationOverlay(stateName: string, stateGroup: SVGGElement, stateInstance: NoCodeState): boolean {
    const fieldValues = stateInstance.boundObjectFieldValues || {};

    // Get available inputs from connected states
    const availableInputs = this.getAvailableInputsForSelector(stateInstance);

    // Get Solution Object fields
    const solutionObjectFields = this.getSolutionObjectFieldsForState(stateInstance);

    const componentRef = this.stateOverlayManager.createOverlayForState(
      stateName,
      stateGroup,
      MathOperationOverlayComponent,
      {
        stateName: stateName,
        boundClassName: 'MathOperation',
        availableInputs: availableInputs,
        solutionObjectFields: solutionObjectFields,
        boundObjectFieldValues: fieldValues
      }
    );

    if (componentRef) {
      // Enable pointer events for this interactive custom overlay
      this.stateOverlayManager.setOverlayPointerEvents(stateName, true);

      // Subscribe to operation change events
      componentRef.instance.operationChanged.subscribe((config: any) => {
        if (!stateInstance.boundObjectFieldValues) {
          stateInstance.boundObjectFieldValues = {};
        }
        stateInstance.boundObjectFieldValues.operationConfig = config;
      });

      // Subscribe to field values change events
      componentRef.instance.fieldValuesChanged.subscribe((fieldValues: { [key: string]: any }) => {
        if (!stateInstance.boundObjectFieldValues) {
          stateInstance.boundObjectFieldValues = {};
        }
        Object.assign(stateInstance.boundObjectFieldValues, fieldValues);
      });

      return true;
    }
    return false;
  }

  /**
   * Get Solution Object fields for a state (from the solution's bound class)
   */
  private getSolutionObjectFieldsForState(stateInstance: NoCodeState): { name: string; displayName: string; type: string; path: string; description?: string }[] {
    if (!this.selectedSolutionName) {
      return [];
    }

    // Get the raw solution data which contains the boundClass
    const solutionData = this.solutionStateService.getSolutionData(this.selectedSolutionName);
    if (!solutionData?.boundClass) {
      return [];
    }

    const boundClass = solutionData.boundClass;
    return (boundClass.fields || []).map(field => ({
      name: field.name,
      displayName: field.displayName || field.name,
      type: field.type,
      path: field.name,
      description: field.description
    }));
  }

  /**
   * Get available inputs formatted for ValueSourceSelector
   */
  private getAvailableInputsForSelector(stateInstance: NoCodeState): { slotIndex: number; variableName: string; type: string; sourceStateName: string }[] {
    const inputs: { slotIndex: number; variableName: string; type: string; sourceStateName: string }[] = [];

    // Use the PotentialContext from the service for proper flow tracing
    if (this.selectedSolutionName && stateInstance.stateName) {
      const context = this.solutionStateService.getPotentialContextForState(
        this.selectedSolutionName,
        stateInstance.stateName
      );

      // Convert PotentialVariables to the input selector format
      let slotIndex = 0;
      for (const variable of context.getVariables()) {
        inputs.push({
          slotIndex: variable.inputSlotIndex ?? slotIndex,
          variableName: variable.name,
          type: variable.type,
          sourceStateName: variable.sourceStateName
        });
        slotIndex++;
      }
    }

    return inputs;
  }

  /**
   * Get available input fields for a state based on connected input slots
   * This provides field options for conditional/filter dropdowns
   * Uses flow-based context resolution to trace through the solution graph
   */
  private getAvailableInputFieldsForState(stateInstance: NoCodeState): { name: string; type: string; source: string }[] {
    const fields: { name: string; type: string; source: string }[] = [];

    // Use the PotentialContext from the service for proper flow tracing
    if (this.selectedSolutionName && stateInstance.stateName) {
      const context = this.solutionStateService.getPotentialContextForState(
        this.selectedSolutionName,
        stateInstance.stateName
      );

      // Convert PotentialVariables to the legacy format
      for (const variable of context.getVariables()) {
        fields.push({
          name: variable.name,
          type: variable.type,
          source: variable.sourceStateName
        });
      }
    }

    return fields;
  }

  /**
   * Get the PotentialContext for a state - provides full flow-based context
   * including available variables and object types
   */
  private getPotentialContextForState(stateInstance: NoCodeState) {
    if (this.selectedSolutionName && stateInstance.stateName) {
      return this.solutionStateService.getPotentialContextForState(
        this.selectedSolutionName,
        stateInstance.stateName
      );
    }
    return null;
  }

  /**
   * Get available inputs formatted for ValueSourceSelector
   * Converts from PotentialContext to the AvailableInput format
   */
  private getAvailableInputsForState(stateInstance: NoCodeState): {
    slotIndex: number;
    variableName: string;
    type: string;
    sourceStateName?: string;
    label?: string;
  }[] {
    if (!this.selectedSolutionName || !stateInstance.stateName) {
      return [];
    }

    const context = this.solutionStateService.getPotentialContextForState(
      this.selectedSolutionName,
      stateInstance.stateName
    );

    return context.getVariables().map(v => ({
      slotIndex: v.inputSlotIndex ?? 0,
      variableName: v.name,
      type: v.type,
      sourceStateName: v.sourceStateName,
      label: v.label || v.name
    }));
  }

  /**
   * Get source object fields formatted for ValueSourceSelector
   * Converts from PotentialContext to the SourceObjectField format
   */
  private getSourceObjectFieldsForState(stateInstance: NoCodeState): {
    path: string;
    type: string;
    displayName?: string;
  }[] {
    if (!this.selectedSolutionName || !stateInstance.stateName) {
      return [];
    }

    const context = this.solutionStateService.getPotentialContextForState(
      this.selectedSolutionName,
      stateInstance.stateName
    );

    return context.getAllObjectFields().map(f => ({
      path: f.path,
      type: f.type,
      displayName: f.displayName
    }));
  }

  /**
   * Add a new input slot to a state instance and re-render
   */
  private addInputSlotToState(stateInstance: NoCodeState, stateGroup: SVGGElement, componentRef: any): void {
    // Initialize slots array if needed
    if (!stateInstance.slots) {
      stateInstance.slots = [];
    }

    // Count current input slots to determine new slot index
    const inputSlots = stateInstance.slots.filter(s => s.isInput);
    const newInputIndex = inputSlots.length;

    // Find the highest slot index
    const maxIndex = stateInstance.slots.length > 0
      ? Math.max(...stateInstance.slots.map(s => s.index))
      : -1;
    const newSlotIndex = maxIndex + 1;

    // Calculate angular position for the new input slot
    // Inputs are typically on the left side (180 degrees +/- spread)
    const inputSpread = 60; // degrees spread for inputs
    const baseAngle = 180;
    const angleOffset = (newInputIndex - (inputSlots.length / 2)) * (inputSpread / Math.max(inputSlots.length, 1));
    const newAngle = baseAngle + angleOffset;

    // Create the new slot
    const newSlot = new Slot(
      newSlotIndex,
      stateInstance.stateName || '',
      newAngle,
      [], // no connectors yet
      true, // isInput
      false, // allowOneToMany
      true  // allowManyToOne - inputs can aggregate from multiple sources
    );

    stateInstance.slots.push(newSlot);

    // Update the component's input slot count
    const newInputSlotCount = stateInstance.slots.filter(s => s.isInput).length;
    componentRef.setInput('inputSlotCount', newInputSlotCount);

    // Re-render the state's slots in D3
    if (stateInstance.stateName) {
      this.rerenderStateSlots(stateInstance.stateName);
    }

    console.log(`[addInputSlotToState] Added input slot ${newSlotIndex} to ${stateInstance.stateName}, total inputs: ${newInputSlotCount}`);
  }

  /**
   * Build BoundObjectInfo from a state instance
   */
  private buildBoundObjectInfo(stateInstance: NoCodeState): any {
    const info: any = {};

    // Set class name
    if (stateInstance.boundObjectClass) {
      info.className = stateInstance.boundObjectClass;
    } else if (stateInstance.stateClass) {
      info.className = stateInstance.stateClass;
    }

    // Copy bound object field values if they exist
    if (stateInstance.boundObjectFieldValues) {
      const fieldValues = stateInstance.boundObjectFieldValues;

      if (fieldValues.memberType) {
        info.memberType = fieldValues.memberType;
      }
      if (fieldValues.memberName) {
        info.memberName = fieldValues.memberName;
      }
      if (fieldValues.fieldName) {
        info.fieldName = fieldValues.fieldName;
      }
      if (fieldValues.fieldType) {
        info.fieldType = fieldValues.fieldType;
      }
      if (fieldValues.methodName) {
        info.methodName = fieldValues.methodName;
      }
      if (fieldValues.returnType) {
        info.returnType = fieldValues.returnType;
      }
      if (fieldValues.parameters) {
        info.parameters = fieldValues.parameters;
      }
      if (fieldValues.subSolutionName) {
        info.subSolutionName = fieldValues.subSolutionName;
      }
    }

    return Object.keys(info).length > 0 ? info : null;
  }

  /**
   * Handle click on a state's overlay area - toggle editing mode or create overlay if missing
   */
  private handleStateOverlayClick(stateName: string, stateGroup: SVGGElement): void {
    // If overlay exists, toggle its editing mode
    if (this.stateOverlayManager.hasOverlay(stateName)) {
      const componentRef = this.stateOverlayManager.getOverlayComponent(stateName);
      if (componentRef) {
        const instance = componentRef.instance;
        instance.toggleEditMode();
      }
      return;
    }

    // Find the state instance
    const stateInstance = this.stateInstances.find(s => s.stateName === stateName);
    if (stateInstance) {
      this.createOverlayForState(stateName, stateGroup, stateInstance);
    }
  }

  /**
   * Get available classes for state binding (placeholder - will be extended)
   */
  private getAvailableClasses(): string[] {
    // TODO: Fetch from backend or state service
    return ['ExampleClass', 'UserState', 'OrderState', 'PaymentState'];
  }

  /**
   * Handle solution selection change from the dropdown
   */
  onSolutionChange(solutionName: string): void {
    console.log('[DEBUG] onSolutionChange called with:', solutionName);
    if (solutionName !== this.selectedSolutionName) {
      this.solutionStateService.selectSolution(solutionName);
    }
  }

  /**
   * Reset to default mock solutions (clears localStorage cache)
   */
  resetToDefaults(): void {
    console.log('[DEBUG] resetToDefaults called');
    // Clear the current selection so it will reload even if same name
    this.selectedSolutionName = null;
    this.solutionStateService.resetToDefaults();
  }

  ngAfterViewInit(): void {
    // Set ViewContainerRef for overlay manager
    this.stateOverlayManager.setViewContainerRef(this.hostViewContainerRef);

    // Set initial canvas bounds for overlay clipping
    const canvasElement = this.elementRef.nativeElement.querySelector('#d3-graph') as HTMLElement;
    if (canvasElement) {
      this.stateOverlayManager.setCanvasBounds(canvasElement);
    }

    // Initial size calculation after view is ready
    setTimeout(() => this.updateSvgSize(), 0);

    // Log state instance positions (only if noCodeSolution is initialized)
    if (this.noCodeSolution && this.noCodeSolution.stateInstances.length > 0) {
      this.noCodeSolution.stateInstances[0].stateLocationX = 0;
      this.noCodeSolution.stateInstances[0].stateLocationY = 0;
    }

    this.polariAccessNodeSubject.subscribe(stateInstance => {
      // Handle new state instance
    });

    this.changeDetectorRef.markForCheck();
  }

  ngOnDestroy(): void {
    // Clean up all overlays
    this.stateOverlayManager.destroyAllOverlays();
    this.currentCircleStateLayer = null;
    this.currentRectangleStateLayer = null;
    this.currentDiamondStateLayer = null;

    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.resizeSubject.next();
  }

  private onResize(): void {
    this.updateSvgSize();
    // Update overlay positions after resize
    this.updateAllOverlayPositions();
  }

  private updateSvgSize(): void {
    const container = this.elementRef.nativeElement.querySelector('#d3-graph');
    if (container && this.d3GraphRenderingSVG) {
      const rect = container.getBoundingClientRect();
      // Maintain aspect ratio while fitting container
      const containerAspect = rect.width / rect.height;
      const viewBoxAspect = this.viewBoxWidth / this.viewBoxHeight;

      // Optionally adjust viewBox to match container aspect ratio
      // This keeps the logical coordinate space consistent
      // while the SVG scales to fill the container
    }
  }

  @HostListener('click', ['$event'])
  onClick(event: MouseEvent) {
    // Handle the click event here
    //console.log('Clicked on custom-no-code page');
    // Get the clicked element
    const clickedElement = event.target as HTMLElement;

    // Log the clicked element and its ancestors
    //console.log('Clicked Element:', clickedElement);
    //console.log("Classes of Element: ", clickedElement.classList);
    const ancestors: HTMLElement[] = [];

    let currentElement = clickedElement.parentElement;
    while (currentElement) {
      ancestors.push(currentElement);
      //console.log(currentElement.classList);
      currentElement = currentElement.parentElement;
    }
    //console.log('Ancestors:', ancestors);
  }

  private hasAncestorWithClass(element: HTMLElement, className: string): boolean {
    let currentElement = element.parentElement;
    while (currentElement) {
      if (currentElement.classList.contains(className)) {
        return true;
      }
      currentElement = currentElement.parentElement;
    }
    return false;
  }  

  private createSvg(): void {
    this.d3GraphRenderingSVG = d3.select('#d3-graph')
      .append('svg')
      .attr('viewBox', `0 0 ${this.viewBoxWidth} ${this.viewBoxHeight}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .attr('stroke-width', 2)
      .style('width', '100%')
      .style('height', '100%');

    // Create a zoom container group - all content will be added to this
    this.zoomContainer = this.d3GraphRenderingSVG.append('g')
      .classed('zoom-container', true);

    // Set up zoom behavior with filter to exclude state group interactions
    this.zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([this.minZoom, this.maxZoom])
      .filter((event: any) => {
        console.log('[ZoomFilter] Event received:', event.type, 'target:', event.target);

        // If there's already an active interaction (state-drag, slot-drag, connector-drag), block zoom
        const currentState = this.interactionStateManager.getCurrentState();
        if (currentState && currentState !== 'none') {
          console.log('[ZoomFilter] Blocking zoom - active interaction:', currentState);
          return false;
        }

        // Get the target element
        const target = event.target as Element;
        if (!target) {
          console.log('[ZoomFilter] No target, allowing zoom');
          return true; // Allow if no target (shouldn't happen)
        }

        // Don't allow zoom/pan if clicking on state group elements
        // This prevents the zoom behavior from interfering with state/slot dragging
        const stateGroup = target.closest('g.state-group');
        if (stateGroup) {
          console.log('[ZoomFilter] Blocking zoom - clicked on state group:', stateGroup.getAttribute('state-name'));
          return false;
        }

        // Also check for specific draggable elements (in case closest doesn't find them)
        const targetClassList = target.classList;
        if (targetClassList?.contains('draggable-shape') ||
            targetClassList?.contains('slot-marker') ||
            targetClassList?.contains('slot-path') ||
            targetClassList?.contains('bounding-box') ||
            targetClassList?.contains('overlay-component') ||
            targetClassList?.contains('permanent-connector') ||
            targetClassList?.contains('tentative-connector')) {
          console.log('[ZoomFilter] Blocking zoom - clicked on draggable element:', target.className);
          return false;
        }

        // Allow default zoom behavior for other elements (background, etc.)
        // Also respect the default filter (no zoom on ctrl+wheel for scrolling, no middle button)
        const allowZoom = !event.ctrlKey && event.button === 0;
        console.log('[ZoomFilter] Allowing zoom:', allowZoom);
        return allowZoom;
      })
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        this.onZoom(event);
      });

    // Apply zoom behavior to SVG
    this.d3GraphRenderingSVG.call(this.zoomBehavior);

    // Prevent double-click from zooming (can interfere with editing)
    this.d3GraphRenderingSVG.on('dblclick.zoom', null);
  }

  private onZoom(event: d3.D3ZoomEvent<SVGSVGElement, unknown>): void {
    if (this.zoomContainer) {
      this.zoomContainer.attr('transform', event.transform.toString());
      this.currentZoom = event.transform.k;
      this.zoomPercent = Math.round(this.currentZoom * 100);
      this.changeDetectorRef.detectChanges();

      // Update all overlay positions to match the new zoom/pan transform
      this.updateAllOverlayPositions();
    }
  }

  /**
   * Update positions of all active overlays after zoom/pan
   */
  private updateAllOverlayPositions(): void {
    // Get the canvas element for clipping bounds
    const canvasElement = this.elementRef.nativeElement.querySelector('#d3-graph') as HTMLElement;

    // Get state group lookup function that checks all shape layers
    const getStateGroup = (stateName: string): SVGGElement | null => {
      // Check circle layer first
      let stateGroup = this.currentCircleStateLayer?.getStateGroupByName(stateName) || null;
      if (stateGroup) return stateGroup;

      // Then check rectangle layer
      stateGroup = this.currentRectangleStateLayer?.getStateGroupByName(stateName) || null;
      if (stateGroup) return stateGroup;

      // Then check diamond layer
      stateGroup = this.currentDiamondStateLayer?.getStateGroupByName(stateName) || null;
      return stateGroup;
    };

    this.stateOverlayManager.updateAllOverlayPositions(getStateGroup, canvasElement);
  }

  zoomIn(): void {
    if (this.zoomBehavior && this.d3GraphRenderingSVG) {
      this.d3GraphRenderingSVG.transition()
        .duration(300)
        .call(this.zoomBehavior.scaleBy, 1.3);
    }
  }

  zoomOut(): void {
    if (this.zoomBehavior && this.d3GraphRenderingSVG) {
      this.d3GraphRenderingSVG.transition()
        .duration(300)
        .call(this.zoomBehavior.scaleBy, 0.7);
    }
  }

  resetZoom(): void {
    if (this.zoomBehavior && this.d3GraphRenderingSVG) {
      this.d3GraphRenderingSVG.transition()
        .duration(300)
        .call(this.zoomBehavior.transform, d3.zoomIdentity);
    }
  }

  // ==================== Solution Options Methods ====================

  /**
   * Toggle visibility of rendering debug elements (bounding boxes, paths)
   */
  toggleRenderingDebug(): void {
    this.showRenderingDebug = !this.showRenderingDebug;
    this.applyRenderingDebugVisibility();
    console.log('[toggleRenderingDebug] Rendering debug:', this.showRenderingDebug ? 'visible' : 'hidden');
  }

  /**
   * Apply the rendering debug visibility to D3 elements
   */
  private applyRenderingDebugVisibility(): void {
    if (!this.zoomContainer) return;

    // Toggle visibility of debug bounding boxes
    this.zoomContainer.selectAll('.debug-bounding-box, .bounding-box')
      .style('opacity', this.showRenderingDebug ? 1 : 0)
      .style('pointer-events', this.showRenderingDebug ? 'auto' : 'none');

    // Toggle visibility of debug paths (including slot-path)
    this.zoomContainer.selectAll('.debug-path, .connector-path-debug, .slot-path')
      .style('opacity', this.showRenderingDebug ? 1 : 0);

    // Toggle visibility of debug labels/text
    this.zoomContainer.selectAll('.debug-label, .debug-text')
      .style('opacity', this.showRenderingDebug ? 1 : 0);

    // Make overlay-component rect borders visible in debug mode
    this.zoomContainer.selectAll('rect.overlay-component')
      .style('stroke', this.showRenderingDebug ? '#ff0000' : 'transparent')
      .style('stroke-width', this.showRenderingDebug ? '2px' : '0')
      .style('stroke-dasharray', this.showRenderingDebug ? '4,4' : 'none');
  }

  /**
   * Toggle visibility of slot labels
   */
  toggleSlotLabels(): void {
    this.showSlotLabels = !this.showSlotLabels;
    this.applySlotLabelsVisibility();
    console.log('[toggleSlotLabels] Slot labels:', this.showSlotLabels ? 'visible' : 'hidden');
  }

  /**
   * Apply slot labels visibility to D3 elements
   */
  private applySlotLabelsVisibility(): void {
    if (!this.zoomContainer) return;

    this.zoomContainer.selectAll('.slot-label')
      .style('opacity', this.showSlotLabels ? 1 : 0);
  }

  /**
   * Toggle visibility of connector labels
   */
  toggleConnectorLabels(): void {
    this.showConnectorLabels = !this.showConnectorLabels;
    this.applyConnectorLabelsVisibility();
    console.log('[toggleConnectorLabels] Connector labels:', this.showConnectorLabels ? 'visible' : 'hidden');
  }

  /**
   * Apply connector labels visibility to D3 elements
   */
  private applyConnectorLabelsVisibility(): void {
    if (!this.zoomContainer) return;

    this.zoomContainer.selectAll('.connector-label, .connection-label')
      .style('opacity', this.showConnectorLabels ? 1 : 0);
  }

  /**
   * Export the current solution as JSON
   */
  exportSolution(): void {
    if (!this.noCodeSolution) {
      console.warn('[exportSolution] No solution to export');
      return;
    }

    const solutionData = {
      solutionName: this.noCodeSolution.solutionName,
      states: this.stateInstances,
      exportedAt: new Date().toISOString()
    };

    const json = JSON.stringify(solutionData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.noCodeSolution.solutionName || 'solution'}.json`;
    a.click();

    URL.revokeObjectURL(url);
    console.log('[exportSolution] Exported solution:', this.noCodeSolution.solutionName);
  }

  private createRectangles()
  {
    const rectangles = d3.range(1).map(() => ({
      x: 20,
      y: 20,
      width: 400,
      height: 400,
      borderPixels: 15
    }));

    const rectSelection = this.d3GraphRenderingSVG.selectAll('rect')
    .data(rectangles)
    .enter()
    .append('rect')
    .attr('x', d => d.x)
    .attr('y', d => d.y)
    .attr('width', d => d.width)
    .attr('height', d => d.height)
    .attr('fill', (d, i) => d3.schemeCategory10[i % 10])
    .call(this.dragRectangle());
    //.each(d => this.overlayComponentService.addDynamicComponent(NoCodeStateInstanceComponent, d, d.borderPixels, this.hostViewContainerRef));
    
    //rectSelection
    
    
  }

  runSetup(selection)
  {
    selection.each((d, i, nodes) => {
      this.overlayComponentService.addDynamicComponent(NoCodeStateInstanceComponent, d, d.borderPixels, this.hostViewContainerRef);
    })

    this.dragRectangle()
  }

/*
  createGraph(): void {

    const d3GraphRenderingSVG = d3.select("#d3-graph")
      .append("svg")
      .attr("width", this.noCodeSolution.xBounds)
      .attr("height", this.noCodeSolution.yBounds);
      
    d3GraphRenderingSVG.append("use")
        .attr("href", "#pointer")
        .attr("x", 50)
        .attr("y", 50)
        .attr("fill", "#039BE5")
        .attr("stroke", "#039BE5")
        .attr("stroke-width", "1px");

    var dragHandler = d3.drag()
      .on("start", function(d, i, n){
        console.log("logging start conditions for drag");
        console.log("d3ElementNodes : ", n);
        console.log("draggedElementIndex : ", i);
        console.log("d3ElementNodes[draggedElementIndex] : ", n[i]);
      })
      .on("drag", (event) => {
          d3.select(event.sourceEvent.target)
              .attr("x", event.x)
              .attr("y", event.y);
      })
      .on("end", function(d, i, n) {
        console.log("logging end conditions for drag");
        console.log("d3ElementNodes : ", n);
        console.log("draggedElementIndex : ", i);
        console.log("d3ElementNodes[draggedElementIndex] : ", n[i]);
    });
    
    dragHandler(d3GraphRenderingSVG.selectAll("use"));

    let boxElement = null;
    let x = null;
    let y = null;
    let overlay = null;

    this.stateInstances.forEach((stateInstance: noCodeState) => {
      boxElement = d3GraphRenderingSVG.append("rect")
      .attr("x", stateInstance.stateLocationX)
      .attr("y", stateInstance.stateLocationY)
      .attr("width", stateInstance.stateComponentSizeX)
      .attr("height", stateInstance.stateComponentSizeY)
      .attr("fill", "lightblue")
      // Creates an onEvent functions that occurs for every pixel dragged after click and drag begins occurring.
      .call(d3.drag()
        .on("start", (event) => {
          console.log("Handling drag Start, start location : (", event.x, ", ", event.y, ")", " and stateInstance location : ", stateInstance.stateLocationX, ", ", stateInstance.stateComponentSizeY, ")");
          this.handleSingleStateObjectDragStart(stateInstance.id);
        })
        .on("drag", (event) => { // Takes the new x and y values sent by event after drag event occurs and assigns them.
          //console.log("Dragging event start, target : ", event.sourceEvent.target, " at location : (", event.x, ", ", event.y, ")");
          //let x = event.x;
          //let y = event.y;
          //Causes actual change of location of object when performing drag.
          //[x, y] = d3.pointer(event);
          // target variable is equivalent of normal d3 'this'.
          //const target = d3.event.sourceEvent.target;
          d3.select(d3.event.sourceEvent.target)
            .attr("x", event.x)
            .attr("y", event.y);
            
          //console.log("event.sourceEvent.target attributes changed, (", event.sourceEvent.target.x, ", ", event.sourceEvent.target.y, ")");
          // This is a single 'layer' of the overlay, where each 'state' object has a layer that binds a component to a box.
          /*
          let overlayStateSegment = document.getElementById(`overlay-${stateInstance.id}`);
          console.log("overlayStateSegment : ", overlayStateSegment);
          if (overlayStateSegment) {
            console.log("overlay style before change: (", overlayStateSegment.style.left, " , ", overlayStateSegment.style.right, ")");
            overlayStateSegment.style.left = `${x}px`;
            overlayStateSegment.style.top = `${y}px`;
          }
            
        })
        .on("end", (event) => { // Triggers whenever you stop dragging something.
          this.handleSingleStateObjectDragEnd(stateInstance, event);
        })
      );
    });
  }
*/



private createCircles(): void {
  const width = 600;
const height = 600;
const radius = 32;
  const circles = d3.range(20).map(() => ({
    // (height - radius * 2) + 32
    x: Math.random() * (600 - 32 * 2) + 32,
    y: Math.random() * (600 - 32 * 2) + 32,
  }));

  this.d3GraphRenderingSVG.selectAll('circle')
    .data(circles)
    .enter()
    .append('circle')
    .attr('cx', d => d.x)
    .attr('cy', d => d.y)
    .attr('r', 32)
    .attr('fill', (d, i) => d3.schemeCategory10[i % 10])
    .call(this.dragCircle());
}

private dragCircle(): any {
  const dragstarted = (event, d) => {
    d3.select(event.sourceEvent.target).raise().attr('stroke', 'black');
  };

  const dragged = (event, d) => {
    d3.select(event.sourceEvent.target).attr('cx', d.x = event.x).attr('cy', d.y = event.y);
  };

  const dragended = (event, d) => {
    d3.select(event.sourceEvent.target).attr('stroke', null);
  };

  return d3.drag()
    .on('start', dragstarted)
    .on('drag', dragged)
    .on('end', dragended);
}

private dragRectangle(): any {
  const dragstarted = (event, d) => {
    d3.select(event.sourceEvent.target).raise().attr('stroke', 'black');
  };

  const dragged = (event, d) => {
    d3.select(event.sourceEvent.target).attr('x', d.x = event.x).attr('y', d.y = event.y);
  };

  const dragended = (event, d) => {
    d3.select(event.sourceEvent.target).attr('stroke', null);
  };

  return d3.drag()
    .on('start', dragstarted)
    .on('drag', dragged)
    .on('end', dragended);
}

  // Handles hiding the overlay/UI when the drag starts, since the UI portion is not optimized to get dragged.
  // TODO? Find a way to transform the UI into an image quickly to imprint on the d3 object so it looks like
  // the UI is still there the whole time instead of being replaced by another object.
  handleSingleStateObjectDragStart(id: number){
    console.log("drag start");
    this.overlayStateSegments[id] = document.getElementById(`overlay-${id}`);
    if (this.overlayStateSegments[id]) { //For some reason typescript cannot detect that we are detecting if it is null or not, so have to use ts-ignore here.
      //@ts-ignore
      this.overlayStateSegments[id].style.display = 'none';
    }
    else{
      console.log("Failed to manipulate overlay in handleSingleStateObjectDragStart");
      //console.log("Somehow dragging a state object which does not have a corresponding element with element id 'overlay-${id}', the state Object id is : ", id);
    }
    console.log("completed drag start handler");
  }

  // Handles showing the overlay/UI when the drag ends, since the UI portion is not optimized to get dragged.
  // Also handles updating the StateObject with the new location it is at.
  handleSingleStateObjectDragEnd(stateInstance: NoCodeState, event){
    const overlayStateSegment = document.getElementById(`overlay-${stateInstance.id}`);
    if (overlayStateSegment) {
      overlayStateSegment.style.display = 'none';
    }
    else{
      console.log("Failed to manipulate overlay in handleSingleStateObjectDragEnd");
      //console.log("Somehow dragged a state object which does not have a corresponding element with element id 'overlay-${id}', the state Object id is : ", id);
    }
    console.log("completed drag end handler");
  }

  // Used to perform height, width, and location transforms on state objects UI overlays, based on d3 transforms of their
  // corresponding d3 object which the UI is overlayed on.
  updateSingleStateOverlayTransforms(id: number, x: number, y: number, width: number, height: number)
  {
    const overlayStateSegment = document.getElementById(`overlay-${id}`);
    if (overlayStateSegment) {
      this.renderer.setStyle(overlayStateSegment, 'left', `${x}px`);
      this.renderer.setStyle(overlayStateSegment, 'top', `${y}px`);
      this.renderer.setStyle(overlayStateSegment, 'width', `${width}px`);
      this.renderer.setStyle(overlayStateSegment, 'height', `${height}px`);
    }
  }

  // Ensures State Objects remain in the same location when re-sizing of the d3-graph/no-code-solution container is re-sized.
  /*
  setOverlaysFromMemory(): void {
    this.stateInstances.forEach((state) => {
      const stateOverlay = d3.select(`rect[x="${state.stateLocationX}"][y="${state.stateLocationY}"]`);
      const x = parseFloat(stateOverlay.attr('x'));
      const y = parseFloat(stateOverlay.attr('y'));
      const width = parseFloat(stateOverlay.attr('width'));
      const height = parseFloat(stateOverlay.attr('height'));
      //this.updateSingleStateOverlayTransforms(state.id, x, y, width, height);
    });
  }
    */

/*
  drawGraph() {
    // Prepare data for ngx-graph
    // Load all states and map them to nodes.
    let nodes = this.stateInstances.map(state => {
      console.log("Iterating state: ", state);
      return {
        //id: state.id.toString(), // Assuming you have a unique identifier for each state instance
        label: state.stateName, // Assuming you have a 'name' property in noCodeState to display as node label
        data: state, // Optionally, you can store the entire noCodeState instance in the 'data' property
        backgroundColor: '#DC143C'
      };

      }); 
      console.log("after nodes");
      let edges: { source: string; target: string; label: string; data: { linkText: string } }[] = [];
      
      this.stateInstances.forEach(state=>{
        state.slots?.forEach(slot=>{
          slot.connectors?.forEach(connector=>{
            edges.push({
              source: state.id.toString(),
              target: connector.sinkSlot.toString(),
              label: 'label',
              data: {
                linkText: 'link text'
              }
            });
          });
        });
      });
      
      console.log("after stateInstances");
      // Set ngx-graph options
      const graphOptions = {
        nodeWidth: 150, // Customize node width
        nodeHeight: 100, // Customize node height
        // Add any other options you want to configure for the graph visualization
      };

      // Here, you can define any logic to determine how the edges should be represented.
      // For example, you can have a 'connections' array in noCodeState to represent the connected states.
      //let edges = [];
      // Create the ngx-graph model
      let graphData = { nodes, edges };
      console.log("before draw");
      // Draw the graph using ngx-graph
      this.draw(graphData, graphOptions);
      console.log("after draw")
  }

  draw(data: any, options: any) {
    // Clear the container in case it already has content
    console.log("before clear")
    //this.graphContainerRef.clear();
    console.log("before factory")
    // Create the ngx-graph component and attach it to the container
    //const graphComponentFactory = this.componentFactoryResolver.resolveComponentFactory(GraphComponent);
    console.log("before ref")
    //const graphComponentRef = this.graphContainerRef.createComponent(graphComponentFactory);
    // Set the data input properties of the ngx-graph component
    //graphComponentRef.instance.nodes = data.nodes;
    //graphComponentRef.instance.links = data.edges;
    // You can access the nativeElement of graphContainerRef to get the DOM container for the graph
    const graphContainer = this.graphContainerRef.nativeElement;

    // Clear the container in case it already has content
    while (graphContainer.firstChild) {
      graphContainer.removeChild(graphContainer.firstChild);
    }

    // Create the ngx-graph component and attach it to the container
    const graphComponent = new GraphComponent();
    graphComponent.init(graphContainer, data, options);
    
  }
    */

  toggleMakeConnectionsMode() {
    this.makeConnectionsMode = !this.makeConnectionsMode;
  }

  handleNodeClick(node: any) {
    if (this.makeConnectionsMode) {
      if (!this.sourceNode) {
        // Store the source node for the connection
        this.sourceNode = node;
      } else {
        // Create a new connector (edge) between source and target nodes
        const newEdge = {
          source: this.sourceNode.id.toString(),
          target: node.id.toString(),
          label: 'label',
          data: {
            linkText: 'link text',
          },
        };
        //this.graphEdges.push(newEdge); // Update your data model
        //this.drawGraph(); // Update the graph visualization
        this.sourceNode = null; // Reset source node
      }
    }
  }


  // Updates the state object instance
  onStateInstanceDrop(event: any) {
    if (!this.noCodeSolution) return;

    // Get the position and dimensions of the dropped no-code-state-instance element
    const stateInstanceMovement = event.distance;

    //Get the state index.
    let stateIndex : number = event.source.data.index;
    let stateInstanceRef = this.noCodeSolution.stateInstances[stateIndex];
    let currentX = stateInstanceRef.stateLocationX;
    let currentY = stateInstanceRef.stateLocationY;

    // Calculate the new position of the state instance in respect to the mat-card element
    let newX = currentX + stateInstanceMovement.x;
    let newY = currentY + stateInstanceMovement.y;
    //Assign the new values so they propagate to child component
    this.noCodeSolution.stateInstances[stateIndex].stateLocationX = newX;
    this.noCodeSolution.stateInstances[stateIndex].stateLocationY = newY;
    // Do something when a state instance is moved, e.g. update its position in the stateInstances array
    // moveItemInArray(this.stateInstances, event.previousIndex, event.currentIndex);
}

  
  showContextMenu(event) {
        event.preventDefault();
        this.contextMenu = true;
        // position of the context menu is based on the event's x and y
  }

  hideContextMenu() {
    this.contextMenu = false;
  }

  onNewStateInstance() {
    if (!this.noCodeSolution) return;

    let newIndex: number = this.noCodeSolution.stateInstances.length;
    this.noCodeSolution.stateInstances.push(new NoCodeState());
    //this.drawGraph(); // Update the graph visualization
  }

  onNewConnectorInstance() {
    // Implement logic to create a new connector instance and update the graph
  }

  onDragStarted(event: CdkDragStart, stateInstance){
    console.log("Drag started");
    console.log(event);
    console.log(stateInstance);
  }

  onDragEnded(event: CdkDragEnd, stateInstance){
    console.log("Drag ended");
  }

  // ==================== Sidebar Methods ====================

  /**
   * Handle sidebar expansion toggle
   */
  onSidebarToggle(expanded: boolean): void {
    this.sidebarExpanded = expanded;
    this.changeDetectorRef.markForCheck();
  }

  // ==================== Context Menu Methods ====================

  /**
   * Handle right-click on a state to show context menu
   */
  private handleStateContextMenu(event: MouseEvent, stateName: string, stateGroup: SVGGElement, shapeType: string): void {
    console.log('[handleStateContextMenu] State:', stateName, 'Shape:', shapeType);

    // Get the current state size
    const stateInstance = this.stateInstances.find(s => s.stateName === stateName);
    let currentSize = 100;
    if (stateInstance) {
      if (shapeType === 'circle') {
        currentSize = stateInstance.stateSvgRadius || 100;
      } else {
        currentSize = stateInstance.stateSvgWidth || stateInstance.stateSvgSizeX || 120;
      }
    }

    // Position and show the context menu
    this.contextMenuPosition = { x: event.clientX, y: event.clientY };
    this.contextMenuStateName = stateName;
    this.contextMenuStateGroup = stateGroup;
    this.contextMenuShapeType = shapeType;
    this.contextMenuCurrentSize = currentSize;
    this.stateContextMenuVisible = true;
    this.changeDetectorRef.markForCheck();
  }

  /**
   * Close the context menu
   */
  closeContextMenu(): void {
    this.stateContextMenuVisible = false;
    this.contextMenuStateName = '';
    this.contextMenuStateGroup = null;
    this.changeDetectorRef.markForCheck();
  }

  /**
   * Handle right-click on a slot to open slot configuration popup directly
   */
  private handleSlotContextMenu(event: MouseEvent, stateName: string, slotIndex: number, isInput: boolean): void {
    console.log('[handleSlotContextMenu] ===== SLOT CONTEXT MENU =====');
    console.log('[handleSlotContextMenu] State:', stateName, 'Slot:', slotIndex, 'isInput:', isInput);

    // Find the state instance
    const stateInstance = this.stateInstances.find(s => s.stateName === stateName);
    if (!stateInstance) {
      console.warn('[handleSlotContextMenu] State not found:', stateName);
      return;
    }

    // Find the slot in the state
    const slot = stateInstance.slots?.find(s => s.index === slotIndex);
    if (!slot) {
      console.warn('[handleSlotContextMenu] Slot not found:', slotIndex);
      return;
    }

    console.log('[handleSlotContextMenu] Found slot:', slot);
    console.log('[handleSlotContextMenu] Slot color from data:', (slot as any).color);
    console.log('[handleSlotContextMenu] Slot label from data:', (slot as any).label);

    // Create slot configuration from the slot data
    const slotConfig: SlotConfiguration = {
      index: slot.index,
      stateName: stateName,
      isInput: slot.isInput,
      color: (slot as any).color || (slot.isInput ? '#2196f3' : '#4caf50'),
      mappingMode: (slot as any).mappingMode || (slot.isInput ? 'object_state' : 'function_return'),
      label: (slot as any).label || (slot.isInput ? `I${slot.index}` : `O${slot.index}`),
      parameterName: (slot as any).parameterName,
      parameterType: (slot as any).parameterType,
      returnType: (slot as any).returnType,
      description: (slot as any).description,
      // Output-specific configuration
      triggerType: (slot as any).triggerType,
      sourceInstance: (slot as any).sourceInstance,
      propertyPath: (slot as any).propertyPath,
      passthroughVariableName: (slot as any).passthroughVariableName,
      // Conditional output configuration
      isConditional: (slot as any).isConditional,
      conditionLabel: (slot as any).conditionLabel,
      conditionExpression: (slot as any).conditionExpression,
      conditionalGroup: (slot as any).conditionalGroup
    };

    // Position the popup at the click position
    this.currentSlotConfig = slotConfig;
    this.slotConfigPosition = {
      x: event.clientX,
      y: event.clientY
    };

    // Get context and state class for the slot's state
    if (this.selectedSolutionName) {
      console.log('[handleSlotContextMenu] Getting context for state:', stateName);
      this.slotConfigStateContext = this.solutionStateService.getPotentialContextForState(
        this.selectedSolutionName,
        stateName
      );
      console.log('[handleSlotContextMenu] State context:', this.slotConfigStateContext);
      this.slotConfigStateClass = stateInstance.stateClass || '';
      console.log('[handleSlotContextMenu] State class:', this.slotConfigStateClass);

      // Get produced variables from the state (for VariableAssignment, MathOperation, etc.)
      console.log('[handleSlotContextMenu] Getting produced variables from state instance:', stateInstance);
      this.slotConfigProducedVariables = this.getProducedVariablesForState(stateInstance);
      console.log('[handleSlotContextMenu] Produced variables:', this.slotConfigProducedVariables);
    } else {
      this.slotConfigStateContext = null;
      this.slotConfigStateClass = '';
      this.slotConfigProducedVariables = [];
    }

    this.slotConfigPopupVisible = true;
    this.changeDetectorRef.markForCheck();
  }

  /**
   * Get produced variables from a state's boundObjectFieldValues
   */
  private getProducedVariablesForState(stateInstance: NoCodeState | { boundObjectFieldValues?: { [key: string]: any } }): ProducedVariable[] {
    console.log('[getProducedVariablesForState] ===== GETTING PRODUCED VARIABLES =====');
    console.log('[getProducedVariablesForState] State Instance:', stateInstance);
    console.log('[getProducedVariablesForState] boundObjectFieldValues:', stateInstance.boundObjectFieldValues);

    const produced: ProducedVariable[] = [];

    if (!stateInstance.boundObjectFieldValues) {
      console.log('[getProducedVariablesForState] No boundObjectFieldValues, returning empty');
      return produced;
    }

    // Check for outputVariable (from VariableAssignment)
    const outputVar = stateInstance.boundObjectFieldValues.outputVariable;
    if (outputVar && outputVar.name && outputVar.type) {
      produced.push({
        name: outputVar.name,
        type: outputVar.type
      });
    }

    // Check for new variable name and type directly (alternative storage format)
    const variableName = stateInstance.boundObjectFieldValues.variableName;
    const dataType = stateInstance.boundObjectFieldValues.dataType;
    const assignmentConfig = stateInstance.boundObjectFieldValues.assignmentConfig;

    // If we have assignment config and it's a new_variable target type
    if (assignmentConfig && assignmentConfig.targetType === 'new_variable' && assignmentConfig.variableName) {
      // Check if not already in produced
      if (!produced.find(p => p.name === assignmentConfig.variableName)) {
        produced.push({
          name: assignmentConfig.variableName,
          type: assignmentConfig.dataType || 'any'
        });
      }
    }

    // Check for MathOperation result variable
    const mathConfig = stateInstance.boundObjectFieldValues.mathConfig;
    if (mathConfig && mathConfig.resultTarget === 'new_variable' && mathConfig.resultVariableName) {
      if (!produced.find(p => p.name === mathConfig.resultVariableName)) {
        produced.push({
          name: mathConfig.resultVariableName,
          type: 'number'
        });
      }
    }

    console.log('[getProducedVariablesForState] Returning produced variables:', produced);
    return produced;
  }

  /**
   * Handle context menu actions
   */
  onContextMenuAction(action: StateContextMenuAction): void {
    console.log('[onContextMenuAction]', action);

    if (!this.selectedSolutionName) {
      return;
    }

    switch (action.type) {
      case 'resize':
        this.handleResizeAction(action);
        break;
      case 'changeShape':
        this.handleChangeShapeAction(action);
        break;
      case 'delete':
        this.handleDeleteAction(action);
        break;
      case 'duplicate':
        this.handleDuplicateAction(action);
        break;
      case 'editProperties':
        // TODO: Open properties panel
        console.log('[onContextMenuAction] Edit properties for:', action.stateName);
        break;
      case 'manageSlots':
        this.handleManageSlotsAction(action);
        break;
      case 'viewContext':
        this.handleViewContextAction(action);
        break;
    }

    this.closeContextMenu();
  }

  /**
   * Handle resize action from context menu
   */
  private handleResizeAction(action: StateContextMenuAction): void {
    if (!this.selectedSolutionName || !action.value) return;

    const { radius, width, height } = action.value;

    // Update the state in the service
    this.solutionStateService.updateStateSize(
      this.selectedSolutionName,
      action.stateName,
      radius,
      width,
      height
    );

    // Reload the solution to reflect changes
    this.loadSelectedSolution();
  }

  /**
   * Handle change shape action from context menu
   */
  private handleChangeShapeAction(action: StateContextMenuAction): void {
    if (!this.selectedSolutionName) return;

    const newShape = action.value as string;

    // Update the state shape in the service
    this.solutionStateService.updateStateShape(
      this.selectedSolutionName,
      action.stateName,
      newShape
    );

    // Reload the solution to reflect changes
    this.loadSelectedSolution();
  }

  /**
   * Handle delete action from context menu
   */
  private handleDeleteAction(action: StateContextMenuAction): void {
    if (!this.selectedSolutionName) return;

    // Remove the state from the service
    this.solutionStateService.removeStateFromSolution(
      this.selectedSolutionName,
      action.stateName
    );

    // Reload the solution to reflect changes
    this.loadSelectedSolution();
  }

  /**
   * Handle duplicate action from context menu
   */
  private handleDuplicateAction(action: StateContextMenuAction): void {
    if (!this.selectedSolutionName || !this.noCodeSolution) return;

    // Find the state to duplicate
    const stateInstance = this.stateInstances.find(s => s.stateName === action.stateName);
    if (!stateInstance) return;

    // Generate new name
    const baseName = stateInstance.stateName || 'State';
    let counter = 1;
    let newName = `${baseName} Copy`;
    const existingNames = this.stateInstances.map(s => s.stateName);
    while (existingNames.includes(newName)) {
      newName = `${baseName} Copy ${counter++}`;
    }

    // Create duplicate with offset position
    const duplicateState: any = {
      id: `state_${Date.now()}`,
      stateName: newName,
      index: this.stateInstances.length,
      shapeType: stateInstance.shapeType || 'circle',
      stateClass: stateInstance.stateClass || '',
      solutionName: this.selectedSolutionName,
      layerName: stateInstance.layerName || '',
      stateLocationX: (stateInstance.stateLocationX || 0) + 50,
      stateLocationY: (stateInstance.stateLocationY || 0) + 50,
      stateSvgSizeX: stateInstance.stateSvgSizeX,
      stateSvgSizeY: stateInstance.stateSvgSizeY,
      stateSvgRadius: stateInstance.stateSvgRadius,
      stateSvgWidth: stateInstance.stateSvgWidth,
      stateSvgHeight: stateInstance.stateSvgHeight,
      cornerRadius: stateInstance.cornerRadius,
      stateSvgName: stateInstance.stateSvgName || '',
      slots: [],
      slotRadius: stateInstance.slotRadius || 4,
      backgroundColor: stateInstance.backgroundColor || '#3f51b5'
    };

    this.solutionStateService.addStateToSolution(this.selectedSolutionName, duplicateState);

    // Reload the solution to reflect changes
    this.loadSelectedSolution();
  }

  // ==================== Slot Manager Methods ====================

  /**
   * Handle manage slots action from context menu
   */
  private handleManageSlotsAction(action: StateContextMenuAction): void {
    const stateInstance = this.stateInstances.find(s => s.stateName === action.stateName);
    if (!stateInstance) return;

    // Convert slots to SlotConfiguration format
    const slots = stateInstance.slots || [];
    this.slotManagerInputSlots = slots
      .filter(s => s.isInput)
      .map((s, i) => ({
        index: s.index ?? i,
        stateName: action.stateName,
        isInput: true,
        color: '#2196f3', // Default input color
        mappingMode: 'object_state' as InputMappingMode,
        label: `Input ${i + 1}`
      }));

    this.slotManagerOutputSlots = slots
      .filter(s => !s.isInput)
      .map((s, i) => ({
        index: s.index ?? i,
        stateName: action.stateName,
        isInput: false,
        color: '#4caf50', // Default output color
        mappingMode: 'function_return' as OutputMappingMode,
        label: `Output ${i + 1}`
      }));

    this.slotManagerStateName = action.stateName;
    this.slotManagerPosition = this.contextMenuPosition;
    this.slotManagerVisible = true;
    this.changeDetectorRef.markForCheck();
  }

  // ==================== View Context Overlay Methods ====================

  /**
   * Handle view context action from context menu
   * Opens the View Context overlay to inspect the PotentialContext at this state
   */
  private handleViewContextAction(action: StateContextMenuAction): void {
    if (!this.selectedSolutionName) return;

    // Get the potential context for this state
    const context = this.solutionStateService.getPotentialContextForState(
      this.selectedSolutionName,
      action.stateName
    );

    console.log('[handleViewContextAction] Context for state:', action.stateName, context);

    // Position the overlay near the context menu position
    this.viewContextOverlayStateName = action.stateName;
    this.viewContextOverlayContext = context;
    this.viewContextOverlayPosition = {
      x: this.contextMenuPosition.x + 20,
      y: this.contextMenuPosition.y + 20
    };
    this.viewContextOverlayVisible = true;
    this.changeDetectorRef.markForCheck();
  }

  /**
   * Close the view context overlay
   */
  closeViewContextOverlay(): void {
    this.viewContextOverlayVisible = false;
    this.viewContextOverlayStateName = '';
    this.viewContextOverlayContext = null;
    this.changeDetectorRef.markForCheck();
  }

  /**
   * Close the slot manager popup
   */
  closeSlotManager(): void {
    this.slotManagerVisible = false;
    this.slotManagerStateName = '';
    this.slotManagerInputSlots = [];
    this.slotManagerOutputSlots = [];
    this.changeDetectorRef.markForCheck();
  }

  /**
   * Show the full view popup for a state
   */
  showFullViewPopup(x: number, y: number, stateInstance: NoCodeState): void {
    this.fullViewPopupPosition = { x, y };
    this.fullViewPopupState = stateInstance;
    this.fullViewPopupVisible = true;
    this.changeDetectorRef.markForCheck();
  }

  /**
   * Close the full view popup
   */
  closeFullViewPopup(): void {
    this.fullViewPopupVisible = false;
    this.fullViewPopupState = null;
    this.changeDetectorRef.markForCheck();
  }

  /**
   * Handle class selection from full view popup
   */
  onFullViewClassSelected(event: { className: string }): void {
    if (this.fullViewPopupState && this.fullViewPopupState.stateName) {
      this.fullViewPopupState.boundObjectClass = event.className;
      // Update the overlay if it exists
      const overlay = this.stateOverlayManager.getOverlayComponent(this.fullViewPopupState.stateName);
      if (overlay) {
        overlay.instance.boundClassName = event.className;
        overlay.changeDetectorRef.detectChanges();
      }
    }
  }

  /**
   * Handle field change from full view popup
   */
  onFullViewFieldChanged(event: { fieldName: string; value: any }): void {
    if (this.fullViewPopupState) {
      if (!this.fullViewPopupState.boundObjectFieldValues) {
        this.fullViewPopupState.boundObjectFieldValues = {};
      }
      this.fullViewPopupState.boundObjectFieldValues[event.fieldName] = event.value;
    }
  }

  // Helper methods for full view popup template bindings
  getFullViewStateType(): 'object' | 'function' | 'variable' | 'block' | 'solution' {
    // Determine state type based on stateClass or other properties
    const stateClass = this.fullViewPopupState?.stateClass || this.fullViewPopupState?.boundObjectClass || '';
    if (stateClass.toLowerCase().includes('function')) return 'function';
    if (stateClass.toLowerCase().includes('variable')) return 'variable';
    if (stateClass.toLowerCase().includes('solution')) return 'solution';
    if (stateClass.toLowerCase().includes('block')) return 'block';
    return 'object';
  }

  getFullViewStateName(): string {
    return this.fullViewPopupState?.stateName || '';
  }

  getFullViewFunctionName(): string {
    return this.fullViewPopupState?.boundObjectFieldValues?.functionName || '';
  }

  getFullViewVariableName(): string {
    return this.fullViewPopupState?.boundObjectFieldValues?.variableName || '';
  }

  getFullViewSolutionName(): string {
    return this.fullViewPopupState?.boundObjectFieldValues?.solutionName || '';
  }

  getFullViewInputSlotCount(): number {
    if (!this.fullViewPopupState?.slots) return 0;
    return this.fullViewPopupState.slots.filter(s => s.isInput).length;
  }

  getFullViewOutputSlotCount(): number {
    if (!this.fullViewPopupState?.slots) return 0;
    return this.fullViewPopupState.slots.filter(s => !s.isInput).length;
  }

  /**
   * Handle slot manager configuration changes
   */
  onSlotManagerChanged(config: StateSlotManagerConfig): void {
    console.log('[onSlotManagerChanged]', config);

    if (!this.selectedSolutionName) return;

    // Find the state and update its slots
    const stateInstance = this.stateInstances.find(s => s.stateName === config.stateName);
    if (!stateInstance) return;

    // Convert SlotConfiguration back to Slot format
    const newSlots: any[] = [];
    let slotIndex = 0;

    // Add input slots (left side, around 180 degrees)
    config.inputSlots.forEach((slotConfig, i) => {
      newSlots.push({
        index: slotIndex++,
        stateName: config.stateName,
        slotAngularPosition: 180 - (i * 30) + ((config.inputSlots.length - 1) * 15),
        connectors: [],
        isInput: true,
        isOutput: false,
        allowOneToMany: false,
        allowManyToOne: true,
        color: slotConfig.color,
        mappingMode: slotConfig.mappingMode,
        label: slotConfig.label
      });
    });

    // Add output slots (right side, around 0 degrees)
    config.outputSlots.forEach((slotConfig, i) => {
      newSlots.push({
        index: slotIndex++,
        stateName: config.stateName,
        slotAngularPosition: (i * 30) - ((config.outputSlots.length - 1) * 15),
        connectors: [],
        isInput: false,
        isOutput: true,
        allowOneToMany: true,
        allowManyToOne: false,
        color: slotConfig.color,
        mappingMode: slotConfig.mappingMode,
        label: slotConfig.label,
        // Conditional output properties
        isConditional: slotConfig.isConditional,
        conditionLabel: slotConfig.conditionLabel,
        conditionExpression: slotConfig.conditionExpression,
        conditionalGroup: slotConfig.conditionalGroup
      });
    });

    // Update state slots in the service
    this.solutionStateService.updateStateSlots(
      this.selectedSolutionName,
      config.stateName,
      newSlots
    );

    // Reload to reflect changes
    this.loadSelectedSolution();
    this.closeSlotManager();
  }

  /**
   * Handle request to open individual slot configuration
   */
  onSlotConfigRequested(slotConfig: SlotConfiguration): void {
    console.log('[onSlotConfigRequested] ===== SLOT CONFIG REQUESTED =====');
    console.log('[onSlotConfigRequested] SlotConfig:', slotConfig);

    this.currentSlotConfig = slotConfig;
    this.slotConfigPosition = {
      x: this.slotManagerPosition.x + 320,
      y: this.slotManagerPosition.y
    };

    // Get context and state class for the slot's state
    if (this.selectedSolutionName && slotConfig.stateName) {
      this.slotConfigStateContext = this.solutionStateService.getPotentialContextForState(
        this.selectedSolutionName,
        slotConfig.stateName
      );
      console.log('[onSlotConfigRequested] State context:', this.slotConfigStateContext);

      // Get state class from the solution - NOTE: this gets from service, not this.stateInstances
      const solution = this.solutionStateService.getSolutionData(this.selectedSolutionName);
      const stateFromService = solution?.stateInstances.find(s => s.stateName === slotConfig.stateName);
      console.log('[onSlotConfigRequested] State from service:', stateFromService);

      // Also check this.stateInstances for comparison
      const stateFromLocal = this.stateInstances.find(s => s.stateName === slotConfig.stateName);
      console.log('[onSlotConfigRequested] State from local stateInstances:', stateFromLocal);
      console.log('[onSlotConfigRequested] Local state boundObjectFieldValues:', stateFromLocal?.boundObjectFieldValues);

      this.slotConfigStateClass = stateFromService?.stateClass || '';

      // Get produced variables from the LOCAL state (which has the latest boundObjectFieldValues)
      if (stateFromLocal) {
        this.slotConfigProducedVariables = this.getProducedVariablesForState(stateFromLocal);
      } else if (stateFromService) {
        this.slotConfigProducedVariables = this.getProducedVariablesForState(stateFromService);
      } else {
        this.slotConfigProducedVariables = [];
      }
      console.log('[onSlotConfigRequested] Produced variables:', this.slotConfigProducedVariables);
    } else {
      this.slotConfigStateContext = null;
      this.slotConfigStateClass = '';
      this.slotConfigProducedVariables = [];
    }

    this.slotConfigPopupVisible = true;
    this.changeDetectorRef.markForCheck();
  }

  /**
   * Close the slot configuration popup
   */
  closeSlotConfigPopup(): void {
    this.slotConfigPopupVisible = false;
    this.currentSlotConfig = null;
    this.slotConfigStateContext = null;
    this.slotConfigStateClass = '';
    this.slotConfigProducedVariables = [];
    this.changeDetectorRef.markForCheck();
  }

  /**
   * Handle slot configuration changes
   */
  onSlotConfigChanged(config: SlotConfiguration): void {
    console.log('[onSlotConfigChanged] ===== SLOT CONFIG CHANGE =====');
    console.log('[onSlotConfigChanged] Config:', config);
    console.log('[onSlotConfigChanged] StateName:', config.stateName, 'SlotIndex:', config.index);
    console.log('[onSlotConfigChanged] Color:', config.color, 'Label:', config.label);

    // Update the slot manager arrays (for slot manager modal)
    if (config.isInput) {
      const index = this.slotManagerInputSlots.findIndex(s => s.index === config.index);
      if (index >= 0) {
        this.slotManagerInputSlots[index] = config;
      }
    } else {
      const index = this.slotManagerOutputSlots.findIndex(s => s.index === config.index);
      if (index >= 0) {
        this.slotManagerOutputSlots[index] = config;
      }
    }

    // Persist the slot configuration to the state instance and service
    if (this.selectedSolutionName && config.stateName) {
      // Find the state instance
      const stateInstance = this.stateInstances.find(s => s.stateName === config.stateName);
      if (stateInstance && stateInstance.slots) {
        // Find and update the slot
        const slot = stateInstance.slots.find(s => s.index === config.index);
        if (slot) {
          // Update slot properties
          (slot as any).color = config.color;
          (slot as any).label = config.label;
          (slot as any).mappingMode = config.mappingMode;
          (slot as any).description = config.description;
          (slot as any).parameterName = config.parameterName;
          (slot as any).parameterType = config.parameterType;
          (slot as any).returnType = config.returnType;
          (slot as any).triggerType = config.triggerType;
          (slot as any).sourceInstance = config.sourceInstance;
          (slot as any).propertyPath = config.propertyPath;
          (slot as any).passthroughVariableName = config.passthroughVariableName;

          console.log('[onSlotConfigChanged] Updated slot:', slot);
          console.log('[onSlotConfigChanged] Updated slot color:', (slot as any).color);
          console.log('[onSlotConfigChanged] Updated slot label:', (slot as any).label);

          // Persist to service
          const slotRawDataArray = stateInstance.slots.map(s => ({
            index: s.index,
            stateName: s.stateName || config.stateName,
            slotAngularPosition: s.slotAngularPosition || 0,
            connectors: (s.connectors || []).map(c => ({
              id: c.id,
              sourceSlot: c.sourceSlot,
              sinkSlot: c.sinkSlot,
              targetStateName: c.targetStateName
            })),
            isInput: s.isInput,
            allowOneToMany: s.allowOneToMany,
            allowManyToOne: s.allowManyToOne,
            color: (s as any).color,
            label: (s as any).label,
            mappingMode: (s as any).mappingMode,
            description: (s as any).description,
            parameterName: (s as any).parameterName,
            parameterType: (s as any).parameterType,
            returnType: (s as any).returnType,
            triggerType: (s as any).triggerType,
            sourceInstance: (s as any).sourceInstance,
            propertyPath: (s as any).propertyPath,
            passthroughVariableName: (s as any).passthroughVariableName,
            // Conditional output properties
            isConditional: (s as any).isConditional,
            conditionLabel: (s as any).conditionLabel,
            conditionExpression: (s as any).conditionExpression,
            conditionalGroup: (s as any).conditionalGroup
          }));

          this.solutionStateService.updateStateSlots(
            this.selectedSolutionName,
            config.stateName,
            slotRawDataArray
          );

          // Re-render the D3 layer to reflect visual changes
          this.rerenderStateSlots(config.stateName);
        }
      }
    }

    this.closeSlotConfigPopup();
  }

  /**
   * Re-render slots for a specific state to reflect configuration changes
   */
  private rerenderStateSlots(stateName: string): void {
    console.log('[rerenderStateSlots] ===== RE-RENDERING SLOTS =====');
    console.log('[rerenderStateSlots] StateName:', stateName);

    // Find the state instance
    const stateInstance = this.stateInstances.find(s => s.stateName === stateName);
    if (!stateInstance) {
      console.log('[rerenderStateSlots] State not found!');
      return;
    }

    console.log('[rerenderStateSlots] State found, slots count:', stateInstance.slots?.length);
    stateInstance.slots?.forEach((s, i) => {
      console.log(`[rerenderStateSlots] Slot ${i}: color=${(s as any).color}, label=${(s as any).label}`);
    });

    // Determine which layer to update based on shape type
    const shapeType = stateInstance.shapeType || 'circle';
    console.log('[rerenderStateSlots] ShapeType:', shapeType);

    if (shapeType === 'circle' && this.currentCircleStateLayer) {
      console.log('[rerenderStateSlots] Calling CircleStateLayer.rerenderState');
      // Re-render the circle state layer
      this.currentCircleStateLayer.rerenderState(stateName);
    } else if (shapeType === 'rectangle' && this.currentRectangleStateLayer) {
      console.log('[rerenderStateSlots] Calling RectangleStateLayer.rerenderState');
      // Re-render the rectangle state layer
      this.currentRectangleStateLayer.rerenderState(stateName);
    } else if (shapeType === 'diamond' && this.currentDiamondStateLayer) {
      console.log('[rerenderStateSlots] Calling DiamondStateLayer.rerenderState');
      // Re-render the diamond state layer
      this.currentDiamondStateLayer.rerenderState(stateName);
    } else {
      console.log('[rerenderStateSlots] No layer found for shape type:', shapeType);
    }
  }

  /**
   * Create a new state from a tool item (definition or built-in class)
   */
  onCreateStateFromDefinition(item: StateToolItem): void {
    if (!this.noCodeSolution || !this.selectedSolutionName) {
      console.warn('[CustomNoCode] No solution selected');
      return;
    }

    console.log('[CustomNoCode] Creating state from:', item);

    // Generate unique state name
    const existingNames = this.noCodeSolution.stateInstances.map(s => s.stateName);
    let baseName = item.displayName;
    let counter = 1;
    let stateName = baseName;
    while (existingNames.includes(stateName)) {
      stateName = `${baseName} ${counter++}`;
    }

    // Get class metadata for default configuration
    const classMetadata = this.stateSpaceRegistry.getClass(item.sourceClassName);

    // Create default slots from class metadata
    const slots: any[] = [];
    if (classMetadata?.slotConfiguration) {
      const slotConfig = classMetadata.slotConfiguration;
      let slotIndex = 0;

      // Create input slots
      const inputCount = slotConfig.defaultInputCount || 0;
      for (let i = 0; i < inputCount; i++) {
        slots.push({
          index: slotIndex++,
          stateName: stateName,
          slotAngularPosition: 180 - (i * 30) + ((inputCount - 1) * 15),
          connectors: [],
          isInput: true,
          isOutput: false,
          allowOneToMany: false,
          allowManyToOne: true,
          label: slotConfig.inputLabels?.[i] || `I${i}`,
          color: '#2196f3' // default blue
        });
      }

      // Create output slots
      const outputCount = slotConfig.defaultOutputCount || 0;
      for (let i = 0; i < outputCount; i++) {
        const outputSlot: any = {
          index: slotIndex++,
          stateName: stateName,
          slotAngularPosition: (i * 45) - ((outputCount - 1) * 22.5),
          connectors: [],
          isInput: false,
          isOutput: true,
          allowOneToMany: true,
          allowManyToOne: false,
          label: slotConfig.outputLabels?.[i] || `O${i}`,
          color: '#4caf50' // default green
        };

        // Apply conditional output configuration if present
        if (slotConfig.conditionalOutputs && slotConfig.conditionalOutputs[i]) {
          const condConfig = slotConfig.conditionalOutputs[i];
          outputSlot.isConditional = true;
          outputSlot.conditionLabel = condConfig.conditionLabel;
          outputSlot.conditionExpression = condConfig.conditionExpression;
          outputSlot.conditionalGroup = condConfig.conditionalGroup;
          if (condConfig.color) {
            outputSlot.color = condConfig.color;
          }
        }

        slots.push(outputSlot);
      }
    }

    // Create new state instance
    const newState = new NoCodeState(
      stateName,
      'circle', // Default shape type
      item.sourceClassName,
      this.noCodeSolution.stateInstances.length, // index
      null, // stateSvgSizeX (use default)
      null, // stateSvgSizeY (use default)
      100, // stateSvgRadius
      this.selectedSolutionName,
      'circle', // layerName
      200 + Math.random() * 400, // Random X position
      200 + Math.random() * 300, // Random Y position
      `state_${Date.now()}`, // Unique ID
      undefined, // stateSvgName
      slots.map(s => new Slot(
        s.index, s.stateName, s.slotAngularPosition, [], s.isInput, s.allowOneToMany, s.allowManyToOne
      )), // Create Slot instances
      4, // slotRadius
      item.color || '#3f51b5' // backgroundColor
    );

    // Bind to state definition if it's a custom definition
    if (item.type === 'definition' && item.id) {
      newState.bindToStateDefinition(item.id, item.sourceClassName);
    } else {
      // For built-in classes, set the bound class
      newState.boundObjectClass = item.sourceClassName;
    }

    // Add to solution
    this.noCodeSolution.stateInstances.push(newState);

    // Persist to state service (include all slot properties including conditional)
    this.solutionStateService.addStateToSolution(this.selectedSolutionName, {
      id: newState.id || `state_${Date.now()}`,
      stateName: newState.stateName || stateName,
      index: newState.index ?? this.noCodeSolution.stateInstances.length - 1,
      shapeType: newState.shapeType || 'circle',
      stateClass: newState.stateClass || item.sourceClassName,
      solutionName: newState.solutionName || this.selectedSolutionName,
      layerName: newState.layerName || 'circle',
      stateLocationX: newState.stateLocationX ?? 300,
      stateLocationY: newState.stateLocationY ?? 300,
      stateSvgSizeX: newState.stateSvgSizeX ?? null,
      stateSvgSizeY: newState.stateSvgSizeY ?? null,
      stateSvgRadius: newState.stateSvgRadius ?? 100,
      stateSvgName: newState.stateSvgName || '',
      slots: slots, // Include full slot data with conditional properties
      slotRadius: newState.slotRadius ?? 4,
      backgroundColor: newState.backgroundColor || item.color || '#3f51b5'
    });

    // Re-render the solution to show the new state
    this.loadSelectedSolution();

    console.log('[CustomNoCode] Created new state:', stateName, 'with', slots.length, 'slots');
  }

  /**
   * Create a state from a class member (field getter/setter or method call)
   */
  onCreateStateFromClassMember(request: ClassMemberStateRequest): void {
    if (!this.noCodeSolution || !this.selectedSolutionName) {
      console.warn('[CustomNoCode] No solution selected');
      return;
    }

    console.log('[CustomNoCode] Creating state from class member:', request);

    // Generate unique state name based on member type
    let baseName: string;
    let stateClass: string;
    let color: string;

    if (request.type === 'field') {
      if (request.memberName.startsWith('set_')) {
        baseName = `Set ${request.field?.displayName || request.memberName.replace('set_', '')}`;
        stateClass = 'FieldSetter';
        color = '#2196f3'; // Blue for setters
      } else {
        baseName = `Get ${request.field?.displayName || request.memberName}`;
        stateClass = 'FieldGetter';
        color = '#4caf50'; // Green for getters
      }
    } else {
      baseName = request.method?.displayName || request.memberName;
      stateClass = 'MethodCall';
      color = '#9c27b0'; // Purple for methods
    }

    // Ensure unique name
    const existingNames = this.noCodeSolution.stateInstances.map(s => s.stateName);
    let counter = 1;
    let stateName = baseName;
    while (existingNames.includes(stateName)) {
      stateName = `${baseName} ${counter++}`;
    }

    // Create slots based on request
    const slots: any[] = [];
    let slotIndex = 0;

    // Create input slots (positioned on left side: 135-225 degrees)
    for (let i = 0; i < request.inputSlotCount; i++) {
      const inputSlot: any = {
        index: slotIndex++,
        stateName: stateName,
        slotAngularPosition: 180 - (i * 30), // Space inputs around left side
        connectors: [],
        isInput: true,
        isOutput: false,
        allowOneToMany: false,
        allowManyToOne: true
      };

      // Add parameter name/type info for methods
      if (request.method && request.method.parameters && request.method.parameters[i]) {
        inputSlot.parameterName = request.method.parameters[i].name;
        inputSlot.parameterType = request.method.parameters[i].type;
      } else if (request.field) {
        inputSlot.parameterName = 'value';
        inputSlot.parameterType = request.field.type;
      }

      slots.push(inputSlot);
    }

    // Create output slots (positioned on right side: -45 to 45 degrees)
    for (let i = 0; i < request.outputSlotCount; i++) {
      const outputSlot: any = {
        index: slotIndex++,
        stateName: stateName,
        slotAngularPosition: 0 + (i * 30), // Space outputs around right side
        connectors: [],
        isInput: false,
        isOutput: true,
        allowOneToMany: true,
        allowManyToOne: false
      };

      // Add return type info
      if (request.method) {
        outputSlot.returnType = request.method.returnType;
      } else if (request.field) {
        outputSlot.returnType = request.field.type;
      }

      slots.push(outputSlot);
    }

    // Create the state
    const newState = new NoCodeState(
      stateName,
      'circle',
      stateClass,
      this.noCodeSolution.stateInstances.length,
      null,
      null,
      80, // Slightly smaller radius
      this.selectedSolutionName,
      'circle',
      200 + Math.random() * 400,
      200 + Math.random() * 300,
      `state_${Date.now()}`,
      undefined,
      slots.map(s => new Slot(
        s.index, s.stateName, s.slotAngularPosition, [], s.isInput, s.allowOneToMany, s.allowManyToOne
      )),
      5,
      color
    );

    // Set bound object info
    newState.boundObjectClass = request.className;
    newState.boundObjectFieldValues = {
      memberType: request.type,
      memberName: request.memberName
    };

    if (request.field) {
      newState.boundObjectFieldValues.fieldName = request.field.name;
      newState.boundObjectFieldValues.fieldType = request.field.type;
    }

    if (request.method) {
      newState.boundObjectFieldValues.methodName = request.method.name;
      newState.boundObjectFieldValues.parameters = request.method.parameters;
      newState.boundObjectFieldValues.returnType = request.method.returnType;
    }

    // Add to solution
    this.noCodeSolution.stateInstances.push(newState);

    // Persist to state service
    this.solutionStateService.addStateToSolution(this.selectedSolutionName, {
      id: newState.id || `state_${Date.now()}`,
      stateName: newState.stateName || stateName,
      index: newState.index ?? this.noCodeSolution.stateInstances.length - 1,
      shapeType: 'circle',
      stateClass: stateClass,
      solutionName: this.selectedSolutionName,
      layerName: 'circle',
      stateLocationX: newState.stateLocationX ?? 300,
      stateLocationY: newState.stateLocationY ?? 300,
      stateSvgSizeX: null,
      stateSvgSizeY: null,
      stateSvgRadius: 80,
      stateSvgName: '',
      slots: slots,
      slotRadius: 5,
      backgroundColor: color,
      boundObjectClass: request.className,
      boundObjectFieldValues: newState.boundObjectFieldValues
    });

    // Re-render the solution to show the new state
    this.loadSelectedSolution();

    console.log('[CustomNoCode] Created class member state:', stateName, 'with', slots.length, 'slots');
  }

  // ==================== Helper Classes Methods ====================

  /**
   * Toggle a helper class on/off for this solution
   */
  onToggleHelperClass(cls: HelperClassDefinition): void {
    const index = this.enabledHelperClasses.findIndex(c => c.className === cls.className);
    if (index >= 0) {
      // Remove from enabled list
      this.enabledHelperClasses.splice(index, 1);
      console.log('[CustomNoCode] Disabled helper class:', cls.className);
    } else {
      // Add to enabled list
      this.enabledHelperClasses.push({ ...cls, isEnabled: true });
      console.log('[CustomNoCode] Enabled helper class:', cls.className);
    }
    this.changeDetectorRef.markForCheck();
  }

  // ==================== Sub-Solutions Methods ====================

  /**
   * Create a state from a sub-solution
   */
  onCreateSubSolutionState(subSolution: SubSolutionDefinition): void {
    if (!this.noCodeSolution) return;

    const stateName = `${subSolution.solutionName}_call_${Date.now()}`;
    const stateClass = `Solution_${subSolution.solutionName}`;

    // Create slots: one input per parameter, one output for return
    const inputCount = subSolution.inputParams?.length || 0;
    const slots: { index: number; stateName: string; slotAngularPosition: number; isInput: boolean; allowOneToMany: boolean; allowManyToOne: boolean }[] = [];

    // Create input slots for parameters
    for (let i = 0; i < inputCount; i++) {
      const angle = 180 + (i * 30) - ((inputCount - 1) * 15); // Left side, distributed
      slots.push({
        index: i,
        stateName: stateName,
        slotAngularPosition: angle,
        isInput: true,
        allowOneToMany: false,
        allowManyToOne: true
      });
    }

    // Create output slot for return value
    slots.push({
      index: inputCount,
      stateName: stateName,
      slotAngularPosition: 0, // Right side
      isInput: false,
      allowOneToMany: true,
      allowManyToOne: false
    });

    const color = subSolution.color || '#673AB7';

    // Create the state (same signature as onCreateStateFromClassMember)
    const newState = new NoCodeState(
      stateName,
      'circle',
      stateClass,
      this.noCodeSolution.stateInstances.length,
      null,
      null,
      80,
      this.selectedSolutionName || '',
      'circle',
      200 + Math.random() * 400,
      200 + Math.random() * 300,
      `state_${Date.now()}`,
      undefined,
      slots.map(s => new Slot(
        s.index, s.stateName, s.slotAngularPosition, [], s.isInput, s.allowOneToMany, s.allowManyToOne
      )),
      5,
      color
    );

    // Set sub-solution binding info
    newState.boundObjectClass = stateClass;
    newState.boundObjectFieldValues = {
      subSolutionName: subSolution.solutionName,
      inputParams: subSolution.inputParams,
      outputType: subSolution.outputType
    };

    // Add to solution
    this.noCodeSolution.stateInstances.push(newState);

    // Persist to state service
    const slotsWithConnectors = slots.map(s => ({
      ...s,
      connectors: []
    }));

    this.solutionStateService.addStateToSolution(this.selectedSolutionName || '', {
      id: newState.id || `state_${Date.now()}`,
      stateName: stateName,
      index: this.noCodeSolution.stateInstances.length - 1,
      shapeType: 'circle',
      stateClass: stateClass,
      solutionName: this.selectedSolutionName || '',
      layerName: 'circle',
      stateLocationX: newState.stateLocationX ?? 300,
      stateLocationY: newState.stateLocationY ?? 300,
      stateSvgSizeX: null,
      stateSvgSizeY: null,
      stateSvgRadius: 80,
      stateSvgName: '',
      slots: slotsWithConnectors,
      slotRadius: 5,
      backgroundColor: color,
      boundObjectClass: stateClass,
      boundObjectFieldValues: newState.boundObjectFieldValues
    });

    // Re-render
    this.loadSelectedSolution();
    console.log('[CustomNoCode] Created sub-solution state:', stateName);
  }

  // ==================== Definition Creator Methods ====================

  /**
   * Open the state definition creator panel
   */
  onOpenDefinitionCreator(): void {
    this.editingDefinition = undefined;
    this.showDefinitionCreator = true;
    this.changeDetectorRef.markForCheck();
  }

  /**
   * Close the state definition creator panel
   */
  closeDefinitionCreator(): void {
    this.showDefinitionCreator = false;
    this.editingDefinition = undefined;
    this.changeDetectorRef.markForCheck();
  }

  /**
   * Handle when a definition is saved
   */
  onDefinitionSaved(definition: StateDefinition): void {
    console.log('[CustomNoCode] Definition saved:', definition);
    this.closeDefinitionCreator();
    // The sidebar will automatically update via the stateDefinitions$ subscription
  }

  /**
   * Open definition creator for editing an existing definition
   */
  editDefinition(definition: StateDefinition): void {
    this.editingDefinition = definition;
    this.showDefinitionCreator = true;
    this.changeDetectorRef.markForCheck();
  }

}
