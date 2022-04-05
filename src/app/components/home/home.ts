import { Component } from '@angular/core';

@Component({
  selector: 'home',
  templateUrl: 'home.html',
  styleUrls: ['./home.css']
})
export class HomeComponent {

  constructor() {

  }

  ngOnInit()
  {
    console.log("In home ngOnInit");
  }

}
