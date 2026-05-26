import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  public appPages = [
    { title: 'Inicio',        url: '/folder/inbox', icon: 'home'          },
    { title: 'Sesión',        url: '/sesiones',      icon: 'business'      },
    { title: 'Comisiones',    url: '/comisiones',    icon: 'people-circle' },
    { title: 'Cerrar sesión', action: 'logout',      icon: 'log-out'       },
  ];

  constructor(private router: Router) {}

  logout() {
    localStorage.setItem('isLoggedin', 'false');
    this.router.navigate(['/auth/login']);
  }
}
