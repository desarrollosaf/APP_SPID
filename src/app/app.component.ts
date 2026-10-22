import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard } from '@capacitor/keyboard';
import { SocketService } from './service/socket.service';
import { User } from './service/user';
import { Eventos } from './service/eventos';
import { HapticsService } from './service/haptics.service';
import { LogoutService } from './service/logout.service';

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

  // Keep-alive: llama cada 20 min para que el backend renueve el token (si usa sliding window)
  // y para detectar expiración antes de que ocurra en medio de una sesión parlamentaria
  private keepAliveInterval: ReturnType<typeof setInterval> | null = null;
  private readonly KEEP_ALIVE_MS = 20 * 60 * 1000;

  constructor(
    private router: Router,
    private socketService: SocketService,
    private userService: User,
    private eventosService: Eventos,
    private hapticsService: HapticsService,
    logoutService: LogoutService
  ) {
    // "Cerrar sesión" vive en Mi perfil; aquí se muestra la animación de salida.
    logoutService.solicitud$.subscribe(() => this.logout());

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
    this.iniciarComportamientoNativo();
    setTimeout(() => {
      this.splashExiting = true;
      setTimeout(() => { this.splashDone = true; }, 650);
    }, 2000);
  }

  private iniciarComportamientoNativo() {
    if (!Capacitor.isNativePlatform()) return;
    // Texto oscuro en la barra de estado, acorde al fondo claro de la app
    StatusBar.setStyle({ style: Style.Light }).catch(() => {});
    // Oculta la barra de accesorios del teclado en iOS para una UI más limpia
    Keyboard.setAccessoryBarVisible({ isVisible: false }).catch(() => {});
  }

  ngOnDestroy() {
    this.detenerKeepAlive();
  }

  logout() {
    this.hapticsService.impact();
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
