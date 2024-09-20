import { Injectable, ApplicationRef, Injector, ViewContainerRef, Type } from '@angular/core';

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

