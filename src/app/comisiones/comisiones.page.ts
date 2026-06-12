import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Eventos } from '../service/eventos';
import { SocketService } from '../service/socket.service';
import { User } from '../service/user';
import { EstadoPanel, MiComision } from '../interface/user';

export interface Comision {
  id: string;
  nombre: string;
  cargo: string;
}

const SENTIDO: Record<string, number> = { FAVOR: 1, ABSTENCION: 2, CONTRA: 3 };

@Component({
  selector: 'app-comisiones',
  templateUrl: './comisiones.page.html',
  styleUrls: ['./comisiones.page.scss'],
  standalone: false,
})
export class ComisionesPage implements OnInit, OnDestroy {

  // ── Lista de comisiones del diputado ─────────────────────────────────
  comisiones: Comision[] = [];
  cargandoComisiones = true;

  // ── Comisiones con sesión activa (vivo) ───────────────────────────────
  comisionesEnVivo = new Set<string>();

  // ── Navegación ────────────────────────────────────────────────────────
  selectedComision: Comision | null = null;

  // ── Estado de sesión de la comisión seleccionada ──────────────────────
  sesionActivaComision: boolean = false;
  sesionNombreComision: string = '';

  // ── Estado del evento ─────────────────────────────────────────────────
  evento: number = 0;
  temaVotacion: string = '';
  tipoPuntoVotacion: string = '';
  noPuntoVotacion: number | null = null;
  textoExpandido: boolean = false;
  miVoto: string = '';
  asistenciaRegistrada: boolean = false;
  nombreDiputado: string = '';

  // ── Modal PDF ─────────────────────────────────────────────────────────
  isModalOpen = false;
  pdfUrl!: SafeResourceUrl;

  private idAgendaActual: string = '';
  private idVotoPuntoActual: string = '';

  constructor(
    private sanitizer: DomSanitizer,
    private eventosService: Eventos,
    private socketService: SocketService,
    private userService: User,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.nombreDiputado = this.userService.currentUserValue?.user?.name ?? '';
    this.cargarComisiones();

    const miId = this.userService.currentUserValue?.user?.integrante_legislatura_id ?? null;
    this.socketService.conectarComoDiputado(miId);

    // Sesiones activas via REST (resuelve idComision incluso para sesiones antiguas)
    this.eventosService.getSesionesComisionesActivas().subscribe({
      next: (res) => {
        console.log('[COMISIONES REST] sesiones activas:', res.sesiones);
        res.sesiones.forEach(s => this.comisionesEnVivo.add(s.idComision));
        console.log('[COMISIONES REST] comisionesEnVivo después:', Array.from(this.comisionesEnVivo));
        console.log('[COMISIONES REST] IDs cargados:', this.comisiones.map(c => c.id));
        this.cdr.detectChanges();
        if (this.selectedComision) {
          const activa = res.sesiones.find(s => s.idComision === this.selectedComision!.id);
          this.sesionActivaComision = !!activa;
          if (activa) this.sesionNombreComision = activa.titulo ?? '';
        }
      },
      error: (err) => console.error('[COMISIONES REST] error:', err)
    });

    // Sesiones activas via socket (idComision ya disponible en nuevas sesiones)
    this.socketService.onSesionesActivas((lista: any[]) => {
      console.log('[COMISIONES SOCKET] sesiones-activas recibido:', lista);
      lista.filter(s => s.esComision && s.idComision).forEach(s => {
        this.comisionesEnVivo.add(s.idComision);
      });
      console.log('[COMISIONES SOCKET] comisionesEnVivo después:', Array.from(this.comisionesEnVivo));
      this.cdr.detectChanges();
      if (this.selectedComision) {
        const activa = lista.find(s => s.esComision && s.idComision === this.selectedComision!.id);
        if (activa) {
          this.sesionActivaComision = true;
          this.sesionNombreComision = activa.titulo ?? '';
        }
      }
    });
    this.socketService.emitGetSesionesActivas();

    // Sesión iniciada en cualquier comisión
    this.socketService.onSesionIniciada((data: any) => {
      console.log('[COMISIONES SOCKET] sesion-iniciada recibido:', data);
      if (data.esComision && data.idComision) {
        this.comisionesEnVivo.add(data.idComision);
        console.log('[COMISIONES SOCKET] comisionesEnVivo después de sesion-iniciada:', Array.from(this.comisionesEnVivo));
        console.log('[COMISIONES SOCKET] IDs de comisiones cargadas:', this.comisiones.map(c => c.id));
        this.cdr.detectChanges();
        if (this.selectedComision?.id === data.idComision) {
          this.sesionActivaComision = true;
          this.sesionNombreComision = data.titulo ?? '';
        }
      }
    });

    // Sesión terminada
    this.socketService.onSesionTerminada((data: any) => {
      if (data.idComision) {
        this.comisionesEnVivo.delete(data.idComision);
        if (this.selectedComision?.id === data.idComision) {
          this.sesionActivaComision = false;
          this.sesionNombreComision = '';
          this.evento = 0;
        }
      }
    });

    // Asistencia abierta
    this.socketService.onAsistenciaAbierta((data) => {
      if (data.idComision !== this.selectedComision?.id) return;
      this.idAgendaActual = data.idAgenda;
      this.evento = 2;
      this.eventosService.getEstadoPanel().subscribe({
        next: (estado) => { this.asistenciaRegistrada = estado.asistencia?.yaRegistro ?? false; },
        error: () => { this.asistenciaRegistrada = false; }
      });
    });

    this.socketService.onAsistenciaCerrada((data) => {
      if (data.idComision !== this.selectedComision?.id) return;
      if (this.evento === 2) this.evento = 0;
    });

    // Votación abierta
    this.socketService.onVotacionAbierta((data) => {
      if (data.idComision !== this.selectedComision?.id) return;
      this.idAgendaActual = data.idAgenda;
      this.idVotoPuntoActual = '';
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
        error: (err) => console.error('Error id_voto_punto', err)
      });
    });

    this.socketService.onVotacionCerrada((data) => {
      if (data.idComision !== this.selectedComision?.id) return;
      if (this.evento === 3) {
        this.evento = 0;
        this.temaVotacion = '';
        this.tipoPuntoVotacion = '';
        this.noPuntoVotacion = null;
        this.miVoto = '';
      }
    });

    // Actualizaciones del admin
    this.socketService.onAsistenciaActualizadaAdmin(() => {
      this.eventosService.getEstadoPanel().subscribe({
        next: (estado) => this.aplicarEstadoPanelParaComision(estado),
        error: () => {}
      });
    });

    this.socketService.onVotoActualizadoAdmin(() => {
      this.eventosService.getEstadoPanel().subscribe({
        next: (estado) => this.aplicarEstadoPanelParaComision(estado),
        error: () => {}
      });
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

  // ── Cargar comisiones desde el backend ───────────────────────────────
  private cargarComisiones() {
    this.cargandoComisiones = true;
    this.eventosService.getMisComisiones().subscribe({
      next: (res) => {
        this.comisiones = res.comisiones.map((c: MiComision) => ({
          id: c.id,
          nombre: c.nombre,
          cargo: c.cargo,
        }));
        this.cargandoComisiones = false;
      },
      error: (err) => {
        console.error('Error al cargar comisiones', err);
        this.cargandoComisiones = false;
      }
    });
  }

  // ── Seleccionar comisión ──────────────────────────────────────────────
  selectComision(comision: Comision) {
    this.selectedComision = comision;
    this.sesionActivaComision = this.comisionesEnVivo.has(comision.id);
    this.evento = 0;
    this.miVoto = '';
    this.asistenciaRegistrada = false;
    this.textoExpandido = false;

    // Restaurar estado actual de esta comisión
    this.eventosService.getEstadoPanel().subscribe({
      next: (estado: EstadoPanel) => this.aplicarEstadoPanelParaComision(estado),
      error: (err) => console.error('Error estado-panel (comision)', err)
    });
  }

  goBack() {
    this.selectedComision = null;
    this.sesionActivaComision = false;
    this.sesionNombreComision = '';
    this.evento = 0;
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

  private aplicarEstadoPanelParaComision(estado: EstadoPanel) {
    if (!this.selectedComision) return;
    const idComision = this.selectedComision.id;

    if (estado.votacion && estado.votacion.idComision === idComision) {
      this.evento = 3;
      this.idAgendaActual = estado.votacion.idAgenda;
      this.idVotoPuntoActual = estado.votacion.id_voto_punto;
      this.temaVotacion = this.extraerTextoVotacion(estado.votacion.punto, estado.votacion.idReserva, estado.votacion.idIniciativa);
      this.noPuntoVotacion = estado.votacion.punto?.nopunto ?? null;
      this.tipoPuntoVotacion = estado.votacion.idReserva ? 'Reserva' : estado.votacion.idIniciativa ? 'Iniciativa' : '';
      if (estado.votacion.yaVoto && estado.votacion.sentidoActual) {
        const labels: Record<number, string> = { 1: 'FAVOR', 2: 'ABSTENCION', 3: 'CONTRA' };
        this.miVoto = labels[estado.votacion.sentidoActual] ?? '';
      }
    } else if (estado.asistencia && estado.asistencia.idComision === idComision) {
      this.evento = 2;
      this.idAgendaActual = estado.asistencia.idAgenda;
      this.asistenciaRegistrada = estado.asistencia.yaRegistro;
    }
  }

  votar(tipo: string) {
    this.miVoto = tipo;
    this.eventosService.registrarVoto({
      sentido_voto: SENTIDO[tipo] ?? 1,
      id_voto_punto: this.idVotoPuntoActual,
      id_comision: this.selectedComision?.id
    } as any).subscribe({
      next: (r: any) => console.log('Votación comisión registrada:', r),
      error: (e: any) => console.error('Error votación comisión', e)
    });
  }

  registrarAsistencia() {
    this.eventosService.registrarAsistencia({
      id_agenda: this.idAgendaActual,
      id_comision: this.selectedComision?.id
    } as any).subscribe({
      next: (r: any) => {
        this.asistenciaRegistrada = true;
        console.log('Asistencia comisión registrada:', r);
      },
      error: (e: any) => console.error('Error asistencia comisión', e)
    });
  }

  setOpen(isOpen: boolean) {
    this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl('assets/OD-DELIBERANTE-DIP.PER-22ENERO2026.pdf');
    this.isModalOpen = isOpen;
  }

  rolIcono(cargo: string): string {
    const c = (cargo ?? '').toLowerCase();
    if (c.includes('president')) return 'crown-outline';
    if (c.includes('secretar'))  return 'create-outline';
    return 'mic-outline';
  }

  esPresidente(cargo: string): boolean {
    return (cargo ?? '').toLowerCase().includes('president');
  }

  esSecretario(cargo: string): boolean {
    return (cargo ?? '').toLowerCase().includes('secretar');
  }

  esVocal(cargo: string): boolean {
    const c = (cargo ?? '').toLowerCase();
    return !c.includes('president') && !c.includes('secretar');
  }

  get miVotoLabel(): string {
    const map: Record<string, string> = { FAVOR: 'A Favor', CONTRA: 'En Contra', ABSTENCION: 'Abstención', 'SIN REGISTRO': 'Sin Registro' };
    return map[this.miVoto] ?? '';
  }

  get votoIcono(): string {
    const map: Record<string, string> = { FAVOR: 'thumbs-up-outline', CONTRA: 'thumbs-down-outline', ABSTENCION: 'remove-circle-outline', 'SIN REGISTRO': 'ellipsis-horizontal-circle-outline' };
    return map[this.miVoto] ?? 'help-circle-outline';
  }
}
