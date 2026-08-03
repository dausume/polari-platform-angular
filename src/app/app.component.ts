// app.component.ts
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AppNav, AppsNavService } from '@services/apps-nav.service';
import { navComponent, ObjectCategory } from '@models/navComponent';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { map } from 'rxjs/operators'
//
import { PolariConfigComponent } from '@components/polari-config/polari-config';
import { PolariService } from '@services/polari-service';
import {ClassTypingService} from '@services/class-typing-service'
import { polariNode } from '@models/polariNode';
import { CRUDEservicesManager } from '@services/crude-services-manager';
import { DisplayManagerService } from '@services/dashboard/display-manager.service';
import { DisplaySummary } from '@models/dashboards/DisplaySummary';


@Component({
  standalone: false,
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  sideNavOpened = false;
  isConnected = false;
  // nav-3: the app whose territory the current route sits in; when
  // set, its menu renders on top and the base (core) nav collapses
  // under an expander — still always reachable.
  currentApp: AppNav | null = null;
  coreNavExpanded = true;
  private coreNavToggledByUser = false;
  router: Router
  //Connects to the polari node and retrieves/maintains the fundamental data on how the app functions.
  polariService: PolariService
  //Pulls all class typing and var typing data and organizes it for use in components.
  typingService: ClassTypingService
  crudeServicesManager: CRUDEservicesManager
  title = 'polari-platform';
  currentComponentTitle = "Home";
  //For now we just set the user have basic authentication.
  authGroupsChecked = ["BasicAuth", "PolariConnected"]
  //Gives a list of valid component templates to be generated
  validComponentTemplates = ["CRUDE-API-INFO", "API-INFO", "Node-Info", "Login", "Register", "Instance", "Object"]
  //List of Components which are confirmed for the given user to be able to navigate to.  Default allows pages accessible without
  //the need to login.  These pages include the Home Page, login, register, validate email, and Polari Configuration Page.
  activeNavComponentsData: navComponent[];
  navComponentsFromPolari: navComponent[];

  // Separate static nav items from dynamic class pages
  staticNavComponents: navComponent[] = [];
  dynamicClassNavComponents: navComponent[] = [];  // Classes WITH instances
  unusedClassNavComponents: navComponent[] = [];   // Classes WITHOUT instances
  objectPagesExpanded: boolean = false;
  unusedPagesExpanded: boolean = false;
  publishedDisplayPages: DisplaySummary[] = [];
  displayPagesExpanded: boolean = false;

  // Sub-category expanded state for Object Pages (keyed by category string)
  objectPagesSubExpanded: Record<string, boolean> = { framework: false, custom: false };
  // Sub-category expanded state for Unused Objects
  unusedPagesSubExpanded: Record<string, boolean> = { framework: false, custom: false };

  private displayManager: DisplayManagerService;

  // nav layout by device class. The drawer is a push-panel ("side")
  // only when there is room beside the content; on phone/tablet it
  // overlays ("over") and closes on navigation, because a 350px
  // push-panel on a 390px screen leaves no content.
  // Breakpoint matches --bp-standard-min in _responsive.css.
  navMode: 'side' | 'over' = 'side';
  private navOverlays = false;

  constructor(router: Router, polariService: PolariService, typingService: ClassTypingService, crudeServicesManager: CRUDEservicesManager, displayManager: DisplayManagerService, private appsNav: AppsNavService, private breakpoints: BreakpointObserver)
  {
    this.router = router
    this.polariService = polariService
    this.typingService = typingService;
    this.navComponentsFromPolari = [];
    this.crudeServicesManager = crudeServicesManager;
    this.displayManager = displayManager;
    this.activeNavComponentsData = []
    this.setActiveNavComponentsData()

    this.breakpoints.observe('(max-width: 1023px)').subscribe(state => {
      this.navOverlays = state.matches;
      this.navMode = state.matches ? 'over' : 'side';
      // An overlay drawer must never start open — it would cover the
      // page. Coming back to a wide screen leaves it closed too, which
      // matches the existing default.
      if (state.matches) { this.sideNavOpened = false; }
    });
  }

  /** On phone/tablet the drawer covers the content, so choosing a
   *  destination has to dismiss it; on desktop it stays pinned. */
  closeNavIfOverlay(): void {
    if (this.navOverlays) { this.sideNavOpened = false; }
  }

  private bindAppContext(url: string): void {
    this.currentApp = this.appsNav.appForUrl(url);
    if (!this.coreNavToggledByUser) {
      // default posture: core nav folds away inside an app,
      // expands in the core shell — until the user says otherwise.
      this.coreNavExpanded = !this.currentApp;
    }
  }

  toggleCoreNav(): void {
    this.coreNavExpanded = !this.coreNavExpanded;
    this.coreNavToggledByUser = true;
  }

  ngOnInit()
  {
    // console.log("In app.component.ts ngOnInit");
    //Attempt to get connection value from polariService
    this.polariService.connectionSuccessSubject.subscribe(connectionVal => {
      this.isConnected = connectionVal
    });

    // nav-3: app context for the side nav (menus are rows; the
    // service resolves which app owns the current route).
    this.appsNav.ensureLoaded();
    this.appsNav.payload$.subscribe(() =>
      this.bindAppContext(this.router.url));
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => this.bindAppContext(e.urlAfterRedirects));

    // Subscribe to static nav components
    this.typingService.navComponentsBehaviorSubject.subscribe(navList => {
      this.staticNavComponents = navList;
      // For backwards compatibility, still update navComponentsFromPolari
      this.navComponentsFromPolari = navList;
    });

    // Subscribe to dynamic class pages WITH instances (for main dropdown)
    this.typingService.dynamicClassNavSubject.subscribe(classList => {
      this.dynamicClassNavComponents = classList;
      // console.log('[AppComponent] Dynamic class pages (with instances) updated:', classList.length);
    });

    // Subscribe to unused class pages WITHOUT instances (for nested dropdown)
    this.typingService.unusedClassNavSubject.subscribe(classList => {
      this.unusedClassNavComponents = classList;
      // console.log('[AppComponent] Unused class pages (no instances) updated:', classList.length);
    });

    // Subscribe to published display pages
    this.displayManager.publishedDisplays$.subscribe(pages => {
      this.publishedDisplayPages = pages;
    });
    this.displayManager.fetchPublishedDisplays();
  }

  // Toggle the object pages dropdown
  toggleObjectPages() {
    this.objectPagesExpanded = !this.objectPagesExpanded;
  }

  // Toggle the unused pages dropdown
  toggleUnusedPages() {
    this.unusedPagesExpanded = !this.unusedPagesExpanded;
  }

  // Toggle a sub-category within Object Pages
  toggleObjectPagesSub(category: string) {
    this.objectPagesSubExpanded[category] = !this.objectPagesSubExpanded[category];
  }

  // Toggle a sub-category within Unused Objects
  toggleUnusedPagesSub(category: string) {
    this.unusedPagesSubExpanded[category] = !this.unusedPagesSubExpanded[category];
  }

  // Filter dynamic class nav components by object category
  getObjectPagesByCategory(category: string): navComponent[] {
    return this.dynamicClassNavComponents.filter(nav => nav.objectCategory === category);
  }

  // Filter unused class nav components by object category
  getUnusedPagesByCategory(category: string): navComponent[] {
    return this.unusedClassNavComponents.filter(nav => nav.objectCategory === category);
  }

  /** Get module category IDs that have classes (excludes 'framework' and 'custom'). */
  getModuleCategories(source: navComponent[]): string[] {
    const categories = new Set<string>();
    for (const nav of source) {
      if (nav.objectCategory && nav.objectCategory !== 'framework' && nav.objectCategory !== 'custom') {
        categories.add(nav.objectCategory);
      }
    }
    return Array.from(categories).sort();
  }

  /** Convert a module_id to a display name (e.g. 'materials_science' -> 'Materials Science'). */
  formatModuleName(moduleId: string): string {
    return moduleId.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  // Toggle the display pages dropdown
  toggleDisplayPages() {
    this.displayPagesExpanded = !this.displayPagesExpanded;
  }

  // Navigate to a published display page
  navigateToDisplayPage(display: DisplaySummary) {
    this.currentComponentTitle = display.name || 'Display Page';
    this.router.navigate(['/display', display.id]);
  }

  // Navigate to a dynamic class page
  navigateToClassPage(navComp: navComponent) {
    this.currentComponentTitle = navComp.title;
    this.router.navigateByUrl(navComp.path);
  }

  ngOnDestroy(){
    //Attempt to get connection value from polariService
    this.polariService.connectionSuccessSubject.unsubscribe();

    this.polariService.navComponents.unsubscribe();
  }

  pageNav(navComp: navComponent)
  {
    this.currentComponentTitle = navComp.title
    this.router.navigateByUrl(navComp.path);
  }

  toggleSideNav() {
    if(this.sideNavOpened)
    {
      this.sideNavOpened = false
    }
    else{
      this.sideNavOpened = true
    }
  }

  //Sets 'activeNavComponentsData' value to a list of navComponents that the user can successfully navigate to.
  setActiveNavComponentsData() {
    let foundComponent = false
    let accessAuthorized = true
    let authorizedNavComponents : navComponent[]
    authorizedNavComponents = []
    //TODO: Narrow down access based on if component has AuthGuard or similar functionality which would prevent access.
    //Loop through all existing Nav components.
    authorizedNavComponents.forEach( (someNavComponent) => {
      foundComponent = this.activeNavComponentsData.some((activeNavComponent) =>{
        if(activeNavComponent.component == someNavComponent.component)
        {
          return true
        }
        return false
      });
      if(!foundComponent)
      {
        this.activeNavComponentsData.push(someNavComponent)
      }
    });
  }

}
