import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SocketService } from './service/socket.service';
import { User } from './service/user';
import { Eventos } from './service/eventos';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit, OnDestroy {
  loggingOut   = false;
  splashDone   = false;
  splashExiting = false;
  isAuthenticated = false;

  public appPages = [
    { title: 'Inicio',        url: '/tabs/inicio',      icon: 'home'          },
    { title: 'Sesión',        url: '/tabs/sesiones',     icon: 'library'       },
    { title: 'Comisiones',    url: '/tabs/comisiones',   icon: 'people-circle' },
    { title: 'Cambiar contraseña', url: '/cambiar-password', icon: 'key'      },
    { title: 'Cerrar sesión', action: 'logout',          icon: 'log-out'       },
  ];

  // Keep-alive: llama cada 20 min para que el backend renueve el token (si usa sliding window)
  // y para detectar expiración antes de que ocurra en medio de una sesión parlamentaria
  private keepAliveInterval: ReturnType<typeof setInterval> | null = null;
  private readonly KEEP_ALIVE_MS = 20 * 60 * 1000;

  constructor(
    private router: Router,
    private socketService: SocketService,
    private userService: User,
    private eventosService: Eventos
  ) {
    this.userService.currentUser$.subscribe(user => {
      this.isAuthenticated = !!user;
      if (user) {
        this.iniciarKeepAlive();
      } else {
        this.detenerKeepAlive();
      }
    });
  }

  private iniciarKeepAlive() {
    this.detenerKeepAlive();
    this.keepAliveInterval = setInterval(() => {
      if (this.userService.currentUserValue) {
        this.eventosService.getEstadoPanel().subscribe({ error: () => {} });
      }
    }, this.KEEP_ALIVE_MS);
  }

  private detenerKeepAlive() {
    if (this.keepAliveInterval !== null) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }

  ngOnInit() {
    setTimeout(() => {
      this.splashExiting = true;
      setTimeout(() => { this.splashDone = true; }, 650);
    }, 2000);
  }

  ngOnDestroy() {
    this.detenerKeepAlive();
  }

  logout() {
    this.loggingOut = true;
    this.detenerKeepAlive();
    this.socketService.disconnect();
    this.userService.logout().subscribe({ error: () => {} });
    localStorage.clear();
    setTimeout(() => {
      this.router.navigate(['/auth/login']);
      setTimeout(() => { this.loggingOut = false; }, 350);
    }, 1000);
  }
}
