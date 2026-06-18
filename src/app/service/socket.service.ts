import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SocketService {
  private socket?: Socket;
  private joinHandler?: () => void;
  private reconnectHandler?: () => void;

  private ensureConnected(): Socket {
    if (!this.socket) {
      const token = localStorage.getItem('authToken');
      this.socket = io(environment.socketUrl, {
        path: environment.socketPath,
        transports: ['websocket', 'polling'],
        auth: { token }
      });
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
    this.ensureConnected().on('asistencia-abierta', cb);
  }

  offAsistenciaAbierta(): void {
    this.socket?.off('asistencia-abierta');
  }

  onAsistenciaCerrada(cb: (data: { idComision: string }) => void): void {
    this.ensureConnected().on('asistencia-cerrada', cb);
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
    this.ensureConnected().on('votacion-abierta', cb);
  }

  offVotacionAbierta(): void {
    this.socket?.off('votacion-abierta');
  }

  onVotacionCerrada(cb: (data: { idComision: string }) => void): void {
    this.ensureConnected().on('votacion-cerrada', cb);
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
    this.ensureConnected().on('sesiones-activas', cb);
  }

  offSesionesActivas(): void {
    this.socket?.off('sesiones-activas');
  }

  onSesionIniciada(cb: (data: any) => void): void {
    this.ensureConnected().on('sesion-iniciada', cb);
  }

  offSesionIniciada(): void {
    this.socket?.off('sesion-iniciada');
  }

  onSesionTerminada(cb: (data: { clave: string; idAgenda: string; esComision?: boolean; idComision?: string; idComisiones?: string[] }) => void): void {
    this.ensureConnected().on('sesion-terminada', cb);
  }

  offSesionTerminada(): void {
    this.socket?.off('sesion-terminada');
  }

  // ── Actualizaciones desde el admin ───────────────────────────────────────

  onAsistenciaActualizadaAdmin(cb: (data: { id_diputado: string; sentido: number; mensaje: string }) => void): void {
    this.ensureConnected().on('asistencia-actualizada-admin', cb);
  }

  offAsistenciaActualizadaAdmin(): void {
    this.socket?.off('asistencia-actualizada-admin');
  }

  onVotoActualizadoAdmin(cb: (data: { id_diputado: string; sentido: number; mensaje: string }) => void): void {
    this.ensureConnected().on('voto-actualizado-admin', cb);
  }

  offVotoActualizadoAdmin(): void {
    this.socket?.off('voto-actualizado-admin');
  }

  // ── Conexión ─────────────────────────────────────────────────────────────

  onReconnect(cb: () => void): void {
    const socket = this.ensureConnected();
    if (this.reconnectHandler) socket.off('connect', this.reconnectHandler);
    this.reconnectHandler = cb;
    socket.on('connect', cb);
  }

  offReconnect(): void {
    if (this.reconnectHandler) {
      this.socket?.off('connect', this.reconnectHandler);
      this.reconnectHandler = undefined;
    }
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = undefined;
  }
}
