// Defines the data which should exist in the data-point being used with d3 to render these kinds of circles.

/*
        Sample Svg group for rendering a basic circle state object with no slots.
        Note that the order of the elements in the group is important for rendering.
        We recieve the data on the circle state shape first, then derive the inner component and bounding box.
        <g class="no-code-state-0">
            <rect class="circle-state-bounding-box" x="0" y="0" width="100" height="100" fill="white" stroke="black"></rect>
            <circle class="circle-state" cx="50" cy="50" r="50" fill="blue"></circle>
            <rect class="circle-state-inner-component" x="15" y="15" width="70" height="70" fill="white" stroke="black"></rect>
        </g>
*/

export default class CircleSlotDataPoint {
  
    // These are from the parent state object
    // Used for reference so we can calculate where our slots should be located on the border of the circle.
    cx: number; // x coordinate of the center of the circle
    cy: number; // y coordinate of the center of the circle
    radius: number; // radius of the circle
    solutionName?: string; // name of the solution this state belongs to.
    stateName?: string; // name of the state this slot is associated with.

    // These are specific to the slot object
    // We use the angular position to determine where the slot should be placed on the border of the circle.
    angularPosition: number; // angle of the circle this slot is at.
    // Used for determining the event rules that occur when a slot is clicked and dragged
    // to connect to another slot, for interconnecting no-code states.
    isInput: boolean; // is this slot an input slot?
    isOutput: boolean; // is this slot an output slot?
    //
    index: number; // index of the slot in the parent state object. This is used to determine the order of the slots when rendering them.

    // Slot appearance
    color?: string; // custom color for the slot (hex format)
    label?: string; // display label (e.g., "I0", "O1")

    constructor(
        cx: number,
        cy: number,
        radius: number,
        index: number,
        angularPosition: number,
        isInput: boolean,
        isOutput: boolean,
        stateName?: string,
        solutionName?: string,
        color?: string,
        label?: string
    ) {
        this.cx = cx;
        this.cy = cy;
        this.radius = radius;
        this.angularPosition = angularPosition;
        this.isInput = isInput;
        this.isOutput = isOutput;
        this.stateName = stateName;
        this.solutionName = solutionName;
        this.index = index;
        this.color = color;
        this.label = label;
    }
}