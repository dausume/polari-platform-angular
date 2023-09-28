import { Connector } from "./connector";
import { MatIconModule } from '@angular/material/icon';

export class Slot {
    index?: number;
    //Indicates the Id of the state component this slot belongs to.
    stateId?: number;
    //
    name?: string;
    //In radians, gives the location of the slot in respect to the state component it belongs to.
    slotPosition?: number;
    //If true, is an output slot, if false is an input slot
    isOutput: boolean;
    //Keeps a list of all connectors attached to this slot.
    connectors?: Connector[];
    //For output nodes, indicates this slot is allowed to duplicate and send data to multiple locations.
    allowOneToMany: boolean = false;
    //For input nodes, indicates this slot may aggregate data from many sources before running.
    allowManyToOne: boolean = false;

    //Defines a configuration object used for configuring variable information for a new class, or modifying/duplicating an existing class.
    constructor(index?:number, stateId?:number, name?: string, slotPosition?: number, isOutput: boolean = true,connectors?: Connector[], allowOneToMany: boolean = false,allowManyToOne: boolean = false)
    {
        this.index = index;
        this.stateId = stateId;
        this.name = name;
        this.slotPosition = slotPosition;
        this.isOutput = isOutput;
        this.connectors = connectors;
        this.allowOneToMany = allowOneToMany;
        this.allowManyToOne = allowManyToOne;
    }
}