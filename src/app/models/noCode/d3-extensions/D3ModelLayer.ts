import * as d3 from 'd3';

export abstract class D3ModelLayer {

  // Effectively a reference to the SVG element that this model will render to
  // often these svg elements are referred to as 'layers' in the context of d3
  // or in the context of some mapping libraries like leaflet, which similarly
  // use a 'layer' concept and depends on d3.
  protected d3SvgLayer: any; // d3.Selection<SVGSVGElement, unknown, null, undefined>;

  // This layer is used to allocate component overlays to externally.
  protected componentLayer: any; // d3.Selection<SVGGElement, unknown, null, undefined>;

  // This layer is used to render the border of the svg elements of each state as a bezier curve,
  // so that we can choose to see the bezier curve being used as a path for the slots for debugging
  // purposes.
  protected slotBorderLayer: any; // d3.Selection<SVGGElement, unknown, null, undefined>;

  // This layer is used to render the slots of the svg elements of each state on their bezier curves,
  // so that we can interact with the slots and drag them around for the purpose of either connecting
  // them to other slots or simply repositioning them.
  protected slotLayer: any; // d3.Selection<SVGGElement, unknown, null, undefined>;
  
  // This layer is used to render the connectors between slots of the svg elements of each state,
  protected connectorLayer: any; // d3.Selection<SVGGElement, unknown, null, undefined>;

  // Ensure that a specific model defines the data point data that it will use to render its elements.
  protected stateDataPoints: any; // The type should be defined by the specific model.

  // Slot data points are used to render the slots of the state elements.
  protected slotDataPoints: any; // The type should be defined by the specific model.

  constructor(d3SvgLayer: any, componentLayer: any, slotBorderLayer: any, slotLayer:any, connectorLayer:any, stateDataPoints: any, slotDataPoints: any) {
    // svg layers used for stratifying how d3 will perform rendering of the elements
    this.d3SvgLayer = d3SvgLayer;
    this.componentLayer = componentLayer;
    this.slotBorderLayer = slotBorderLayer;
    this.slotLayer = slotLayer;
    this.connectorLayer = connectorLayer;
    // Data points used to render the elements
    this.stateDataPoints = stateDataPoints;
    this.slotDataPoints = slotDataPoints;
  }

  abstract render(): void;
}
