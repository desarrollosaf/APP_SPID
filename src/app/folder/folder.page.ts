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

  constructor(private userService: User) {}

  ngOnInit() {}

  ionViewWillEnter(): void {
    this.nombreDiputado = this.userService.nombreCompleto;
  }
}
