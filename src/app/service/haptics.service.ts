import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

@Injectable({
  providedIn: 'root',
})
export class HapticsService {

  private get disponible(): boolean {
    return Capacitor.isNativePlatform();
  }

  /** Toque en una acción clave: votar, registrar asistencia, etc. */
  impact(style: ImpactStyle = ImpactStyle.Medium) {
    if (!this.disponible) return;
    Haptics.impact({ style }).catch(() => {});
  }

  /** Acción completada con éxito (login correcto, etc.) */
  success() {
    if (!this.disponible) return;
    Haptics.notification({ type: NotificationType.Success }).catch(() => {});
  }

  /** Acción fallida (login incorrecto, error de red, etc.) */
  error() {
    if (!this.disponible) return;
    Haptics.notification({ type: NotificationType.Error }).catch(() => {});
  }
}
