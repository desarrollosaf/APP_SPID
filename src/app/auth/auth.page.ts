import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ViewWillEnter } from '@ionic/angular';
import { HttpErrorResponse } from '@angular/common/http';
import { User } from '../service/user';
import { AlertController } from '@ionic/angular';
import { HapticsService } from '../service/haptics.service';

@Component({
  selector: 'app-auth',
  templateUrl: './auth.page.html',
  styleUrls: ['./auth.page.scss'],
  standalone: false,
})
export class AuthPage implements ViewWillEnter {

  usuario = '';
  password = '';
  showPassword = false;
  loading = false;
  loginSuccess = false;
  loginError = false;
  animated = false;

  constructor(
    private router: Router,
    private _userService: User,
    private alertCtrl: AlertController,
    private hapticsService: HapticsService
  ) {}

  ionViewWillEnter() {
    this.usuario = '';
    this.password = '';
    this.loading = false;
    this.loginSuccess = false;
    this.loginError = false;
    // reiniciar animación de entrada
    this.animated = false;
    setTimeout(() => { this.animated = true; }, 30);
  }

  togglePassword() { this.showPassword = !this.showPassword; }

  login() {
    if (!this.usuario || !this.password) {
      this.showAlert('Ingresa usuario y contraseña.');
      return;
    }

    this.loading = true;

    this._userService.login({ name: this.usuario, password: this.password }).subscribe({
      next: () => {
        this.loading = false;
        this.loginSuccess = true;
        this.hapticsService.success();
        localStorage.setItem('isLoggedin', 'true');
        setTimeout(() => {
          this.router.navigate(['/tabs/inicio'], { replaceUrl: true });
        }, 1100);
      },
      error: (e: HttpErrorResponse) => {
        this.loading = false;
        this.loginError = true;
        this.hapticsService.error();
        setTimeout(() => { this.loginError = false; }, 600);
        this.showAlert(this.mensajeDeError(e), this.tituloDeError(e));
      },
    });
  }

  private esFalloDeRed(e: HttpErrorResponse): boolean {
    return e?.status === 0 || e?.status === 504 || e?.status === 408;
  }

  private tituloDeError(e: HttpErrorResponse): string {
    return this.esFalloDeRed(e) ? 'Sin conexión' : 'Error';
  }

  private mensajeDeError(e: HttpErrorResponse): string {
    if (this.esFalloDeRed(e)) {
      return 'No se pudo contactar al servidor. Verifica tu conexión a internet. ' +
             'Este sistema solo es accesible desde la red del Congreso del Estado de México.';
    }
    if (e?.status >= 500) {
      return 'El servidor no está disponible en este momento. Intenta más tarde.';
    }
    return e?.error?.msg || 'Usuario o contraseña incorrectos.';
  }

  async showAlert(message: string, header = 'Error') {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['OK'],
    });
    await alert.present();
  }
}
