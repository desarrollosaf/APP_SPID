import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';
import { App } from '@capacitor/app';

@Injectable({ providedIn: 'root' })
export class SocketService {
  private socket?: Socket;
  private joinHandler?: () => void;
  private reconnectHandler?: () => void;

  // `appStateChange` (basado en document.visibilitychange) también se dispara
  // con solo cambiar de ventana un instante (p. ej. Chrome en Mac marca la
  // pestaña como oculta al perder el foco del SO), no solo al regresar de una
  // pausa larga real. Se guarda desde cuándo quedó oculta para distinguir un
  // parpadeo corto (el socket sigue vivo, no tocar nada) de una pausa larga
  // real (donde si vale la pena forzar un ciclo limpio de reconexión).
  private ocultoDesde?: number;
  private static readonly UMBRAL_PAUSA_LARGA_MS = 10000;

  constructor() {
    // Al volver de segundo plano (app suspendida por el SO, o pestaña oculta
    // en la versión web) el JS pudo haber estado congelado y el socket queda
    // "zombie": parece conectado pero nunca detectó la caída. Al reactivarse
    // se revisa y, si hace falta, se reconecta con el token vigente (por si
    // expiró mientras la app estaba en pausa).
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) this.verificarConexionAlVolver();
      else this.ocultoDesde = Date.now();
    });
  }

  private verificarConexionAlVolver(): void {
    if (!this.socket) return;

    const pausaLarga = this.ocultoDesde !== undefined
      && (Date.now() - this.ocultoDesde) >= SocketService.UMBRAL_PAUSA_LARGA_MS;
    this.ocultoDesde = undefined;

    this.socket.auth = { token: localStorage.getItem('authToken') };

    if (!pausaLarga) {
      // Parpadeo corto (p. ej. cambiar de ventana un momento): el socket casi
      // seguro sigue vivo. Forzar un disconnect/connect aquí solo arriesga
      // perder eventos en tránsito durante el ciclo de reconexión.
      if (!this.socket.connected) this.socket.connect();
      return;
    }

    // Pausa larga real: no hay que confiar en que `connected` refleje la
    // realidad, el JS pudo haber estado congelado y el socket queda
    // "zombie". Se fuerza un ciclo limpio de desconexión/reconexión y se
    // resincroniza de una vez, sin esperar a que dispare el evento interno
    // 'reconnect' (que depende de que el manager haya detectado la caída
    // por su cuenta).
    if (this.socket.connected) this.socket.disconnect();
    this.socket.connect();
    this.joinHandler?.();
    this.reconnectHandler?.();
  }

  private ensureConnected(): Socket {
    if (!this.socket) {
      const token = localStorage.getItem('authToken');
      this.socket = io(environment.socketUrl, {
        path: environment.socketPath,
        transports: ['websocket', 'polling'],
        auth: { token }
      });
      this.socket.on('connect_error', (err) => console.warn('Socket connect_error:', err.message));
      this.socket.on('disconnect', (reason) => console.warn('Socket desconectado:', reason));
    }
    return this.socket;
  }

  /** Conecta como diputado, se une a sala-diputados y a sala personal.
   *  Usa on('connect') persistente para re-unirse tras reconexión del socket. */
  conectarComoDiputado(integranteId?: string | null): void {
    const socket = this.ensureConnected();

    // Quitar handler anterior para evitar duplicados
    if (this.joinHandler) {
      socket.off('connect', this.joinHandler);
    }

    this.joinHandler = () => socket.emit('unirse-diputado', integranteId ? { integranteId } : undefined);

    // Re-unirse en cada reconexión
    socket.on('connect', this.joinHandler);

    // Si ya está conectado, unirse inmediatamente
    if (socket.connected) {
      this.joinHandler();
    }
  }

  // ── Asistencia ───────────────────────────────────────────────────────────

  onAsistenciaAbierta(cb: (data: { idAgenda: string; idComision: string }) => void): void {
    const s = this.ensureConnected();
    s.off('asistencia-abierta');
    s.on('asistencia-abierta', cb);
  }

  offAsistenciaAbierta(): void {
    this.socket?.off('asistencia-abierta');
  }

  onAsistenciaCerrada(cb: (data: { idComision: string }) => void): void {
    const s = this.ensureConnected();
    s.off('asistencia-cerrada');
    s.on('asistencia-cerrada', cb);
  }

  offAsistenciaCerrada(): void {
    this.socket?.off('asistencia-cerrada');
  }

  // ── Votación ─────────────────────────────────────────────────────────────

  onVotacionAbierta(cb: (data: {
    idAgenda: string;
    punto: string;
    idComision: string;
    idPunto?: string;
    idReserva?: string | null;
    idIniciativa?: string | null;
  }) => void): void {
    const s = this.ensureConnected();
    s.off('votacion-abierta');
    s.on('votacion-abierta', cb);
  }

  offVotacionAbierta(): void {
    this.socket?.off('votacion-abierta');
  }

  onVotacionCerrada(cb: (data: { idComision: string }) => void): void {
    const s = this.ensureConnected();
    s.off('votacion-cerrada');
    s.on('votacion-cerrada', cb);
  }

  offVotacionCerrada(): void {
    this.socket?.off('votacion-cerrada');
  }

  // ── Sesiones ─────────────────────────────────────────────────────────────

  /** Consulta sesiones ya activas al abrir la app (si la sesión arrancó antes) */
  emitGetSesionesActivas(): void {
    const socket = this.ensureConnected();
    const emit = () => socket.emit('get-sesiones-activas');
    if (socket.connected) emit();
    else socket.once('connect', emit);
  }

  onSesionesActivas(cb: (lista: any[]) => void): void {
    const s = this.ensureConnected();
    s.off('sesiones-activas');
    s.on('sesiones-activas', cb);
  }

  offSesionesActivas(): void {
    this.socket?.off('sesiones-activas');
  }

  onSesionIniciada(cb: (data: any) => void): void {
    const s = this.ensureConnected();
    s.off('sesion-iniciada');
    s.on('sesion-iniciada', cb);
  }

  offSesionIniciada(): void {
    this.socket?.off('sesion-iniciada');
  }

  onSesionTerminada(cb: (data: { clave: string; idAgenda: string; esComision?: boolean; idComision?: string; idComisiones?: string[] }) => void): void {
    const s = this.ensureConnected();
    s.off('sesion-terminada');
    s.on('sesion-terminada', cb);
  }

  offSesionTerminada(): void {
    this.socket?.off('sesion-terminada');
  }

  // ── Actualizaciones desde el admin ───────────────────────────────────────

  onAsistenciaActualizadaAdmin(cb: (data: { id_diputado: string; sentido: number; mensaje: string }) => void): void {
    const s = this.ensureConnected();
    s.off('asistencia-actualizada-admin');
    s.on('asistencia-actualizada-admin', cb);
  }

  offAsistenciaActualizadaAdmin(): void {
    this.socket?.off('asistencia-actualizada-admin');
  }

  onVotoActualizadoAdmin(cb: (data: { id_diputado: string; sentido: number; mensaje: string }) => void): void {
    const s = this.ensureConnected();
    s.off('voto-actualizado-admin');
    s.on('voto-actualizado-admin', cb);
  }

  offVotoActualizadoAdmin(): void {
    this.socket?.off('voto-actualizado-admin');
  }

  // ── Conexión ─────────────────────────────────────────────────────────────

  onReconnect(cb: () => void): void {
    const socket = this.ensureConnected();
    if (this.reconnectHandler) socket.io.off('reconnect', this.reconnectHandler);
    this.reconnectHandler = cb;
    socket.io.on('reconnect', cb);
  }

  offReconnect(): void {
    if (this.reconnectHandler) {
      this.socket?.io.off('reconnect', this.reconnectHandler);
      this.reconnectHandler = undefined;
    }
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = undefined;
  }
}
