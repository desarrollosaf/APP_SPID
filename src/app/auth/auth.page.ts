import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ViewWillEnter } from '@ionic/angular';
import { User } from '../service/user';
import { AlertController } from '@ionic/angular';

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
    private alertCtrl: AlertController
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
        localStorage.setItem('isLoggedin', 'true');
        setTimeout(() => {
          this.router.navigate(['/tabs/inicio'], { replaceUrl: true });
        }, 1100);
      },
      error: (e) => {
        this.loading = false;
        this.loginError = true;
        setTimeout(() => { this.loginError = false; }, 600);
        const msg = e?.error?.msg || 'Usuario o contraseña incorrectos.';
        this.showAlert(msg);
      },
    });
  }

  async showAlert(message: string) {
    const alert = await this.alertCtrl.create({
      header: 'Error',
      message,
      buttons: ['OK'],
    });
    await alert.present();
  }
}
