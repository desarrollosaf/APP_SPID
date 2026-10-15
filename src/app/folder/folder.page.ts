import { Component, OnInit } from '@angular/core';
import { ViewWillEnter } from '@ionic/angular';
import { User } from '../service/user';

@Component({
  selector: 'app-folder',
  templateUrl: './folder.page.html',
  styleUrls: ['./folder.page.scss'],
  standalone: false,
})
export class FolderPage implements OnInit, ViewWillEnter {
  nombreDiputado: string = '';
  fechaHoy: string = '';

  constructor(private userService: User) {}

  ngOnInit() {}

  ionViewWillEnter(): void {
    this.nombreDiputado = this.userService.nombreCompleto;
    const fecha = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
    this.fechaHoy = fecha.charAt(0).toUpperCase() + fecha.slice(1);
  }
}
