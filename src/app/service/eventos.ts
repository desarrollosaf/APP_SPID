import { Observable } from 'rxjs';
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { EstadoPanel, MiComision } from '../interface/user';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class Eventos {
  private http = inject(HttpClient);

  getEstadoPanel(idAgenda?: string): Observable<EstadoPanel> {
    const url = idAgenda
      ? `${environment.apiUrl}/diputado/estado-panel?idAgenda=${idAgenda}`
      : `${environment.apiUrl}/diputado/estado-panel`;
    return this.http.get<EstadoPanel>(url);
  }

  registrarAsistencia(data: { id_agenda: string; id_comision?: string }): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/diputado/registrar-asistencia`, data);
  }

  registrarVoto(data: { sentido_voto: number; id_voto_punto: string; id_comision?: string }): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/diputado/registrar-voto`, data);
  }

  getMisComisiones(): Observable<{ comisiones: MiComision[] }> {
    return this.http.get<{ comisiones: MiComision[] }>(`${environment.apiUrl}/diputado/mis-comisiones`);
  }

  getMiAsistencia(idAgenda: string): Observable<{ yaRegistro: boolean; sentido: number; mensaje: string }> {
    return this.http.get<any>(`${environment.apiUrl}/diputado/mi-asistencia/${idAgenda}`);
  }

  getOrdenDelDia(idAgenda: string): Observable<{ puntos: any[] }> {
    return this.http.get<any>(`${environment.apiUrl}/diputado/orden-del-dia/${idAgenda}`);
  }

  getMisVotos(idAgenda: string): Observable<{ votos: any[] }> {
    return this.http.get<any>(`${environment.apiUrl}/diputado/mis-votos/${idAgenda}`);
  }

  getSesionesComisionesActivas(): Observable<{ sesiones: { idAgenda: string; titulo: string; fecha: string; idComision: string; idComisiones?: string[] }[] }> {
    return this.http.get<any>(`${environment.apiUrl}/diputado/sesiones-comisiones-activas`);
  }

  getComisionInfo(idComision: string): Observable<{
    proximos: { id: string; descripcion: string; fecha: string; hora: string; fecha_hora: string }[];
    pasados:  { id: string; descripcion: string; fecha: string; hora: string; fecha_hora: string }[];
    integrantes: { id: string; nombre: string; cargo: string; orden: number }[];
  }> {
    return this.http.get<any>(`${environment.apiUrl}/diputado/comision/${idComision}/info`);
  }
}
