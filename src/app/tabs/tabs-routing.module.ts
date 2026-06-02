import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { TabsPage } from './tabs.page';

const routes: Routes = [
  {
    path: '',
    component: TabsPage,
    children: [
      {
        path: 'inicio',
        loadChildren: () => import('../folder/folder.module').then(m => m.FolderPageModule)
      },
      {
        path: 'sesiones',
        loadChildren: () => import('../sesiones/sesiones.module').then(m => m.SesionesPageModule)
      },
      {
        path: 'comisiones',
        loadChildren: () => import('../comisiones/comisiones.module').then(m => m.ComisionesPageModule)
      },
      { path: '', redirectTo: 'inicio', pathMatch: 'full' }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class TabsPageRoutingModule {}
