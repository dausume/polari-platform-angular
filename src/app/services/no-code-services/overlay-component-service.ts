// ./src/services/no-code-services/overlay-component-service.ts
import { Injectable, ApplicationRef, Injector, ViewContainerRef, Type } from '@angular/core';

// A service used to add dynamic components to the DOM.
// The primary use of this is to overlay components specifically on top
// of 'No-code State' objects, which are rendered on the frontend via d3.
// NoCodeState objects use an svg element as their root element, and the
// overlay components are added to the body of the document.
// Specifically each No-Code State's base svg type should have a corresponding
// equation for how to calculate the overlay component's position and size
// in relation to the No-Code State's position and size.
@Injectable({
  providedIn: 'root',
})
export class OverlayComponentService {
  constructor(
    private appRef: ApplicationRef,
    private injector: Injector
  ) {}

  addDynamicComponent<T>(component: Type<T>, rect: any, borderPixels: number, hostViewContainerRef: ViewContainerRef) {
    console.log("Inside Add Dynamic Component");
    console.log("appRef: ", this.appRef);
    console.log("View Container Ref : ", hostViewContainerRef);
    console.log("", component)
    const { x, y, width, height } = rect;
    console.log("x, y, width, height : ", x, y, width, height);
    const componentRef = hostViewContainerRef.createComponent(component, {
      injector: this.injector
    });
    console.log("Component Reference : ", componentRef);

    // Assuming the component has the inputs width, height, x, y
    // Where x and y correspond to the top left corner of the svg element of this new component
    // and specifies where it should be overlaid, which should be on top of the logic unit object.
    (componentRef.instance as any).width = width - 2 * borderPixels;
    (componentRef.instance as any).height = height - 2 * borderPixels;
    (componentRef.instance as any).x = x + borderPixels;
    (componentRef.instance as any).y = y + borderPixels;

    this.appRef.attachView(componentRef.hostView);

    const domElem = (componentRef.hostView as any).rootNodes[0] as HTMLElement;
    console.log("domElem: ", domElem);
    document.body.appendChild(domElem);
  }
}