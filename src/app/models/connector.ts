export class Connector {
    id: number;
    //Indicates the Id of the output slot component this connector latches to and pulls data from.
    sourceSlot: number;
    //Indicates the Id of the input slot component this connector latches to and pushes data to.
    sinkSlot: number;
    

    //Defines a configuration object used for configuring variable information for a new class, or modifying/duplicating an existing class.
    constructor(id: number, sourceSlot: number, sinkSlot: number)
    {
        this.id = id;
        this.sourceSlot = sourceSlot;
        this.sinkSlot = sinkSlot;
    }
}