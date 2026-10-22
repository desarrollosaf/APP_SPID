import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { AvatarBtnComponent } from './avatar-btn/avatar-btn.component';

@NgModule({
  imports: [CommonModule, RouterModule, IonicModule],
  declarations: [AvatarBtnComponent],
  exports: [AvatarBtnComponent],
})
export class SharedModule {}
