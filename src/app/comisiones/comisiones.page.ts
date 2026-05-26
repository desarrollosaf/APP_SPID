import { Component, OnDestroy } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Eventos } from '../service/eventos';
import { User } from '../service/user';
import { interval, Subscription, of, timer } from 'rxjs';
import { catchError, distinctUntilChanged, exhaustMap } from 'rxjs/operators';
import { retry } from 'rxjs';

export interface Comision {
  id: number;
  nombre: string;
  rol: 'Presidente' | 'Secretario' | 'Vocal';
}

@Component({
  selector: 'app-comisiones',
  templateUrl: './comisiones.page.html',
  styleUrls: ['./comisiones.page.scss'],
  standalone: false,
})
export class ComisionesPage implements OnDestroy {

  // ── Datos estáticos (reemplazar con API cuando esté disponible) ──────
  readonly comisiones: Comision[] = [
    { id: 1, nombre: 'Comisión de Educación, Ciencia y Tecnología', rol: 'Presidente' },
    { id: 2, nombre: 'Comisión de Salud y Asistencia Social',        rol: 'Vocal'      },
    { id: 3, nombre: 'Comisión de Presupuesto y Cuenta Pública',     rol: 'Secretario' },
    { id: 4, nombre: 'Comisión de Seguridad Pública',                rol: 'Vocal'      },
    { id: 5, nombre: 'Comisión de Medio Ambiente y Ecología',        rol: 'Secretario' },
  ];

  // ── Estado de navegación ──────────────────────────────────────────────
  selectedComision: Comision | null = null;

  // ── Estado del evento ─────────────────────────────────────────────────
  evento: number = 0;
  temaVotacion: string = '';
  miVoto: string = '';
  asistenciaRegistrada: boolean = false;
  nombreDiputado: string = '';

  // ── Modal PDF ─────────────────────────────────────────────────────────
  isModalOpen = false;
  pdfUrl!: SafeResourceUrl;

  private eventoSub?: Subscription;

  constructor(
    private sanitizer: DomSanitizer,
    private eventosService: Eventos,
    private userService: User
  ) {}

  ngOnDestroy() {
    this.eventoSub?.unsubscribe();
  }

  // ── Seleccionar comisión ──────────────────────────────────────────────
  selectComision(comision: Comision) {
    this.selectedComision = comision;
    this.evento = 0;
    this.miVoto = '';
    this.asistenciaRegistrada = false;
    this.nombreDiputado = this.userService.currentUserValue?.nombre ?? '';
    this.iniciarPolling();
  }

  goBack() {
    this.eventoSub?.unsubscribe();
    this.selectedComision = null;
    this.evento = 0;
  }

  // ── Polling de evento ─────────────────────────────────────────────────
  private iniciarPolling() {
    this.eventoSub?.unsubscribe();

    this.eventoSub = interval(2000).pipe(
      exhaustMap(() =>
        this.eventosService.getEvento().pipe(
          retry({
            delay: (err, retryCount) => {
              if (err?.status !== 429) throw err;
              const waitMs = Math.min(5000 * Math.pow(2, retryCount - 1), 60000);
              console.warn(`429 Reintentando en ${waitMs / 1000}s...`);
              return timer(waitMs);
            }
          }),
          catchError(err => {
            console.error('Error getEvento (comisiones)', err);
            return of(null);
          })
        )
      ),
      distinctUntilChanged((prev: any, curr: any) => prev?.bandera === curr?.bandera)
    )
    .subscribe(resp => {
      if (!resp) return;
      const prevBandera = this.evento;
      this.evento = resp.bandera;

      if (resp.bandera === 2 && prevBandera !== 2) this.asistenciaRegistrada = false;
      if (resp.bandera === 3 && prevBandera !== 3) this.miVoto = '';

      this.temaVotacion = this.evento === 3 ? resp.tema : this.temaVotacion;
    });
  }

  // ── Acciones ──────────────────────────────────────────────────────────
  votar(tipo: string) {
    this.miVoto = tipo;
    const payload = {
      id: this.userService.currentUserValue?.id_diputado,
      sentido: tipo,
      id_comision: this.selectedComision?.id   // listo para la API
    };
    this.eventosService.saveVotacion(payload).subscribe({
      next: (r: any) => console.log('Votación comisión registrada:', r),
      error: (e: any) => console.error('Error votación comisión', e)
    });
  }

  registrarAsistencia() {
    const payload = {
      id: this.userService.currentUserValue?.id_diputado,
      id_comision: this.selectedComision?.id   // listo para la API
    };
    this.eventosService.saveAsistencia(payload).subscribe({
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

  // ── Getters de presentación ───────────────────────────────────────────
  rolIcono(rol: string): string {
    switch (rol) {
      case 'Presidente':  return 'star-outline';
      case 'Secretario':  return 'ribbon-outline';
      default:            return 'person-outline';
    }
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
