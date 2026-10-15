import { Component } from '@angular/core';
import { User } from '../service/user';

@Component({
  selector: 'app-tabs',
  templateUrl: './tabs.page.html',
  styleUrls: ['./tabs.page.scss'],
  standalone: false,
})
export class TabsPage {
  constructor(private userService: User) {}

  get esPresidente(): boolean {
    return this.userService.esPresidente;
  }
}
