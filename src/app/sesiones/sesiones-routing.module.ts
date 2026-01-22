import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { SesionesPage } from './sesiones.page';

const routes: Routes = [
  {
    path: '',
    component: SesionesPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SesionesPageRoutingModule {}
