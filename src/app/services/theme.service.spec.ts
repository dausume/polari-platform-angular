/**
 * Unit tests for ThemeService — light/dark toggle, persistence to
 * localStorage, and the body .dark-theme class side effect.
 */
import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

const KEY = 'polari-theme';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.removeItem(KEY);
    document.body.classList.remove('dark-theme');
  });

  function make(): ThemeService {
    TestBed.configureTestingModule({ providers: [ThemeService] });
    return TestBed.inject(ThemeService);
  }

  it('defaults to light when nothing is stored', () => {
    const svc = make();
    expect(svc.currentTheme.value).toBe('light');
    expect(document.body.classList.contains('dark-theme')).toBe(false);
  });

  it('toggleTheme() flips light -> dark, persists, applies body class', () => {
    const svc = make();
    svc.toggleTheme();
    expect(svc.currentTheme.value).toBe('dark');
    expect(localStorage.getItem(KEY)).toBe('dark');
    expect(document.body.classList.contains('dark-theme')).toBe(true);
  });

  it('toggleTheme() twice returns to light and removes the body class', () => {
    const svc = make();
    svc.toggleTheme();
    svc.toggleTheme();
    expect(svc.currentTheme.value).toBe('light');
    expect(localStorage.getItem(KEY)).toBe('light');
    expect(document.body.classList.contains('dark-theme')).toBe(false);
  });

  it('restores a stored dark theme on construction', () => {
    localStorage.setItem(KEY, 'dark');
    const svc = make();
    expect(svc.currentTheme.value).toBe('dark');
    expect(document.body.classList.contains('dark-theme')).toBe(true);
  });
});
