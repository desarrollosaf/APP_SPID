import { Component, OnDestroy } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AlertController, ToastController, ViewWillEnter, ViewWillLeave } from '@ionic/angular';
import { User } from '../../service/user';
import { HapticsService } from '../../service/haptics.service';
import { SocketService } from '../../service/socket.service';
import {
  EstadoEvento, EventoAgenda, PresidenciaService, ResumenAgenda,
  aFechaLocal, aIso, avanceEvento, estadoEvento, faltaPara, sumarDias,
} from '../../service/presidencia.service';

const DIAS_TIRA = 14;

interface DiaTira { iso: string; letra: string; dia: number; eventos: number; hoy: boolean }

@Component({
  selector: 'app-inicio',
  templateUrl: './panel.page.html',
  styleUrls: ['./panel.page.scss'],
  standalone: false,
})
export class PanelPresidenciaPage implements ViewWillEnter, ViewWillLeave, OnDestroy {
  nombre = '';
  ahora = new Date();
  resumen: ResumenAgenda | null = null;
  cargando = true;
  errorAgenda = false;

  /** Día elegido en la tira (yyyy-mm-dd) o 'todos' para ver todo lo que viene. */
  seleccion = aIso(new Date());
  busqueda = '';

  calendarioAbierto = false;
  mesVisible = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  readonly diasSemana = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

  // Notificar al congreso
  enviando = false;
  p6: 'consultando' | 'conectado' | 'desconectado' | 'sin-conexion' = 'consultando';

  /** Sesión del Pleno en curso (llega por el socket); resalta el acceso "Sesión del Pleno". */
  sesionPleno: { titulo: string; idAgenda: string } | null = null;

  private reloj?: ReturnType<typeof setInterval>;
  private dejarDeEscuchar?: () => void;

  constructor(
    private userService: User,
    private presidencia: PresidenciaService,
    private haptics: HapticsService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private socketService: SocketService,
  ) {}

  ionViewWillEnter(): void {
    this.nombre = this.userService.nombreCompleto;
    this.ahora = new Date();
    this.reloj = setInterval(() => (this.ahora = new Date()), 1000);
    if (!this.resumen) this.cargar();
    if (this.esPresidente) this.consultarP6();

    this.socketService.conectarComoDiputado(this.userService.integranteLegislaturaId);
    this.dejarDeEscuchar?.();
    this.dejarDeEscuchar = this.socketService.escucharSesionPlenaria(s => (this.sesionPleno = s));
  }

  ionViewWillLeave(): void {
    clearInterval(this.reloj);
    this.dejarDeEscuchar?.();
    this.dejarDeEscuchar = undefined;
  }

  ngOnDestroy(): void {
    clearInterval(this.reloj);
    this.dejarDeEscuchar?.();
  }

  cargar(refrescar = false, refresher?: { complete: () => void }): void {
    this.errorAgenda = false;
    if (!refresher) this.cargando = true;
    this.presidencia.resumen(refrescar).subscribe({
      next: r => { this.resumen = r; this.cargando = false; refresher?.complete(); },
      error: () => { this.cargando = false; this.errorAgenda = true; refresher?.complete(); },
    });
  }

  refrescar(ev: Event): void {
    this.cargar(true, ev.target as unknown as { complete: () => void });
  }

  /** Inicio es el mismo para todos; Presidencia ve además Notificar, indicadores, sesiones, salones y agenda. */
  get esPresidente(): boolean {
    return this.userService.esPresidente;
  }

  // ── Encabezado ──

  get saludo(): string {
    const h = this.ahora.getHours();
    return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  }

  get hora(): string {
    return new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false }).format(this.ahora);
  }

  get segundos(): string {
    return this.ahora.getSeconds().toString().padStart(2, '0');
  }

  get fechaLarga(): string {
    const t = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }).format(this.ahora);
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  // ── Ahora en el Congreso ──

  private get eventosHoy(): EventoAgenda[] {
    return this.resumen?.eventosHoy ?? [];
  }

  get enCurso(): EventoAgenda[] {
    return this.eventosHoy.filter(e => estadoEvento(e, this.ahora) === 'en-curso');
  }

  /** Siguiente evento: el próximo de hoy o, si ya no hay, el primero de los próximos días. */
  get siguiente(): EventoAgenda | null {
    return this.eventosHoy.find(e => estadoEvento(e, this.ahora) === 'proximo')
      ?? this.resumen?.proximosEventos[0] ?? null;
  }

  cuando(e: EventoAgenda): string {
    if (e.fecha === aIso(this.ahora)) return `Empieza ${faltaPara(e, this.ahora)}`;
    return `${this.fechaDia(e.fecha)} · ${e.horaInicio}`;
  }

  avance(e: EventoAgenda): number { return avanceEvento(e, this.ahora); }
  estado(e: EventoAgenda): EstadoEvento { return estadoEvento(e, this.ahora); }

  // ── Agenda ──

  private get todos(): EventoAgenda[] {
    return this.resumen ? [...this.resumen.eventosHoy, ...this.resumen.proximosEventos] : [];
  }

  get diasTira(): DiaTira[] {
    const hoy = aIso(new Date());
    const letras = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
    return Array.from({ length: DIAS_TIRA }, (_, i) => {
      const d = sumarDias(new Date(), i);
      const iso = aIso(d);
      return { iso, letra: letras[d.getDay()], dia: d.getDate(), eventos: this.todos.filter(e => e.fecha === iso).length, hoy: iso === hoy };
    });
  }

  puntos(n: number): number[] {
    return Array(Math.min(n, 3)).fill(0);
  }

  elegir(seleccion: string): void {
    this.haptics.impact();
    this.seleccion = seleccion;
  }

  get eventos(): EventoAgenda[] {
    const porFecha = this.seleccion === 'todos'
      ? this.todos
      : (this.resumen?.todos ?? []).filter(e => e.fecha === this.seleccion);
    const texto = this.busqueda.trim().toLowerCase();
    if (!texto) return porFecha;
    return porFecha.filter(e => e.titulo.toLowerCase().includes(texto) || e.ubicacion.toLowerCase().includes(texto));
  }

  /** Separador de fecha cuando la lista abarca varios días. */
  mostrarFecha(i: number): boolean {
    if (this.seleccion !== 'todos') return false;
    const lista = this.eventos;
    return i === 0 || lista[i].fecha !== lista[i - 1].fecha;
  }

  get tituloLista(): string {
    return this.seleccion === 'todos' ? 'Todo lo que viene' : this.fechaDia(this.seleccion);
  }

  fechaDia(fechaIso: string): string {
    const f = aFechaLocal(fechaIso);
    if (!f) return '';
    if (fechaIso === aIso(new Date())) return 'Hoy';
    if (fechaIso === aIso(sumarDias(new Date(), 1))) return 'Mañana';
    const t = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }).format(f);
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  // ── Calendario del mes ──

  get etiquetaMes(): string {
    const t = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(this.mesVisible);
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  get diasDelMes(): (Date | null)[] {
    const m = this.mesVisible;
    const offset = (new Date(m.getFullYear(), m.getMonth(), 1).getDay() + 6) % 7; // semana inicia en lunes
    const total = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    const celdas: (Date | null)[] = Array(offset).fill(null);
    for (let d = 1; d <= total; d++) celdas.push(new Date(m.getFullYear(), m.getMonth(), d));
    return celdas;
  }

  cambiarMes(delta: number): void {
    this.mesVisible = new Date(this.mesVisible.getFullYear(), this.mesVisible.getMonth() + delta, 1);
  }

  esHoy(d: Date): boolean { return aIso(d) === aIso(new Date()); }
  esSeleccionado(d: Date): boolean { return this.seleccion === aIso(d); }
  tieneEvento(d: Date): boolean { return !!this.resumen?.diasConEventos.includes(aIso(d)); }

  elegirDia(d: Date): void {
    this.elegir(aIso(d));
    this.calendarioAbierto = false;
  }

  // ── Notificar al congreso ──

  /** Lee si el puente del P-6 está en línea (no toca ningún sonido). */
  consultarP6(): void {
    this.p6 = 'consultando';
    this.presidencia.estadoP6().subscribe({
      next: e => (this.p6 = e.conectado ? 'conectado' : 'desconectado'),
      error: () => (this.p6 = 'sin-conexion'),
    });
  }

  get subtituloNotificar(): string {
    if (this.enviando) return 'Enviando el aviso sonoro…';
    return {
      consultando: 'Revisando el P-6…',
      conectado: 'P-6 en línea · Envía el aviso al Pleno',
      desconectado: 'P-6 sin conexión',
      'sin-conexion': 'No se pudo revisar el P-6',
    }[this.p6];
  }

  private mensajeError(e: HttpErrorResponse): string {
    if (e.status === 0) return 'Sin conexión. Revisa tu red.';
    const m = e.error?.message ?? e.error?.msg;
    return (Array.isArray(m) ? m.join(', ') : m) || 'No se pudo enviar el aviso al P-6.';
  }

  async notificar(): Promise<void> {
    if (this.enviando) return;

    const alerta = await this.alertCtrl.create({
      header: 'Notificar al congreso',
      message: this.p6 === 'desconectado'
        ? 'El P-6 aparece sin conexión. ¿Intentar enviar el aviso sonoro de todos modos?'
        : 'Se enviará el aviso sonoro al Pleno.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Enviar aviso', role: 'confirm' },
      ],
    });
    await alerta.present();
    if ((await alerta.onDidDismiss()).role !== 'confirm') return;

    this.enviando = true;
    this.haptics.impact();
    this.presidencia.notificarCongreso().subscribe({
      next: () => {
        this.enviando = false;
        this.haptics.success();
        this.toast('Notificación enviada al congreso.', 'success');
        this.p6 = 'conectado';
      },
      error: (e: HttpErrorResponse) => {
        this.enviando = false;
        this.haptics.error();
        this.toast(this.mensajeError(e), 'danger');
        this.consultarP6();
      },
    });
  }

  private async toast(message: string, color: 'success' | 'danger' | 'warning'): Promise<void> {
    const t = await this.toastCtrl.create({ message, color, duration: 2600, position: 'top' });
    await t.present();
  }
}
