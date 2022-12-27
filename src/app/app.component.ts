import { Router } from '@angular/router';
import { navComponent } from '@models/navComponent';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { map } from 'rxjs/operators'
//
import { PolariConfigComponent } from '@components/polari-config/polari-config';
import { PolariService } from '@services/polari-service';
import {ClassTypingService} from '@services/class-typing-service'
import { polariNode } from '@models/polariNode';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  sideNavOpened = false;
  isConnected = false;
  router: Router
  polariService: PolariService
  typingService: ClassTypingService
  title = 'polari-platform';
  currentComponentTitle = "Home";
  //For now we just set the user have basic authentication.
  authGroupsChecked = ["BasicAuth", "PolariConnected"]
  //Gives a list of valid component templates to be generated
  validComponentTemplates = ["CRUDE-API-INFO", "API-INFO", "Node-Info", "Login", "Register", "Instance", "Object"]
  //List of Components which have the potential to be navigated to.
  allNavComponentsData: navComponent[];
  //List of Components which are confirmed for the given user to be able to navigate to.  Default allows pages accessible without
  //the need to login.  These pages include the Home Page, login, register, validate email, and Polari Configuration Page.
  activeNavComponentsData: navComponent[];
  navComponentsFromPolari: navComponent[];

  constructor(router: Router, polariService: PolariService, typingService: ClassTypingService)
  {
    this.router = router
    this.polariService = polariService
    this.typingService = typingService;
    this.navComponentsFromPolari = [];
    //Sets information on potential Navigation for the application with navComponent model instances.
    this.allNavComponentsData = [
      {
        "title":"Home",
        "path":"",
        "component":"HomeComponent",
        "queryParams":{},
        "authGroups":[]
      },
      {
        "title":"Polari Configuration",
        "path":"polari-config",
        "component":"PolariConfigComponent",
        "queryParams":{},
        "authGroups":[]
      }
    ]
    
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

    this.typingService.navComponentsBehaviorSubject.subscribe(navList => {
      this.navComponentsFromPolari = navList
    });
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
    this.allNavComponentsData.forEach( (someNavComponent) => {
      //A series of authentication groups and the client-side checks to see if they have previously passed those Authentication
      //group requirements.  *Authentication is still preformed on the backend, so even though these client-side checks can be hacked,
      // the page accessed as a result will still not render properly since the data will not be able to be accessed*
      if(someNavComponent.authGroups != null)
      {
        accessAuthorized = someNavComponent.authGroups.every((someAuthGroup)=>{
          if(!(someAuthGroup in this.authGroupsChecked))
          {
            return false
          }
          return true
        });
      }
      if(accessAuthorized)
      {
        authorizedNavComponents.push(someNavComponent)
      }
    });
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
