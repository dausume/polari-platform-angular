// app.module.ts
import { APP_INITIALIZER, CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { RuntimeConfigService } from '@services/runtime-config.service';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'
import { HttpClientModule } from '@angular/common/http';
import { DragDropModule } from '@angular/cdk/drag-drop';
//Materials
import { MaterialModule } from './material/material.module'
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule } from '@angular/material/dialog';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDividerModule } from '@angular/material/divider';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSnackBarModule } from '@angular/material/snack-bar';
//NgRx
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';
import { rootReducers } from './state/app.state';
import { PolariEffects } from './state/effects/polari.effects';
import { DynamicObjectsEffects } from './state/effects/dynamic-objects.effects';
import { environment } from '../environments/environment-dev';
//App Routing and App Base Component
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
//Components
// App Base Components
import { HeaderComponent } from 'src/app/components/header/header';
import { PolariConfigComponent } from '@components/polari-config/polari-config';
import { NavigationComponent } from '@components/nav-component/nav-component';
// Class-Oriented Dynamic Components
import { templateClassTableComponent } from '@components/templateClassTable/templateClassTable';
import { ClassMainPageComponent } from '@components/class-main-page/class-main-page';
import { classInstanceSearchComponent } from '@components/class-instance-search/class-instance-search';
import { CreateNewClassComponent } from '@components/create-new-class/create-new-class';
import { VariableModifierComponent } from '@components/create-new-class/variable-modifier/variable-modifier';
import { EditClassDialogComponent } from '@components/class-main-page/edit-class-dialog/edit-class-dialog';
// Dashboard/Display Components
import { DisplayRendererComponent } from '@components/dashboard/dashboard-renderer/dashboard-renderer';
import { DisplayMetricCardComponent } from '@components/dashboard/dashboard-metric-card/dashboard-metric-card';
// No-Code Components
import { CustomNoCodeComponent } from '@components/custom-no-code/custom-no-code';
import { NoCodeStateInstanceComponent } from '@components/custom-no-code/no-code-state-instance/no-code-state-instance';
import { NoCodeStateInstanceComponentD3 } from '@components/custom-no-code/no-code-interface/no-code-state-instance-d3/no-code-state-instance-d3';
import { NoCodeInterfaceComponent } from '@components/custom-no-code/no-code-interface/no-code-interface';
import { SolutionEditorComponent } from '@components/custom-no-code/no-code-interface/solution-editor/solution-editor';
import { SlotComponent } from '@components/custom-no-code/slot/slot';
import { NoCodeStateBorderComponent } from '@components/custom-no-code/no-code-state-instance/no-code-state-border/no-code-state-border';
import { StateOverlayComponent } from '@components/custom-no-code/state-overlay/state-overlay.component';
import { StateDefinitionCreatorComponent } from '@components/custom-no-code/state-definition-creator/state-definition-creator.component';
import { StateToolSidebarComponent } from '@components/custom-no-code/state-tool-sidebar/state-tool-sidebar.component';
import { StateContextMenuComponent } from '@components/custom-no-code/state-context-menu/state-context-menu.component';
import { SlotConfigurationPopupComponent } from '@components/custom-no-code/slot-configuration-popup/slot-configuration-popup.component';
import { StateSlotManagerPopupComponent } from '@components/custom-no-code/state-slot-manager-popup/state-slot-manager-popup.component';
import { StateFullViewPopupComponent } from '@components/custom-no-code/state-full-view-popup/state-full-view-popup.component';
import { ConditionalChainOverlayComponent } from '@components/custom-no-code/conditional-chain-overlay/conditional-chain-overlay.component';
import { FilterListOverlayComponent } from '@components/custom-no-code/filter-list-overlay/filter-list-overlay.component';
import { VariableAssignmentOverlayComponent } from '@components/custom-no-code/variable-assignment-overlay/variable-assignment-overlay.component';
import { InitialStateOverlayComponent } from '@components/custom-no-code/initial-state-overlay/initial-state-overlay.component';
import { MathOperationOverlayComponent } from '@components/custom-no-code/math-operation-overlay/math-operation-overlay.component';
import { ValueSourceSelectorComponent } from '@components/custom-no-code/value-source-selector/value-source-selector.component';
import { ViewContextOverlayComponent } from '@components/custom-no-code/view-context-overlay/view-context-overlay.component';
// Class Configuration Components
import { DefaultCellComponent } from './components/templateClassTable/type-cells/default-cell/default-cell';
import { ConfigCellActions } from '@components/templateClassTable/type-cells/config-cell-actions/config-cell-actions';
import { ClassDataTableComponent } from '@components/templateClassTable/class-data-table/class-data-table';
// Type-specific Cell Components
import { StringCellComponent } from '@components/templateClassTable/type-cells/string-cell/string-cell';
import { NumberCellComponent } from '@components/templateClassTable/type-cells/number-cell/number-cell';
import { BooleanCellComponent } from '@components/templateClassTable/type-cells/boolean-cell/boolean-cell';
import { DateCellComponent } from '@components/templateClassTable/type-cells/date-cell/date-cell';
import { ListCellComponent } from '@components/templateClassTable/type-cells/list-cell/list-cell';
import { DictCellComponent } from '@components/templateClassTable/type-cells/dict-cell/dict-cell';
import { ObjectCellComponent } from '@components/templateClassTable/type-cells/object-cell/object-cell';
// Cell View Components (for popups)
import { ListViewComponent } from '@components/templateClassTable/type-cells/list-view/list-view';
import { DictViewComponent } from '@components/templateClassTable/type-cells/dict-view/dict-view';
// (ManagerInfoComponent and TypingInfoComponent are lazy-loaded via router)
// Certificate Trust Component
import { CertificateTrustPromptComponent } from '@components/certificate-trust-prompt/certificate-trust-prompt';
// API Profiler Component
import { ApiProfilerComponent } from '@components/api-profiler/api-profiler.component';
// API Config Component
import { ApiConfigComponent } from '@components/api-config/api-config';
import { ApiConfigDetailDialogComponent } from '@components/api-config/api-config-detail-dialog';
// Table Config Components
import { TableConfigSidebarComponent } from '@components/table-config/table-config-sidebar/table-config-sidebar';
// Graph Config Components
import { GraphConfigSidebarComponent } from '@components/graph-config/graph-config-sidebar/graph-config-sidebar';
import { GraphRendererComponent } from '@components/graph-config/graph-renderer/graph-renderer';
// GeoJSON Config Components
import { GeoJsonConfigSidebarComponent } from '@components/geojson-config/geojson-config-sidebar/geojson-config-sidebar';
import { MapRendererComponent } from '@components/geojson-config/map-renderer/map-renderer';
import { CreateGeoJsonConfigDialogComponent } from '@components/geojson-config/create-geojson-config-dialog/create-geojson-config-dialog';
import { GeolocationDialogComponent } from '@components/geojson-config/geolocation-dialog/geolocation-dialog';
import { GeoJsonDataViewComponent } from '@components/geojson-config/geojson-data-view/geojson-data-view';
import { CreateTileSourceDialogComponent } from '@components/geojson-config/create-tile-source-dialog/create-tile-source-dialog';
import { TileSourceDetailDialogComponent } from '@components/geojson-config/tile-source-detail-dialog/tile-source-detail-dialog';
import { CreateGeocoderDialogComponent } from '@components/geojson-config/create-geocoder-dialog/create-geocoder-dialog';
import { GeocoderDetailDialogComponent } from '@components/geojson-config/geocoder-detail-dialog/geocoder-detail-dialog';
import { AddressSearchComponent } from '@components/geojson-config/address-search/address-search';
// Embedded Display Components
import { EmbeddedTableComponent } from '@components/dashboard/embedded-table/embedded-table';
import { EmbeddedGraphComponent } from '@components/dashboard/embedded-graph/embedded-graph';
// (SystemDiagnosticsComponent and HomeComponent are lazy-loaded via router)
//Services (Backend Access)
import { PolariService } from '@services/polari-service';
import { CRUDEservicesManager } from '@services/crude-services-manager';
import { CertificateTrustService } from '@services/certificate-trust.service';
import { ApiProfilerService } from '@services/api-profiler.service';
// Display Services
import { DefaultDisplayFactory } from '@services/dashboard/default-dashboard-factory.service';
import { DisplayConfigService } from '@services/dashboard/dashboard-config.service';
// Component Registry for dynamic display components
import { registerDisplayComponent } from '@models/dashboards/ComponentRegistry';
//
import { MatIconRegistry } from "@angular/material/icon";
import { DomSanitizer } from "@angular/platform-browser";
// Overlay for custom dropdowns and rendering of dynamic components in no-code ui.
import { OverlayContainer } from '@angular/cdk/overlay';
import { OverlayComponentService } from './services/no-code-services/overlay-component-service';
import { InteractionStateService } from '@services/no-code-services/interaction-state-service';
import { StateOverlayManager } from '@services/no-code-services/state-overlay-manager.service';
import { StateDefinitionService } from '@services/no-code-services/state-definition.service';
// Shared CRUD Module for dynamic class editing components
import { SharedCrudModule, DynamicDataTableComponent } from '@components/shared/shared-crud.module';


@NgModule({
  declarations: [
    AppComponent,
    PolariConfigComponent,
    templateClassTableComponent,
    ClassMainPageComponent,
    classInstanceSearchComponent,
    CreateNewClassComponent,
    VariableModifierComponent,
    EditClassDialogComponent,
    // No-Code Components
    CustomNoCodeComponent,
    NoCodeInterfaceComponent,
    NoCodeStateInstanceComponent,
    NoCodeStateInstanceComponentD3,
    SolutionEditorComponent,
    SlotComponent,
    NoCodeStateBorderComponent,
    StateOverlayComponent,
    StateDefinitionCreatorComponent,
    StateToolSidebarComponent,
    StateContextMenuComponent,
    SlotConfigurationPopupComponent,
    StateSlotManagerPopupComponent,
    StateFullViewPopupComponent,
    ConditionalChainOverlayComponent,
    FilterListOverlayComponent,
    VariableAssignmentOverlayComponent,
    InitialStateOverlayComponent,
    MathOperationOverlayComponent,
    ValueSourceSelectorComponent,
    ViewContextOverlayComponent,
    ClassDataTableComponent,
    ListCellComponent,
    DictCellComponent,
    ListViewComponent,
    DictViewComponent,
    ApiProfilerComponent,
    ApiConfigComponent,
    ApiConfigDetailDialogComponent,
    TableConfigSidebarComponent,
    GraphConfigSidebarComponent,
    GeoJsonConfigSidebarComponent,
    EmbeddedTableComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    MaterialModule,
    FormsModule,
    HttpClientModule,
    ReactiveFormsModule,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatGridListModule,
    MatSelectModule,
    DragDropModule,
    MatAutocompleteModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatDialogModule,
    MatListModule,
    MatIconModule,
    MatCheckboxModule,
    MatTabsModule,
    MatProgressBarModule,
    MatExpansionModule,
    MatDividerModule,
    MatSidenavModule,
    MatSlideToggleModule,
    MatButtonToggleModule,
    MatSnackBarModule,
    // Shared CRUD Module
    SharedCrudModule,
    // Standalone Components (Phase 1)
    StringCellComponent,
    NumberCellComponent,
    BooleanCellComponent,
    DateCellComponent,
    ObjectCellComponent,
    ConfigCellActions,
    DefaultCellComponent,
    NavigationComponent,
    HeaderComponent,
    DisplayMetricCardComponent,
    DisplayRendererComponent,
    GraphRendererComponent,
    CertificateTrustPromptComponent,
    EmbeddedGraphComponent,
    MapRendererComponent,
    CreateGeoJsonConfigDialogComponent,
    GeolocationDialogComponent,
    GeoJsonDataViewComponent,
    CreateTileSourceDialogComponent,
    TileSourceDetailDialogComponent,
    CreateGeocoderDialogComponent,
    GeocoderDetailDialogComponent,
    AddressSearchComponent,
    // NgRx
    StoreModule.forRoot(rootReducers),
    EffectsModule.forRoot([PolariEffects, DynamicObjectsEffects]),
    StoreDevtoolsModule.instrument({
      maxAge: 25,
      logOnly: environment.production
    })
  ],
  exports: [

  ],
  providers: [
    RuntimeConfigService,
    {
      provide: APP_INITIALIZER,
      useFactory: (configService: RuntimeConfigService) => () => configService.initialize(),
      deps: [RuntimeConfigService],
      multi: true
    },
    PolariService,
    CRUDEservicesManager,
    CertificateTrustService,
    ApiProfilerService,
    DefaultDisplayFactory,
    DisplayConfigService,
    OverlayContainer,
    OverlayComponentService,
    InteractionStateService,
    StateOverlayManager,
    StateDefinitionService
  ],
  bootstrap: [
    AppComponent
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AppModule {
  constructor(
    private matIconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer
  ) {
    this.matIconRegistry.addSvgIcon(
      "io-circle",
      this.domSanitizer.bypassSecurityTrustResourceUrl("../assets/io-circle.svg")
    );

    // Register display-compatible components
    this.registerDisplayComponents();
  }

  /**
   * Registers components that can be used in displays.
   * This enables dynamic component loading in the display renderer.
   */
  private registerDisplayComponents(): void {
    // Register templateClassTable for use in displays
    registerDisplayComponent('templateClassTable', templateClassTableComponent, {
      displayName: 'Class Data Table',
      description: 'Displays class instances in a configurable table with filtering and sorting'
    });

    // Register ClassDataTableComponent for direct table rendering
    registerDisplayComponent('classDataTable', ClassDataTableComponent, {
      displayName: 'Data Table',
      description: 'Material data table with type-aware cell rendering'
    });

    // Register DynamicDataTableComponent for CRUD operations on dynamic classes
    registerDisplayComponent('dynamicDataTable', DynamicDataTableComponent, {
      displayName: 'Dynamic Data Table',
      description: 'Full CRUD table with inline editing, dialog editing, and row actions'
    });

    // Register embedded table wrapper (loads table config by ID at render time)
    registerDisplayComponent('embeddedTable', EmbeddedTableComponent, {
      displayName: 'Table Configuration',
      description: 'Renders a saved table configuration'
    });

    // Register embedded graph wrapper (loads graph config by ID at render time)
    registerDisplayComponent('embeddedGraph', EmbeddedGraphComponent, {
      displayName: 'Graph Configuration',
      description: 'Renders a saved graph configuration'
    });

    console.log('[AppModule] Display components registered');
  }

  ngOnInit() {
    console.log("In AppModule ngOnInit");
  }

  initializeApp() {
  }
}
