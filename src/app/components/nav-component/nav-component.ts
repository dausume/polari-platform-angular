import { Router } from '@angular/router';
import { navComponent } from '@models/navComponent';
import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject, interval, Observable, Observer, Subscription } from 'rxjs';


@Component({
  standalone: false,
  selector: 'nav-component',
  templateUrl: 'nav-component.html',
  styleUrls: ['./nav-component.css']
})
export class NavigationComponent {
  //Pulls in the navigation component provided by the parent component.
  @Input('navComp') navComp: navComponent;

  //Component navigation event emitter from this component to the Parent App Component.
  @Output()
  navEvent = new EventEmitter<navComponent>();

  constructor(public newNavComp: navComponent) {
    this.navComp = newNavComp;
    //console.log("New nav-comp created.");
    //console.log(this.navComp);
  }

  pageNav()
  {
    this.navEvent.emit(this.navComp);
  }
}