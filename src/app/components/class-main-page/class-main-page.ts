import { Component } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { PolariService } from '@services/polari-service';
import { ClassTypingService } from '@services/class-typing-service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'class-main-page',
  templateUrl: 'class-main-page.html',
  styleUrls: ['./class-main-page.css']
})
export class ClassMainPageComponent {

  className? : string = "name";
  classTypeData? : any;

  constructor(private route : ActivatedRoute, private router : Router, protected polariService: PolariService, protected typingService: ClassTypingService) 
  {

  }

  //Url parameters are not passed until ngOnInit occurs
  ngOnInit() {
    this.route.paramMap
      .subscribe(paramsMap => {
        Object.keys(paramsMap['params']).forEach( param =>{
          if(param == "class")
          {
            this.className = paramsMap["params"][param];
          }
        });
  
        this.typingService.polyTypingBehaviorSubject
          .subscribe(polyTyping => {
            console.log("typing dict retrieved in class main page");
            console.log(polyTyping);
            if(this.className != undefined)
            {
              this.classTypeData = polyTyping[this.className];
              console.log("ClassTypeData on ClassMainPage for ", this.className);
              console.log("ClassTypeData on ClassMainPage for ", polyTyping["completeVariableTypingData"]);
            }
            else
            {
              console.log("could not get typing info because class info was null.");
            }
          }
        );
      }
    );
    console.log(this.classTypeData);
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
