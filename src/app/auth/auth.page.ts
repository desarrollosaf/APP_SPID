import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { User } from '../service/user'
import { HttpErrorResponse } from '@angular/common/http';
import { AlertController } from '@ionic/angular';
import type { OverlayEventDetail } from '@ionic/core';

@Component({
  selector: 'app-auth',
  templateUrl: './auth.page.html',
  styleUrls: ['./auth.page.scss'],
  standalone: false,
})
export class AuthPage implements OnInit {

  usuario: string = '';
  password: string = '';
  
 

  constructor(private router: Router, private _userService: User, private alertCtrl: AlertController) { }

  ngOnInit() {
  }

  async showInvalidAlert() {
    const alert = await this.alertCtrl.create({
      header: 'Error',
      message: 'Usuario o contraseña incorrecta.',
      buttons: ['OK'],
    });

    await alert.present();
  }

  login() {

    const user = {
      email: this.usuario,
      psw: this.password
    };
    console.log(user)

    this._userService.login(user).subscribe({
      next: (response: any) => {
        console.log(response)
        const data = response;
        
        if(data.bandera == 0 || data.bandera == 1){
          this.showInvalidAlert();
          return;
        }else{

        }
        localStorage.setItem('isLoggedin', 'true');
        this._userService.setCurrentUser(response);
        this.router.navigate(['/folder/inbox']);

      },
      error: (e: HttpErrorResponse) => {
        if (e.error && e.error.msg) {
          alert('Usuario o contraseña incorrectos');
        } else {
          alert('Error desconocido'+ e);
        }
      },
    });
   
    
  }

}
