// Author: Dustin Etts
import { dataSet } from "./dataSet";

//Defines a dataSetCollection, which is the raw format of all data output by any given polari custom or crude api endpoints.
// The dataSetCollection is a collection of arbitrary dataSets which have just been retrieved from the backend.
// The dataSetCollection is meant to be a tool to help organize and interpret the data that has been retrieved from the backend.
export class dataSetCollection {
    //The Names of all objects which had at least one instance passed in the dataSetCollection.
    objectNames?: string[];
    //The actual collection of dataSets to be utilized
    setCollection: object;

    constructor(setCollection: object)
    {
        this.setCollection = setCollection;
        this.objectNames = Object.keys(this.setCollection);
    }

    //Returns all dataSets of the given class from the dataSetCollection.
    public getClassDataSets(className:string)
    {
        let dataSetList : dataSet[] = this.setCollection[0][className]
        return dataSetList;
    }


    //Converts the dataSet into a list of instances of the requested type.
    public getClassInstanceList(className:string)
    {
        let classDataSets = this.getClassDataSets(className);
        //Gets a list of objects from the first dataSet.
        let instanceList : object[] = []
        if(classDataSets != undefined)
        {
            classDataSets.forEach((someDS : dataSet) =>{
                instanceList = instanceList.concat(someDS["data"]);
            });
        }
        
        return instanceList;
    }

    //Stores all of the data from the dataSet locally.
    public extractData()
    {

    }
}