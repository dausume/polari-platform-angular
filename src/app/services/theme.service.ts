import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private static readonly STORAGE_KEY = 'polari-theme';
  currentTheme = new BehaviorSubject<'light' | 'dark'>(this.getInitialTheme());

  constructor() {
    this.applyTheme(this.currentTheme.value);
  }

  toggleTheme(): void {
    const next = this.currentTheme.value === 'light' ? 'dark' : 'light';
    this.currentTheme.next(next);
    this.applyTheme(next);
    localStorage.setItem(ThemeService.STORAGE_KEY, next);
  }

  private getInitialTheme(): 'light' | 'dark' {
    const stored = localStorage.getItem(ThemeService.STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') {
      return stored;
    }
    return 'light';
  }

  private applyTheme(theme: 'light' | 'dark'): void {
    if (theme === 'dark') {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }
}
