import { Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(private router: Router) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Solo la API de SPID lleva este token; otros servicios (p. ej. la agenda pública) no deben recibirlo
    // y un 401 de esos servicios no debe cerrar la sesión de SPID.
    if (!req.url.startsWith(environment.apiUrl)) {
      return next.handle(req);
    }

    const raw = localStorage.getItem('authToken');
    const token = raw && raw !== 'undefined' && raw !== 'null' && raw.length > 20 ? raw : null;

    const authReq = token
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

    return next.handle(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          localStorage.clear();
          this.router.navigate(['/auth/login'], { replaceUrl: true });
        }
        return throwError(() => error);
      })
    );
  }
}
