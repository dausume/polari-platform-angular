// Author: Dustin Etts
// polari-platform-angular/src/app/services/no-code-services/state-overlay-manager.service.ts
import { Injectable, ApplicationRef, ComponentRef, Injector, ViewContainerRef, Type } from '@angular/core';
import { Subject } from 'rxjs';

export interface OverlayPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ActiveOverlay {
  stateName: string;
  componentRef: ComponentRef<any>;
  hostElement: HTMLElement;
}

export interface CanvasBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/**
 * StateOverlayManager manages the lifecycle of Angular components overlaid on D3 state groups.
 *
 * Key responsibilities:
 * - Create overlay components positioned over D3 state group inner rects
 * - Track active overlays by state name
 * - Update overlay positions on zoom/pan
 * - Hide/show overlays during drag operations
 * - Destroy overlays when states are removed or solutions change
 */
@Injectable({
  providedIn: 'root',
})
export class StateOverlayManager {

  private activeOverlays: Map<string, ActiveOverlay> = new Map();
  private viewContainerRef: ViewContainerRef | null = null;
  private canvasBounds: CanvasBounds | null = null;

  // Event emitters for overlay lifecycle events
  public overlayCreated$ = new Subject<string>();
  public overlayDestroyed$ = new Subject<string>();

  constructor(
    private appRef: ApplicationRef,
    private injector: Injector
  ) {}

  /**
   * Update the canvas bounds for clipping overlays.
   * Call this when the canvas container changes size or position.
   */
  setCanvasBounds(canvasElement: HTMLElement): void {
    const rect = canvasElement.getBoundingClientRect();
    this.canvasBounds = {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height
    };
  }

  /**
   * Get the current canvas bounds.
   */
  getCanvasBounds(): CanvasBounds | null {
    return this.canvasBounds;
  }

  /**
   * Set the ViewContainerRef to use for creating components.
   * Must be called from the host component (CustomNoCodeComponent).
   */
  setViewContainerRef(vcr: ViewContainerRef): void {
    this.viewContainerRef = vcr;
  }

  /**
   * Get the screen position of a state group's overlay-component rect.
   * Uses getBoundingClientRect which automatically applies all SVG transforms.
   */
  getOverlayPosition(stateGroup: SVGGElement): OverlayPosition | null {
    const stateName = stateGroup.getAttribute('state-name') || 'unknown';
    const overlayRect = stateGroup.querySelector('rect.overlay-component') as SVGRectElement;
    if (!overlayRect) {
      console.warn('[StateOverlayManager] No overlay-component rect found in state group:', stateName);
      return null;
    }

    // Log the SVG rect's attributes for debugging
    console.log('[StateOverlayManager] overlay-component rect SVG attributes for', stateName, ':', {
      x: overlayRect.getAttribute('x'),
      y: overlayRect.getAttribute('y'),
      width: overlayRect.getAttribute('width'),
      height: overlayRect.getAttribute('height'),
      fill: overlayRect.getAttribute('fill')
    });

    // Log the state group's transform
    const groupTransform = stateGroup.getAttribute('transform');
    console.log('[StateOverlayManager] State group transform for', stateName, ':', groupTransform);

    const bounds = overlayRect.getBoundingClientRect();
    console.log('[StateOverlayManager] getBoundingClientRect for', stateName, ':', {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      left: bounds.left,
      top: bounds.top,
      right: bounds.right,
      bottom: bounds.bottom
    });

    // Check for invalid dimensions (can happen if element is hidden or not rendered)
    if (bounds.width === 0 || bounds.height === 0) {
      console.warn('[StateOverlayManager] Overlay rect has zero dimensions for:', stateName);
      return null;
    }

    // Verify the position is within a reasonable viewport range
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    console.log('[StateOverlayManager] Viewport size:', { viewportWidth, viewportHeight });

    if (bounds.x < -1000 || bounds.x > viewportWidth + 1000 ||
        bounds.y < -1000 || bounds.y > viewportHeight + 1000) {
      console.warn('[StateOverlayManager] Overlay position seems outside reasonable bounds for:', stateName,
        { x: bounds.x, y: bounds.y, viewportWidth, viewportHeight });
    }

    return {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height
    };
  }

  /**
   * Create an overlay component for a state.
   * The component will be positioned over the state's inner rect.
   */
  createOverlayForState<T>(
    stateName: string,
    stateGroup: SVGGElement,
    component: Type<T>,
    inputData?: Partial<T>
  ): ComponentRef<T> | null {

    if (!this.viewContainerRef) {
      console.error('[StateOverlayManager] ViewContainerRef not set. Call setViewContainerRef first.');
      return null;
    }

    // Destroy existing overlay for this state if any
    if (this.activeOverlays.has(stateName)) {
      this.destroyOverlayForState(stateName);
    }

    const position = this.getOverlayPosition(stateGroup);
    if (!position) {
      return null;
    }

    console.log(`[StateOverlayManager] Creating overlay for ${stateName} at position:`, position);

    // Create the component using ViewContainerRef
    const componentRef = this.viewContainerRef.createComponent(component, {
      injector: this.injector
    });

    // Set position and size inputs on the component
    const instance = componentRef.instance as any;
    instance.x = position.x;
    instance.y = position.y;
    instance.width = position.width;
    instance.height = position.height;
    instance.stateName = stateName;

    // Apply any additional input data
    if (inputData) {
      Object.assign(instance, inputData);
    }

    // Get the DOM element from the component's host view
    const hostElement = (componentRef.hostView as any).rootNodes[0] as HTMLElement;

    if (!hostElement) {
      console.error('[StateOverlayManager] Failed to get host element for:', stateName);
      componentRef.destroy();
      return null;
    }

    // Style the host element for fixed positioning over the SVG rect
    hostElement.style.position = 'fixed';
    hostElement.style.left = `${position.x}px`;
    hostElement.style.top = `${position.y}px`;
    hostElement.style.width = `${position.width}px`;
    hostElement.style.height = `${position.height}px`;
    hostElement.style.zIndex = '1001'; // Higher than most UI elements
    // pointer-events: none on host allows clicks to pass through to D3 elements
    // Individual interactive elements inside have pointer-events: auto via CSS
    hostElement.style.pointerEvents = 'none';
    hostElement.style.overflow = 'hidden';

    // Add a visible debug attribute to help identify overlays in the DOM
    hostElement.setAttribute('data-state-overlay', stateName);

    // Move the element from ViewContainerRef's location to document body
    // This ensures it's positioned relative to the viewport, not the Angular component tree
    document.body.appendChild(hostElement);

    // Trigger change detection to ensure the component renders its template
    componentRef.changeDetectorRef.detectChanges();

    // Log the final computed styles for debugging
    const computedStyle = window.getComputedStyle(hostElement);
    console.log(`[StateOverlayManager] Overlay ${stateName} final styles:`, {
      position: computedStyle.position,
      left: computedStyle.left,
      top: computedStyle.top,
      width: computedStyle.width,
      height: computedStyle.height,
      zIndex: computedStyle.zIndex,
      display: computedStyle.display,
      visibility: computedStyle.visibility,
      opacity: computedStyle.opacity,
      inDOM: document.body.contains(hostElement)
    });

    // Track the overlay
    this.activeOverlays.set(stateName, {
      stateName,
      componentRef,
      hostElement
    });

    this.overlayCreated$.next(stateName);
    console.log(`[StateOverlayManager] Created overlay for state: ${stateName}`);

    return componentRef;
  }

  /**
   * Destroy the overlay for a specific state.
   */
  destroyOverlayForState(stateName: string): void {
    const overlay = this.activeOverlays.get(stateName);
    if (!overlay) {
      return;
    }

    // Remove from DOM
    if (overlay.hostElement.parentNode) {
      overlay.hostElement.parentNode.removeChild(overlay.hostElement);
    }

    // Detach view and destroy component
    this.appRef.detachView(overlay.componentRef.hostView);
    overlay.componentRef.destroy();

    this.activeOverlays.delete(stateName);
    this.overlayDestroyed$.next(stateName);
    console.log(`[StateOverlayManager] Destroyed overlay for state: ${stateName}`);
  }

  /**
   * Destroy all active overlays.
   * Call this when switching solutions or clearing the canvas.
   */
  destroyAllOverlays(): void {
    const stateNames = Array.from(this.activeOverlays.keys());
    for (const stateName of stateNames) {
      this.destroyOverlayForState(stateName);
    }
    console.log('[StateOverlayManager] Destroyed all overlays');
  }

  /**
   * Update the position of an overlay based on the current state group position.
   * Call this after drag ends or during zoom/pan.
   * Handles clipping to canvas bounds and triggers change detection for size mode updates.
   */
  updateOverlayPosition(stateName: string, stateGroup: SVGGElement): void {
    const overlay = this.activeOverlays.get(stateName);
    if (!overlay) {
      return;
    }

    const position = this.getOverlayPosition(stateGroup);
    if (!position) {
      // If we can't get position, hide the overlay
      overlay.hostElement.style.visibility = 'hidden';
      return;
    }

    // Update the component inputs (this affects the component's size mode calculation)
    const instance = overlay.componentRef.instance as any;
    instance.x = position.x;
    instance.y = position.y;
    instance.width = position.width;
    instance.height = position.height;

    // Update the host element styles
    overlay.hostElement.style.left = `${position.x}px`;
    overlay.hostElement.style.top = `${position.y}px`;
    overlay.hostElement.style.width = `${position.width}px`;
    overlay.hostElement.style.height = `${position.height}px`;

    // Apply canvas clipping if bounds are set
    this.applyCanvasClipping(overlay, position);

    // Force the component to recalculate its size mode based on new dimensions
    if (typeof instance.forceUpdateSizeMode === 'function') {
      instance.forceUpdateSizeMode();
    }

    // Trigger change detection to update the view
    overlay.componentRef.changeDetectorRef.detectChanges();
  }

  /**
   * Apply clipping to an overlay based on canvas bounds.
   * Uses clip-path to smoothly clip overlays that extend beyond the canvas.
   */
  private applyCanvasClipping(overlay: ActiveOverlay, position: OverlayPosition): void {
    if (!this.canvasBounds) {
      // No canvas bounds set, show the overlay without clipping
      overlay.hostElement.style.visibility = 'visible';
      overlay.hostElement.style.clipPath = 'none';
      return;
    }

    const bounds = this.canvasBounds;

    // Check if the overlay is completely outside the canvas
    const isCompletelyOutside =
      position.x + position.width < bounds.left ||
      position.x > bounds.right ||
      position.y + position.height < bounds.top ||
      position.y > bounds.bottom;

    if (isCompletelyOutside) {
      // Completely outside - hide the overlay
      overlay.hostElement.style.visibility = 'hidden';
      return;
    }

    // Make visible
    overlay.hostElement.style.visibility = 'visible';

    // Check if the overlay is completely inside the canvas
    const isCompletelyInside =
      position.x >= bounds.left &&
      position.x + position.width <= bounds.right &&
      position.y >= bounds.top &&
      position.y + position.height <= bounds.bottom;

    if (isCompletelyInside) {
      // Completely inside - no clipping needed
      overlay.hostElement.style.clipPath = 'none';
      return;
    }

    // Partially visible - calculate clip-path
    // The clip-path is in the overlay's local coordinate space (0,0 is top-left of overlay)
    const clipLeft = Math.max(0, bounds.left - position.x);
    const clipTop = Math.max(0, bounds.top - position.y);
    const clipRight = Math.min(position.width, bounds.right - position.x);
    const clipBottom = Math.min(position.height, bounds.bottom - position.y);

    // inset(top right bottom left) - but we use polygon for more control
    // polygon uses coordinates relative to the element
    overlay.hostElement.style.clipPath =
      `polygon(${clipLeft}px ${clipTop}px, ${clipRight}px ${clipTop}px, ${clipRight}px ${clipBottom}px, ${clipLeft}px ${clipBottom}px)`;
  }

  /**
   * Update positions of all active overlays.
   * Call this on zoom/pan events.
   * @param getStateGroup Function to get the SVG group for a state name
   * @param canvasElement Optional canvas element to update bounds for clipping
   */
  updateAllOverlayPositions(
    getStateGroup: (stateName: string) => SVGGElement | null,
    canvasElement?: HTMLElement
  ): void {
    // Update canvas bounds if provided
    if (canvasElement) {
      this.setCanvasBounds(canvasElement);
    }

    for (const [stateName, overlay] of this.activeOverlays) {
      const stateGroup = getStateGroup(stateName);
      if (stateGroup) {
        this.updateOverlayPosition(stateName, stateGroup);
      } else {
        // State group not found - hide the overlay
        overlay.hostElement.style.visibility = 'hidden';
      }
    }
  }

  /**
   * Hide an overlay temporarily (e.g., during drag).
   */
  hideOverlayForState(stateName: string): void {
    const overlay = this.activeOverlays.get(stateName);
    if (overlay) {
      overlay.hostElement.style.display = 'none';
    }
  }

  /**
   * Show a previously hidden overlay.
   */
  showOverlayForState(stateName: string): void {
    const overlay = this.activeOverlays.get(stateName);
    if (overlay) {
      overlay.hostElement.style.display = 'block';
    }
  }

  /**
   * Hide all overlays temporarily.
   */
  hideAllOverlays(): void {
    for (const overlay of this.activeOverlays.values()) {
      overlay.hostElement.style.display = 'none';
    }
  }

  /**
   * Show all overlays.
   */
  showAllOverlays(): void {
    for (const overlay of this.activeOverlays.values()) {
      overlay.hostElement.style.display = 'block';
    }
  }

  /**
   * Check if a state has an active overlay.
   */
  hasOverlay(stateName: string): boolean {
    return this.activeOverlays.has(stateName);
  }

  /**
   * Get the component ref for a state's overlay.
   */
  getOverlayComponent(stateName: string): ComponentRef<any> | null {
    return this.activeOverlays.get(stateName)?.componentRef || null;
  }

  /**
   * Get all active state names with overlays.
   */
  getActiveStateNames(): string[] {
    return Array.from(this.activeOverlays.keys());
  }
}
