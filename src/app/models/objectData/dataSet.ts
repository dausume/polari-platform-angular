// Author: Dustin Etts
// A data set that holds instances of a spacific class, specifies what all the variables are that exist on that class,
// and specifies which variables are black-listed from being retrieved from the backend for this data set.
export class dataSet {
    objectName: string; //The name of the class that this dataSet holds instances of.
    variableNames?: string[]; //The names of all the data-containing variables that exist on the class that this dataSet holds instances of.
    varsLimited?: string[]; // The names of the variables that are black-listed from being retrieved from the backend for this data set.
    data: any; //The instances of the class that this dataSet holds.

    constructor(objectName: string, data: any, varsLimited?: string[], variableNames?: string[])
    {
        this.objectName = objectName;
        this.varsLimited = varsLimited;
        this.variableNames = variableNames;
        this.data = data;
    }

    //Converts the dataSet into a list of instances of the appropriate type.
    public getInstanceList()
    {
        return this.data;
    }

    //Takes another dataSet and pulls it's data into this dataSet.
    public mergeDataSet(otherSet:dataSet)
    {
        //Determine which variables will be new to the current dataSet and which will not have values (must have null values assigned)
        let addedVarsOther : string[] = [];
        let missingVarsOther : string[] = [];
        if(!(this.variableNames == null) && !(this.varsLimited == null))
        {
            this.variableNames.forEach((varName:string)=>{
                if(otherSet.variableNames != null)
                {
                    if(!(varName in otherSet.variableNames))
                    {
                        missingVarsOther.push(varName);
                    }
                }
            });
            this.varsLimited.forEach((varName:string)=>{
                if(otherSet.varsLimited != null)
                {
                    if(!(varName in otherSet.varsLimited))
                    {
                        addedVarsOther.push(varName);
                    }
                }
            })
        }
        //If true, we must create null values on our current dataSet
        // Generates error
        if(addedVarsOther.length !== 0)
        {
            this.data.array.forEach(inst => {
                addedVarsOther.forEach( (varName:string) =>{
                    inst[varName] = null;
                });
            });
        }
        //Now, go through the other dataSet and pull it's instances over.  For vars with missingVarsOther, set to null.
        if(missingVarsOther.length !== 0)
        {
            otherSet.data.array.forEach(inst => {
                missingVarsOther.forEach( (varName:string) =>{
                    inst[varName] = null;
                });
            });
        }
        //NOTE: This combination method assumes no duplicates between dataSets!
        this.data = (this.data).concat(otherSet.data);
    }

}