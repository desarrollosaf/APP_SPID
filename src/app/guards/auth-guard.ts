import { ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot } from '@angular/router';
import { inject } from '@angular/core';
import { map, catchError, of } from 'rxjs';


export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const isLoggedIn = localStorage.getItem('isLoggedin') === 'true';
  if (isLoggedIn) {
    return true;
  }
  router.navigate(['/auth/login'], { queryParams: { returnUrl: state.url } });
  return of(false);
};
