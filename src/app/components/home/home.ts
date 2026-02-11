import { Component } from '@angular/core';

@Component({
  standalone: false,
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
