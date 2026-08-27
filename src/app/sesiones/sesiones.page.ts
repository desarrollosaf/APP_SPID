import { Component, OnInit, OnDestroy } from '@angular/core';
import { ViewWillEnter, ViewWillLeave, AlertController } from '@ionic/angular';
import { Eventos } from '../service/eventos';
import { SocketService } from '../service/socket.service';
import { User } from '../service/user';
import { HapticsService } from '../service/haptics.service';
import { EstadoPanel } from '../interface/user';

const SENTIDO: Record<string, number> = { FAVOR: 1, ABSTENCION: 2, CONTRA: 3, 'SIN REGISTRO': 0 };

@Component({
  selector: 'app-sesiones',
  templateUrl: './sesiones.page.html',
  styleUrls: ['./sesiones.page.scss'],
  standalone: false,
})
export class SesionesPage implements OnInit, OnDestroy, ViewWillEnter, ViewWillLeave {

  // Estado del evento: 0=nada, 2=asistencia, 3=votación
  evento: number = 0;
  temaVotacion: string = '';
  tipoPuntoVotacion: string = '';
  noPuntoVotacion: number | null = null;
  textoExpandido: boolean = false;
  miVoto: string = '';
  nombreDiputado: string = '';
  asistenciaRegistrada: boolean = false;

  // Sesión plenaria activa
  sesionActiva: boolean = false;
  sesionNombre: string = '';

  // Vista de detalle (orden del día / votos)
  vistaDetalle: 'none' | 'orden' | 'votos' = 'none';
  ordenDelDia: any[] = [];
  misVotos: any[] = [];
  cargandoDetalle = false;
  errorDetalle = false;

  private sesionIdAgenda: string = '';
  private misComisionIds = new Set<string>();

  private idAgendaActual: string = '';
  private idVotoPuntoActual: string = '';
  private idComisionActual: string = '';

  constructor(
    private eventosService: Eventos,
    private socketService: SocketService,
    private userService: User,
    private alertCtrl: AlertController,
    private hapticsService: HapticsService
  ) {}

  ngOnInit() {}

  ionViewWillEnter() {
    this.nombreDiputado = this.userService.nombreCompleto;
    const miId = this.userService.currentUserValue?.user?.integrante_legislatura_id ?? null;
    this.socketService.conectarComoDiputado(miId);

    this.socketService.onSesionesActivas((lista: any[]) => {
      const plenaria = lista.find((s: any) => !s.esComision);
      if (plenaria) {
        this.sesionActiva = true;
        this.sesionNombre = plenaria.titulo ?? '';
        this.sesionIdAgenda = plenaria.idAgenda ?? '';
        this.eventosService.getMiAsistencia(this.sesionIdAgenda).subscribe({
          next: (r) => { this.asistenciaRegistrada = r.yaRegistro; },
          error: () => {}
        });
        // Refrescar estado usando el idAgenda de la sesión plenaria para
        // no recibir el estado de una comisión activa en paralelo
        this.eventosService.getEstadoPanel(this.sesionIdAgenda).subscribe({
          next: (estado) => this.aplicarEstadoPanel(estado),
          error: () => {}
        });
      } else {
        this.sesionActiva = false;
        this.sesionNombre = '';
        this.sesionIdAgenda = '';
        this.limpiarEvento();
      }
    });
    this.socketService.emitGetSesionesActivas();

    this.socketService.onSesionIniciada((data) => {
      if (data.esComision) return;
      this.sesionActiva = true;
      this.sesionNombre = data.titulo ?? '';
      this.sesionIdAgenda = data.idAgenda ?? '';
      this.asistenciaRegistrada = false;
      this.vistaDetalle = 'none';
    });

    this.socketService.onSesionTerminada((data) => {
      if (data.esComision) return;
      if (this.sesionIdAgenda && data.idAgenda !== this.sesionIdAgenda) return;
      this.sesionActiva = false;
      this.sesionNombre = '';
      this.sesionIdAgenda = '';
      this.vistaDetalle = 'none';
      this.limpiarEvento();
    });

    const refrescarEstado = () => {
      this.socketService.emitGetSesionesActivas();
      // Si no hay sesión plenaria activa no hay nada que refrescar aquí
      if (!this.sesionIdAgenda) return;
      this.eventosService.getEstadoPanel(this.sesionIdAgenda).subscribe({
        next: (estado) => this.aplicarEstadoPanel(estado),
        error: (err) => console.error('Error al refrescar estado-panel', err)
      });
    };

    // Al reconectar tras caída de red, volver a pedir el estado actual
    this.socketService.onReconnect(refrescarEstado);

    this.socketService.onAsistenciaActualizadaAdmin((data) => {
      if (miId && data.id_diputado && data.id_diputado !== miId) return;
      refrescarEstado();
    });

    this.socketService.onVotoActualizadoAdmin((data) => {
      if (miId && data.id_diputado && data.id_diputado !== miId) return;
      refrescarEstado();
    });

    // Cargar IDs de comisiones y luego registrar listeners de asistencia/votación
    this.misComisionIds.clear();
    this.eventosService.getMisComisiones().subscribe({
      next: (res) => {
        res.comisiones.forEach(c => this.misComisionIds.add(c.id));
        this.eventosService.getEstadoPanel(this.sesionIdAgenda || undefined).subscribe({
          next: (estado: EstadoPanel) => this.aplicarEstadoPanel(estado),
          error: () => {}
        });
        this.registrarListenersAsistenciaVotacion();
      },
      error: () => {
        this.eventosService.getEstadoPanel(this.sesionIdAgenda || undefined).subscribe({
          next: (estado: EstadoPanel) => this.aplicarEstadoPanel(estado),
          error: () => {}
        });
        this.registrarListenersAsistenciaVotacion();
      }
    });
  }

  ionViewWillLeave() {
    this.socketService.offReconnect();
    this.socketService.offSesionesActivas();
    this.socketService.offSesionIniciada();
    this.socketService.offSesionTerminada();
    this.socketService.offAsistenciaAbierta();
    this.socketService.offAsistenciaCerrada();
    this.socketService.offVotacionAbierta();
    this.socketService.offVotacionCerrada();
    this.socketService.offAsistenciaActualizadaAdmin();
    this.socketService.offVotoActualizadoAdmin();
  }

  ngOnDestroy() {
    this.ionViewWillLeave();
  }

  // Registrar listeners de asistencia/votación DESPUÉS de cargar misComisionIds
  // para evitar la condición de carrera donde llegan eventos de comisión antes
  // de que el filtro esté listo
  private registrarListenersAsistenciaVotacion() {
    this.socketService.onAsistenciaAbierta((data) => {
      // Solo aceptar eventos de la agenda plenaria activa
      if (!this.sesionIdAgenda || data.idAgenda !== this.sesionIdAgenda) return;
      this.idAgendaActual = data.idAgenda;
      this.idComisionActual = data.idComision ?? '';
      this.evento = 2;
      this.eventosService.getEstadoPanel(data.idAgenda).subscribe({
        next: (estado) => { this.asistenciaRegistrada = estado.asistencia?.yaRegistro ?? false; },
        error: () => { this.asistenciaRegistrada = false; }
      });
    });

    this.socketService.onAsistenciaCerrada((data) => {
      // Solo cerrar si el idComision coincide con el que tenemos abierto
      if ((data.idComision ?? '') !== this.idComisionActual) return;
      if (this.evento === 2) this.evento = 0;
    });

    this.socketService.onVotacionAbierta((data) => {
      // Solo aceptar eventos de la agenda plenaria activa
      if (!this.sesionIdAgenda || data.idAgenda !== this.sesionIdAgenda) return;
      this.idAgendaActual = data.idAgenda;
      this.idComisionActual = data.idComision ?? '';
      const idRes = (data as any).idReserva;
      const idIni = (data as any).idIniciativa;
      this.temaVotacion = this.extraerTextoVotacion(data.punto, idRes, idIni);
      this.noPuntoVotacion = (data.punto as any)?.nopunto ?? null;
      this.tipoPuntoVotacion = idRes ? 'Reserva' : idIni ? 'Iniciativa' : '';
      this.textoExpandido = false;
      this.miVoto = '';
      this.evento = 3;
      this.eventosService.getEstadoPanel(data.idAgenda).subscribe({
        next: (estado) => { if (estado.votacion) this.idVotoPuntoActual = estado.votacion.id_voto_punto; },
        error: (err) => console.error('Error al obtener id_voto_punto', err)
      });
    });

    this.socketService.onVotacionCerrada((data) => {
      // Solo cerrar si el idComision coincide con el que tenemos abierto
      if ((data.idComision ?? '') !== this.idComisionActual) return;
      if (this.evento === 3) {
        this.limpiarEvento();
      }
    });
  }

  private extraerTextoVotacion(punto: any, idReserva?: any, idIniciativa?: any): string {
    if (!punto) return '';
    if (typeof punto === 'string') return punto;
    if (idReserva && punto.reservas?.length) {
      const r = punto.reservas.find((x: any) => String(x.id) === String(idReserva));
      if (r?.tema_votacion) return r.tema_votacion;
    }
    if (idIniciativa && punto.iniciativas?.length) {
      const i = punto.iniciativas.find((x: any) => String(x.id) === String(idIniciativa));
      if (i?.iniciativa) return i.iniciativa;
    }
    return punto.punto ?? punto.descripcion ?? punto.titulo ?? '';
  }

  get temaVotacionCorto(): string {
    return this.temaVotacion.length > 110 ? this.temaVotacion.slice(0, 110) : this.temaVotacion;
  }

  private limpiarEvento() {
    this.evento = 0;
    this.temaVotacion = '';
    this.tipoPuntoVotacion = '';
    this.noPuntoVotacion = null;
    this.miVoto = '';
    this.idAgendaActual = '';
    this.idVotoPuntoActual = '';
    this.idComisionActual = '';
  }

  private perteneceAComision(obj: { idComision?: string | null; idComisiones?: string[] }): boolean {
    const ids = obj.idComisiones?.length ? obj.idComisiones : (obj.idComision ? [obj.idComision] : []);
    return ids.some(id => this.misComisionIds.has(id));
  }

  private aplicarEstadoPanel(estado: EstadoPanel) {
    // Red de seguridad: si el backend devolvió un evento de comisión, limpiar y salir
    if (estado.votacion && this.perteneceAComision(estado.votacion)) {
      this.limpiarEvento();
      return;
    }
    if (estado.asistencia && this.perteneceAComision(estado.asistencia)) {
      this.limpiarEvento();
      return;
    }

    if (estado.votacion) {
      this.evento = 3;
      this.idAgendaActual = estado.votacion.idAgenda;
      this.idVotoPuntoActual = estado.votacion.id_voto_punto;
      this.idComisionActual = estado.votacion.idComision ?? '';
      this.temaVotacion = this.extraerTextoVotacion(estado.votacion.punto, estado.votacion.idReserva, estado.votacion.idIniciativa);
      this.noPuntoVotacion = estado.votacion.punto?.nopunto ?? null;
      this.tipoPuntoVotacion = estado.votacion.idReserva ? 'Reserva' : estado.votacion.idIniciativa ? 'Iniciativa' : '';
      this.textoExpandido = false;
      if (estado.votacion.yaVoto && estado.votacion.sentidoActual) {
        const labels: Record<number, string> = { 1: 'FAVOR', 2: 'ABSTENCION', 3: 'CONTRA' };
        this.miVoto = labels[estado.votacion.sentidoActual] ?? '';
      } else {
        this.miVoto = '';
      }
    } else if (estado.asistencia) {
      this.evento = 2;
      this.idAgendaActual = estado.asistencia.idAgenda;
      this.idComisionActual = estado.asistencia.idComision ?? '';
      this.asistenciaRegistrada = estado.asistencia.yaRegistro;
    } else {
      // Nada activo → limpiar
      this.limpiarEvento();
    }
  }

  votar(tipo: string) {
    this.hapticsService.impact();
    const prevVoto = this.miVoto;
    this.miVoto = tipo;
    // Sesiones plenarias: no mandar id_comision (VotosPunto.id_comision_dip es NULL para plenarias)
    this.eventosService.registrarVoto({
      sentido_voto: SENTIDO[tipo] ?? 1,
      id_voto_punto: this.idVotoPuntoActual,
    }).subscribe({
      next: (r: any) => console.log('Votación registrada:', r),
      error: (err: any) => {
        console.error('Error al registrar votación', err);
        this.miVoto = prevVoto;
        this.hapticsService.error();
        this.mostrarErrorConReintento(
          'No se pudo registrar el voto. La votación puede haber sido cerrada o el servidor reiniciado.',
          () => this.votar(tipo)
        );
      }
    });
  }

  registrarAsistencia() {
    this.hapticsService.impact();
    // Sesiones plenarias: nunca mandar id_comision porque AsistenciaVoto.comision_dip_id es NULL
    this.eventosService.registrarAsistencia({ id_agenda: this.idAgendaActual }).subscribe({
      next: (r: any) => {
        this.asistenciaRegistrada = true;
        console.log('Asistencia registrada:', r);
      },
      error: (err: any) => {
        console.error('Error al registrar asistencia', err);
        this.hapticsService.error();
        this.mostrarErrorConReintento(
          'No se pudo registrar la asistencia. Intenta de nuevo o contacta al administrador.',
          () => this.registrarAsistencia()
        );
      }
    });
  }

  private async mostrarErrorConReintento(message: string, reintentar: () => void) {
    const alert = await this.alertCtrl.create({
      header: 'Error',
      message,
      buttons: [
        { text: 'Cerrar', role: 'cancel' },
        { text: 'Reintentar', handler: reintentar },
      ],
    });
    await alert.present();
  }

 verOrden() {
  if (this.vistaDetalle === 'orden') { this.vistaDetalle = 'none'; return;}
  this.vistaDetalle = 'orden';
  if (!this.sesionIdAgenda) return;
  this.cargarOrdenDelDia();
}

  private cargarOrdenDelDia() {
    this.cargandoDetalle = true;
    this.errorDetalle = false;
    this.eventosService.getOrdenDelDia(this.sesionIdAgenda).subscribe({
      next: (r) => {
        this.ordenDelDia = r.puntos;
        this.cargandoDetalle = false;
      },
      error: () => {
        this.cargandoDetalle = false;
        this.errorDetalle = true;
      }
    });
  }

  verVotos() {
    if (this.vistaDetalle === 'votos') { this.vistaDetalle = 'none'; return; }
    this.vistaDetalle = 'votos';
    this.cargarMisVotos();
  }

  private cargarMisVotos() {
    this.cargandoDetalle = true;
    this.errorDetalle = false;
    this.eventosService.getMisVotos(this.sesionIdAgenda).subscribe({
      next: (r) => { this.misVotos = r.votos; this.cargandoDetalle = false; },
      error: () => { this.cargandoDetalle = false; this.errorDetalle = true; }
    });
  }

  reintentarDetalle() {
    if (this.vistaDetalle === 'orden') this.cargarOrdenDelDia();
    else if (this.vistaDetalle === 'votos') this.cargarMisVotos();
  }

  get miVotoLabel(): string {
    switch (this.miVoto) {
      case 'FAVOR':        return 'A Favor';
      case 'CONTRA':       return 'En Contra';
      case 'ABSTENCION':   return 'Abstención';
      case 'SIN REGISTRO': return 'Sin Registro';
      default:             return '';
    }
  }

  get votoIcono(): string {
    switch (this.miVoto) {
      case 'FAVOR':        return 'thumbs-up-outline';
      case 'CONTRA':       return 'thumbs-down-outline';
      case 'ABSTENCION':   return 'remove-circle-outline';
      case 'SIN REGISTRO': return 'ellipsis-horizontal-circle-outline';
      default:             return 'help-circle-outline';
    }
  }
}
