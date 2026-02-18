import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type GeolocationStatus = 'idle' | 'detecting' | 'success' | 'denied' | 'unavailable' | 'manual';

@Injectable({ providedIn: 'root' })
export class GeolocationService {

  location$ = new BehaviorSubject<{ lng: number; lat: number } | null>(null);
  status$ = new BehaviorSubject<GeolocationStatus>('idle');

  constructor(private ngZone: NgZone) {}

  detectLocation(): Observable<{ lng: number; lat: number }> {
    this.status$.next('detecting');

    return new Observable(observer => {
      if (!navigator.geolocation) {
        this.status$.next('unavailable');
        observer.error(new Error('Geolocation API not available'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.ngZone.run(() => {
            const loc = {
              lng: position.coords.longitude,
              lat: position.coords.latitude
            };
            this.location$.next(loc);
            this.status$.next('success');
            observer.next(loc);
            observer.complete();
          });
        },
        (error) => {
          this.ngZone.run(() => {
            if (error.code === error.PERMISSION_DENIED) {
              this.status$.next('denied');
            } else {
              this.status$.next('unavailable');
            }
            observer.error(error);
          });
        },
        {
          enableHighAccuracy: true,
          timeout: 10000
        }
      );
    });
  }

  setManualLocation(lat: number, lng: number): void {
    const loc = { lng, lat };
    this.location$.next(loc);
    this.status$.next('manual');
  }

  clearLocation(): void {
    this.location$.next(null);
    this.status$.next('idle');
  }
}
