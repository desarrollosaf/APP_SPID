import { Observable } from 'rxjs';
import { Injectable, signal, inject, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class Eventos {
  private http = inject( HttpClient );

  private myAppUrl: string;
  private myAPIUrl: string;

   constructor() {
    this.myAppUrl = 'https://spidplem.gob.mx/';
    this.myAPIUrl ='api';
  }

  getEvento(): Observable<any> {
    return this.http.get<any>(`${this.myAppUrl}${this.myAPIUrl}/validacionEvento`)
  }

  saveAsistencia(data: any ): Observable<any> {
    return this.http.post<any>(`${this.myAppUrl}${this.myAPIUrl}/asistenciaDip`, data)
  }

  saveVotacion(data: any ): Observable<any> {
    return this.http.post<any>(`${this.myAppUrl}${this.myAPIUrl}/votoDip`, data)
  }

}
