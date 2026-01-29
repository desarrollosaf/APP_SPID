import { Component, OnInit } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Eventos } from '../service/eventos';
import { Sse } from '../service/sse';
import { interval, Subscription } from 'rxjs';
import { exhaustMap, distinctUntilChanged } from 'rxjs/operators';
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
  pdfUrl!: SafeResourceUrl;
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
    this.eventoSub = interval(1000)
       .pipe(
        exhaustMap(() => this.eventosService.getEvento()),
        distinctUntilChanged((prev, curr) => prev?.bandera === curr?.bandera)
      )
      .subscribe({
        next: (resp) => {
          this.evento = resp.bandera
          console.log(this.evento);
         
        },
        error: (err) => {
          console.error('Error al consultar evento', err);
        }
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

}
