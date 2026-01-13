// Author: Dustin Etts
// polari-platform-angular/src/app/models/noCode/d3-extensions/D3ModelLayer.ts
import * as d3 from 'd3';
import { NoCodeState } from '../NoCodeState';
import { NoCodeStateRendererManager } from '@services/no-code-services/no-code-state-renderer-manager';
import { Subscription } from 'rxjs';
import { NoCodeSolution } from '../NoCodeSolution';

// The D3ModelLayer class is used to define the base class for all D3ModelLayer objects that are used to render the
// No-Code State objects in the No-Code Solution Editor or the No-Code State Editor.
// A single D3ModelLayer object should be specific to a NoCodeSolution object and a type of No-Code State object.
export abstract class D3ModelLayer 
{
  public shapeType: string = ''; // This should correspond to a specific D3ModelLayer implementation.

  public iconSvgName: string | undefined; // This should correspond to a specific icon based on a svg image that will be rendered onto the base d3 shape.

  // Effectively a reference to the SVG element that this model will render to
  // often these svg elements are referred to as 'layers' in the context of d3
  // or in the context of some mapping libraries like leaflet, which similarly
  // use a 'layer' concept and depends on d3.
  public d3SvgBaseLayer: d3.Selection<SVGSVGElement, unknown, null, undefined> | undefined;

  public baseLayerSubscription: Subscription | undefined;

  // Ensure that a specific model defines the data point data that it will use to render its elements.
  protected stateDataPoints: any; // The type should be defined by the specific model.

  // Slot data points are used to render the slots of the state elements.
  protected slotDataPoints?: any; // The type should be defined by the specific model.

  // This layer is used to allocate component overlays to externally.
  protected componentLayer?: d3.Selection<SVGGElement, unknown, null, undefined> | undefined; // d3.Selection<SVGGElement, unknown, null, undefined>;

  // This layer is used to render the border of the svg elements of each state as a bezier curve,
  // so that we can choose to see the bezier curve being used as a path for the slots for debugging
  // purposes.
  protected slotBorderLayer?: d3.Selection<SVGGElement, unknown, null, undefined> | undefined; // d3.Selection<SVGGElement, unknown, null, undefined>;

  // This layer is used to render the slots of the svg elements of each state on their bezier curves,
  // so that we can interact with the slots and drag them around for the purpose of either connecting
  // them to other slots or simply repositioning them.
  protected slotLayer?: d3.Selection<SVGGElement, unknown, null, undefined> | undefined; // d3.Selection<SVGGElement, unknown, null, undefined>;
  
  // This layer is used to render the connectors between slots of the svg elements of each state,
  protected connectorLayer?: d3.Selection<SVGGElement, unknown, null, undefined> | undefined; // d3.Selection<SVGGElement, unknown, null, undefined>;

  protected layerName?: string; // This should correspond to a layer shape type - named svg combination, so layers can be unique per solution.

  noCodeSolution: NoCodeSolution | undefined;

  constructor( // Note : RendererManager is not used in this class, but should be used in all child classes.
    shapeType: string,
    noCodeSolution: NoCodeSolution,
    stateDataPoints: any[], 
    iconSvgName?: string,
    slotDataPoints?: any[], 
    slotBorderLayer?: d3.Selection<SVGGElement, unknown, null, undefined>, 
    slotLayer?:d3.Selection<SVGGElement, unknown, null, undefined>, 
    connectorLayer?:d3.Selection<SVGGElement, unknown, null, undefined>, 
    componentLayer?: d3.Selection<SVGGElement, unknown, null, undefined>,
  ) 
  {
    console.log('D3ModelLayer constructor');
    this.shapeType = shapeType;
    this.iconSvgName = iconSvgName;
    // the following sections will almost always be loaded through an automated process and are allowed to be undefined
    this.componentLayer = componentLayer;
    this.slotBorderLayer = slotBorderLayer;
    this.slotLayer = slotLayer;
    this.connectorLayer = connectorLayer;
    // Data points used to render the elements
    this.stateDataPoints = stateDataPoints || [];
    this.slotDataPoints = slotDataPoints || [];
    this.noCodeSolution = noCodeSolution;
    this.setLayerName();
  }

  abstract render(): void;

  abstract addNoCodeState(newState: NoCodeState): void

  // Connects the base layer used by the rendering service to perform the rendering
  setD3SvgBaseLayer(d3SvgBaseLayer: d3.Selection<SVGSVGElement, unknown, null, undefined>)
  {
    console.log("Setting D3 Svg Base Layer on D3ModelLayer");
    this.d3SvgBaseLayer = d3SvgBaseLayer;
    console.log("Update D3 Svg Base Layer on D3ModelLayer : ", this.d3SvgBaseLayer);
  }

  // Layer names are set only automatically using a combination of the shape type, the no-code-solution name,
  // and the name of the svg element used if any.
  // Solution names are sanitized to remove spaces and special characters that would break CSS selectors.
  setLayerName()
  {
    const sanitizedSolutionName = this.noCodeSolution?.solutionName?.replace(/[^a-zA-Z0-9-_]/g, '-') || 'unknown';
    const sanitizedIconName = this.iconSvgName?.replace(/[^a-zA-Z0-9-_]/g, '-') || 'default';
    this.layerName = sanitizedSolutionName + '-' + this.shapeType + '-' + sanitizedIconName;
  }

}
