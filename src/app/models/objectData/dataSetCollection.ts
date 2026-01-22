// Author: Dustin Etts
import { DataSet } from "./dataSet";

//Defines a dataSetCollection, which is the raw format of all data output by any given polari custom or crude api endpoints.
// The dataSetCollection is a collection of arbitrary dataSets which have just been retrieved from the backend.
// The dataSetCollection is meant to be a tool to help organize and interpret the data that has been retrieved from the backend.
export class DataSetCollection {
    //The Names of all objects which had at least one instance passed in the dataSetCollection.
    objectNames?: string[];
    //The actual collection of dataSets to be utilized
    setCollection: Record<string, DataSet[]>;

    constructor(setCollection: Record<string, DataSet[]> | any[] | any)
    {
        // Handle different input formats
        if (Array.isArray(setCollection) && setCollection.length > 0) {
            // If it's an array, use the first element as the collection
            this.setCollection = setCollection[0] as Record<string, DataSet[]>;
        } else if (typeof setCollection === 'object' && setCollection !== null) {
            this.setCollection = setCollection as Record<string, DataSet[]>;
        } else {
            this.setCollection = {};
        }
        this.objectNames = Object.keys(this.setCollection);
    }

    //Returns all dataSets of the given class from the dataSetCollection.
    public getClassDataSets(className: string): DataSet[] | undefined
    {
        return this.setCollection[className];
    }


    //Converts the dataSet into a list of instances of the requested type.
    public getClassInstanceList(className: string): any[]
    {
        const classDataSets = this.getClassDataSets(className);
        //Gets a list of objects from the first dataSet.
        let instanceList: any[] = [];
        if(classDataSets != undefined)
        {
            classDataSets.forEach((someDS: DataSet) => {
                instanceList = instanceList.concat(someDS.data);
            });
        }

        return instanceList;
    }

    //Stores all of the data from the dataSet locally.
    public extractData()
    {

    }
}