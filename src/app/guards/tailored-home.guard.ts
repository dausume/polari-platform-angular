import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AppsNavService } from '@services/apps-nav.service';
import { AuthSessionService } from '@services/auth/auth-session.service';

/**
 * §58 — the tailored home.
 *
 * His words (2026-09-18): *"If you have my apps selected or a role selected,
 * and apps exist that are assigned to those roles, we should have a secondary
 * landing page you can land on that lets you choose from your own apps. It
 * should still be possible to go to the main Polari Home page via another
 * route, but when logged in as your user it takes you to your tailored home
 * page."*
 *
 * This guard sits on the BARE `''` route and on nothing else, so:
 *
 *   - a deep link is never touched — the guard simply does not run for it;
 *   - an anonymous visitor lands on the main home, as today (checked
 *     synchronously, so nobody signed out pays for a round trip);
 *   - somebody whose My apps is empty lands on the main home, as today;
 *   - `?home=polari` (and the sessionStorage flag the "Polari home" link
 *     sets) keeps a person on the main page for the whole browser session;
 *   - `?home=mine` clears that choice again;
 *   - the sep-0 clamp wins: `shellAppGuard` is a canActivateChild on the
 *     parent route and therefore runs FIRST, redirecting a locked shell to
 *     its app; `tailoredHomeApplies` refuses under a lock as well, so the
 *     clamp cannot be undone from either direction.
 *
 * The auth initializer has already settled by the time the router's initial
 * navigation runs (app.module.ts chains runtime config → AuthSessionService
 * .start() in ONE APP_INITIALIZER), so `currentUser` is a truthful synchronous
 * read here. The my-apps answer is not — it is an HTTP call — so this awaits
 * it, bounded, and falls through to the main home if it does not come.
 */
export const tailoredHomeGuard: CanActivateFn = async (route) => {
  const appsNav = inject(AppsNavService);
  const auth = inject(AuthSessionService);
  const router = inject(Router);

  // An explicit ask, either direction, before anything else.
  const asked = route.queryParamMap.get('home');
  if (asked === 'polari') { appsNav.choosePolariHome(); return true; }
  if (asked === 'mine') { appsNav.chooseTailoredHome(); }

  // Chose the main page for this session (the "Polari home" link) — stay.
  if (appsNav.polariHomeChosen) { return true; }

  // sep-0: a locked shell has exactly one home and it is not this one.
  if (appsNav.lockedAppName) { return true; }

  // Anonymous: the main home is the right landing, and no call is made.
  if (!auth.isAuthenticated) { return true; }

  await appsNav.whenMineLoaded();
  if (!appsNav.tailoredHomeApplies) { return true; }
  return router.createUrlTree(['/home']);
};
