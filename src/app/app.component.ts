// app.component.ts
import { Router } from '@angular/router';
import { navComponent, ObjectCategory } from '@models/navComponent';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { map } from 'rxjs/operators'
//
import { PolariConfigComponent } from '@components/polari-config/polari-config';
import { PolariService } from '@services/polari-service';
import {ClassTypingService} from '@services/class-typing-service'
import { polariNode } from '@models/polariNode';
import { CRUDEservicesManager } from '@services/crude-services-manager';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  sideNavOpened = false;
  isConnected = false;
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

  // Sub-category expanded state for Object Pages
  objectPagesSubExpanded: { framework: boolean; custom: boolean } = {
    framework: false, custom: false
  };
  // Sub-category expanded state for Unused Objects
  unusedPagesSubExpanded: { framework: boolean; custom: boolean } = {
    framework: false, custom: false
  };

  constructor(router: Router, polariService: PolariService, typingService: ClassTypingService, crudeServicesManager: CRUDEservicesManager)
  {
    this.router = router
    this.polariService = polariService
    this.typingService = typingService;
    this.navComponentsFromPolari = [];
    this.crudeServicesManager = crudeServicesManager;
    this.activeNavComponentsData = []
    this.setActiveNavComponentsData()
  }

  ngOnInit()
  {
    console.log("In app.component.ts ngOnInit");
    //Attempt to get connection value from polariService
    this.polariService.connectionSuccessSubject.subscribe(connectionVal => {
      this.isConnected = connectionVal
    });

    // Subscribe to static nav components
    this.typingService.navComponentsBehaviorSubject.subscribe(navList => {
      this.staticNavComponents = navList;
      // For backwards compatibility, still update navComponentsFromPolari
      this.navComponentsFromPolari = navList;
    });

    // Subscribe to dynamic class pages WITH instances (for main dropdown)
    this.typingService.dynamicClassNavSubject.subscribe(classList => {
      this.dynamicClassNavComponents = classList;
      console.log('[AppComponent] Dynamic class pages (with instances) updated:', classList.length);
    });

    // Subscribe to unused class pages WITHOUT instances (for nested dropdown)
    this.typingService.unusedClassNavSubject.subscribe(classList => {
      this.unusedClassNavComponents = classList;
      console.log('[AppComponent] Unused class pages (no instances) updated:', classList.length);
    });
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
  toggleObjectPagesSub(category: 'framework' | 'custom') {
    this.objectPagesSubExpanded[category] = !this.objectPagesSubExpanded[category];
  }

  // Toggle a sub-category within Unused Objects
  toggleUnusedPagesSub(category: 'framework' | 'custom') {
    this.unusedPagesSubExpanded[category] = !this.unusedPagesSubExpanded[category];
  }

  // Filter dynamic class nav components by object category
  getObjectPagesByCategory(category: ObjectCategory): navComponent[] {
    return this.dynamicClassNavComponents.filter(nav => nav.objectCategory === category);
  }

  // Filter unused class nav components by object category
  getUnusedPagesByCategory(category: ObjectCategory): navComponent[] {
    return this.unusedClassNavComponents.filter(nav => nav.objectCategory === category);
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
