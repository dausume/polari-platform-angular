import { CRUDEpermissionsDictionary } from "./crudePermissionDictionary";

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