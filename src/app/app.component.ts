import { Component } from '@angular/core';
import { User } from './service/user'
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  public appPages = [
    { title: 'Inicio', url: '/folder/inbox', icon: 'home' },
    { title: 'Sesion', url: '/sesiones', icon: 'paper-plane' },
    { title: 'Cerrar sesion', action: 'logout', icon: 'trash' },
    // { title: 'Asuntos orden del dia', url: '/folder/favorites', icon: 'heart' },
    // { title: 'Orden del dia', url: '/folder/archived', icon: 'archive' },
    // { title: 'Marco Juridico', url: '/folder/trash', icon: 'trash' },
    // { title: 'Sesion', url: '/folder/spam', icon: 'warning' },
  ];
  public labels = ['Family', 'Friends', 'Notes', 'Work', 'Travel', 'Reminders'];
  constructor(private _userService: User, private router: Router) {}


  logout() {
    console.log('cerrar sesion')
    localStorage.setItem('isLoggedin', 'false');
    this.router.navigate(['/auth/login']);

  }
}
