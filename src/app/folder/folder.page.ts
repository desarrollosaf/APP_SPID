import { Component, OnInit } from '@angular/core';
import { User } from '../service/user';

@Component({
  selector: 'app-folder',
  templateUrl: './folder.page.html',
  styleUrls: ['./folder.page.scss'],
  standalone: false,
})
export class FolderPage implements OnInit {
  nombreDiputado: string = '';

  constructor(private userService: User) {}

  ngOnInit() {
    this.nombreDiputado = this.userService.nombreCompleto;
  }
}
