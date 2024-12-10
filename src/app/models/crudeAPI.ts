// Author: Dustin Etts
import { CRUDEpermissionsDictionary } from "./permissions/crudePermissionDictionary";

// This class is used to store the API name, object name, and permissions for a CRUDE operations
// on a specific object.
// CRUDE operations are Create, Read, Update, Delete, and Events (events being state based functions on the object).
export class crudeAPI {
    permSet: CRUDEpermissionsDictionary;
    apiName : string;
    objectName: string;

    constructor(apiName: string, objectName: string, permSet: CRUDEpermissionsDictionary){
        this.apiName = apiName
        this.objectName = objectName
        this.permSet = permSet
    }
}