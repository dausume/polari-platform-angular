import { Component } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';

@Component({
  selector: 'class-main-page',
  templateUrl: 'class-main-page.html',
  styleUrls: ['./class-main-page.css']
})
export class ClassMainPageComponent {

  className? : string;

  constructor(private route : ActivatedRoute, private router : Router) 
  {

  }

  //Url parameters are not passed until ngOnInit occurs
  ngOnInit()
  {
    this.route.queryParams
      .subscribe(params => {
        if("class" in params)
        {
          this.className = params["class"]
        }
      }
    );
  }

}
