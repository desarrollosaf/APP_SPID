import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PanelPresidenciaPage } from './panel/panel.page';
import { SalonesPage } from './salones/salones.page';
import { SesionesPresidenciaPage } from './sesiones/sesiones.page';
import { SesionDetallePage } from './sesion-detalle/sesion-detalle.page';

const routes: Routes = [
  { path: '', component: PanelPresidenciaPage },
  { path: 'salones', component: SalonesPage },
  { path: 'sesiones', component: SesionesPresidenciaPage },
  { path: 'sesiones/:id', component: SesionDetallePage },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PresidenciaRoutingModule {}
