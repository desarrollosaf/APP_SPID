import { Component, OnInit } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Eventos } from '../service/eventos';
import { interval, Subscription } from 'rxjs';
import { exhaustMap, distinctUntilChanged } from 'rxjs/operators';

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

  constructor(private sanitizer: DomSanitizer, private eventosService: Eventos) { }

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

  votar(tipo: number) {
    console.log('Voto:', tipo);
  }

  registrarAsistencia() {
    console.log('Asistencia registrada');
  }

}
