// polari-platform-angular/src/app/models/noCode/Connector.ts
export class Connector {
    id: number;
    //Indicates the Id of the output slot component this connector latches to and pulls data from.
    sourceSlot: number;
    //Indicates the Id of the input slot component this connector latches to and pushes data to.
    sinkSlot: number;
    //Indicates the name of the state that contains the sink slot
    targetStateName?: string;

    //Defines a configuration object used for configuring variable information for a new class, or modifying/duplicating an existing class.
    constructor(id: number, sourceSlot: number, sinkSlot: number, targetStateName?: string)
    {
        this.id = id;
        this.sourceSlot = sourceSlot;
        this.sinkSlot = sinkSlot;
        this.targetStateName = targetStateName;
    }
}