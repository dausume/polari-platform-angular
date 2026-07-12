import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

import { XrCapabilityService } from '@services/xr/xr-capability.service';

@Component({
  standalone: true,
  selector: 'home',
  templateUrl: 'home.html',
  styleUrls: ['./home.css'],
  imports: [CommonModule, RouterModule, MatCardModule, MatIconModule,
            MatButtonModule]
})
export class HomeComponent implements OnInit {

  /** Shows the XR-lobby suggestion banner — a suggestion pointing
   *  at /xr, never an auto-redirect. */
  vrCapable = false;

  constructor(private xrCapability: XrCapabilityService) {}

  ngOnInit(): void {
    this.xrCapability.capability()
      .then(cap => { this.vrCapable = cap.vr; })
      .catch(() => { /* honest default: no banner */ });
  }

}
