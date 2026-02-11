import { Input } from '@angular/core';
import { Component } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';


@Component({
  standalone: true,
  selector: 'header',
  templateUrl: 'header.html',
  styleUrls: ['header.css'],
  imports: [MatToolbarModule]
})
export class HeaderComponent {
  @Input()
  currentComponentTitle = "";
  
  polariImgUrl="../assets/circle-cropped_dodecahedronStar.png"

  constructor() {
    
  }
}