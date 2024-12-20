// polari-platform-angular/src/app/models/noCode/slot.ts
// Author: Dustin Etts
// Defines a class for a slot, which is a connection point on a state component.
// Slots can be input or output, and can have multiple connectors attached to them.
import { Connector } from "./Connector";
import { MatIconModule } from '@angular/material/icon';

export class Slot {
    // Index of the slot in respect to the layer it is defined in.
    index?: number;
    //Indicates the Id of the state component this slot belongs to.
    stateId?: number;
    // Layer of the slot in respect to the state component it belongs to.
    layerId?: string;
    //In degrees out of 360, gives the location of the slot in respect to the state component it belongs to.
    slotAngularPosition?: number;
    //Keeps a list of all connectors attached to this slot.
    connectors?: Connector[];
    //For output nodes, indicates this slot is allowed to duplicate and send data to multiple locations.
    allowOneToMany: boolean = false;
    //For input nodes, indicates this slot may aggregate data from many sources before running.
    allowManyToOne: boolean = false;

    //Defines a configuration object used for configuring variable information for a new class, or modifying/duplicating an existing class.
    constructor(index?:number, stateId?:number, layerId?:string, slotAngularPosition?: number, connectors?: Connector[], allowOneToMany: boolean = false,allowManyToOne: boolean = false)
    {
        this.index = index;
        this.stateId = stateId;
        this.slotAngularPosition = slotAngularPosition;
        this.connectors = connectors;
        this.allowOneToMany = allowOneToMany;
        this.allowManyToOne = allowManyToOne;
    }
}