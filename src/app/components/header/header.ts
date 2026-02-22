import { Input, OnInit, OnDestroy } from '@angular/core';
import { Component } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ThemeService } from '@services/theme.service';
import { Subscription } from 'rxjs';

@Component({
  standalone: true,
  selector: 'header',
  templateUrl: 'header.html',
  styleUrls: ['header.css'],
  imports: [MatToolbarModule, MatIconModule, MatButtonModule]
})
export class HeaderComponent implements OnInit, OnDestroy {
  @Input()
  currentComponentTitle = "";

  polariImgUrl="../assets/circle-cropped_dodecahedronStar.png"
  isDark = false;

  private themeSub?: Subscription;

  constructor(private themeService: ThemeService) {}

  ngOnInit(): void {
    this.themeSub = this.themeService.currentTheme.subscribe(theme => {
      this.isDark = theme === 'dark';
    });
  }

  ngOnDestroy(): void {
    this.themeSub?.unsubscribe();
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }
}
