import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { PresidenciaRoutingModule } from './presidencia-routing.module';
import { PanelPresidenciaPage } from './panel/panel.page';
import { SalonesPage } from './salones/salones.page';
import { SesionesPresidenciaPage } from './sesiones/sesiones.page';
import { SesionDetallePage } from './sesion-detalle/sesion-detalle.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, PresidenciaRoutingModule],
  declarations: [PanelPresidenciaPage, SalonesPage, SesionesPresidenciaPage, SesionDetallePage],
})
export class PresidenciaPageModule {}
