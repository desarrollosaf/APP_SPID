import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
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
    this.currentUserSubject.next(null);
  }

  login(data: { name: string; password: string }): Observable<Users> {
    return this.http.post<Users>(`${environment.apiUrl}/user/login`, data).pipe(
      tap((response: Users) => {
        localStorage.setItem('authToken', response.token);
        this.setCurrentUser(response);
      })
    );
  }

  logout(): Observable<any> {
    return this.http.post(`${environment.apiUrl}/user/cerrarsesion`, {}).pipe(
      tap(() => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        localStorage.removeItem('isLoggedin');
        this.currentUserSubject.next(null);
      })
    );
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

  setCurrentUser(user: Users) {
    this.currentUserSubject.next(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
  }
}
