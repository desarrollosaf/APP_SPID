import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AlertController } from '@ionic/angular';
import { User } from '../service/user';

@Component({
  selector: 'app-cambiar-password',
  templateUrl: './cambiar-password.page.html',
  styleUrls: ['./cambiar-password.page.scss'],
  standalone: false,
})
export class CambiarPasswordPage {

  newPassword = '';
  confirmPassword = '';

  showNew = false;
  showConfirm = false;

  loading = false;

  constructor(
    private router: Router,
    private userService: User,
    private alertCtrl: AlertController
  ) {}

  toggleNew() { this.showNew = !this.showNew; }
  toggleConfirm() { this.showConfirm = !this.showConfirm; }

  guardar() {
    if (!this.newPassword || !this.confirmPassword) {
      this.showAlert('Completa todos los campos.');
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.showAlert('La nueva contraseña y su confirmación no coinciden.');
      return;
    }

    this.loading = true;

    this.userService.changePassword({
      newPassword: this.newPassword,
    }).subscribe({
      next: async () => {
        this.loading = false;
        await this.showAlert('Tu contraseña se actualizó correctamente.', 'Listo', true);
      },
      error: (e: HttpErrorResponse) => {
        this.loading = false;
        this.showAlert(e?.error?.msg || 'No se pudo actualizar la contraseña.');
      },
    });
  }

  async showAlert(message: string, header = 'Error', volverAtras = false) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['OK'],
    });
    await alert.present();
    if (volverAtras) {
      await alert.onDidDismiss();
      this.router.navigate(['/tabs/inicio']);
    }
  }
}
