import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PanelPresidenciaPage } from './panel/panel.page';
import { SalonesPage } from './salones/salones.page';
import { SesionesPresidenciaPage } from './sesiones/sesiones.page';
import { SesionDetallePage } from './sesion-detalle/sesion-detalle.page';
import { presidenteGuard } from '../guards/presidente.guard';

const routes: Routes = [
  // Inicio: el mismo panel para todos; muestra más secciones si es Presidencia.
  { path: '', component: PanelPresidenciaPage },
  // Subpáginas solo para Presidencia
  { path: 'salones', component: SalonesPage, canActivate: [presidenteGuard] },
  { path: 'sesiones', component: SesionesPresidenciaPage, canActivate: [presidenteGuard] },
  { path: 'sesiones/:id', component: SesionDetallePage, canActivate: [presidenteGuard] },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PresidenciaRoutingModule {}
