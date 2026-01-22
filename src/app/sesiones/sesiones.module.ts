import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { SesionesPageRoutingModule } from './sesiones-routing.module';

import { SesionesPage } from './sesiones.page';


@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SesionesPageRoutingModule,
  ],
  declarations: [SesionesPage]
})
export class SesionesPageModule {}
