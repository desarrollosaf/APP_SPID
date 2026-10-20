import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs/operators';
import { User } from '../service/user';

/** Solo quien preside la Junta de Coordinación Política (se confirma con sus comisiones). */
export const presidenteGuard: CanActivateFn = () => {
  const userService = inject(User);
  const router = inject(Router);
  return userService.verificarPresidencia().pipe(map(es => es ? true : router.parseUrl('/tabs/inicio')));
};
