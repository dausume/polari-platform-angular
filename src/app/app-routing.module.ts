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
  // Headset-first lobby: giant targets, no fine scrolling — the XR
  // homepage (suggested from Home when a headset is detected).
  { path: 'xr', loadComponent: () => import('@components/xr-lobby/xr-lobby-page.component').then(m => m.XrLobbyPageComponent) },
  // arz-5: AR zone capture — walk a real room, place points with the
  // trigger, both-grips-hold commits; packed cubes render in place.
  { path: 'xr/zone-capture', loadComponent: () => import('@components/xr-lobby/xr-zone-capture-page.component').then(m => m.XrZoneCapturePageComponent) },
  // Rooms/zones board: horizontal bar of rooms + the zones in them
  // (dual-surface: this web view AND an XR HTMLMesh panel).
  { path: 'zones-board', loadComponent: () => import('@components/zones/zones-board.component').then(m => m.ZonesBoardComponent) },
  // Direct XR entry (2026-07-12): the lobby links HERE now — one big
  // ENTER VR action, no flat-preview chrome in between.
  { path: 'xr/enter/:name', loadComponent: () => import('@components/xr-lobby/xr-direct-entry-page.component').then(m => m.XrDirectEntryPageComponent) },
  // Older flat-preview + Enter VR page — still reachable directly,
  // just no longer the lobby's own link target.
  { path: 'xr/view/:name', loadComponent: () => import('@components/xr-lobby/xr-view-page.component').then(m => m.XrViewPageComponent) },
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
  // mlb-4: lazy-boot bring-up tracking (module tiles going online live).
  { path: 'modules/bringup', loadComponent: () => import('@components/module-bringup/module-bringup.component').then(m => m.ModuleBringupComponent) },
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
  { path: 'topology', loadComponent: () => import('@components/topology/topology-home.component').then(m => m.TopologyHomeComponent) },
  { path: 'tech-tree', loadComponent: () => import('@components/techtree/tech-tree-home.component').then(m => m.TechTreeHomeComponent) },
  { path: 'testing', loadComponent: () => import('@components/testing/testing-home.component').then(m => m.TestingHomeComponent) },
  { path: 'apps', loadComponent: () => import('@components/apps/apps-home.component').then(m => m.AppsHomeComponent) },
  { path: 'pspp', loadComponent: () => import('@components/pspp/pspp-home.component').then(m => m.PsppHomeComponent) },
  { path: 'pspp/proofing', loadComponent: () => import('@components/pspp/pspp-proofing.component').then(m => m.PsppProofingComponent) },
  { path: 'pspp/network', loadComponent: () => import('@components/pspp/pspp-network.component').then(m => m.PsppNetworkComponent) },
  { path: 'pspp/grader', loadComponent: () => import('@components/pspp/pspp-grader.component').then(m => m.PsppGraderComponent) },
  { path: 'pspp/progress', loadComponent: () => import('@components/pspp/pspp-progress.component').then(m => m.PsppProgressComponent) },
  { path: 'pspp/guide', loadComponent: () => import('@components/pspp/pspp-guide.component').then(m => m.PsppGuideComponent) },
  { path: 'pspp/benchmarks', loadComponent: () => import('@components/pspp/pspp-benchmarks.component').then(m => m.PsppBenchmarksComponent) },
  { path: 'pspp/states', loadComponent: () => import('@components/pspp/pspp-state-dag.component').then(m => m.PsppStateDagComponent) },
  { path: 'pspp/structure', loadComponent: () => import('@components/pspp/pspp-structure.component').then(m => m.PsppStructureComponent) },
  { path: 'pspp/ceramics', loadComponent: () => import('@components/pspp/pspp-ceramics.component').then(m => m.PsppCeramicsComponent) },
  { path: 'pspp/research', loadComponent: () => import('@components/pspp/pspp-research.component').then(m => m.PsppResearchComponent) },
  { path: 'business/odoo', loadComponent: () => import('@components/business/odoo-business.component').then(m => m.OdooBusinessComponent) },
  { path: 'display/:id', loadComponent: () => import('@components/dashboard/display-page/display-page').then(m => m.DisplayPageComponent) },
  { path: 'video-assets', loadComponent: () => import('@components/video/video-assets-page.component').then(m => m.VideoAssetsPageComponent) }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
