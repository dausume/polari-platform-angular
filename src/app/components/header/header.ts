import { Input, OnInit, OnDestroy } from '@angular/core';
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ThemeService } from '@services/theme.service';
import { AuthSessionService } from '@services/auth/auth-session.service';
import { AuthUser } from '../../classes/auth-user';
import { Subscription } from 'rxjs';

@Component({
  standalone: true,
  selector: 'header',
  templateUrl: 'header.html',
  styleUrls: ['header.css'],
  imports: [CommonModule, MatToolbarModule, MatIconModule, MatButtonModule, MatMenuModule, MatTooltipModule]
})
export class HeaderComponent implements OnInit, OnDestroy {
  @Input()
  currentComponentTitle = "";

  polariImgUrl = "../assets/circle-cropped_dodecahedronStar.png";
  isDark = false;
  currentUser: AuthUser | null = null;

  private themeSub?: Subscription;
  private authSub?: Subscription;

  constructor(
    private themeService: ThemeService,
    private authSession: AuthSessionService
  ) {}

  ngOnInit(): void {
    this.themeSub = this.themeService.currentTheme.subscribe(theme => {
      this.isDark = theme === 'dark';
    });
    this.authSub = this.authSession.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
  }

  ngOnDestroy(): void {
    this.themeSub?.unsubscribe();
    this.authSub?.unsubscribe();
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  login(): void {
    this.authSession.login();
  }

  register(): void {
    this.authSession.register();
  }

  logout(): void {
    this.authSession.logout();
  }

  get displayName(): string {
    return this.currentUser?.name || this.currentUser?.username || 'Account';
  }
}
