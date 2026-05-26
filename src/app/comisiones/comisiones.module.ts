import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ComisionesPageRoutingModule } from './comisiones-routing.module';
import { ComisionesPage } from './comisiones.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ComisionesPageRoutingModule,
  ],
  declarations: [ComisionesPage]
})
export class ComisionesPageModule {}
