import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-auth',
  templateUrl: './auth.page.html',
  styleUrls: ['./auth.page.scss'],
  standalone: false,
})
export class AuthPage implements OnInit {

  usuario: string = '';
  password: string = '';

  constructor(private router: Router) { }

  ngOnInit() {
  }

  login() {
   
    if (this.usuario === 'admin' && this.password === '1234') {
      console.log('entrar')
      localStorage.setItem('isLoggedin', 'true');
      this.router.navigate(['/folder/inbox']);
    } else {
      alert('Usuario o contraseña incorrectos');
    }
  }

}
