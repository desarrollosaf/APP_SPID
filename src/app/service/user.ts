import { Observable } from 'rxjs';
import { Injectable, signal, inject, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';
import { Users } from '../interface/user';

@Injectable({
  providedIn: 'root',
})
export class User {

  private http = inject( HttpClient );

  private myAppUrl: string;
  private myAPIUrl: string;
  private currentUserSubject = new BehaviorSubject<Users | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

   constructor() {
    this.myAppUrl = 'https://spidplem.gob.mx/';
    this.myAPIUrl ='api';

    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      this.currentUserSubject.next(JSON.parse(storedUser));
    }
  }

  login(data: any): Observable<string>{
    return this.http.post<string>(`${this.myAppUrl}${this.myAPIUrl}/validacionUser`, data);
  }

  get currentUserValue(): Users | null {
    return this.currentUserSubject.value;
  }

  setCurrentUser(user: Users) {
    this.currentUserSubject.next(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
  }
  
}
