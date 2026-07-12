import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { XrCapabilityService } from '@services/xr/xr-capability.service';

const CHOICE_KEY = 'polari-xr-prompt-choice';

/**
 * Session-start XR prompt (Dustin 2026-07-12): when the device can
 * do immersive VR, offer the XR navigation ONCE per browser session
 * — right when the session starts, not buried on the home page.
 * Either choice (go / stay flat) is remembered in sessionStorage so
 * the prompt never nags within the session but naturally returns in
 * a later one. Never a redirect — always a choice.
 */
@Component({
  standalone: true,
  selector: 'xr-session-prompt',
  imports: [CommonModule],
  template: `
    <div class="xr-prompt" *ngIf="visible">
      <div class="card">
        <h2>XR headset detected</h2>
        <p>Polari has a navigation adapted for headsets — big
          targets, no fine scrolling, straight to the simulation
          spaces.</p>
        <div class="actions">
          <button class="go" (click)="choose(true)">
            Open Polari XR</button>
          <button class="stay" (click)="choose(false)">
            Stay on the flat site</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* Deliberately theme-independent: literal dark palette so it is
       readable in light AND dark themes (the first lobby build used
       theme vars and went white-on-white in light mode). */
    .xr-prompt { position: fixed; inset: 0; z-index: 3000;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0, 0, 0, .6); }
    .card { background: #1e1e1e; color: #ffffff; max-width: 560px;
      margin: 16px; padding: 30px 34px; border-radius: 20px;
      border: 2px solid #9ecbff; }
    h2 { margin: 0 0 10px; font-size: 1.7rem; }
    p { font-size: 1.15rem; opacity: .85; }
    .actions { display: flex; gap: 16px; margin-top: 22px;
      flex-wrap: wrap; }
    button { font-size: 1.25rem; padding: 18px 30px;
      border-radius: 14px; cursor: pointer; border: none; }
    .go { background: #9ecbff; color: #10233a; font-weight: 600; }
    .stay { background: #2d2d2d; color: #ffffff;
      border: 2px solid #3a3a3a; }
  `],
})
export class XrSessionPromptComponent implements OnInit {

  visible = false;

  constructor(private capability: XrCapabilityService,
              private router: Router) {}

  ngOnInit(): void {
    let stored: string | null = null;
    try {
      stored = sessionStorage.getItem(CHOICE_KEY);
    } catch { /* storage unavailable -> just don't prompt */
      return;
    }
    if (stored || this.router.url.startsWith('/xr')) {
      return;
    }
    this.capability.capability()
      .then(cap => { this.visible = cap.vr; })
      .catch(() => { /* honest default: no prompt */ });
  }

  choose(goXr: boolean): void {
    try {
      sessionStorage.setItem(CHOICE_KEY, goXr ? 'xr' : 'flat');
    } catch { /* remembering failed — still honor the choice now */ }
    this.visible = false;
    if (goXr) {
      this.router.navigate(['/xr']);
    }
  }
}
