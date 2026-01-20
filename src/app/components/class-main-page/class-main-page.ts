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
  classTypeData : any = {};  // Initialize to empty object to prevent undefined errors
  crudeService?: CRUDEclassService;
  private componentId: string = 'ClassMainPageComponent';
  private previousClassName?: string;

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
            const newClassName = paramsMap["params"][param];

            // If className is changing, clean up old service first
            if (this.previousClassName && this.previousClassName !== newClassName) {
              console.log(`[ClassMainPage] ClassName changing from ${this.previousClassName} to ${newClassName}`);

              // Clear old data
              this.classTypeData = undefined;

              // Clean up old service
              if (this.crudeService) {
                this.crudeService.removeUtilizer(this.componentId);
                this.crudeManager.decrementUtilizerCounter(this.previousClassName);
                this.crudeManager.cleanupUnusedService(this.previousClassName);
              }
            }

            // Set new className
            this.className = newClassName;
            this.previousClassName = newClassName;

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
            console.log("[ClassMainPage] Typing dict update received");
            console.log("[ClassMainPage] polyTyping keys:", Object.keys(polyTyping || {}));

            if(this.className != undefined) //Check if class name was defined
            {
              // Retrieve the class typing data - default to empty object if not found
              const typingData = polyTyping[this.className];
              if (typingData && Object.keys(typingData).length > 0) {
                this.classTypeData = typingData;
                console.log(`[ClassMainPage] Found typing data for ${this.className}:`, Object.keys(typingData));
              } else {
                // Keep as empty object, not undefined - will update when data arrives
                this.classTypeData = this.classTypeData || {};
                console.log(`[ClassMainPage] No typing data yet for ${this.className}, using empty object`);
              }
            }
            else
            {
              console.log("[ClassMainPage] Could not get typing info - className undefined");
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
