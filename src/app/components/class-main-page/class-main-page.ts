import { Component, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { PolariService } from '@services/polari-service';
import { ClassTypingService } from '@services/class-typing-service';
import { CRUDEservicesManager } from '@services/crude-services-manager';
import { CRUDEclassService } from '@services/crude-class-service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'class-main-page',
  templateUrl: 'class-main-page.html',
  styleUrls: ['./class-main-page.css']
})
export class ClassMainPageComponent implements OnDestroy {

  className? : string = "name";
  classTypeData? : any;
  crudeService?: CRUDEclassService;
  private componentId: string = 'ClassMainPageComponent';

  constructor(
    private route : ActivatedRoute,
    private router : Router,
    protected polariService: PolariService,
    protected typingService: ClassTypingService,
    private crudeManager: CRUDEservicesManager
  )
  {

  }

  //Url parameters are not passed until ngOnInit occurs
  ngOnInit() {
    this.route.paramMap
      .subscribe(paramsMap => {
        Object.keys(paramsMap['params']).forEach( param =>{
          if(param == "class")
          {
            this.className = paramsMap["params"][param]; // Get the class name from the url so we can access the service.

            // Initialize CRUDE service for this class
            if (this.className) {
              console.log(`[ClassMainPage] Getting CRUDE service for: ${this.className}`);

              // Get or create the CRUDE service for this class
              this.crudeService = this.crudeManager.getCRUDEclassService(this.className);

              // Register this component as a utilizer of the service
              this.crudeService.addUtilizer(this.componentId);
              this.crudeManager.incrementUtilizerCounter(this.className);

              console.log(`[ClassMainPage] Service registered for ${this.className}`);
              console.log(`[ClassMainPage] Active utilizers:`, this.crudeService.serviceUtilizers);
            }
          }
        });

        this.typingService.polyTypingBehaviorSubject
          .subscribe(polyTyping => {
            console.log("typing dict retrieved in class main page");
            console.log(polyTyping);
            if(this.className != undefined) //Check if class name was defined
            {
              // Retrieve the class typing data
              this.classTypeData = polyTyping[this.className];
              console.log("ClassTypeData on ClassMainPage for ", this.className);
              console.log("ClassTypeData on ClassMainPage for ", polyTyping["completeVariableTypingData"]);
            }
            else
            {
              console.log("could not get typing info because class info was undefined.");
            }
          }
        );
      }
    );
    console.log(this.classTypeData);
  }

  ngOnDestroy() {
    // Unregister this component as a utilizer when destroyed
    if (this.crudeService && this.className) {
      console.log(`[ClassMainPage] Cleaning up service for ${this.className}`);
      this.crudeService.removeUtilizer(this.componentId);
      this.crudeManager.decrementUtilizerCounter(this.className);
      this.crudeManager.cleanupUnusedService(this.className);
    }
  }
  
  /*
  ngOnInit()
  {
    this.route.paramMap
      .subscribe(paramsMap => {
        Object.keys(paramsMap['params']).forEach( param =>{
          if(param == "class")
          {
            this.className = paramsMap["params"][param];
          }
        })
        
      }
    );
    this.typingService.polyTypingBehaviorSubject
    .subscribe(polyTyping => {
      console.log("typing dict retrieved in class main page");
      console.log(polyTyping);
      if(this.className != undefined)
      {
        this.classTypeData = polyTyping[this.className];
        console.log("ClassTypeData on ClassMainPage for ", this.className);
      }
      else
      {
        console.log("could not get typing info because class info was null.");
      }
    }
  );
  console.log(this.classTypeData);
  }
  */
}
