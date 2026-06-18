import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SocketService {
  private socket?: Socket;
  private joinHandler?: () => void;

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

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = undefined;
  }
}
