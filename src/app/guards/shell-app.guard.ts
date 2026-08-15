import { inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';
import { AppsNavService } from '@services/apps-nav.service';

/**
 * sep-0: under the single-app clamp (`?shellApp=<name>`), a route
 * outside the locked app's territory REDIRECTS to the app home —
 * never a 404, never foreign chrome. Territory = the app's own home
 * (/app/<name>) plus every route its nav rows name, including each
 * item's bring-online route (the quad-state honesty survives the
 * clamp) and /tech-tree when the app carries tech-node items.
 */
export const shellAppGuard: CanActivateChildFn = async (_route, state) => {
  const appsNav = inject(AppsNavService);
  const router = inject(Router);
  if (!appsNav.lockedAppName) { return true; }

  const path = state.url.split('?')[0] || '/';
  // The OIDC callback must always complete, clamp or not.
  if (path === '/callback') { return true; }

  await appsNav.whenLoaded();
  if (!appsNav.locked) { return true; }  // unknown app name fell open

  const name = appsNav.lockedAppName;
  const covers = (r: string | undefined): boolean =>
    !!r && (path === r || path.startsWith(r + '/'));
  if (covers(`/app/${name}`)) { return true; }

  const app = appsNav.lockedApp();
  const inTerritory = (app?.nav ?? []).some(g => g.items.some(it =>
    covers(it.route) || covers(it.bringup?.route)
    || (it.kind === 'tech-node' && covers('/tech-tree'))));
  return inTerritory ? true : router.createUrlTree(['/app', name]);
};
