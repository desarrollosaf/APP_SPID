import { Component } from '@angular/core';
import { AlertController, ViewWillEnter } from '@ionic/angular';
import { User } from '../service/user';
import { Eventos } from '../service/eventos';
import { LogoutService } from '../service/logout.service';

@Component({
  selector: 'app-perfil',
  templateUrl: './perfil.page.html',
  styleUrls: ['./perfil.page.scss'],
  standalone: false,
})
export class PerfilPage implements ViewWillEnter {
  nombre = '';
  usuario = '';
  esPresidente = false;
  enFuncionesDesde = '';
  grupo: { siglas: string; nombre: string; color: string; coordinador: boolean } | null = null;

  constructor(
    private userService: User,
    private eventos: Eventos,
    private logout: LogoutService,
    private alertCtrl: AlertController,
  ) {}

  ionViewWillEnter(): void {
    const u = this.userService.currentUserValue?.user;
    this.nombre = this.userService.nombreCompleto;
    this.usuario = u?.email || u?.name || '';
    this.esPresidente = this.userService.esPresidente;
    this.cargar();
  }

  get rol(): string {
    return this.esPresidente ? 'Presidencia de la JUCOPO' : 'Diputado(a)';
  }

  cargar(): void {
    this.eventos.getMiPerfil().subscribe({
      next: r => (this.enFuncionesDesde = this.fecha(r.integrante?.fecha_inicio)),
      error: () => {},
    });
    const miId = this.userService.integranteLegislaturaId;
    this.eventos.getGruposParlamentarios().subscribe({
      next: r => {
        const g = (r.grupos ?? []).find(x => x.integrantes.some(i => i.id === miId));
        if (!g) return;
        const yo = g.integrantes.find(i => i.id === miId);
        const sinPartido = !g.nombre || g.siglas.toLowerCase().includes('sin');
        this.grupo = {
          siglas: sinPartido ? 'Sin grupo parlamentario' : g.siglas,
          nombre: sinPartido ? '' : g.nombre ?? '',
          color: COLOR_PARTIDO[g.siglas.toLowerCase()] ?? 'var(--neutral)',
          coordinador: !!yo?.coordinador,
        };
      },
      error: () => {},
    });
  }

  private fecha(iso: string | null | undefined): string {
    const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
    if (!m) return '';
    const f = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }).format(f);
  }


  async cerrarSesion(): Promise<void> {
    const alerta = await this.alertCtrl.create({
      header: 'Cerrar sesión',
      message: '¿Quieres salir de tu cuenta?',
      buttons: [{ text: 'Cancelar', role: 'cancel' }, { text: 'Cerrar sesión', role: 'confirm' }],
    });
    await alerta.present();
    if ((await alerta.onDidDismiss()).role === 'confirm') this.logout.cerrarSesion();
  }
}

/** Color institucional de cada grupo parlamentario (por siglas). */
const COLOR_PARTIDO: Record<string, string> = {
  morena: '#A3123A',
  pan: '#0059A8',
  pri: '#008C45',
  pt: '#D8262B',
  pvem: '#3FA535',
  prd: '#E5B800',
  mc: '#F47B20',
};
