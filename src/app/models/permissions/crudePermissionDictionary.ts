// Author: Dustin Etts
// crudePermissionDictionary.ts

// This is a dictionary object used to store the permissions of the user for a given object.
// It is implied that the user has no access to an object if no permissions are defined for the object for the user.
// Note: This object is used to define general permissions for the user, more granular permissions should likely
// be defined later, and integrated carefully to work together with Keycloak and the backend.
export class CRUDEpermissionsDictionary {
    // Indicates if the user has absolute access to the object, allowed to create, read, update, delete, and trigger events
    // for any variable or event on the object.
    userHasAbsoluteAccess: boolean;
    // The name of the object the permissions are defined for.
    objectName: string;
    // The list of variables the user is allowed to write to during the creation of an object instance.
    createAccess: string[];
    // The list of variables the user is allowed to read from any given instance of the object.
    readAccess: string[];
    // The list of variables the user is allowed to write to during the update of an object instance.
    updateAccess: string[];
    // The list of variables the user is allowed to delete from an object instance.
    // Note : This may imply downstream deletion of other objects or data based on the variable being deleted.
    deleteAccess: string[];
    // The list of events the user is allowed to trigger on an object instance.
    eventAccess: string[];

    // For now if we just define a permissions dictionary for a given object, we can give blanket access to everything
    // this is because we are in a development phase and we want to be able to test everything more easily.
    constructor(
        objectName: string, 
        userHasAbsoluteAccess: boolean = true, 
        createAccess: string[] = [], readAccess: string[] = [], updateAccess: string[] = [], deleteAccess: string[] = [], 
        eventAccess: string[] = []
    )
    {
        this.objectName = objectName;
        this.userHasAbsoluteAccess = userHasAbsoluteAccess;
        this.createAccess = createAccess;
        this.readAccess = readAccess;
        this.updateAccess = updateAccess;
        this.deleteAccess = deleteAccess;
        this.eventAccess = eventAccess;
    }
}