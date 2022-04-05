import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
//Components aka Pages
import { HomeComponent } from '@components/home/home';
import { PolariConfigComponent } from '@components/polari-config/polari-config';
import { templateClassTableComponent } from '@components/templateClassTable/templateClassTable';
import { ClassMainPageComponent } from '@components/class-main-page/class-main-page';

const routes: Routes = [
  { path: '', component: HomeComponent},
  { path: 'polari-config', component: PolariConfigComponent},
  { path: 'polari-config/:polariAccessNode', component: PolariConfigComponent},
  { path: 'template-class-test', component: templateClassTableComponent},
  { path: 'class-main-page/:class', component: ClassMainPageComponent}
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
