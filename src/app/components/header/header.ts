import { style } from '@angular/animations';
import { Input } from '@angular/core';
import { Component } from '@angular/core';


@Component({
  standalone: false,
  selector: 'header',
  templateUrl: 'header.html',
  styleUrls: ['header.css']
})
export class HeaderComponent {
  @Input()
  currentComponentTitle = "";
  
  polariImgUrl="../assets/circle-cropped_dodecahedronStar.png"

  constructor() {
    
  }
}