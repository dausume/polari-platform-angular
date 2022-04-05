import { Component } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { PolariService } from '@services/polari-service';
import { ClassTypingService } from '@services/class-typing-service';

@Component({
  selector: 'class-main-page',
  templateUrl: 'class-main-page.html',
  styleUrls: ['./class-main-page.css']
})
export class ClassMainPageComponent {

  className? : string = "name";
  typeInfo? : any;

  constructor(private route : ActivatedRoute, private router : Router, protected polariService: PolariService, protected typingService: ClassTypingService) 
  {

  }

  //Url parameters are not passed until ngOnInit occurs
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
    .subscribe(typingDict => {
      console.log("typing dict retrieved");
      if(this.className != null)
      {
        typingDict[this.className]
      }
      else
      {
        console.log("could not get typing info because class info was null.");
      }
    }
  );
  }

}
