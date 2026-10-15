import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { User } from '../service/user';

export const presidenteGuard: CanActivateFn = () => {
  const userService = inject(User);
  const router = inject(Router);
  return userService.esPresidente ? true : router.parseUrl('/tabs/inicio');
};
