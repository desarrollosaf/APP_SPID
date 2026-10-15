import { Component, OnDestroy } from '@angular/core';
import { ViewWillEnter, ViewWillLeave } from '@ionic/angular';
import {
  EstadoEvento, EventoAgenda, PresidenciaService, SalonAgenda, aFechaLocal, aIso, estadoEvento, sumarDias,
} from '../../service/presidencia.service';

type Segmento = 'dia' | 'semana' | 'mes';
type EstadoSalon = 'en-evento' | 'proximamente' | 'disponible' | 'sin-eventos';
type FiltroEstado = 'todos' | 'en-evento' | 'proximamente' | 'disponible';

const RANGO_INICIO = 8;  // 08:00
const RANGO_FIN = 20;    // 20:00
const RANGO_TOTAL = RANGO_FIN - RANGO_INICIO;

const hhmm = (f: Date) => `${f.getHours().toString().padStart(2, '0')}:${f.getMinutes().toString().padStart(2, '0')}`;
const horaDecimal = (t: string) => { const [h, m] = t.split(':').map(Number); return h + (m || 0) / 60; };

interface EventoConSalon extends EventoAgenda {
  salonNombre: string;
  salonColor: string;
}

@Component({
  selector: 'app-salones',
  templateUrl: './salones.page.html',
  styleUrls: ['./salones.page.scss'],
  standalone: false,
})
export class SalonesPage implements ViewWillEnter, ViewWillLeave, OnDestroy {
  readonly escala = [8, 11, 14, 17, 20];
  salones: SalonAgenda[] = [];
  cargando = true;
  error = false;

  segmento: Segmento = 'dia';
  fecha = aIso(new Date());
  busqueda = '';
  filtroEstado: FiltroEstado = 'todos';
  ahora = new Date();
  seleccionado: EventoConSalon | null = null;
  detalleAbierto = false;

  /** En tablet la hoja se muestra como ventana centrada; en teléfono, desde abajo. */
  readonly hojaCentrada = window.matchMedia('(min-width: 768px)').matches;

  private reloj?: ReturnType<typeof setInterval>;

  constructor(private presidencia: PresidenciaService) {}

  ionViewWillEnter(): void {
    this.ahora = new Date();
    this.reloj = setInterval(() => (this.ahora = new Date()), 60000);
    if (!this.salones.length) this.cargar();
  }

  ionViewWillLeave(): void { clearInterval(this.reloj); }
  ngOnDestroy(): void { clearInterval(this.reloj); }

  cargar(refrescar = false, refresher?: { complete: () => void }): void {
    this.error = false;
    if (!refresher) this.cargando = true;
    this.presidencia.salones(refrescar).subscribe({
      next: s => { this.salones = s; this.cargando = false; refresher?.complete(); },
      error: () => { this.cargando = false; this.error = true; refresher?.complete(); },
    });
  }

  refrescar(ev: Event): void {
    this.cargar(true, ev.target as unknown as { complete: () => void });
  }

  get hoy(): string { return aIso(new Date()); }

  get salonesFiltrados(): SalonAgenda[] {
    const t = this.busqueda.trim().toLowerCase();
    const lista = this.salones.filter(s => {
      if (t && !s.nombre.toLowerCase().includes(t)) return false;
      if (this.filtroEstado === 'todos') return true;
      const e = this.estado(s);
      return this.filtroEstado === 'disponible' ? e === 'disponible' || e === 'sin-eventos' : e === this.filtroEstado;
    });
    // Ocupados primero: en evento, luego los que tienen eventos ese día, luego libres
    const peso = (s: SalonAgenda) =>
      (this.fecha === this.hoy && this.estado(s) === 'en-evento' ? 0 : 1) * 10 + (this.eventosDelDia(s).length ? 0 : 1);
    return [...lista].sort((a, b) => peso(a) - peso(b));
  }

  get totales() {
    const estados = this.salones.map(s => this.estado(s));
    return {
      enEvento: estados.filter(e => e === 'en-evento').length,
      proximamente: estados.filter(e => e === 'proximamente').length,
      disponibles: estados.filter(e => e === 'disponible' || e === 'sin-eventos').length,
      total: this.salones.length,
    };
  }

  /** Los indicadores funcionan como filtro; se aplican sobre el día de hoy. */
  filtrar(f: FiltroEstado): void {
    this.filtroEstado = this.filtroEstado === f ? 'todos' : f;
    if (this.filtroEstado !== 'todos') {
      this.segmento = 'dia';
      this.fecha = this.hoy;
    }
  }

  get etiquetaFiltro(): string {
    return { todos: '', 'en-evento': 'En evento ahora', proximamente: 'Con evento en la próxima hora', disponible: 'Disponibles' }[this.filtroEstado];
  }

  estadoEv(e: EventoAgenda): EstadoEvento {
    return estadoEvento(e, this.ahora);
  }

  // ── Vista por día ──

  eventosDelDia(s: SalonAgenda): EventoAgenda[] {
    return s.eventos.filter(e => e.fecha === this.fecha);
  }

  moverDia(delta: number): void {
    const f = aFechaLocal(this.fecha) ?? new Date();
    this.fecha = aIso(sumarDias(f, delta));
  }

  get etiquetaFecha(): string {
    if (this.fecha === this.hoy) return 'Hoy';
    if (this.fecha === aIso(sumarDias(new Date(), 1))) return 'Mañana';
    if (this.fecha === aIso(sumarDias(new Date(), -1))) return 'Ayer';
    const f = aFechaLocal(this.fecha);
    if (!f) return '';
    const t = new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }).format(f);
    return t.charAt(0).toUpperCase() + t.slice(1).replace(/\./g, '');
  }

  barra(e: EventoAgenda): { left: number; width: number } {
    const inicio = Math.max(RANGO_INICIO, horaDecimal(e.horaInicio));
    const finRaw = e.horaFin ? horaDecimal(e.horaFin) : inicio + 0.5;
    const fin = Math.min(RANGO_FIN, Math.max(finRaw, inicio + 0.25));
    return {
      left: ((inicio - RANGO_INICIO) / RANGO_TOTAL) * 100,
      width: Math.max(((fin - inicio) / RANGO_TOTAL) * 100, 2),
    };
  }

  get posicionAhora(): number | null {
    if (this.fecha !== this.hoy) return null;
    const d = horaDecimal(hhmm(this.ahora));
    return d < RANGO_INICIO || d > RANGO_FIN ? null : ((d - RANGO_INICIO) / RANGO_TOTAL) * 100;
  }

  estado(s: SalonAgenda): EstadoSalon {
    const hoy = s.eventos.filter(e => e.fecha === this.hoy);
    if (!hoy.length) return 'sin-eventos';
    const ahora = hhmm(this.ahora);
    if (hoy.some(e => e.horaInicio <= ahora && (e.horaFin === null || e.horaFin >= ahora))) return 'en-evento';
    const enUnaHora = hhmm(new Date(this.ahora.getTime() + 60 * 60000));
    if (hoy.some(e => e.horaInicio > ahora && e.horaInicio <= enUnaHora)) return 'proximamente';
    return 'disponible';
  }

  etiquetaEstado(s: SalonAgenda): string {
    return { 'en-evento': 'En evento', proximamente: 'Próximamente', disponible: 'Disponible', 'sin-eventos': 'Libre hoy' }[this.estado(s)];
  }

  // ── Vista semana / mes ──

  get eventosPeriodo(): EventoConSalon[] {
    const limite = aIso(sumarDias(new Date(), this.segmento === 'semana' ? 7 : 30));
    const visibles = new Set(this.salonesFiltrados.map(s => s.id));
    const porSalon = this.salones
      .filter(s => visibles.has(s.id))
      .map(s => s.eventos
        .filter(e => e.fecha >= this.hoy && e.fecha <= limite)
        .map(e => ({ ...e, salonNombre: s.nombre, salonColor: s.color })));
    return ([] as EventoConSalon[]).concat(...porSalon)
      .sort((a, b) => a.fecha === b.fecha ? a.horaInicio.localeCompare(b.horaInicio) : a.fecha.localeCompare(b.fecha));
  }

  mostrarFecha(i: number): boolean {
    const l = this.eventosPeriodo;
    return i === 0 || l[i].fecha !== l[i - 1].fecha;
  }

  fechaDia(fechaIso: string): string {
    if (fechaIso === this.hoy) return 'Hoy';
    if (fechaIso === aIso(sumarDias(new Date(), 1))) return 'Mañana';
    const f = aFechaLocal(fechaIso);
    if (!f) return '';
    const t = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }).format(f);
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  // ── Detalle ──

  abrir(e: EventoAgenda, s: SalonAgenda): void {
    this.ver({ ...e, salonNombre: s.nombre, salonColor: s.color });
  }

  ver(e: EventoConSalon): void {
    this.seleccionado = e;
    this.detalleAbierto = true;
  }

  rango(e: EventoAgenda): string {
    return e.horaFin ? `${e.horaInicio} – ${e.horaFin}` : e.horaInicio;
  }
}
