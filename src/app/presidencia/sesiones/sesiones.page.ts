import { Component } from '@angular/core';
import { ViewWillEnter } from '@ionic/angular';
import { PresidenciaService, SesionResumen, aFechaLocal, aIso } from '../../service/presidencia.service';

@Component({
  selector: 'app-sesiones-presidencia',
  templateUrl: './sesiones.page.html',
  styleUrls: ['./sesiones.page.scss'],
  standalone: false,
})
export class SesionesPresidenciaPage implements ViewWillEnter {
  sesiones: SesionResumen[] = [];
  cargando = true;
  error = false;
  /** Fecha buscada (yyyy-mm-dd); vacía = últimas sesiones. */
  fecha = '';

  constructor(private presidencia: PresidenciaService) {}

  ionViewWillEnter(): void {
    if (!this.sesiones.length && !this.error) this.cargarUltimas();
  }

  cargarUltimas(): void {
    this.fecha = '';
    this.pedir(this.presidencia.ultimasSesiones());
  }

  buscar(): void {
    if (!this.fecha) return this.cargarUltimas();
    this.pedir(this.presidencia.sesionesPorFecha(this.fecha));
  }

  refrescar(ev: Event): void {
    const r = ev.target as unknown as { complete: () => void };
    const fuente = this.fecha ? this.presidencia.sesionesPorFecha(this.fecha) : this.presidencia.ultimasSesiones();
    fuente.subscribe({
      next: s => { this.sesiones = s; this.error = false; r.complete(); },
      error: () => r.complete(),
    });
  }

  private pedir(fuente: ReturnType<PresidenciaService['ultimasSesiones']>): void {
    this.cargando = true;
    this.error = false;
    fuente.subscribe({
      next: s => { this.sesiones = s; this.cargando = false; },
      error: () => { this.cargando = false; this.error = true; },
    });
  }

  get etiquetaFecha(): string {
    const f = aFechaLocal(this.fecha);
    if (!f) return 'Buscar por fecha';
    if (this.fecha === aIso(new Date())) return 'Hoy';
    return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }).format(f);
  }

  dia(fechaIso: string): string {
    return aFechaLocal(fechaIso)?.getDate().toString() ?? '—';
  }

  mes(fechaIso: string): string {
    const f = aFechaLocal(fechaIso);
    return f ? new Intl.DateTimeFormat('es-MX', { month: 'short' }).format(f).replace('.', '') : '';
  }

  diaSemana(fechaIso: string): string {
    const f = aFechaLocal(fechaIso);
    if (!f) return '';
    const dia = new Intl.DateTimeFormat('es-MX', { weekday: 'long' }).format(f);
    return `${dia.charAt(0).toUpperCase() + dia.slice(1)} · ${f.getFullYear()}`;
  }

  /** Encabezado de mes cuando cambia respecto a la sesión anterior. */
  mostrarMes(i: number): boolean {
    return i === 0 || this.sesiones[i].fecha?.slice(0, 7) !== this.sesiones[i - 1].fecha?.slice(0, 7);
  }

  mesLargo(fechaIso: string): string {
    const f = aFechaLocal(fechaIso);
    if (!f) return '';
    const t = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(f);
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  esHoy(fechaIso: string): boolean {
    return fechaIso?.slice(0, 10) === aIso(new Date());
  }
}
