// Author: Dustin Etts
// variableDef.ts

// This file defines the variableConfigDef class, which is used to store information about a variable in a class.
// This information is used to configure the variable in the class editor.
import { FormControl } from "@angular/forms";

export class variableConfigDef {

    varIndex: number;
    varName: string;
    varDisplayName: string;
    varType: string;
    varRefClass?: string;
    //Need to change form control in accordance with the type selected.
    varNameControl: FormControl;
    varDisplayNameControl: FormControl;
    soleIdentifier:Boolean = false;
    jointIdentifier:Boolean = false; 
    isUnique:Boolean = false;


    //Defines a configuration object used for configuring variable information for a new class, or modifying/duplicating an existing class.
    constructor(varIndex:number, varName:string, varDisplayName:string, varType:string, varNameControl:FormControl, varDisplayNameControl:FormControl, soleIdentifier:Boolean = false, jointIdentifier:Boolean = false, isUnique:Boolean = false, varRefClass?:string)
    {
        this.varIndex = varIndex;
        this.varName = varName;
        this.varDisplayName = varDisplayName;
        this.varType = varType;
        this.varRefClass = varRefClass;
        this.varNameControl = varNameControl;
        this.varDisplayNameControl = varDisplayNameControl;
        this.soleIdentifier = soleIdentifier;
        this.jointIdentifier = jointIdentifier;
        this.isUnique = isUnique;
    }
}