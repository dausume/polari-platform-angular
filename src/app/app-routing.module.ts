// app-routing.module.ts
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
//Components aka Pages
import { HomeComponent } from '@components/home/home';
import { PolariConfigComponent } from '@components/polari-config/polari-config';
import { ClassMainPageComponent } from '@components/class-main-page/class-main-page';
import { CreateNewClassComponent } from '@components/create-new-class/create-new-class';
import { CustomNoCodeComponent } from '@components/custom-no-code/custom-no-code';
import { ManagerInfoComponent } from '@components/manager-info/manager-info';
import { TypingInfoComponent } from '@components/typing-info/typing-info';
import { ApiProfilerComponent } from '@components/api-profiler/api-profiler.component';
import { ApiConfigComponent } from '@components/api-config/api-config';

const routes: Routes = [
  { path: '', component: HomeComponent},
  { path: 'polari-config', component: PolariConfigComponent},
  { path: 'polari-config/:polariAccessNode', component: PolariConfigComponent},
  { path: 'class-main-page/:class', component: ClassMainPageComponent},
  { path: 'create-class', component: CreateNewClassComponent },
  { path: 'custom-no-code', component: CustomNoCodeComponent },
  { path: 'manager-info', component: ManagerInfoComponent },
  { path: 'typing-info', component: TypingInfoComponent },
  { path: 'api-profiler', component: ApiProfilerComponent },
  { path: 'api-config', component: ApiConfigComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
