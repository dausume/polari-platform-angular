import { CUSTOM_ELEMENTS_SCHEMA, /*ErrorHandler,*/  NgModule } from '@angular/core';
import { NgxGraphModule } from '@swimlane/ngx-graph';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'
//import { FlexModule } from '@angular/flex-layout'
//import { FlexLayoutModule } from "@angular/flex-layout";
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
import { MatSelectModule  } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatMenuModule } from '@angular/material/menu';
//App Routing and App Base Component
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
//Components
import { HomeComponent } from 'src/app/components/home/home';
import { HeaderComponent } from 'src/app/components/header/header';
import { PolariConfigComponent } from '@components/polari-config/polari-config';
import { NavigationComponent } from '@components/nav-component/nav-component';
import { templateClassTableComponent } from '@components/templateClassTable/templateClassTable';
import { ClassMainPageComponent }  from '@components/class-main-page/class-main-page';
import { classInstanceSearchComponent } from '@components/class-instance-search/class-instance-search';
import { CreateNewClassComponent } from '@components/create-new-class/create-new-class';
import { VariableModifierComponent } from '@components/create-new-class/variable-modifier/variable-modifier';
import { CustomNoCodeComponent } from '@components/custom-no-code/custom-no-code';
import { NoCodeStateInstanceComponent } from '@components/custom-no-code/no-code-state-instance/no-code-state-instance';
import { NoCodeStateInstanceComponentD3 } from '@components/custom-no-code/no-code-interface/no-code-state-instance-d3/no-code-state-instance-d3';
import { NoCodeInterfaceComponent } from '@components/custom-no-code/no-code-interface/no-code-interface';
import { SolutionEditorComponent } from '@components/custom-no-code/no-code-interface/solution-editor/solution-editor';
import { SlotComponent } from '@components/custom-no-code/slot/slot';
import { NoCodeMenuComponent } from '@components/custom-no-code/no-code-menu/no-code-menu';
import { NoCodeStateBorderComponent } from '@components/custom-no-code/no-code-state-instance/no-code-state-border/no-code-state-border';
import { DefaultCellComponent } from './components/templateClassTable/type-cells/default-cell/default-cell';
import { ConfigCellActions } from '@components/templateClassTable/type-cells/config-cell-actions/config-cell-actions';
//Services (Backend Access)
import { PolariService } from '@services/polari-service';
import { CRUDEservicesManager } from '@services/crude-services-manager';
//
import { MatIconRegistry } from "@angular/material/icon";
import { DomSanitizer } from "@angular/platform-browser";
// Overlay for custom dropdowns
import { OverlayContainer } from '@angular/cdk/overlay';
import { CustomOverlayContainer } from './services/overlay-container-service';


@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    HeaderComponent,
    NavigationComponent,
    PolariConfigComponent,
    templateClassTableComponent,
    ClassMainPageComponent,
    classInstanceSearchComponent,
    CreateNewClassComponent,
    VariableModifierComponent,
    CustomNoCodeComponent,
    NoCodeInterfaceComponent,
    NoCodeStateInstanceComponent,
    NoCodeStateInstanceComponentD3,
    SolutionEditorComponent,
    SlotComponent,
    NoCodeMenuComponent,
    NoCodeStateBorderComponent,
    DefaultCellComponent,
    ConfigCellActions
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    MaterialModule,
    FormsModule,
    //FlexModule,
    //FlexLayoutModule,
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
    NgxGraphModule
  ],
  exports: [
    
  ],
  providers: [
    PolariService,
    CRUDEservicesManager,
    OverlayContainer,
    CustomOverlayContainer
  ],
  bootstrap: [
    AppComponent,
    MaterialModule
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AppModule {
  constructor(private matIconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer){
      this.matIconRegistry.addSvgIcon(
        "io-circle",
        this.domSanitizer.bypassSecurityTrustResourceUrl("../assets/io-circle.svg")
      );
  }

  ngOnInit()
  {
    console.log("In AppModule ngOnInit");
  }

  initializeApp() {
  }
}
