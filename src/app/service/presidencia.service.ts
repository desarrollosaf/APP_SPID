import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map, shareReplay, tap } from 'rxjs';
import { environment } from '../../environments/environment';

// Módulo de Presidencia, portado de SIPresidencia (angular/SIPresidencia).
// - Agenda y salones: API pública de agenda del Congreso.
// - Sesiones, orden del día, votos y videos: API pública de Registro Parlamentario (misma API que SPID).
// - Botón "Notificar al congreso": backend de SPID (/api/presidencia/p6), con la misma sesión.

// ── Agenda ────────────────────────────────────────────────────────────

export type ColorEvento = 'brand' | 'accent' | 'ok' | 'info';

export interface EventoAgenda {
  id: string;
  titulo: string;
  descripcion: string;
  fecha: string;          // yyyy-mm-dd
  horaInicio: string;     // HH:mm
  horaFin: string | null;
  ubicacion: string;
  tipo: string;
  color: ColorEvento;
}

export interface ResumenAgenda {
  totales: { eventosHoy: number; proximosEventos: number; salonesOcupados: number; salonesDisponibles: number };
  eventosHoy: EventoAgenda[];
  proximosEventos: EventoAgenda[];
  /** Todos los eventos que trae la agenda, incluidos días pasados. */
  todos: EventoAgenda[];
  diasConEventos: string[];
}

export interface SalonAgenda {
  id: number;
  nombre: string;
  color: string;
  eventos: EventoAgenda[];
}

interface EventoAgendaApi {
  hora_inicio: string;
  hora_termino: string | null;
  sede: string;
  titulo: string;
  descripcion: string | null;
  evento: string | null;
  materia: string | null;
  modalidad: string | null;
  tipo_reunion: string | null;
}

interface AgendaApiResponse {
  success: boolean;
  agenda: Record<string, EventoAgendaApi[]>;
  sedes: { id: number; salon: string; color: string; agenda: { fecha_inicio: string }[] }[];
}

// El folio identifica trámites internos (p. ej. "18001/3383/2026"); si el título trae eso, usamos tipo_reunion.
const FOLIO = /^\d+\/\d+\/\d+$/;

function categoriaDe(ev: EventoAgendaApi): string {
  if (ev.titulo && !FOLIO.test(ev.titulo)) return ev.titulo;
  return ev.tipo_reunion ?? 'Evento institucional';
}

function colorDe(categoria: string): ColorEvento {
  const t = categoria.toLowerCase();
  if (t.includes('sesión') || t.includes('sesion')) return 'brand';
  if (t.includes('comisión') || t.includes('comision')) return 'ok';
  if (t.includes('otro') || t.includes('privad')) return 'info';
  return 'accent';
}

function mapEvento(fecha: string, ev: EventoAgendaApi, i: number): EventoAgenda {
  const categoria = categoriaDe(ev);
  const titulo = ev.descripcion || ev.evento || categoria;
  let descripcion = '';
  if (ev.materia && ev.materia !== titulo) descripcion = ev.materia;
  else if (ev.modalidad) descripcion = `Modalidad: ${ev.modalidad}`;
  return {
    id: `${fecha}-${i}`,
    titulo,
    descripcion,
    fecha,
    horaInicio: ev.hora_inicio?.slice(11, 16) || '—',
    horaFin: ev.hora_termino?.slice(11, 16) || null,
    ubicacion: ev.sede,
    tipo: categoria,
    color: colorDe(categoria),
  };
}

const porFechaYHora = (a: EventoAgenda, b: EventoAgenda) =>
  a.fecha === b.fecha ? a.horaInicio.localeCompare(b.horaInicio) : a.fecha.localeCompare(b.fecha);

export function aIso(fecha: Date): string {
  const m = (fecha.getMonth() + 1).toString().padStart(2, '0');
  const d = fecha.getDate().toString().padStart(2, '0');
  return `${fecha.getFullYear()}-${m}-${d}`;
}

export function sumarDias(base: Date, dias: number): Date {
  const copia = new Date(base);
  copia.setDate(copia.getDate() + dias);
  return copia;
}

/** new Date('yyyy-mm-dd') se interpreta como UTC y se corre un día; esto la toma como fecha local. */
export function aFechaLocal(fechaIso: string | null | undefined): Date | null {
  const m = fechaIso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(fechaIso) : null;
  if (!m) return null;
  const fecha = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

export type EstadoEvento = 'pasado' | 'en-curso' | 'proximo';

const minutosDelDia = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + (m || 0); };

/** Estado del evento respecto a este momento. Sin hora de fin se asume 1 hora de duración. */
export function estadoEvento(e: EventoAgenda, ahora: Date): EstadoEvento {
  const hoy = aIso(ahora);
  if (e.fecha < hoy) return 'pasado';
  if (e.fecha > hoy || !/^\d{2}:\d{2}$/.test(e.horaInicio)) return 'proximo';
  const min = ahora.getHours() * 60 + ahora.getMinutes();
  const inicio = minutosDelDia(e.horaInicio);
  const fin = e.horaFin ? minutosDelDia(e.horaFin) : inicio + 60;
  if (min < inicio) return 'proximo';
  return min <= fin ? 'en-curso' : 'pasado';
}

/** Porcentaje transcurrido (0-100) de un evento en curso. */
export function avanceEvento(e: EventoAgenda, ahora: Date): number {
  const inicio = minutosDelDia(e.horaInicio);
  const fin = e.horaFin ? minutosDelDia(e.horaFin) : inicio + 60;
  const min = ahora.getHours() * 60 + ahora.getMinutes() + ahora.getSeconds() / 60;
  return Math.max(0, Math.min(100, ((min - inicio) / Math.max(fin - inicio, 1)) * 100));
}

/** "en 25 min", "en 2 h 10 min" para un evento de hoy. */
export function faltaPara(e: EventoAgenda, ahora: Date): string {
  const faltan = minutosDelDia(e.horaInicio) - (ahora.getHours() * 60 + ahora.getMinutes());
  if (faltan <= 0) return 'en un momento';
  if (faltan < 60) return `en ${faltan} min`;
  const h = Math.floor(faltan / 60), m = faltan % 60;
  return m ? `en ${h} h ${m} min` : `en ${h} h`;
}

function todosLosEventos(resp: AgendaApiResponse): EventoAgenda[] {
  const porDia = Object.keys(resp.agenda).sort().map(fecha => resp.agenda[fecha].map((ev, i) => mapEvento(fecha, ev, i)));
  return ([] as EventoAgenda[]).concat(...porDia);
}

// ── Registro Parlamentario ────────────────────────────────────────────

export interface SesionResumen {
  id: string;
  descripcion: string | null;
  fecha: string;
  tipoevento: string | null;
}

export interface PuntoSesion {
  id: number;
  nopunto: number | null;
  punto: string;
  video_url: string | null;
}

export interface SesionDetalle {
  id: string;
  fecha: string | null;
  hora: string | null;
  descripcion: string | null;
  puntos: PuntoSesion[];
}

export type SentidoVoto = 'favor' | 'contra' | 'abst' | 'pendiente';

export interface VotoDiputado {
  diputado: string;
  partido: string | null;
  sentido: SentidoVoto;
  etiqueta: string;
}

/** El texto (`mensaje`) es la fuente confiable; el código numérico solo se usa si no viene texto. */
function sentidoDe(mensaje: string | null | undefined, codigo: unknown): SentidoVoto {
  const t = (mensaje ?? '').toUpperCase();
  if (t.includes('FAVOR')) return 'favor';
  if (t.includes('CONTRA')) return 'contra';
  if (t.includes('ABST')) return 'abst';
  if (t) return 'pendiente';
  // Mismos códigos con los que SPID registra el voto: 1 favor, 2 abstención, 3 en contra.
  return ({ 1: 'favor', 2: 'abst', 3: 'contra' } as Record<number, SentidoVoto>)[Number(codigo)] ?? 'pendiente';
}

const ETIQUETA_SENTIDO: Record<SentidoVoto, string> = {
  favor: 'A favor', contra: 'En contra', abst: 'Abstención', pendiente: 'Pendiente',
};


@Injectable({ providedIn: 'root' })
export class PresidenciaService {
  private http = inject(HttpClient);
  private cfg = environment.presidencia;
  private registroUrl = `${environment.apiUrl}/eventos`;
  private agenda$?: Observable<AgendaApiResponse>;

  // ── Agenda ──

  /** La misma respuesta trae agenda por día y por salón; se comparte entre pantallas. */
  private agenda(refrescar = false): Observable<AgendaApiResponse> {
    if (!this.agenda$ || refrescar) {
      this.agenda$ = this.http.get<AgendaApiResponse>(this.cfg.agendaApiUrl).pipe(shareReplay(1));
    }
    return this.agenda$;
  }

  resumen(refrescar = false): Observable<ResumenAgenda> {
    return this.agenda(refrescar).pipe(map(resp => {
      const hoy = aIso(new Date());
      const limite = aIso(sumarDias(new Date(), 7));
      const eventos = todosLosEventos(resp);
      const proximos = eventos.filter(e => e.fecha > hoy).sort(porFechaYHora);
      return {
        totales: {
          eventosHoy: eventos.filter(e => e.fecha === hoy).length,
          proximosEventos: proximos.filter(e => e.fecha <= limite).length,
          salonesOcupados: resp.sedes.filter(s => s.agenda.some(a => a.fecha_inicio === hoy)).length,
          salonesDisponibles: resp.sedes.length,
        },
        eventosHoy: eventos.filter(e => e.fecha === hoy).sort(porFechaYHora),
        proximosEventos: proximos,
        todos: [...eventos].sort(porFechaYHora),
        diasConEventos: Object.keys(resp.agenda),
      };
    }));
  }

  salones(refrescar = false): Observable<SalonAgenda[]> {
    return this.agenda(refrescar).pipe(map(resp => {
      const eventos = todosLosEventos(resp);
      return resp.sedes
        .filter(s => s.salon && s.salon !== 'N/A')
        .map(s => ({
          id: s.id,
          nombre: s.salon,
          color: s.color,
          eventos: eventos.filter(e => e.ubicacion === s.salon).sort(porFechaYHora),
        }));
    }));
  }

  // ── Sesiones ──

  ultimasSesiones(): Observable<SesionResumen[]> {
    return this.http.get<{ data: SesionResumen[] }>(`${this.registroUrl}/ultimoseventos/1`)
      .pipe(map(r => r.data ?? []));
  }

  sesionesPorFecha(fecha: string): Observable<SesionResumen[]> {
    return this.http.get<{ eventos?: any[] }>(`${this.registroUrl}/getagendaHoy/${fecha}`).pipe(
      map(r => (r.eventos ?? []).map(ev => ({
        id: ev.id,
        descripcion: ev.descripcion || ev.titulo || null,
        fecha: ev.fecha,
        tipoevento: typeof ev.tipoevento === 'object' ? (ev.tipoevento?.nombre ?? null) : (ev.tipoevento ?? null),
      }))),
    );
  }

  detalleSesion(id: string): Observable<SesionDetalle> {
    return forkJoin({
      agenda: this.http.get<any>(`${this.registroUrl}/getagenda/${id}`),
      // getpuntos regresa { message, data, selectini }
      puntos: this.http.get<{ data?: PuntoSesion[] }>(`${this.registroUrl}/getpuntos/${id}`),
    }).pipe(map(({ agenda, puntos }) => ({ ...(agenda ?? {}), puntos: puntos?.data ?? [] })));
  }

  votosPunto(idPunto: number): Observable<VotoDiputado[]> {
    return this.http.post<{ integrantes?: any[] }>(`${this.registroUrl}/getvotospunto/`, { idPunto }).pipe(
      map(r => (r.integrantes ?? []).map(i => {
        const sentido = sentidoDe(i.mensaje, i.sentido);
        return { diputado: i.diputado ?? '—', partido: i.partido ?? null, sentido, etiqueta: ETIQUETA_SENTIDO[sentido] };
      })),
    );
  }

  // ── Notificar al congreso (Roland P-6) ──
  // El backend de SPID reenvía la orden por Socket.IO al puente (Raspberry Pi) que tiene el P-6 por USB.
  // Usa la misma sesión de SPID; el backend solo lo permite a los usuarios de Presidencia.

  /** Solo consulta si el puente del P-6 está en línea; no toca ningún sonido. */
  estadoP6(): Observable<{ conectado: boolean; puentes: number }> {
    return this.http.get<{ conectado: boolean; puentes: number }>(`${environment.apiUrl}/presidencia/p6/estado`);
  }

  notificarCongreso(): Observable<{ ok: boolean; puentes: number }> {
    const { bank, pad } = this.cfg.p6Pad;
    return this.http.post<{ ok: boolean; puentes: number }>(`${environment.apiUrl}/presidencia/p6/pad`, { bank, pad, velocity: 100 });
  }
}
