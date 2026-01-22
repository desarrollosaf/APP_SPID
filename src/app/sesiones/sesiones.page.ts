import { Component, OnInit } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';


@Component({
  selector: 'app-sesiones',
  templateUrl: './sesiones.page.html',
  styleUrls: ['./sesiones.page.scss'],
  standalone: false,
})
export class SesionesPage implements OnInit {

  isModalOpen = false;
  pdfUrl!: SafeResourceUrl;


  constructor(private sanitizer: DomSanitizer) { }

  ngOnInit() {
  }

 
  openPdf(url: string) {
    this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
    this.isModalOpen = true;
  }

  setOpen(isOpen: boolean) {
    
     this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl('assets/OD-DELIBERANTE-DIP.PER-22ENERO2026.pdf');
    this.isModalOpen = isOpen;
  }

}
