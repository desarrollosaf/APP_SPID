import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { SocketService } from './service/socket.service';
import { User } from './service/user';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  public appPages = [
    { title: 'Inicio',        url: '/tabs/inicio',      icon: 'home'          },
    { title: 'Sesión',        url: '/tabs/sesiones',     icon: 'business'      },
    { title: 'Comisiones',    url: '/tabs/comisiones',   icon: 'people-circle' },
    { title: 'Cerrar sesión', action: 'logout',          icon: 'log-out'       },
  ];

  constructor(
    private router: Router,
    private socketService: SocketService,
    private userService: User
  ) {}

  logout() {
    this.socketService.disconnect();
    this.userService.logout().subscribe({ error: () => {} });
    localStorage.removeItem('authToken');
    localStorage.setItem('isLoggedin', 'false');
    this.router.navigate(['/auth/login']);
  }
}
