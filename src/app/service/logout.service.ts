import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

/** Pide cerrar sesión; AppComponent escucha y muestra la animación de salida. */
@Injectable({ providedIn: 'root' })
export class LogoutService {
  private readonly solicitud = new Subject<void>();
  readonly solicitud$ = this.solicitud.asObservable();

  cerrarSesion(): void {
    this.solicitud.next();
  }
}
