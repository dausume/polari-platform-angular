import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  standalone: true,
  selector: 'home',
  templateUrl: 'home.html',
  styleUrls: ['./home.css'],
  imports: [MatCardModule, MatIconModule, MatButtonModule]
})
export class HomeComponent {

  constructor() {

  }

  ngOnInit()
  {
    console.log("In home ngOnInit");
  }

}
