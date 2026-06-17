import { Component, OnInit, OnDestroy } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Eventos } from '../service/eventos';
import { SocketService } from '../service/socket.service';
import { User } from '../service/user';
import { EstadoPanel } from '../interface/user';

const SENTIDO: Record<string, number> = { FAVOR: 1, ABSTENCION: 2, CONTRA: 3 };

@Component({
  selector: 'app-sesiones',
  templateUrl: './sesiones.page.html',
  styleUrls: ['./sesiones.page.scss'],
  standalone: false,
})
export class SesionesPage implements OnInit, OnDestroy {

  isModalOpen = false;
  pdfUrl!: SafeResourceUrl;

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

  private sesionIdAgenda: string = '';
  private misComisionIds = new Set<string>();

  private idAgendaActual: string = '';
  private idVotoPuntoActual: string = '';
  private idComisionActual: string = '';

  constructor(
    private sanitizer: DomSanitizer,
    private eventosService: Eventos,
    private socketService: SocketService,
    private userService: User
  ) {}

  ngOnInit() {
    this.nombreDiputado = this.userService.nombreCompleto;

    // Cargar IDs de comisiones y después verificar estado del panel (orden importa para el filtro)
    this.eventosService.getMisComisiones().subscribe({
      next: (res) => {
        res.comisiones.forEach(c => this.misComisionIds.add(c.id));
        this.eventosService.getEstadoPanel().subscribe({
          next: (estado: EstadoPanel) => this.aplicarEstadoPanel(estado),
          error: () => {}
        });
      },
      error: () => {
        this.eventosService.getEstadoPanel().subscribe({
          next: (estado: EstadoPanel) => this.aplicarEstadoPanel(estado),
          error: () => {}
        });
      }
    });

    const miId = this.userService.currentUserValue?.user?.integrante_legislatura_id ?? null;
    this.socketService.conectarComoDiputado(miId);

    // Verificar si ya hay sesión PLENARIA activa al abrir la app
    this.socketService.onSesionesActivas((lista: any[]) => {
      const plenaria = lista.find((s: any) => !s.esComision);
      if (plenaria) {
        this.sesionActiva = true;
        this.sesionNombre = plenaria.titulo ?? '';
        this.sesionIdAgenda = plenaria.idAgenda ?? '';
        // Consultar si ya tiene asistencia registrada en esta sesión
        this.eventosService.getMiAsistencia(this.sesionIdAgenda).subscribe({
          next: (r) => { this.asistenciaRegistrada = r.yaRegistro; },
          error: () => {}
        });
      }
    });
    this.socketService.emitGetSesionesActivas();

    // Solo sesiones PLENARIAS (esComision = false)
    this.socketService.onSesionIniciada((data) => {
      if (data.esComision) return;
      this.sesionActiva = true;
      this.sesionNombre = data.titulo ?? '';
      this.sesionIdAgenda = data.idAgenda ?? '';
      this.asistenciaRegistrada = false;
      this.vistaDetalle = 'none';
    });

    this.socketService.onSesionTerminada((data) => {
      if (data.esComision) return; // Solo reaccionar a sesiones plenarias
      if (this.sesionIdAgenda && data.idAgenda !== this.sesionIdAgenda) return;
      this.sesionActiva = false;
      this.sesionNombre = '';
      this.sesionIdAgenda = '';
      this.evento = 0;
      this.vistaDetalle = 'none';
    });

    // Asistencia abierta — ignorar eventos de comisión
    this.socketService.onAsistenciaAbierta((data) => {
      if (this.misComisionIds.has(data.idComision)) return;
      this.idAgendaActual = data.idAgenda;
      this.idComisionActual = data.idComision ?? '';
      this.evento = 2;
      this.eventosService.getEstadoPanel().subscribe({
        next: (estado) => {
          this.asistenciaRegistrada = estado.asistencia?.yaRegistro ?? false;
        },
        error: () => { this.asistenciaRegistrada = false; }
      });
    });

    // Asistencia cerrada — ignorar si es de comisión
    this.socketService.onAsistenciaCerrada((data) => {
      if (this.misComisionIds.has(data.idComision)) return;
      if (this.evento === 2) this.evento = 0;
    });

    // Votación abierta — ignorar eventos de comisión
    this.socketService.onVotacionAbierta((data) => {
      if (this.misComisionIds.has(data.idComision)) return;
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
      this.eventosService.getEstadoPanel().subscribe({
        next: (estado) => {
          if (estado.votacion) this.idVotoPuntoActual = estado.votacion.id_voto_punto;
        },
        error: (err) => console.error('Error al obtener id_voto_punto', err)
      });
    });

    this.socketService.onVotacionCerrada(() => {
      if (this.evento === 3) {
        this.evento = 0;
        this.tipoPuntoVotacion = '';
        this.noPuntoVotacion = null;
        this.temaVotacion = '';
        this.miVoto = '';
      }
    });

    // Actualizaciones del admin → refrescar estado desde el backend (fuente de verdad)
    const refrescarEstado = () => {
      this.eventosService.getEstadoPanel().subscribe({
        next: (estado) => this.aplicarEstadoPanel(estado),
        error: (err) => console.error('Error al refrescar estado-panel', err)
      });
    };

    this.socketService.onAsistenciaActualizadaAdmin((data) => {
      // Si estamos en sala personal el evento ya es nuestro; si hay miId lo verificamos
      if (miId && data.id_diputado && data.id_diputado !== miId) return;
      refrescarEstado();
    });

    this.socketService.onVotoActualizadoAdmin((data) => {
      if (miId && data.id_diputado && data.id_diputado !== miId) return;
      refrescarEstado();
    });
  }

  ngOnDestroy() {
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

  private aplicarEstadoPanel(estado: EstadoPanel) {
    // Ignorar eventos de comisión en la vista de sesiones plenarias
    if (estado.votacion) {
      const ids = estado.votacion.idComisiones ?? [estado.votacion.idComision];
      if (ids.some(id => this.misComisionIds.has(id))) return;
    }
    if (estado.asistencia) {
      const ids = estado.asistencia.idComisiones ?? [estado.asistencia.idComision];
      if (ids.some(id => this.misComisionIds.has(id))) return;
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
      }
    } else if (estado.asistencia) {
      this.evento = 2;
      this.idAgendaActual = estado.asistencia.idAgenda;
      this.idComisionActual = estado.asistencia.idComision ?? '';
      this.asistenciaRegistrada = estado.asistencia.yaRegistro;
    }
  }

  votar(tipo: string) {
    this.miVoto = tipo;
    const payload = {
      sentido_voto: SENTIDO[tipo] ?? 1,
      id_voto_punto: this.idVotoPuntoActual,
      ...(this.idComisionActual ? { id_comision: this.idComisionActual } : {})
    };
    this.eventosService.registrarVoto(payload).subscribe({
      next: (r: any) => console.log('Votación registrada:', r),
      error: (err: any) => console.error('Error al registrar votación', err)
    });
  }

  registrarAsistencia() {
    const payload = {
      id_agenda: this.idAgendaActual,
      ...(this.idComisionActual ? { id_comision: this.idComisionActual } : {})
    };
    this.eventosService.registrarAsistencia(payload).subscribe({
      next: (r: any) => {
        this.asistenciaRegistrada = true;
        console.log('Asistencia registrada:', r);
      },
      error: (err: any) => console.error('Error al registrar asistencia', err)
    });
  }

 verOrden() {
  if (this.vistaDetalle === 'orden') { this.vistaDetalle = 'none'; return;}
  this.vistaDetalle = 'orden';
  if (!this.sesionIdAgenda) return;
  this.cargandoDetalle = true;
  this.eventosService.getOrdenDelDia(this.sesionIdAgenda).subscribe({
    next: (r) => {
      this.ordenDelDia = r.puntos;
      this.cargandoDetalle = false;
    },
    error: () => {
      this.cargandoDetalle = false;
    }
  });
}

  verVotos() {
    if (this.vistaDetalle === 'votos') { this.vistaDetalle = 'none'; return; }
    this.vistaDetalle = 'votos';
    this.cargandoDetalle = true;
    this.eventosService.getMisVotos(this.sesionIdAgenda).subscribe({
      next: (r) => { this.misVotos = r.votos; this.cargandoDetalle = false; },
      error: () => { this.cargandoDetalle = false; }
    });
  }

  openPdf(url: string) {
    this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
    this.isModalOpen = true;
  }

  setOpen(isOpen: boolean) {
    this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl('assets/OD-DELIBERANTE-DIP.PER-22ENERO2026.pdf');
    this.isModalOpen = isOpen;
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
