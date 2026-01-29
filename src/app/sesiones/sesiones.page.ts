import { Component, OnInit } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Eventos } from '../service/eventos';
import { Sse } from '../service/sse';
import { interval, Subscription, of, timer } from 'rxjs';
import { catchError, distinctUntilChanged, exhaustMap, retryWhen, scan, switchMap } from 'rxjs/operators';
import { User } from '../service/user'

@Component({
  selector: 'app-sesiones',
  templateUrl: './sesiones.page.html',
  styleUrls: ['./sesiones.page.scss'],
  standalone: false,
})
export class SesionesPage implements OnInit {

  isModalOpen = false;
  evento: number = 0;
  temaVotacion: string  = '';
  pdfUrl!: SafeResourceUrl;
  miVoto: string = '';
  private eventoSub!: Subscription;

  constructor(private sanitizer: DomSanitizer, private eventosService: Eventos, private userService: User, private sseService: Sse) { }

  // ionViewDidEnter() {
  //   this.eventoSub = this.sseService.streamEvento().pipe(
  //     distinctUntilChanged((a, b) => a?.bandera === b?.bandera && a?.tema === b?.tema)
  //   ).subscribe({
  //     next: (resp) => {
  //       this.evento = resp.bandera;
  //       //this.tema = resp.tema ?? null;
  //       console.log('evento:', resp);
  //     },
  //     error: (err) => console.error('SSE error', err)
  //   });
  // }

  // ionViewWillLeave() {
  //   this.eventoSub?.unsubscribe();
  // }

  ngOnInit() {
    this.eventoSub = interval(2000).pipe(
      exhaustMap(() =>
        this.eventosService.getEvento().pipe(
          retryWhen(errors =>
            errors.pipe(
              // contamos reintentos y calculamos espera
              scan((acc, err) => {
                const status = err?.status;
                if (status !== 429) throw err; // si NO es 429, que reviente normal
                return acc + 1;
              }, 0),
              switchMap(retryCount => {
                // backoff: 5s, 10s, 20s, 40s (tope 60s)
                const waitMs = Math.min(5000 * Math.pow(2, retryCount - 1), 60000);
                console.warn(`429 Too Many Requests. Reintentando en ${waitMs / 1000}s...`);
                return timer(waitMs);
              })
            )
          ),
          catchError(err => {
            // si quieres: no romper todo; solo log y continuar
            console.error('Error getEvento', err);
            return of(null); // evita que se caiga el stream
          })
        )
      ),
      distinctUntilChanged((prev: any, curr: any) => prev?.bandera === curr?.bandera)
    )
    .subscribe(resp => {
      if (!resp) return;
      this.evento = resp.bandera;
      this.temaVotacion = this.evento === 3 ? resp.tema : this.temaVotacion;
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

  votar(tipo: string) {
    console.log('Voto:', tipo);
    this.miVoto = tipo;
    const votacion = {
      id: this.userService.currentUserValue?.id_diputado,
      sentido: tipo
    };

    this.eventosService.saveVotacion(votacion).subscribe({
      next: (response: any) => {
        const data = response;
        console.log('votacion registrada');
        console.log('mensaje:', data);
      },
      error: (err) => {
        console.error('Error al registrar votacion', err);
      }
    });
  }

  registrarAsistencia() {
    
    const asistencia = {
      id: this.userService.currentUserValue?.id_diputado,
    };

    this.eventosService.saveAsistencia(asistencia).subscribe({
      next: (response: any) => {
        const data = response;
        console.log('Asistencia registrada');
        console.log('mensaje:', data);
      },
      error: (err) => {
        console.error('Error al registrar asistencia', err);
      }
    });
    console.log('Asistencia registrada');
  }

  get miVotoLabel() {
  switch (this.miVoto) {
    case 'FAVOR': return 'A Favor';
    case 'CONTRA': return 'En Contra';
    case 'ABSTENCION': return 'Abstención';
    case 'SIN REGISTRO': return 'Sin Registro';
    default: return '';
  }
}

}
