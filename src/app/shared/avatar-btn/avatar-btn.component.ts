import { Component } from '@angular/core';
import { User } from '../../service/user';

/** Botón de perfil de la barra superior; abre "Mi perfil". */
@Component({
  selector: 'app-avatar-btn',
  template: `
    <a class="avatar-btn" routerLink="/perfil" aria-label="Mi perfil">
      <ion-icon name="person-circle"></ion-icon>
      @if (esPresidente) {
        <span class="avatar-badge"><ion-icon name="ribbon"></ion-icon></span>
      }
    </a>
  `,
  styles: [`
    :host { display: inline-flex; }
    .avatar-btn {
      position: relative;
      width: 44px;
      height: 44px;
      border-radius: 14px;
      background: var(--surface);
      box-shadow: var(--shadow-sm);
      display: flex;
      align-items: center;
      justify-content: center;
      text-decoration: none;
      transition: transform 0.12s ease;
    }
    .avatar-btn:active { transform: scale(0.94); }
    .avatar-btn > ion-icon { font-size: 30px; color: var(--brand); }
    .avatar-badge {
      position: absolute;
      right: -4px;
      bottom: -4px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: linear-gradient(135deg, #D9B26F, #A9823F);
      border: 2px solid var(--surface);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .avatar-badge ion-icon { font-size: 11px; color: #fff; }
  `],
  standalone: false,
})
export class AvatarBtnComponent {
  constructor(private userService: User) {}

  get esPresidente(): boolean {
    return this.userService.esPresidente;
  }
}
