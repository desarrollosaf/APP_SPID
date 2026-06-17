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

interface EstadoCom {
  evento: number;
  asistenciaRegistrada: boolean;
  miVoto: string;
  idVotoPuntoActual: string;
  temaVotacion: string;
  noPuntoVotacion: number | null;
  tipoPuntoVotacion: string;
  idAgenda: string;
  textoExpandido: boolean;
}

const SENTIDO: Record<string, number> = { FAVOR: 1, ABSTENCION: 2, CONTRA: 3, 'SIN REGISTRO': 0 };

const DEFAULT_ESTADO_COM: EstadoCom = {
  evento: 0, asistenciaRegistrada: false, miVoto: '',
  idVotoPuntoActual: '', temaVotacion: '', noPuntoVotacion: null,
  tipoPuntoVotacion: '', idAgenda: '', textoExpandido: false
};

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

  // ── Eventos activos donde el diputado es anfitrión ────────────────────
  private sesionesVivas: { idAgenda: string; titulo: string; idComisiones: string[] }[] = [];
  eventosActivos: { idAgenda: string; titulo: string; comisionesDelDiputado: Comision[] }[] = [];

  // ── Navegación ────────────────────────────────────────────────────────
  selectedComision: Comision | null = null;
  selectedEvento: { idAgenda: string; titulo: string; comisionesDelDiputado: Comision[] } | null = null;
  private estadosPorComision = new Map<string, EstadoCom>();

  // ── Info de la comisión seleccionada ─────────────────────────────────
  comisionInfo: {
    proximos: { id: string; descripcion: string; fecha: string; hora: string; fecha_hora: string }[];
    pasados:  { id: string; descripcion: string; fecha: string; hora: string; fecha_hora: string }[];
    integrantes: { id: string; nombre: string; cargo: string; orden: number }[];
  } | null = null;
  cargandoComisionInfo = false;

  // ── Estado de sesión de la comisión seleccionada (vista single) ───────
  sesionActivaComision: boolean = false;
  sesionNombreComision: string = '';
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

  ionViewWillEnter() {
    this.nombreDiputado = this.userService.nombreCompleto;
    this.comisionesEnVivo.clear();
    this.comisiones = [];
    this.sesionesVivas = [];
    this.eventosActivos = [];
    this.selectedComision = null;
    this.selectedEvento = null;
    this.estadosPorComision.clear();
    this.cargarComisiones();

    const miId = this.userService.currentUserValue?.user?.integrante_legislatura_id ?? null;
    this.socketService.conectarComoDiputado(miId);
    this.eventosService.getSesionesComisionesActivas().subscribe({
      next: (res) => {
        this.sesionesVivas = res.sesiones.map(s => ({
          idAgenda: s.idAgenda,
          titulo: s.titulo,
          idComisiones: s.idComisiones?.length ? s.idComisiones : (s.idComision ? [s.idComision] : [])
        }));
        this.sesionesVivas.forEach(s => s.idComisiones.forEach(id => this.comisionesEnVivo.add(id)));
        this.computarEventosActivos();
      },
      error: () => {}
    });
    this.socketService.emitGetSesionesActivas();
  }

  ngOnInit() {
    this.socketService.onSesionesActivas((lista: any[]) => {
      this.sesionesVivas = lista.filter(s => s.esComision).map(s => ({
        idAgenda: s.idAgenda,
        titulo: s.titulo,
        idComisiones: s.idComisiones?.length ? s.idComisiones : (s.idComision ? [s.idComision] : [])
      }));
      this.comisionesEnVivo.clear();
      this.sesionesVivas.forEach(s => s.idComisiones.forEach(id => this.comisionesEnVivo.add(id)));
      this.computarEventosActivos();
      if (this.selectedComision) {
        const activa = this.sesionesVivas.find(s => s.idComisiones.includes(this.selectedComision!.id));
        if (activa) { this.sesionActivaComision = true; this.sesionNombreComision = activa.titulo; }
      }
    });

    this.socketService.onSesionIniciada((data: any) => {
      if (data.esComision) {
        const ids: string[] = data.idComisiones?.length ? data.idComisiones : (data.idComision ? [data.idComision] : []);
        if (!this.sesionesVivas.find(s => s.idAgenda === data.idAgenda)) {
          this.sesionesVivas.push({ idAgenda: data.idAgenda, titulo: data.titulo, idComisiones: ids });
        }
        ids.forEach(id => this.comisionesEnVivo.add(id));
        this.computarEventosActivos();
        if (this.selectedComision && ids.includes(this.selectedComision.id)) {
          this.sesionActivaComision = true;
          this.sesionNombreComision = data.titulo ?? '';
        }
      }
    });

    this.socketService.onSesionTerminada((data: any) => {
      if (!data.esComision) return;
      const ids: string[] = data.idComisiones?.length ? data.idComisiones : (data.idComision ? [data.idComision] : []);
      this.sesionesVivas = this.sesionesVivas.filter(s => s.idAgenda !== data.idAgenda);
      ids.forEach(id => this.comisionesEnVivo.delete(id));
      this.computarEventosActivos();
      if (this.selectedComision && ids.includes(this.selectedComision.id)) {
        this.sesionActivaComision = false;
        this.sesionNombreComision = '';
        this.evento = 0;
      }
      if (this.selectedEvento?.idAgenda === data.idAgenda) {
        this.selectedEvento = null;
        this.estadosPorComision.clear();
      }
    });

    this.socketService.onAsistenciaAbierta((data) => {
      if (this.selectedComision && data.idComision === this.selectedComision.id) {
        this.idAgendaActual = data.idAgenda;
        this.evento = 2;
        this.eventosService.getEstadoPanel().subscribe({
          next: (estado) => { this.asistenciaRegistrada = estado.asistencia?.yaRegistro ?? false; },
          error: () => { this.asistenciaRegistrada = false; }
        });
        return;
      }
      if (this.selectedEvento) {
        const s = this.estadosPorComision.get(data.idComision);
        if (s) {
          s.evento = 2;
          s.idAgenda = data.idAgenda;
          s.asistenciaRegistrada = false;
          this.cdr.detectChanges();
        }
      }
    });

    this.socketService.onAsistenciaCerrada((data) => {
      if (this.selectedComision && data.idComision === this.selectedComision.id) {
        if (this.evento === 2) this.evento = 0;
        return;
      }
      if (this.selectedEvento) {
        const s = this.estadosPorComision.get(data.idComision);
        if (s && s.evento === 2) { s.evento = 0; this.cdr.detectChanges(); }
      }
    });

    this.socketService.onVotacionAbierta((data) => {
      if (this.selectedComision && data.idComision === this.selectedComision.id) {
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
          next: (estado) => { if (estado.votacion) this.idVotoPuntoActual = estado.votacion.id_voto_punto; },
          error: (err) => console.error('Error id_voto_punto', err)
        });
        return;
      }
      if (this.selectedEvento) {
        const s = this.estadosPorComision.get(data.idComision);
        if (s) {
          const idRes = (data as any).idReserva;
          const idIni = (data as any).idIniciativa;
          s.evento = 3;
          s.idAgenda = data.idAgenda;
          s.idVotoPuntoActual = '';
          s.temaVotacion = this.extraerTextoVotacion(data.punto, idRes, idIni);
          s.noPuntoVotacion = (data.punto as any)?.nopunto ?? null;
          s.tipoPuntoVotacion = idRes ? 'Reserva' : idIni ? 'Iniciativa' : '';
          s.textoExpandido = false;
          s.miVoto = '';
          this.eventosService.getEstadoPanel().subscribe({
            next: (estado) => {
              if (estado.votacion) { s.idVotoPuntoActual = estado.votacion.id_voto_punto; this.cdr.detectChanges(); }
            }
          });
          this.cdr.detectChanges();
        }
      }
    });

    this.socketService.onVotacionCerrada((data) => {
      if (this.selectedComision && data.idComision === this.selectedComision.id) {
        if (this.evento === 3) {
          this.evento = 0;
          this.temaVotacion = '';
          this.tipoPuntoVotacion = '';
          this.noPuntoVotacion = null;
          this.miVoto = '';
        }
        return;
      }
      if (this.selectedEvento) {
        const s = this.estadosPorComision.get(data.idComision);
        if (s && s.evento === 3) {
          s.evento = 0; s.temaVotacion = ''; s.tipoPuntoVotacion = ''; s.noPuntoVotacion = null; s.miVoto = '';
          this.cdr.detectChanges();
        }
      }
    });

    this.socketService.onAsistenciaActualizadaAdmin(() => {
      this.eventosService.getEstadoPanel().subscribe({
        next: (estado) => { this.aplicarEstadoPanelParaComision(estado); this.aplicarEstadoPanelParaEvento(estado); },
        error: () => {}
      });
    });

    this.socketService.onVotoActualizadoAdmin(() => {
      this.eventosService.getEstadoPanel().subscribe({
        next: (estado) => { this.aplicarEstadoPanelParaComision(estado); this.aplicarEstadoPanelParaEvento(estado); },
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
        this.comisiones = res.comisiones
          .sort((a, b) => (a.nivel ?? 99) - (b.nivel ?? 99))
          .map((c: MiComision) => ({ id: c.id, nombre: c.nombre, cargo: c.cargo }));
        this.cargandoComisiones = false;
        this.computarEventosActivos();
      },
      error: (err) => {
        console.error('Error al cargar comisiones', err);
        this.cargandoComisiones = false;
      }
    });
  }

  private computarEventosActivos() {
    this.eventosActivos = this.sesionesVivas
      .map(s => ({
        idAgenda: s.idAgenda,
        titulo: s.titulo,
        comisionesDelDiputado: this.comisiones.filter(c => s.idComisiones.includes(c.id))
      }))
      .filter(e => e.comisionesDelDiputado.length > 0);
    this.cdr.detectChanges();
  }

  // ── Navegación ────────────────────────────────────────────────────────
  selectComision(comision: Comision) {
    this.selectedComision = comision;
    this.selectedEvento = null;
    this.sesionActivaComision = this.comisionesEnVivo.has(comision.id);
    this.evento = 0;
    this.miVoto = '';
    this.asistenciaRegistrada = false;
    this.textoExpandido = false;
    this.comisionInfo = null;
    this.cargandoComisionInfo = true;
    this.eventosService.getComisionInfo(comision.id).subscribe({
      next: (info) => { this.comisionInfo = info; this.cargandoComisionInfo = false; },
      error: () => { this.cargandoComisionInfo = false; }
    });
  }

  selectEvento(ev: { idAgenda: string; titulo: string; comisionesDelDiputado: Comision[] }) {
    this.selectedEvento = ev;
    this.selectedComision = null;
    this.estadosPorComision.clear();
    ev.comisionesDelDiputado.forEach(c => {
      this.estadosPorComision.set(c.id, { ...DEFAULT_ESTADO_COM, idAgenda: ev.idAgenda });
    });
    this.eventosService.getEstadoPanel().subscribe({
      next: (estado) => this.aplicarEstadoPanelParaEvento(estado),
      error: () => {}
    });
  }

  goBack() {
    if (this.selectedEvento) {
      this.selectedEvento = null;
      this.estadosPorComision.clear();
      return;
    }
    this.selectedComision = null;
    this.sesionActivaComision = false;
    this.sesionNombreComision = '';
    this.evento = 0;
  }

  // ── Estado multi-comisión ─────────────────────────────────────────────
  getEstadoCom(idComision: string): EstadoCom {
    return this.estadosPorComision.get(idComision) ?? { ...DEFAULT_ESTADO_COM };
  }

  private aplicarEstadoPanelParaEvento(estado: EstadoPanel) {
    if (!this.selectedEvento) return;
    if (estado.asistencia) {
      const ids = estado.asistencia.idComisiones ?? [estado.asistencia.idComision];
      ids.forEach(id => {
        const s = this.estadosPorComision.get(id);
        if (s) { s.evento = 2; s.idAgenda = estado.asistencia!.idAgenda; s.asistenciaRegistrada = estado.asistencia!.yaRegistro; }
      });
    }
    if (estado.votacion) {
      const ids = estado.votacion.idComisiones ?? [estado.votacion.idComision];
      ids.forEach(id => {
        const s = this.estadosPorComision.get(id);
        if (s) {
          s.evento = 3;
          s.idAgenda = estado.votacion!.idAgenda;
          s.idVotoPuntoActual = estado.votacion!.id_voto_punto;
          s.temaVotacion = this.extraerTextoVotacion(estado.votacion!.punto, estado.votacion!.idReserva, estado.votacion!.idIniciativa);
          s.noPuntoVotacion = estado.votacion!.punto?.nopunto ?? null;
          s.tipoPuntoVotacion = estado.votacion!.idReserva ? 'Reserva' : estado.votacion!.idIniciativa ? 'Iniciativa' : '';
          if (estado.votacion!.yaVoto && estado.votacion!.sentidoActual) {
            const labels: Record<number, string> = { 1: 'FAVOR', 2: 'ABSTENCION', 3: 'CONTRA' };
            s.miVoto = labels[estado.votacion!.sentidoActual] ?? '';
          }
        }
      });
    }
    this.cdr.detectChanges();
  }

  get hayAsistenciaAbiertaEnEvento(): boolean {
    if (!this.selectedEvento) return false;
    return this.selectedEvento.comisionesDelDiputado.some(c => this.getEstadoCom(c.id).evento === 2);
  }

  get todasAsistenciasRegistradas(): boolean {
    if (!this.selectedEvento) return false;
    const conAsist = this.selectedEvento.comisionesDelDiputado.filter(c => this.getEstadoCom(c.id).evento === 2);
    return conAsist.length > 0 && conAsist.every(c => this.getEstadoCom(c.id).asistenciaRegistrada);
  }

  registrarAsistenciaComision(idComision: string) {
    const s = this.estadosPorComision.get(idComision);
    if (!s || s.asistenciaRegistrada) return;
    this.eventosService.registrarAsistencia({ id_agenda: s.idAgenda, id_comision: idComision } as any).subscribe({
      next: () => {
        s.asistenciaRegistrada = true;
        this.cdr.detectChanges();
      },
      error: (e: any) => {
        if (e?.status === 409) {
          s.asistenciaRegistrada = true;
          this.cdr.detectChanges();
        } else {
          console.error('Error asistencia comisión', e);
        }
      }
    });
  }

  registrarAsistenciaTodas() {
    if (!this.selectedEvento) return;
    this.selectedEvento.comisionesDelDiputado.forEach(c => {
      const s = this.estadosPorComision.get(c.id);
      if (s?.evento === 2 && !s.asistenciaRegistrada) this.registrarAsistenciaComision(c.id);
    });
  }

  votarComision(tipo: string, idComision: string) {
    const s = this.estadosPorComision.get(idComision);
    if (!s) return;
    s.miVoto = tipo;
    this.cdr.detectChanges();
    this.eventosService.registrarVoto({
      sentido_voto: SENTIDO[tipo] ?? 1,
      id_voto_punto: s.idVotoPuntoActual,
      id_comision: idComision
    } as any).subscribe({
      next: (r: any) => console.log('Voto comisión:', r),
      error: (e: any) => console.error('Error votación comisión', e)
    });
  }

  // ── Estado single-comisión ────────────────────────────────────────────
  private aplicarEstadoPanelParaComision(estado: EstadoPanel) {
    if (!this.selectedComision) return;
    const idComision = this.selectedComision.id;
    const enVotacion = estado.votacion &&
      ((estado.votacion.idComisiones ?? [estado.votacion.idComision]).includes(idComision));
    const enAsistencia = estado.asistencia &&
      ((estado.asistencia.idComisiones ?? [estado.asistencia.idComision]).includes(idComision));
    if (enVotacion && estado.votacion) {
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
    } else if (enAsistencia && estado.asistencia) {
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
      next: (r: any) => { this.asistenciaRegistrada = true; console.log('Asistencia registrada:', r); },
      error: (e: any) => console.error('Error asistencia comisión', e)
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────
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

  // Devuelve el tema de votación del evento (compartido entre todas las comisiones)
  get votacionEvento(): { tema: string; noPunto: number | null; tipoPunto: string; textoExpandido: boolean } | null {
    if (!this.selectedEvento) return null;
    for (const com of this.selectedEvento.comisionesDelDiputado) {
      const s = this.estadosPorComision.get(com.id);
      if (s && s.evento === 3 && s.temaVotacion) {
        return { tema: s.temaVotacion, noPunto: s.noPuntoVotacion, tipoPunto: s.tipoPuntoVotacion, textoExpandido: s.textoExpandido };
      }
    }
    return null;
  }

  toggleExpandirTemaEvento() {
    if (!this.selectedEvento) return;
    for (const com of this.selectedEvento.comisionesDelDiputado) {
      const s = this.estadosPorComision.get(com.id);
      if (s && s.evento === 3) { s.textoExpandido = !s.textoExpandido; }
    }
    this.cdr.detectChanges();
  }

  formatMes(fechaStr: string): string {
    if (!fechaStr) return '';
    const src = fechaStr.includes('T') ? fechaStr : `${fechaStr}T12:00:00`;
    return new Date(src).toLocaleDateString('es-MX', { month: 'short' }).replace('.', '').toUpperCase().slice(0, 3);
  }

  formatDia(fechaStr: string): string {
    if (!fechaStr) return '';
    const src = fechaStr.includes('T') ? fechaStr : `${fechaStr}T12:00:00`;
    return new Date(src).getDate().toString();
  }

  formatFecha(fechaStr: string): string {
    if (!fechaStr) return '';
    const d = new Date(fechaStr);
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  formatHora(item: { hora?: string; fecha_hora?: string }): string {
    const src = item.fecha_hora || item.hora;
    if (!src) return '';
    const d = new Date(src);
    if (isNaN(d.getTime())) return src.slice(0, 5);
    return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  rolIconoStr(cargo: string): string {
    return this.rolIcono(cargo);
  }

  temaCorto(texto: string, max = 80): string {
    return texto.length > max ? texto.slice(0, max) : texto;
  }

  get temaVotacionCorto(): string { return this.temaCorto(this.temaVotacion, 110); }

  setOpen(isOpen: boolean) {
    this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl('assets/OD-DELIBERANTE-DIP.PER-22ENERO2026.pdf');
    this.isModalOpen = isOpen;
  }

  rolIcono(cargo: string): string {
    const c = (cargo ?? '').toLowerCase();
    if (c.includes('president')) return 'crown-outline';
    if (c.includes('secretar'))  return 'document-text-outline';
    return 'person-outline';
  }

  esPresidente(cargo: string): boolean { return (cargo ?? '').toLowerCase().includes('president'); }
  esSecretario(cargo: string): boolean { return (cargo ?? '').toLowerCase().includes('secretar'); }
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

  votoLabel(voto: string): string {
    const map: Record<string, string> = { FAVOR: 'A Favor', CONTRA: 'En Contra', ABSTENCION: 'Abstención', 'SIN REGISTRO': 'Sin Registro' };
    return map[voto] ?? '';
  }
}
