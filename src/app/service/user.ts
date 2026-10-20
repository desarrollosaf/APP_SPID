import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';
import { Users } from '../interface/user';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class User {

  private http = inject(HttpClient);
  private currentUserSubject = new BehaviorSubject<Users | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  /** Presidencia = quien preside la Junta de Coordinación Política (se recalcula con sus comisiones). */
  private presidenteSubject = new BehaviorSubject<boolean>(localStorage.getItem('esPresidente') === '1');
  public esPresidente$ = this.presidenteSubject.asObservable();

  constructor() {
    this.limpiarTokenInvalido();
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      try {
        const user: Users = JSON.parse(storedUser);
        // Si el token guardado en el user object es válido, refresca authToken
        if (user?.token && user.token !== 'undefined' && user.token.length > 20) {
          localStorage.setItem('authToken', user.token);
          this.currentUserSubject.next(user);
          this.verificarPresidencia().subscribe();
        } else {
          // Sesión guardada sin token válido — forzar nuevo login
          this.clearSession();
        }
      } catch {
        this.clearSession();
      }
    }
  }

  private limpiarTokenInvalido(): void {
    const raw = localStorage.getItem('authToken');
    if (raw && (raw === 'undefined' || raw === 'null' || raw.length < 20)) {
      localStorage.removeItem('authToken');
    }
  }

  private clearSession(): void {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('isLoggedin');
    localStorage.removeItem('esPresidente');
    this.presidenteSubject.next(false);
    this.currentUserSubject.next(null);
  }

  login(data: { name: string; password: string }): Observable<Users> {
    return this.http.post<Users>(`${environment.apiUrl}/user/login`, data).pipe(
      tap((response: Users) => {
        localStorage.setItem('authToken', response.token);
        this.setCurrentUser(response);
        this.verificarPresidencia().subscribe();
      })
    );
  }

  changePassword(data: { newPassword: string }): Observable<any> {
    return this.http.post(`${environment.apiUrl}/user/change-password`, data);
  }

  logout(): Observable<any> {
    // Limpiar sesión inmediatamente sin esperar respuesta del servidor
    this.clearSession();
    return this.http.post(`${environment.apiUrl}/user/cerrarsesion`, {});
  }

  get currentUserValue(): Users | null {
    return this.currentUserSubject.value;
  }

  get token(): string | null {
    return localStorage.getItem('authToken');
  }

  get integranteLegislaturaId(): string | null {
    return this.currentUserValue?.user?.integrante_legislatura_id ?? null;
  }

  get nombreCompleto(): string {
    const u = this.currentUserValue?.user;
    return u?.nombreCompleto ?? u?.name ?? '';
  }

  /** Vista de Presidencia: preside la Junta de Coordinación Política. */
  get esPresidente(): boolean {
    return this.presidenteSubject.value;
  }

  /** Consulta las comisiones del diputado y actualiza si preside la JUCOPO.
   *  Si la consulta falla se conserva el último valor conocido. */
  verificarPresidencia(): Observable<boolean> {
    if (!this.currentUserValue) return of(false);
    return this.http.get<{ comisiones: { nombre: string; cargo: string }[] }>(`${environment.apiUrl}/diputado/mis-comisiones`).pipe(
      map(r => (r.comisiones ?? []).some(esPresidenciaJucopo)),
      tap(es => {
        localStorage.setItem('esPresidente', es ? '1' : '0');
        this.presidenteSubject.next(es);
      }),
      catchError(() => of(this.presidenteSubject.value)),
    );
  }

  setCurrentUser(user: Users) {
    this.currentUserSubject.next(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
  }
}

/** Preside la JUCOPO. El cargo debe EMPEZAR con "presiden" para no contar "Vicepresidencia". */
function esPresidenciaJucopo(c: { nombre: string; cargo: string }): boolean {
  const nombre = normalizar(c.nombre ?? '');
  return nombre.includes('junta de coordinacion politica') && normalizar(c.cargo ?? '').startsWith('presiden');
}

/** Minúsculas, sin acentos y con espacios simples, para comparar nombres y correos. */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}
