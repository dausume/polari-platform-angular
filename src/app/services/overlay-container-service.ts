// custom-overlay-container.service.ts
import { Injectable } from '@angular/core';
import { OverlayContainer } from '@angular/cdk/overlay';

@Injectable({
  providedIn: 'root'
})
export class CustomOverlayContainer extends OverlayContainer {
  protected _createContainer(): void {
    super._createContainer();
    this._containerElement.classList.add('custom-overlay-container');
  }
}