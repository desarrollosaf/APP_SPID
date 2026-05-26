import { Component, OnInit, OnDestroy } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Eventos } from '../service/eventos';
import { interval, Subscription, of, timer } from 'rxjs';
import { catchError, distinctUntilChanged, exhaustMap } from 'rxjs/operators';
import { retry } from 'rxjs';
import { User } from '../service/user';

@Component({
  selector: 'app-sesiones',
  templateUrl: './sesiones.page.html',
  styleUrls: ['./sesiones.page.scss'],
  standalone: false,
})
export class SesionesPage implements OnInit, OnDestroy {

  isModalOpen = false;
  evento: number = 0;
  temaVotacion: string = '';
  pdfUrl!: SafeResourceUrl;
  miVoto: string = '';
  nombreDiputado: string = '';
  asistenciaRegistrada: boolean = false;

  private eventoSub!: Subscription;

  constructor(
    private sanitizer: DomSanitizer,
    private eventosService: Eventos,
    private userService: User
  ) {}

  ngOnInit() {
    this.nombreDiputado = this.userService.currentUserValue?.nombre ?? '';

    this.eventoSub = interval(2000).pipe(
      exhaustMap(() =>
        this.eventosService.getEvento().pipe(
          retry({
            delay: (err, retryCount) => {
              if (err?.status !== 429) throw err;
              const waitMs = Math.min(5000 * Math.pow(2, retryCount - 1), 60000);
              console.warn(`429 Too Many Requests. Reintentando en ${waitMs / 1000}s...`);
              return timer(waitMs);
            }
          }),
          catchError(err => {
            console.error('Error getEvento', err);
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

      if (resp.bandera === 2 && prevBandera !== 2) {
        this.asistenciaRegistrada = false;
      }
      if (resp.bandera === 3 && prevBandera !== 3) {
        this.miVoto = '';
      }

      this.temaVotacion = this.evento === 3 ? resp.tema : this.temaVotacion;
    });
  }

  ngOnDestroy() {
    this.eventoSub?.unsubscribe();
  }

  openPdf(url: string) {
    this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
    this.isModalOpen = true;
  }

  setOpen(isOpen: boolean) {
    this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl('assets/OD-DELIBERANTE-DIP.PER-22ENERO2026.pdf');
    this.isModalOpen = isOpen;
  }

  votar(tipo: string) {
    this.miVoto = tipo;
    const votacion = {
      id: this.userService.currentUserValue?.id_diputado,
      sentido: tipo
    };

    this.eventosService.saveVotacion(votacion).subscribe({
      next: (response: any) => console.log('Votación registrada:', response),
      error: (err) => console.error('Error al registrar votación', err)
    });
  }

  registrarAsistencia() {
    const asistencia = { id: this.userService.currentUserValue?.id_diputado };

    this.eventosService.saveAsistencia(asistencia).subscribe({
      next: (response: any) => {
        this.asistenciaRegistrada = true;
        console.log('Asistencia registrada:', response);
      },
      error: (err) => console.error('Error al registrar asistencia', err)
    });
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
