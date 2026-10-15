import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HapticsService } from '../../service/haptics.service';
import {
  PresidenciaService, PuntoSesion, SesionDetalle, SentidoVoto, VotoDiputado, aFechaLocal,
} from '../../service/presidencia.service';

type Filtro = 'todos' | 'video' | 'sin-video';

interface Conteo { favor: number; contra: number; abst: number; pendiente: number; total: number }

@Component({
  selector: 'app-sesion-detalle',
  templateUrl: './sesion-detalle.page.html',
  styleUrls: ['./sesion-detalle.page.scss'],
  standalone: false,
})
export class SesionDetallePage implements OnInit {
  sesion: SesionDetalle | null = null;
  cargando = true;
  error = false;
  filtro: Filtro = 'todos';

  textoAbierto = new Set<number>();
  videoAbierto: number | null = null;
  votosAbierto: number | null = null;
  votos: Record<number, VotoDiputado[]> = {};
  conteos: Record<number, Conteo> = {};
  cargandoVotos: number | null = null;
  errorVotos: number | null = null;

  detalleAbierto: number | null = null;
  busquedaDiputado = '';
  filtroSentido: SentidoVoto | 'todos' = 'todos';

  private id = '';

  constructor(
    private route: ActivatedRoute,
    private presidencia: PresidenciaService,
    private haptics: HapticsService,
  ) {}

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id') ?? '';
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.error = false;
    this.presidencia.detalleSesion(this.id).subscribe({
      next: s => { this.sesion = s; this.cargando = false; },
      error: () => { this.cargando = false; this.error = true; },
    });
  }

  // ── Encabezado ──

  get fechaLarga(): string {
    const f = aFechaLocal(this.sesion?.fecha);
    if (!f) return '';
    const t = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(f);
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  get conVideo(): number {
    return this.sesion?.puntos.filter(p => !!p.video_url).length ?? 0;
  }

  get puntos(): PuntoSesion[] {
    const p = this.sesion?.puntos ?? [];
    if (this.filtro === 'video') return p.filter(x => !!x.video_url);
    if (this.filtro === 'sin-video') return p.filter(x => !x.video_url);
    return p;
  }

  // ── Punto ──

  alternarTexto(p: PuntoSesion): void {
    this.textoAbierto.has(p.id) ? this.textoAbierto.delete(p.id) : this.textoAbierto.add(p.id);
  }

  alternarVideo(p: PuntoSesion): void {
    this.haptics.impact();
    this.videoAbierto = this.videoAbierto === p.id ? null : p.id;
  }

  alternarVotos(p: PuntoSesion): void {
    this.haptics.impact();
    if (this.votosAbierto === p.id) {
      this.votosAbierto = null;
      return;
    }
    this.votosAbierto = p.id;
    this.detalleAbierto = null;
    if (!this.votos[p.id]) this.cargarVotos(p.id);
  }

  cargarVotos(idPunto: number): void {
    this.cargandoVotos = idPunto;
    this.errorVotos = null;
    this.presidencia.votosPunto(idPunto).subscribe({
      next: v => {
        this.votos[idPunto] = v;
        this.conteos[idPunto] = this.contar(v);
        this.cargandoVotos = null;
      },
      error: () => { this.cargandoVotos = null; this.errorVotos = idPunto; },
    });
  }

  private contar(v: VotoDiputado[]): Conteo {
    const c: Conteo = { favor: 0, contra: 0, abst: 0, pendiente: 0, total: v.length };
    v.forEach(x => c[x.sentido]++);
    return c;
  }

  pct(n: number, total: number): number {
    return total ? (n / total) * 100 : 0;
  }


  // ── Detalle por diputado ──

  alternarDetalle(idPunto: number): void {
    this.busquedaDiputado = '';
    this.filtroSentido = 'todos';
    this.detalleAbierto = this.detalleAbierto === idPunto ? null : idPunto;
  }

  diputados(idPunto: number): VotoDiputado[] {
    const t = this.busquedaDiputado.trim().toLowerCase();
    return (this.votos[idPunto] ?? []).filter(v =>
      (this.filtroSentido === 'todos' || v.sentido === this.filtroSentido) &&
      (!t || v.diputado.toLowerCase().includes(t) || (v.partido ?? '').toLowerCase().includes(t)),
    );
  }
}
