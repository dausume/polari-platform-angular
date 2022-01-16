export class CRUDEpermissionsDictionary {
    userHasSomeAccess: boolean;
    userHasAbsoluteAccess: boolean;
    objectName: string;
    createAccess: any[];
    readAccess: any[];
    updateAccess: any[];
    deleteAccess: any[];
    eventAccess: any[];

    constructor(userHasSomeAccess: boolean, userHasAbsoluteAccess: boolean, objectName: string, 
        createAccess: any[], readAccess: any[], updateAccess: any[], deleteAccess: any[], eventAccess: any[])
    {
        this.userHasSomeAccess = userHasSomeAccess;
        this.objectName = objectName;
        this.userHasAbsoluteAccess = userHasAbsoluteAccess;
        this.createAccess = createAccess;
        this.readAccess = readAccess;
        this.updateAccess = updateAccess;
        this.deleteAccess = deleteAccess;
        this.eventAccess = eventAccess;
    }
}