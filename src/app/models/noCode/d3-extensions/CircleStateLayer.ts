// Author: Dustin Etts
// polari-platform-angular/src/app/models/noCode/d3-extensions/CircleStateLayer.ts
import { D3ModelLayer } from './D3ModelLayer';
import CircleStateDataPoint from './DataPointTypes/CircleStateDataPoint';
import CircleSlotDataPoint from './DataPointTypes/CircleSlotDataPoint';
import { mockCircleStateDataPoints } from './mockDataPoints/mockCircleStateDataPoints';
import { NoCodeStateRendererManager } from '@services/no-code-services/no-code-state-renderer-manager';
import { BehaviorSubject, Subscription } from 'rxjs';
import {Slot} from '../Slot';
import * as d3 from 'd3';
import { NoCodeState } from '../NoCodeState';
import { NoCodeSolution } from '../NoCodeSolution';

// Defines how to render solid circles that can be dragged around the screen.
// This is used to represent the state components in the No-Code Interface.
export class CircleStateLayer extends D3ModelLayer {

  constructor(
    private rendererManager: NoCodeStateRendererManager, // Inject rendererManager (injecting in both parent and child seems to cause error?)
    shapeType: string,
    noCodeSolution: NoCodeSolution,
    stateDataPoints: CircleStateDataPoint[], 
    iconSvgString?: string,
    slotDataPoints?: CircleSlotDataPoint[],
    slotBorderLayer?: d3.Selection<SVGGElement, unknown, null, undefined>, 
    slotLayer?:d3.Selection<SVGGElement, unknown, null, undefined>, 
    connectorLayer?:d3.Selection<SVGGElement, unknown, null, undefined>,
    componentLayer?: d3.Selection<SVGGElement, unknown, null, undefined>, 
  ) 
  {
    console.log("CircleStateLayer constructor called");
    super(
      // Required parameters for the D3ModelLayer constructor
      shapeType, noCodeSolution, stateDataPoints, 
      // Optional parameters for the D3ModelLayer constructor
      iconSvgString, // Optional parameter used when loading an icon for the state
      slotDataPoints, // Optional parameter used when loading a no-code-solution that has been saved to the backend and configured.
      // Used when loading a no-code-solution from rendered layers that have been cached since render layers are not saved to the backend, 
      // only the minimal data required to render the layers.
      slotBorderLayer, slotLayer, connectorLayer, componentLayer
    );
     // Subscribe to the BehaviorSubject for the d3SvgBaseLayer in the renderer manager
     console.log("rendererManager in CircleStateLayer:", rendererManager);
     console.log("this.rendererManager:", this.rendererManager);
     console.log("this.rendererManager.subscribeToD3SvgBaseLayer:", this.rendererManager.subscribeToD3SvgBaseLayer);
     console.log("NoCodeSolution in CircleStateLayer:", this.noCodeSolution);
    // Explicitly typecast the BehaviorSubject to a Subscription to avoid type errors
    this.baseLayerSubscription = this.rendererManager.subscribeToD3SvgBaseLayer((baseLayer:d3.Selection<SVGSVGElement, unknown, null, undefined> | undefined) => {
      if (baseLayer) {
          console.log("Subscription triggered to update D3 Svg Base Layer in CircleStateLayer");
          this.setD3SvgBaseLayer(baseLayer);
      }
    });
    this.stateDataPoints = this.getCircleStateDataPointsFromSolution(noCodeSolution);
    this.slotDataPoints =  this.getCircleSlotDataPointsFromSolution(noCodeSolution);
  }

  // Retrieves the circle state objects from the no-code solution and converts them into data-points.
  /**
   * Retrieves all circle state objects from the NoCodeSolution and converts them into CircleStateDataPoint format.
   * This allows them to be rendered correctly in the CircleStateLayer.
   * Also appends inner component boxes and outer bounding boxes to the data points.
   * 
   * @param noCodeSolution - The NoCodeSolution containing NoCodeState objects.
   * @returns An array of CircleStateDataPoint objects for rendering.
   */
  private getCircleStateDataPointsFromSolution(noCodeSolution: NoCodeSolution): CircleStateDataPoint[] {
    if (!noCodeSolution) {
        console.error("NoCodeSolution is undefined. Cannot retrieve circle state data points.");
        return [];
    }

    console.log("Retrieving circle state data points from NoCodeSolution:", noCodeSolution.solutionName);

    let solutionStates = noCodeSolution.stateInstances
        .filter(state => state.shapeType === "circle") // Filter only circle states
        .map(state => (
          new CircleStateDataPoint(
            state.stateLocationX ?? 0, // cx
            state.stateLocationY ?? 0, // cy 
            state.stateSvgRadius ?? 10, // radius: Default to 10 if undefined
            state.stateName ?? "unknown", // stateName : Default to "unknown" if undefined
        )
      ));
        console.log("Solution States:", solutionStates);

        //solutionStates = this.appendInnerComponentBoxesToCircleDatapoints(solutionStates);
        //solutionStates = this.appendOuterBoundingBoxesToCircleDatapoints(solutionStates);
       
    return solutionStates;
  }

  //
  private getCircleSlotDataPointsFromSolution(noCodeSolution: NoCodeSolution) : CircleSlotDataPoint[]
  {
    if (!noCodeSolution) {
      console.error("NoCodeSolution is undefined. Cannot retrieve slot data points.");
      return [];
    }

    console.log("Retrieving circle state slot data points from NoCodeSolution:", noCodeSolution.solutionName);

    let slotDataPoints = noCodeSolution.stateInstances
      .filter(state => state.shapeType === "circle") // Filter only circle states
      .flatMap((state: NoCodeState) => 
          state.slots?.map((slot:Slot) => new CircleSlotDataPoint(
              state.stateLocationX ?? 0,
              state.stateLocationY ?? 0,
              state.stateSvgRadius ?? 10,
              slot.slotAngularPosition ?? 0,
              slot.isInput,
              slot.isOutput,
              state.stateName ?? "unknown"
          )) || [] // Ensure it does not return undefined
      );
    return slotDataPoints;
  }

  // --- Rendering Functions ---

  // Renders the CircleStateLayer by creating a circle for each data point in the dataPoints array.
  render(): void {
    console.log("Step 11 : Rendering CircleStateLayer");
    console.log("CircleStateLayer render called");
    this.initializeLayerGroup();
    this.initializeStateGroups();
  }

  // Create, Read, Update, Delete (CRUD) operations for the data points

  // --- Data Manipulation Functions ---

  // CRUD operations for the data points, which represent the No-Code State objects using circle-like svg's in the No-Code Interface.

  addNoCodeState(newState: NoCodeState): void {
    // Confirm the shape type is circle
    if (newState.shapeType === "circle") {
      // Validate the necessary properties
      const cx = newState.stateLocationX ?? 0; // Default to 0 if undefined
      const cy = newState.stateLocationY ?? 0; // Default to 0 if undefined
      const radius = newState.stateSvgRadius ?? 10; // Default radius if undefined
      const color = newState.backgroundColor ?? "blue"
  
      // Create the CircleStateDataPoint
      const newStateDataPoint: CircleStateDataPoint = new CircleStateDataPoint(cx, cy, radius);
  
      // Add the new state data point to the layer (implementation-dependent)
      console.log("Added new CircleStateDataPoint:", newStateDataPoint);
    } else {
      console.warn(
        "Invalid No-Code State: Ensure shapeType is 'circle' for states added to the CircleStateLayer."
      );
    }
  }
  

  getStateDataPoints(): any[] {
    return this.stateDataPoints || [];
  }
  
  setStateDataPoints(dataPoints: any[]): void {
    this.stateDataPoints = dataPoints;
  }

  
  
  updateDataPoints(newDataPoints: any[]): void {
    this.stateDataPoints = newDataPoints;
    this.render();
  }  

  // Add a new data point to the dataPoints array
  addStateDataPoint(datapoint: CircleStateDataPoint): void {
    this.stateDataPoints.push(datapoint);
  }

  // Remove a data point from the dataPoints array
  removeDataPoint(datapoint: CircleStateDataPoint): void {
    const index = this.stateDataPoints.indexOf(datapoint);
    if (index > -1) {
      this.stateDataPoints.splice(index, 1);
    }
  }

  // Update a data point in the dataPoints array
  updateDataPoint(oldDatapoint: CircleStateDataPoint, newDatapoint: CircleStateDataPoint): void {
    const index = this.stateDataPoints.indexOf(oldDatapoint);
    if (index > -1) {
      this.stateDataPoints[index] = newDatapoint;
    }
  }

  // Get a data point from the dataPoints array
  getDataPoint(index: number): CircleStateDataPoint {
    return this.stateDataPoints[index];
  }

  // -- CRUD operations for the slots, which act as the basis for interconnecting States and managing input and output flow --

  // Add a new slot to the slots array
  addSlot(slot: Slot): void {
    this.slotDataPoints.push(slot);
  }

  // Remove a slot from the slots array
  removeSlot(slot: Slot): void {
    const index = this.slotDataPoints.indexOf(slot);
    if (index > -1) {
      this.slotDataPoints.splice(index, 1);
    }
  }

  // Update a slot in the slots array
  updateSlot(oldSlot: Slot, newSlot: Slot): void {
    const index = this.slotDataPoints.indexOf(oldSlot);
    if (index > -1) {
      this.slotDataPoints[index] = newSlot;
    }
  }

  // Get a slot from the slots array
  getSlot(index: number): Slot {
    return this.slotDataPoints[index];
  }

  // -- Layer Level Functions --

  initializeLayerGroup(): void {
    // Ensure a specific <g> wrapper exists for this Layer, specific to the svg, shape type, and No-Code Solution.
    let layerGroup = this.d3SvgBaseLayer
    .selectAll(`g.${this.layerName}`)
    .data([null]); // Bind one element to ensure a single group exists

    layerGroup = layerGroup.enter()
      .append('g')
      .classed(`${this.layerName}`, true)
      .merge(layerGroup);

    console.log("Group selection after enter():", layerGroup);
  }

  // Gets the baseline group for this layer.
  getLayerGroup(): any {
    return this.d3SvgBaseLayer
      .selectAll(`g.${this.layerName}`)
  }

  // Clears the layer group of all elements
  protected clearLayerGroup(): void {
    let layerGroup = this.getLayerGroup();
    layerGroup.selectAll('*').remove();
  }

  // -- State-Group Functions --

  initializeStateGroups(): void {
    if(this.d3SvgBaseLayer)
      {
        // Select states *only* inside the correct group
        let layerGroup = this.getLayerGroup()
        
        console.log("LayerGroup before state group creation:", layerGroup);
        console.log("this.stateDataPoints before state group creation:", this.stateDataPoints);
        
        let stateGroups = layerGroup
          .selectAll('g.state-group')
          .data(this.stateDataPoints, (datapoint: any) => datapoint.stateName || "unknown"); // Bind data
    
        console.log("stateGroups selection before enter():", stateGroups);
    
        // ENTER: Append new circles **inside the group**
        const newStateGroups = stateGroups.enter()
          .append('g')
          .classed('state-group', true)
          .attr('state-name', (datapoint) => {
            console.log("State-group name:", datapoint.stateName);
            return datapoint.stateName || "unknown";
          })
          .attr('x', (datapoint) => {
            console.log(`Creating state-group in '${this.noCodeSolution?.solutionName}' at X:`, datapoint.cx);
            return datapoint.cx - datapoint.radius;
          })
          .attr('y', (datapoint) => {
            console.log(`Creating state-group in '${this.noCodeSolution?.solutionName}' at Y:`, datapoint.cy);
            return datapoint.cy - datapoint.radius;
          })
          .each((datapoint, index, elements) => {  
            let group = d3.select(elements[index]); // Correct way to select element in Angular

            console.log(`Appending new state-group: ${datapoint.stateName}`);

            // Append the inner component rectangle
            group.append('rect')
                .classed('bounding-box', true)
                .attr('x', - datapoint.radius)
                .attr('y', - datapoint.radius)
                .attr('width', 2*datapoint.radius)
                .attr('height', 2*datapoint.radius)
                .attr('fill', "white")
                .attr('stroke', "black");

            // Append the background circle (visual representation of state)
            group.append('circle')
                .classed('draggable-shape', true)
                .attr('r', datapoint.radius)
                .attr('fill', "blue")
                .attr('stroke', "black");
                

            console.log("appending circle to state-group:", group);

            // Append the inner component rectangle
            group.append('rect')
                .classed('overlay-component', true)
                .attr('x', - ((1.4 * datapoint.radius)/2)) // This is the offset from the center of the circle, since it is in a group
                .attr('y', - ((1.4 * datapoint.radius)/2)) // Position in relation to the group.
                .attr('width', 1.4*datapoint.radius)
                .attr('height', 1.4*datapoint.radius)
                .attr('fill', "white")
                .attr('stroke', "black");

            // Generate the bezier path for the circle
            let bezierPath = this.generateCircularBezierPath(datapoint.radius);// Retrieve the Bezier path for the circle's boundary.
            group.append('path') // The slot path will need to be used for slot placement.
                .attr('d', bezierPath) // Set the path's data attribute to the Bezier path - positioning handled by d.
                .classed('slot-path', true)
                .attr('fill', 'none')  // Make the path transparent (no fill)
                .attr('stroke', 'red') // Set the stroke color for the path
                .attr('stroke-width', 8) // Set the stroke width for better visibility
                .node() as SVGPathElement; // Return the DOM node for the path

            console.log("appending inner component to state-group:", group);
          })
          .call(this.createDragStateBehavior()) // Apply drag behavior
          .merge(stateGroups); // Merge enter and update selections
    
        console.log("New states added:", newStateGroups.size());
    
        console.log("Updated states:", newStateGroups);
    
        // EXIT: Remove circles that no longer exist in data
        stateGroups.exit().remove();
        console.log("State group render complete.");
    
      }
  }

  getStateGroups(): any {
    return this.getLayerGroup()
      .selectAll('g.state-group');
  }

  // -- Background Circles of States Layer Functions --

  // We select all circles in the layer, so that we re-render all circles on each render call.
    // We should not only use cx and cy but also assign an index to act as a unique identifier for each circle.
    // This way we can guarantee that each circle is uniquely identified and can be updated correctly
    // and logic conflicts can be avoided.
    /*
      initializeCircleStateLayer(): void {
    if(this.d3SvgBaseLayer)
      {
        // Select circles should simply use the attributes of their immediate parent
        // group.  This is so that we can easily manipulate the circles by manipulating the group.
        // as well as the other elements in the group.
        //
        // By binding the data to the group, we can ensure we only have to update the group
        // element in order to update the circle, inner component, and bounding box.
        let circles = this.getStateGroups()
          .data(d => [d]) // Bind one datum per group (for each state group bind one circle)
          .join(
            enter => enter.append('circle')
                .classed('circle-state', true)
                .attr('r', d => d.radius || 10)
                .attr('fill', 'blue'),
            update => update // No additional updates for now
        );
    
        console.log("Circle selection before enter():", circles);
    
        // ENTER: Append new circles **inside the group**
        
        const newCircles = circles.enter()
        .append('g')
        .classed('state-group', true)
        .attr('cx', (datapoint) => {
          console.log(`Creating state-group in '${this.noCodeSolution?.solutionName}' at X:`, datapoint.cx);
          return datapoint.cx;
        })
        .attr('cy', (datapoint) => {
          console.log(`Creating state-group in '${this.noCodeSolution?.solutionName}' at Y:`, datapoint.cy);
          return datapoint.cy;
        })
        .attr('r', (datapoint) => {
          console.log("State-group radius:", datapoint.radius);
          return datapoint.radius || 10;
        })
        .attr('state-name', (datapoint) => {
          console.log("State-group color:", datapoint.stateName);
          return datapoint.color || "blue";
        })
        .call(this.createDragStateBehavior()) // Apply drag behavior
        .merge(circles); // Merge enter and update selections
        
    
        console.log("New circles added:", newCircles.size());
    
        // UPDATE: Modify existing circles in the correct group
        newCircles
        .attr('cx', (datapoint) => datapoint.cx)
        .attr('cy', (datapoint) => datapoint.cy)
        .attr('r', (datapoint) => datapoint.radius)
        .attr('fill', (datapoint) => datapoint.color);
        
        console.log("created circles:", circles);
    
        // EXIT: Remove circles that no longer exist in data
        circles.exit().remove();
        console.log("CircleStateLayer render complete.");
    
      }
  }*/

  // Gets the circle states in the layer
  getCircleElements(): d3.Selection<SVGGElement, CircleStateDataPoint, any, unknown> {
    return this.getStateGroups()
      .selectAll('circle.state-circle');
  }

  // -- Overlay Component Functions --

  // Render the inner rectangles inside circles
  // temporarily we do this by rendering rectangles, but in the future we will render components
  // we should dynamically calculate the position and size of the inner component based on the circle's position and size
  // This is primarily used for the initial rendering of the inner components, on load of the overall no-code interface.
  /*
  initializeOverlayComponents(): void {
    // It is not gaurenteed that all 'rect' elements will be a rectangular component container
    // so we should add some kind of identifier for circle inner rectangles to the data to ensure that we can differentiate 
    // between them.
    if(this.d3SvgBaseLayer)
    {
      let stateLayer = this.getStateGroups(); // Get the state layer
      console.log("State Layer in initializeOverlayComponents:", stateLayer);
      // Since we position the innerComponent rect insise the circle, we should tie the innerComponentBox
      // to always translate with the circle, so that the innerComponent is always inside the circle in the
      // correct position and size relative to the circle it is inside.
      stateLayer.each((datapoint: CircleStateDataPoint, index: number, elements: any) => {
        let currentElement = d3.select(elements[index]); // Explicitly select the current element
        console.log("Current Element in initializeOverlayComponents with datapoint ", datapoint ,":", currentElement);
        currentElement.append('rect')
            .classed('circle-state-inner-component', true)
            .attr('x', datapoint.innerComponentBoxX)
            .attr('y', datapoint.innerComponentBoxY)
            .attr('width', datapoint.innerComponentBoxWidth)
            .attr('height', datapoint.innerComponentBoxHeight)
            .attr('fill', 'white')
            .attr('stroke', 'black');
      });
    }
  }
  */

  // --- Slot Placement Functions ---

  /**
   * Calls the function to generate the bezier paths for the circles, and then adds the bezier paths to the SVG.
   * @param svg - The SVG selection where the circle will be drawn.
   * @param cx - The x-coordinate of the circle's center.
   * @param cy - The y-coordinate of the circle's center.
   * @param r - The radius of the circle.
   * @returns The SVGPathElement representing the Bezier circle.
   */
  initializeCircularBezierSlotPaths(): void {
    // Go through all circle states from this layer and generate bezier paths to contour each circle.
    // This is done to ensure that the slots are placed on the circle's border, and not inside the circle.
    this.stateDataPoints.forEach((datapoint: CircleStateDataPoint) => {
      // Render the bezier path for the circle
      const bezierPath = this.generateCircularBezierPath(datapoint.radius);// Retrieve the Bezier path for the circle's boundary.
      /*
      // Append the path element to the SVG
      svg.append('path')
        .attr('d', bezierPath) // Set the path's data attribute to the Bezier path
        .attr('fill', 'none')  // Make the path transparent (no fill)
        .attr('stroke', 'black') // Set the stroke color for the path
        .attr('stroke-width', 2) // Set the stroke width for better visibility
        .node() as SVGPathElement; // Return the DOM node for the path
      */
    });
    // Define the Bezier curve path for a circle
      
  }

    /**
   * 
   * @param r 
   * @returns 
   * 
   * return `
      M ${cx - r}, ${cy}
      Q ${cx - r}, ${cy - r} ${cx}, ${cy - r} // First quadratic Bezier curve: top-left quadrant
      Q ${cx + r}, ${cy - r} ${cx + r}, ${cy} // Second quadratic Bezier curve: top-right quadrant
      Q ${cx + r}, ${cy + r} ${cx}, ${cy + r} // Third quadratic Bezier curve: bottom-right quadrant
      Q ${cx - r}, ${cy + r} ${cx - r}, ${cy} // Fourth quadratic Bezier curve: bottom-left quadrant
      Z                                     // Close the path to form a complete circle
    `;
   
    // Generates a Bezier path for the circular no-code state, given its center and radius.
    private generateCircularBezierPath(cx: number, cy: number, r: number): string {
      // made adjustments since we shifted to having the bezier path be a part of the state-group
      return `
        M ${-r}, 0 // Bottom of the circle
        Q ${- r}, ${-r} 0, ${-r} // First quadratic Bezier curve: top-left quadrant
        Q ${r}, ${- r} ${r}, ${cy} // Second quadratic Bezier curve: top-right quadrant
        Q ${r}, ${r} 0, ${r} // Third quadratic Bezier curve: bottom-right quadrant
        Q ${- r}, ${r} ${- r}, 0 // Fourth quadratic Bezier curve: bottom-left quadrant
        Z                                     // Close the path to form a complete circle
      `;
      return `
      M 0, ${r}  // Start at the leftmost point of the circle
      Q 0, 0 ${r}, 0  // First quadrant: top-left curve
      Q ${2 * r}, 0 ${2 * r}, ${r}  // Second quadrant: top-right curve
      Q ${2 * r}, ${2 * r} ${r}, ${2 * r}  // Third quadrant: bottom-right curve
      Q 0, ${2 * r} 0, ${r}  // Fourth quadrant: bottom-left curve
      Z  // Close the path to complete the circle
    `;
    }
    */
  // Generates a Bezier path for the circular no-code state, given its center and radius.
  generateCircularBezierPath(r: number): string {
    // made adjustments since we shifted to having the bezier path be a part of the state-group
    return `
      M 0, ${r}
      Q 0, 0 ${r}, 0
      Q ${2 * r}, 0 ${2 * r}, ${r}
      Q ${2 * r}, ${2 * r} ${r}, ${2 * r}
      Q 0, ${2 * r} 0, ${r}
      Z
    `;
  }

  /**
   * Renders slot markers (e.g., small circles) along a Bezier curve at specified angles.
   * this should be a layer that exists on top of the circle layer, to ensure drag events on the slots are not
   * interfered with by the circle layer.
   * @param svg - The SVG selection where the slots will be rendered.
   * @param path - The SVGPathElement representing the Bezier curve.
   * @param cx - The x-coordinate of the circle's center.
   * @param cy - The y-coordinate of the circle's center.
   * @param r - The radius of the circle.
   * @param slots - The number of slots to render.
   */
  renderGeneralSlots(
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>, // This should be a layer that exists on top of the circle layer.
    path: SVGPathElement,
    slots: Slot[]
  ) 
  {
    // We make an assumption that 4/5ths of the length of the bezier curve should be open and available
    // for use in manipulating the State itself, while the remaining 1/5th should be used for slot placement.
    // This is a temporary assumption, and in the future we should allow for the user to specify the slot placement
    // themselves.  We should also allow for the user to specify the number of slots they want to place on the bezier curve.
    // the size of the slots should be determined by the length of the bezier curve and the number of slots.
    const bezierLength = path.getTotalLength();
    // 1/5th of the bezier curve length is used for slot placement
    const slotLength = bezierLength / 5; 
    // The radius of the slot is by default 1/5th of the state's bezier curve length, but should not be less than 10 pixels.
    // It will still occupy more than 1/5th of the bezier curve length if the number of slots is too high, but
    // will still throw an error if the slots are too numerous to fit on the bezier curve.
    const slotRadius = Math.min(slotLength / slots.length, 10); 
    // If the slots take up more space than the entire curve, 
    // we should not render them, and we should handle this by requesting the user to reduce the number of slots
    // or to increase the size of the bezier curve by making the circle/state larger.
    const tooManySlots = (slotRadius * slots.length > slotLength);
    if (tooManySlots) {
      console.error('Too many slots to fit on the Bezier curve.');
    }
    else{
      // Calculate the angles for slot placement (evenly distributed around 360 degrees)
      const defaultAngleIncrements = Array.from({ length: slots.length }, (_, i) => (360 / slots.length) * i);

      // Iterate over each angle and calculate its position on the path
      defaultAngleIncrements.forEach(angle => {
        const { x, y } = this.getSlotPositionOnBezier(path, angle); // Get the point on the path for the given angle

        // Append a small circle at the calculated position to represent a slot
        svg.append('circle')
          .attr('cx', x)      // Set the x-coordinate of the slot
          .attr('cy', y)      // Set the y-coordinate of the slot
          .attr('r', slotRadius)       // Set the radius of the slot marker
          .attr('fill', 'blue'); // Set the fill color of the slot marker
      });
    }
    
  }

  // --- Generator Functions for supporting overlay functions ---

  // Goes through all data points and calculates the inner component box variables for each circle.
  // Generally will only be called once, when the No-Code Solution Component is first created.
  private appendInnerComponentBoxesToCircleDatapoints(datapoints: CircleStateDataPoint[]): CircleStateDataPoint[] {
    for (const datapoint of datapoints) {
      // Calculate the inner component box based on the circle's position and size
      datapoint.innerComponentBoxX = datapoint.cx - datapoint.radius / 2;
      datapoint.innerComponentBoxY = datapoint.cy - datapoint.radius / 2;
      datapoint.innerComponentBoxWidth = datapoint.radius;
      datapoint.innerComponentBoxHeight = datapoint.radius;
    }
    return datapoints;
  }

  // Goes through all data points and calculates the outer bounding box variables for each circle.
  // Generally will only be called once, when the No-Code Solution Component is first created.
  private appendOuterBoundingBoxesToCircleDatapoints(datapoints: CircleStateDataPoint[]): CircleStateDataPoint[] {
    for (const datapoint of datapoints) {
      // Calculate the outer bounding box based on the circle's position and size
      datapoint.outerBoundingBoxX = datapoint.cx - datapoint.radius / 2;
      datapoint.outerBoundingBoxY = datapoint.cy - datapoint.radius / 2;
      datapoint.outerBoundingBoxWidth = datapoint.radius;
      datapoint.outerBoundingBoxHeight = datapoint.radius;
    }
    return datapoints;
  }
  
  // --- Retrieval Functions for getting related objects : Slots, Connectors, Overlay Componenets ---

  /**
   * Calculates the point on a Bezier path corresponding to a given polar angle, and transforms it to Cartesian coordinates.
   * @param path - The SVGPathElement representing the Bezier curve.
   * @param angle - The angle in degrees (0-360) representing the position on the curve.
   * @param cx - The x-coordinate of the circle's center.
   * @param cy - The y-coordinate of the circle's center.
   * @returns The x and y coordinates of the point on the path.
   */
  getSlotPositionOnBezier(
    path: SVGPathElement,
    angle: number
  ): { x: number; y: number } {
    // Get the total length of the path
    const totalLength = path.getTotalLength();

    // Normalize the angle to a fraction of the total path length
    const theta = angle % 360;       // Ensure the angle is between 0 and 360
    const fraction = theta / 360;    // Convert the angle to a fraction of the circle

    // Get the point on the path at the corresponding length
    const point = path.getPointAtLength(fraction * totalLength);

    return { x: point.x, y: point.y }; // Return the calculated coordinates
  }

  // Get a connector originating from a slot on one circle to a slot on another circle

  // Get an overlay component that is displayed within a circle
  // since overlay components are not rendered by d3, we should use the overlay component service to render them
  // however, we should still have a function that returns the overlay component that is displayed within a circle
  // so that we can use it in the drag event handlers for the circles.
  // This function should return the overlay component that is displayed within the who's cx and cy are closest to the 
  // given x and y.

  // --- Event Handlers ---

  // -- Drag behavior for the state circles --

  // Drag behavior with modularized event handlers
  private createDragStateBehavior(): d3.DragBehavior<SVGCircleElement, CircleStateDataPoint, CircleStateDataPoint> {
    return d3.drag<SVGCircleElement, CircleStateDataPoint>()
      .on('start', (event, d) => this.onDragStateStart(event, d))
      .on('drag', (event, d) => this.onDragState(event, d))
      .on('end', (event, d) => this.onDragStateEnd(event, d));
  }

  // Event handlers for drag behavior for when the circle starts being dragged.
  private onDragStateStart(event: d3.D3DragEvent<SVGCircleElement, CircleStateDataPoint, CircleStateDataPoint>, datapoint: CircleStateDataPoint): void {
    console.log("Drag Start event triggered");
    // We should make the overlay component corresponding to this circle invisible while dragging.
    // This is because dragging the overlay component along with the circle may be too expensive
    // to update in real-time.
    let target : EventTarget | null = event.sourceEvent.target;
    const targetElement: HTMLElement | null = target as HTMLElement;
    console.log("Target Element:", targetElement);
    //if(!targetElement){return;}
    // Find the closest state-group <g> element
    const groupElement: SVGGElement | null = targetElement.closest('g.state-group');
    //if(!groupElement){return;}
    // Convert the groupElement to a D3 selection
    const group: d3.Selection<SVGGElement, unknown, null, undefined> = d3.select(groupElement);
    /*
    // Store the initial mouse click position relative to the group's current transform
    const transform = groupNode.getCTM(); // Get current transformation matrix
    console.log("Initial Transform:", transform);
    console.log("Initial Event coordinates:", event.x, event.y);
    if (transform) {
      // event.x and event.y are the mouse coordinates relative to the group g.state-group SVG
      // transform.e and transform.f are the x and y coordinates of the group g.state-group
      datapoint._dragOffsetX = event.x - transform.e;
      datapoint._dragOffsetY = event.y - transform.f;
    } else {
      datapoint._dragOffsetX = 0;
      datapoint._dragOffsetY = 0;
    }
    */
    // Ensure drag only starts if the clicked element is a circle
    if (targetElement?.tagName === 'circle') {
      console.log(`Dragging started for ${datapoint.stateName}`);
      console.log("Initial Offset:", { x: datapoint._dragOffsetX, y: datapoint._dragOffsetY });
      group.raise().attr('stroke', 'black'); // Highlight active group
    }
    console.log("Drag Start event complete");
  }

  // Event handlers for drag behavior for while the circle is being dragged.
  private onDragState(event: d3.D3DragEvent<SVGCircleElement, CircleStateDataPoint, CircleStateDataPoint>, datapoint: CircleStateDataPoint): void {
    console.log("Drag event triggered");
    // By changing the cx and cy attributes of the circle, we are effectively moving the circle on the screen.
    //d3.select(event.sourceEvent.target)
    //  .attr('cx', datapoint.cx)
    //  .attr('cy', datapoint.cy); // Update SVG attributes
    //let group = d3.select(event.sourceEvent.target.closest('g.state-group'));
    let target : EventTarget | null = event.sourceEvent.target;
    //if(!target){return;}
    const targetElement: HTMLElement | null = target as HTMLElement;
    // Find the closest state-group <g> element
    const groupElement: SVGGElement | null = targetElement.closest('g.state-group');
    //if(!groupElement){return;}
    // Convert the groupElement to a D3 selection
    const group: d3.Selection<SVGGElement, unknown, null, undefined> = d3.select(groupElement);
    //if (event.sourceEvent.target.tagName === 'circle') 
    if (targetElement?.tagName === 'circle') 
    {
      //console.log(`Dragging ${datapoint.stateName}`);
      //console.log("Event:", event);
      //console.log("DataPoint:", datapoint);
      //console.log("group:", group);
      //console.log("Group Element:", groupElement);
      // Compute new translation by accumulating dx and dy
      //const currentCircleransform = group.attr("transform") || "translate(0,0)";
        //const matchCircle = currentCircleransform.match(/translate\(([-\d.]+),\s*([-\d.]+)\)/);
        //let currentCircleX = matchCircle ? parseFloat(matchCircle[1]) : 0;
        //let currentCircleY = matchCircle ? parseFloat(matchCircle[2]) : 0;
        //console.log("Current Circle Transform:", { currentCircleX, currentCircleY });

      // We should update the group's transform attribute to move the entire group
        const currentGroupTransform = group.attr("transform") || "translate(0,0)";
        const matchGroup = currentGroupTransform.match(/translate\(([-\d.]+),\s*([-\d.]+)\)/);
        let currentGroupX = matchGroup ? parseFloat(matchGroup[1]) : 0;
        let currentGroupY = matchGroup ? parseFloat(matchGroup[2]) : 0;
        console.log("Current Group Transform:", { currentGroupX, currentGroupY });
        console.log("Event dx, dy:", event.dx, event.dy);
        // Apply incremental movement
        const translateX = currentGroupX + event.dx;
        const translateY = currentGroupY + event.dy;

        // Update the group transformation
        group.attr('transform', `translate(${translateX}, ${translateY})`);
    }
    console.log("Drag event complete");
  }

  // Event handlers for drag behavior for when the circle stops being dragged.
  private onDragStateEnd(event: d3.D3DragEvent<SVGCircleElement, CircleStateDataPoint, CircleStateDataPoint>, datapoint: CircleStateDataPoint): void {
    console.log("Drag End event triggered");
    // We should make the overlay component corresponding to this circle visible again after updating the
    // overlay component's position based on the new position of the circle.
    let target : EventTarget | null = event.sourceEvent.target;
    //if(!target){return;}
    const targetElement: HTMLElement | null = target as HTMLElement;
    // Find the closest state-group <g> element
    const groupElement: SVGGElement | null = targetElement.closest('g.state-group');
    //if(!groupElement){return;}
    // Convert the groupElement to a D3 selection
    const group: d3.Selection<SVGGElement, unknown, null, undefined> = d3.select(groupElement);
    //let group = d3.select(event.sourceEvent.target.closest('g.state-group'));

    if (targetElement?.tagName === 'circle') {
      group.attr('stroke', null);
    }
    console.log("Drag End event complete");
  }


  // Ensure cleanup of the subscription
  public destroy(): void {
    this.baseLayerSubscription?.unsubscribe();
  }

}