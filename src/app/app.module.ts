import { CUSTOM_ELEMENTS_SCHEMA, /*ErrorHandler,*/  NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'
import { FlexModule } from '@angular/flex-layout'
import { HttpClientModule } from '@angular/common/http';
//Materials
import { MaterialModule } from './material/material.module'
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
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
//Services (Backend Access)
import { PolariService } from '@services/polari-service';
import { MatCardModule } from '@angular/material/card';

@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    HeaderComponent,
    NavigationComponent,
    PolariConfigComponent,
    templateClassTableComponent,
    ClassMainPageComponent,
    classInstanceSearchComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    MaterialModule,
    FormsModule,
    FlexModule,
    HttpClientModule,
    ReactiveFormsModule,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatCardModule
  ],
  exports: [
    
  ],
  providers: [
    PolariService
  ],
  bootstrap: [
    AppComponent,
    MaterialModule
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AppModule {
  constructor(){
    //console.log("App Module constructor started.")
  }

  ngOnInit()
  {
    console.log("In AppModule ngOnInit");
  }

  initializeApp() {
  }
}
