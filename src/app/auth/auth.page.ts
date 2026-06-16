import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { User } from '../service/user';
import { AlertController } from '@ionic/angular';

@Component({
  selector: 'app-auth',
  templateUrl: './auth.page.html',
  styleUrls: ['./auth.page.scss'],
  standalone: false,
})
export class AuthPage implements OnInit {

  usuario: string = '';
  password: string = '';
  showPassword: boolean = false;

  togglePassword() { this.showPassword = !this.showPassword; }

  constructor(
    private router: Router,
    private _userService: User,
    private alertCtrl: AlertController
  ) {}

  ngOnInit() {}

  async showAlert(message: string) {
    const alert = await this.alertCtrl.create({
      header: 'Error',
      message,
      buttons: ['OK'],
    });
    await alert.present();
  }

  login() {
    if (!this.usuario || !this.password) {
      this.showAlert('Ingresa usuario y contraseña.');
      return;
    }

    this._userService.login({ name: this.usuario, password: this.password }).subscribe({
      next: () => {
        localStorage.setItem('isLoggedin', 'true');
        this.router.navigate(['/tabs/inicio']);
      },
      error: (e) => {
        const msg = e?.error?.msg || 'Usuario o contraseña incorrectos.';
        this.showAlert(msg);
      },
    });
  }
}
