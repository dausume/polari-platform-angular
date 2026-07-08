// app-routing.module.ts
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
//Components aka Pages
import { PolariConfigComponent } from '@components/polari-config/polari-config';
import { ClassMainPageComponent } from '@components/class-main-page/class-main-page';
import { CreateNewClassComponent } from '@components/create-new-class/create-new-class';
import { CustomNoCodeComponent } from '@components/custom-no-code/custom-no-code';
import { ApiProfilerComponent } from '@components/api-profiler/api-profiler.component';
import { ApiConfigComponent } from '@components/api-config/api-config';
import { MapsComponent } from '@components/maps/maps.component';
import { DisplaysComponent } from '@components/displays/displays.component';
import { TablesComponent } from '@components/tables/tables.component';
import { GraphsComponent } from '@components/graphs/graphs.component';
import { DataSetsComponent } from '@components/datasets/datasets.component';
import { EquationsComponent } from '@components/equations/equations.component';
import { EquationConfigEditComponent } from '@components/equation-config/equation-config-edit/equation-config-edit.component';

const routes: Routes = [
  { path: '', loadComponent: () => import('@components/home/home').then(m => m.HomeComponent) },
  { path: 'callback', loadComponent: () => import('@components/auth-callback/auth-callback.component').then(m => m.AuthCallbackComponent) },
  { path: 'permissions', loadComponent: () => import('@components/permissions/permissions.component').then(m => m.PermissionsComponent) },
  { path: 'permissions/roles/:name', loadComponent: () => import('@components/permissions/role-detail/role-detail.component').then(m => m.RoleDetailComponent) },
  { path: 'sim-spaces', loadComponent: () => import('@components/sim-space/sim-space-list-page/sim-space-list-page.component').then(m => m.SimSpaceListPageComponent) },
  { path: 'sim-spaces/:name', loadComponent: () => import('@components/sim-space/sim-space-detail-page/sim-space-detail-page.component').then(m => m.SimSpaceDetailPageComponent) },
  { path: 'multi-scale-sims', loadComponent: () => import('@components/multi-scale/multi-scale-sims.component').then(m => m.MultiScaleSimsComponent) },
  { path: 'multi-scale-sims/new', loadComponent: () => import('@components/multi-scale/msim-wizard.component').then(m => m.MsimWizardComponent) },
  { path: 'multi-scale-sim/:name', loadComponent: () => import('@components/multi-scale/multi-scale-sim-page.component').then(m => m.MultiScaleSimPageComponent) },
  { path: 'polari-config', component: PolariConfigComponent},
  { path: 'polari-config/:polariAccessNode', component: PolariConfigComponent},
{ path: 'class-main-page/:class', component: ClassMainPageComponent},
  { path: 'create-class', component: CreateNewClassComponent },
  { path: 'custom-no-code', component: CustomNoCodeComponent },
  { path: 'manager-info', loadComponent: () => import('@components/manager-info/manager-info').then(m => m.ManagerInfoComponent) },
  { path: 'typing-info', loadComponent: () => import('@components/typing-info/typing-info').then(m => m.TypingInfoComponent) },
  { path: 'api-profiler', component: ApiProfilerComponent },
  { path: 'api-config', component: ApiConfigComponent },
  { path: 'system-diagnostics', loadComponent: () => import('@components/system-diagnostics/system-diagnostics').then(m => m.SystemDiagnosticsComponent) },
  { path: 'module-management', loadComponent: () => import('@components/module-management/module-management.component').then(m => m.ModuleManagementComponent) },
  { path: 'module-details/:moduleId', loadComponent: () => import('@components/module-details/module-details.component').then(m => m.ModuleDetailsComponent) },
  { path: 'maps', component: MapsComponent },
  { path: 'displays', component: DisplaysComponent },
  { path: 'tables', component: TablesComponent },
  { path: 'graphs', component: GraphsComponent },
  { path: 'datasets', component: DataSetsComponent },
  { path: 'equations', component: EquationsComponent },
  { path: 'equations/:id', component: EquationConfigEditComponent },
  { path: 'matrices', loadComponent: () => import('@components/matrices/matrices-page/matrices-page.component').then(m => m.MatricesPageComponent) },
  { path: 'matrices/:name', loadComponent: () => import('@components/matrices/matrices-page/matrices-page.component').then(m => m.MatricesPageComponent) },
  { path: 'materials/:name', loadComponent: () => import('@components/materials-science/material-detail.component').then(m => m.MaterialDetailComponent) },
  { path: 'scoring', loadComponent: () => import('@components/scoring/scoring-home.component').then(m => m.ScoringHomeComponent) },
  { path: 'scoring/accountability', loadComponent: () => import('@components/scoring/policy-accountability.component').then(m => m.PolicyAccountabilityComponent) },
  { path: 'scoring/survival', loadComponent: () => import('@components/scoring/survival-costs.component').then(m => m.SurvivalCostsComponent) },
  { path: 'display/:id', loadComponent: () => import('@components/dashboard/display-page/display-page').then(m => m.DisplayPageComponent) }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
