import { Injectable, EventEmitter, ErrorHandler } from "@angular/core";
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { polariNode } from "@models/polariNode";
import { BehaviorSubject, Subject, throwError } from "rxjs";
import { retry, catchError } from 'rxjs/operators';
import { navComponent } from "@models/navComponent";
import { classPolyTyping } from "@models/classPolyTyping";
import { dataSetCollection } from "@models/dataSetCollection";


@Injectable({
    providedIn: 'root'
})
export class PolariService {
    //Subjects allow for the Parent Component and any number of child components to subscribe to the variables
    //as Observers to read and modify them.
    backendHeadersDict = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Access-Control-Allow-Headers': 'Content-Type',
        //Implement functionality to narrow this down to only the backend url.
        'Access-Control-Allow-Origin' : '*'
    }
      
    backendRequestOptions = {                                                                                                                                                                                 
        headers: new HttpHeaders(this.backendHeadersDict), 
    };

    fakeBaseAPI_json = [
        {
            "polariAPI": [
                {
                    "class": "polariAPI",
                    "varsLimited": [],
                    "data": [
                        {
                            "id": "1VXo4542w",
                            "branch": [
                                "CLASS-polariServer-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "NEW_SERVER"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        "Kp7wG8NXX"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "apiName": "/",
                            "permissionSets": [
                                {
                                    "polariList": []
                                }
                            ],
                            "minAccessDict": [
                                {
                                    "dict": {
                                        "R": [
                                            {
                                                "str": null
                                            }
                                        ]
                                    }
                                }
                            ],
                            "maxAccessDict": [
                                {
                                    "dict": {}
                                }
                            ],
                            "minPermissionsDict": [
                                {
                                    "dict": {
                                        "R": [
                                            {
                                                "str": null
                                            }
                                        ]
                                    }
                                }
                            ],
                            "maxPermissionsDict": [
                                {
                                    "dict": {}
                                }
                            ]
                        },
                        {
                            "id": "u0Op9M7mA",
                            "branch": [
                                "CLASS-polariServer-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "NEW_SERVER"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        "Kp7wG8NXX"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "apiName": "/tempRegister",
                            "permissionSets": [
                                {
                                    "polariList": []
                                }
                            ],
                            "minAccessDict": [
                                {
                                    "dict": {
                                        "E": [
                                            {
                                                "str": null
                                            }
                                        ]
                                    }
                                }
                            ],
                            "maxAccessDict": [
                                {
                                    "dict": {}
                                }
                            ],
                            "minPermissionsDict": [
                                {
                                    "dict": {
                                        "E": [
                                            {
                                                "str": null
                                            }
                                        ]
                                    }
                                }
                            ],
                            "maxPermissionsDict": [
                                {
                                    "dict": {}
                                }
                            ]
                        }
                    ]
                }
            ],
            "polariCRUDE": [
                {
                    "class": "polariCRUDE",
                    "varsLimited": [],
                    "data": [
                        {
                            "id": "tRtzcDN8K",
                            "branch": [
                                "CLASS-polariServer-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "NEW_SERVER"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        "Kp7wG8NXX"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polServer": [
                                "CLASS-polariServer-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "NEW_SERVER"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        "Kp7wG8NXX"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "apiObject": "polariCRUDE",
                            "apiName": "/polariCRUDE",
                            "objTyping": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polariCRUDE"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "baseAccessDictionaries": [
                                {
                                    "polariList": []
                                }
                            ],
                            "basePermissionDictionaries": [
                                {
                                    "polariList": []
                                }
                            ],
                            "CreateMethod": [
                                "CLASS-type-IDs",
                                [
                                    {
                                        "NoneType": null
                                    }
                                ]
                            ],
                            "CreateDefaultParameters": [
                                {
                                    "polariList": []
                                }
                            ],
                            "CreateRequiredParameters": [
                                {
                                    "polariList": [
                                        "apiObject",
                                        "polServer"
                                    ]
                                }
                            ],
                            "validVarsList": [
                                {
                                    "polariList": []
                                }
                            ]
                        },
                        {
                            "id": "fQp10ty6zF",
                            "branch": [
                                "CLASS-polariServer-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "NEW_SERVER"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        "Kp7wG8NXX"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polServer": [
                                "CLASS-polariServer-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "NEW_SERVER"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        "Kp7wG8NXX"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "apiObject": "managerObject",
                            "apiName": "/managerObject",
                            "objTyping": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managerObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "baseAccessDictionaries": [
                                {
                                    "polariList": []
                                }
                            ],
                            "basePermissionDictionaries": [
                                {
                                    "polariList": []
                                }
                            ],
                            "CreateMethod": [
                                "CLASS-type-IDs",
                                [
                                    {
                                        "NoneType": null
                                    }
                                ]
                            ],
                            "CreateDefaultParameters": [
                                {
                                    "dict": {}
                                }
                            ],
                            "CreateRequiredParameters": [
                                {
                                    "polariList": []
                                }
                            ],
                            "validVarsList": [
                                {
                                    "polariList": [
                                        "complete",
                                        "manager",
                                        "hostSys",
                                        "hasDB",
                                        "objectTypingDict",
                                        "objectTyping",
                                        "objectTree",
                                        "objectTables",
                                        "managedFiles",
                                        "id",
                                        "db",
                                        "polServer",
                                        "subManagers",
                                        "idList",
                                        "branch",
                                        "cloudIdList",
                                        "hasServer"
                                    ]
                                }
                            ]
                        },
                        {
                            "id": "CFyXBDs53",
                            "branch": [
                                "CLASS-polariServer-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "NEW_SERVER"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        "Kp7wG8NXX"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polServer": [
                                "CLASS-polariServer-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "NEW_SERVER"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        "Kp7wG8NXX"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "apiObject": "polyTypedVariable",
                            "apiName": "/polyTypedVariable",
                            "objTyping": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedVariable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "baseAccessDictionaries": [
                                {
                                    "polariList": []
                                }
                            ],
                            "basePermissionDictionaries": [
                                {
                                    "polariList": []
                                }
                            ],
                            "CreateMethod": [
                                "CLASS-type-IDs",
                                [
                                    {
                                        "NoneType": null
                                    }
                                ]
                            ],
                            "CreateDefaultParameters": [
                                {
                                    "polariList": []
                                }
                            ],
                            "CreateRequiredParameters": [
                                {
                                    "polariList": []
                                }
                            ],
                            "validVarsList": [
                                {
                                    "polariList": [
                                        "id",
                                        "branch",
                                        "inTree",
                                        "manager",
                                        "name",
                                        "eventsList",
                                        "typingDicts",
                                        "pythonTypeDefault"
                                    ]
                                }
                            ]
                        },
                        {
                            "id": "z116yB4x4x",
                            "branch": [
                                "CLASS-polariServer-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "NEW_SERVER"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        "Kp7wG8NXX"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polServer": [
                                "CLASS-polariServer-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "NEW_SERVER"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        "Kp7wG8NXX"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "apiObject": "Polari",
                            "apiName": "/Polari",
                            "objTyping": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "Polari"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "baseAccessDictionaries": [
                                {
                                    "polariList": []
                                }
                            ],
                            "basePermissionDictionaries": [
                                {
                                    "polariList": []
                                }
                            ],
                            "CreateMethod": [
                                "CLASS-type-IDs",
                                [
                                    {
                                        "NoneType": null
                                    }
                                ]
                            ],
                            "CreateDefaultParameters": [
                                {
                                    "polariList": []
                                }
                            ],
                            "CreateRequiredParameters": [
                                {
                                    "polariList": []
                                }
                            ],
                            "validVarsList": [
                                {
                                    "polariList": []
                                }
                            ]
                        },
                        {
                            "id": "ydyAVrCLF",
                            "branch": [
                                "CLASS-polariServer-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "NEW_SERVER"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        "Kp7wG8NXX"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polServer": [
                                "CLASS-polariServer-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "NEW_SERVER"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        "Kp7wG8NXX"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "apiObject": "dataStream",
                            "apiName": "/dataStream",
                            "objTyping": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "dataStream"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "baseAccessDictionaries": [
                                {
                                    "polariList": []
                                }
                            ],
                            "basePermissionDictionaries": [
                                {
                                    "polariList": []
                                }
                            ],
                            "CreateMethod": [
                                "CLASS-type-IDs",
                                [
                                    {
                                        "NoneType": null
                                    }
                                ]
                            ],
                            "CreateDefaultParameters": [
                                {
                                    "polariList": [
                                        "channels",
                                        "sinkInstances",
                                        "recurring"
                                    ]
                                }
                            ],
                            "CreateRequiredParameters": [
                                {
                                    "polariList": [
                                        "source"
                                    ]
                                }
                            ],
                            "validVarsList": [
                                {
                                    "polariList": []
                                }
                            ]
                        },
                        {
                            "id": "840XrZtsX",
                            "branch": [
                                "CLASS-polariServer-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "NEW_SERVER"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        "Kp7wG8NXX"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polServer": [
                                "CLASS-polariServer-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "NEW_SERVER"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        "Kp7wG8NXX"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "apiObject": "remoteEvent",
                            "apiName": "/remoteEvent",
                            "objTyping": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "remoteEvent"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "baseAccessDictionaries": [
                                {
                                    "polariList": []
                                }
                            ],
                            "basePermissionDictionaries": [
                                {
                                    "polariList": []
                                }
                            ],
                            "CreateMethod": [
                                "CLASS-type-IDs",
                                [
                                    {
                                        "NoneType": null
                                    }
                                ]
                            ],
                            "CreateDefaultParameters": [
                                {
                                    "polariList": [
                                        "eventName",
                                        "source",
                                        "sink",
                                        "channels"
                                    ]
                                }
                            ],
                            "CreateRequiredParameters": [
                                {
                                    "polariList": []
                                }
                            ],
                            "validVarsList": [
                                {
                                    "polariList": []
                                }
                            ]
                        },
                        {
                            "id": "YjJfzIfxq",
                            "branch": [
                                "CLASS-polariServer-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "NEW_SERVER"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        "Kp7wG8NXX"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polServer": [
                                "CLASS-polariServer-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "NEW_SERVER"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        "Kp7wG8NXX"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "apiObject": "managedUserInterface",
                            "apiName": "/managedUserInterface",
                            "objTyping": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managedUserInterface"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "baseAccessDictionaries": [
                                {
                                    "polariList": []
                                }
                            ],
                            "basePermissionDictionaries": [
                                {
                                    "polariList": []
                                }
                            ],
                            "CreateMethod": [
                                "CLASS-type-IDs",
                                [
                                    {
                                        "NoneType": null
                                    }
                                ]
                            ],
                            "CreateDefaultParameters": [
                                {
                                    "polariList": [
                                        "hostApp",
                                        "launchMethod"
                                    ]
                                }
                            ],
                            "CreateRequiredParameters": [
                                {
                                    "polariList": []
                                }
                            ],
                            "validVarsList": [
                                {
                                    "polariList": []
                                }
                            ]
                        },
                        {
                            "id": "rVteU10Nl10",
                            "branch": [
                                "CLASS-polariServer-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "NEW_SERVER"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        "Kp7wG8NXX"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polServer": [
                                "CLASS-polariServer-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "NEW_SERVER"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        "Kp7wG8NXX"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "apiObject": "managedFile",
                            "apiName": "/managedFile",
                            "objTyping": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managedFile"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "baseAccessDictionaries": [
                                {
                                    "polariList": []
                                }
                            ],
                            "basePermissionDictionaries": [
                                {
                                    "polariList": []
                                }
                            ],
                            "CreateMethod": [
                                "CLASS-type-IDs",
                                [
                                    {
                                        "NoneType": null
                                    }
                                ]
                            ],
                            "CreateDefaultParameters": [
                                {
                                    "polariList": [
                                        "name",
                                        "Path",
                                        "extension"
                                    ]
                                }
                            ],
                            "CreateRequiredParameters": [
                                {
                                    "polariList": []
                                }
                            ],
                            "validVarsList": [
                                {
                                    "polariList": []
                                }
                            ]
                        },
                        {
                            "id": "Ic11EE8Jko",
                            "branch": [
                                "CLASS-polariServer-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "NEW_SERVER"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        "Kp7wG8NXX"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polServer": [
                                "CLASS-polariServer-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "NEW_SERVER"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        "Kp7wG8NXX"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "apiObject": "managedApp",
                            "apiName": "/managedApp",
                            "objTyping": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managedApp"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "baseAccessDictionaries": [
                                {
                                    "polariList": []
                                }
                            ],
                            "basePermissionDictionaries": [
                                {
                                    "polariList": []
                                }
                            ],
                            "CreateMethod": [
                                "CLASS-type-IDs",
                                [
                                    {
                                        "NoneType": null
                                    }
                                ]
                            ],
                            "CreateDefaultParameters": [
                                {
                                    "polariList": [
                                        "name",
                                        "displayName",
                                        "Path",
                                        "manager"
                                    ]
                                }
                            ],
                            "CreateRequiredParameters": [
                                {
                                    "polariList": []
                                }
                            ],
                            "validVarsList": [
                                {
                                    "polariList": []
                                }
                            ]
                        },
                        {
                            "id": "D3YeQjg7d",
                            "branch": [
                                "CLASS-polariServer-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "NEW_SERVER"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        "Kp7wG8NXX"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polServer": [
                                "CLASS-polariServer-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "NEW_SERVER"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        "Kp7wG8NXX"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "apiObject": "browserSourcePage",
                            "apiName": "/browserSourcePage",
                            "objTyping": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "browserSourcePage"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "baseAccessDictionaries": [
                                {
                                    "polariList": []
                                }
                            ],
                            "basePermissionDictionaries": [
                                {
                                    "polariList": []
                                }
                            ],
                            "CreateMethod": [
                                "CLASS-type-IDs",
                                [
                                    {
                                        "NoneType": null
                                    }
                                ]
                            ],
                            "CreateDefaultParameters": [
                                {
                                    "polariList": [
                                        "name",
                                        "sourceHTMLfile",
                                        "supportFiles",
                                        "supportPages"
                                    ]
                                }
                            ],
                            "CreateRequiredParameters": [
                                {
                                    "polariList": []
                                }
                            ],
                            "validVarsList": [
                                {
                                    "polariList": []
                                }
                            ]
                        },
                        {
                            "id": "BC1AKr27r",
                            "branch": [
                                "CLASS-polariServer-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "NEW_SERVER"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        "Kp7wG8NXX"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polServer": [
                                "CLASS-polariServer-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "NEW_SERVER"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        "Kp7wG8NXX"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "apiObject": "managedDatabase",
                            "apiName": "/managedDatabase",
                            "objTyping": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managedDatabase"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "baseAccessDictionaries": [
                                {
                                    "polariList": []
                                }
                            ],
                            "basePermissionDictionaries": [
                                {
                                    "polariList": []
                                }
                            ],
                            "CreateMethod": [
                                "CLASS-type-IDs",
                                [
                                    {
                                        "NoneType": null
                                    }
                                ]
                            ],
                            "CreateDefaultParameters": [
                                {
                                    "polariList": [
                                        "name",
                                        "manager",
                                        "DBurl",
                                        "DBtype",
                                        "tables",
                                        "inRAM"
                                    ]
                                }
                            ],
                            "CreateRequiredParameters": [
                                {
                                    "polariList": []
                                }
                            ],
                            "validVarsList": [
                                {
                                    "polariList": []
                                }
                            ]
                        },
                        {
                            "id": "5lnwXAxDb",
                            "branch": [
                                "CLASS-polariServer-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "NEW_SERVER"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        "Kp7wG8NXX"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polServer": [
                                "CLASS-polariServer-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "NEW_SERVER"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        "Kp7wG8NXX"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "apiObject": "dataChannel",
                            "apiName": "/dataChannel",
                            "objTyping": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "dataChannel"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "baseAccessDictionaries": [
                                {
                                    "polariList": []
                                }
                            ],
                            "basePermissionDictionaries": [
                                {
                                    "polariList": []
                                }
                            ],
                            "CreateMethod": [
                                "CLASS-type-IDs",
                                [
                                    {
                                        "NoneType": null
                                    }
                                ]
                            ],
                            "CreateDefaultParameters": [
                                {
                                    "polariList": [
                                        "name",
                                        "Path"
                                    ]
                                }
                            ],
                            "CreateRequiredParameters": [
                                {
                                    "polariList": [
                                        "manager"
                                    ]
                                }
                            ],
                            "validVarsList": [
                                {
                                    "polariList": []
                                }
                            ]
                        },
                        {
                            "id": "UzCxzGo48",
                            "branch": [
                                "CLASS-polariServer-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "NEW_SERVER"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        "Kp7wG8NXX"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polServer": [
                                "CLASS-polariServer-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "NEW_SERVER"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        "Kp7wG8NXX"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "apiObject": "managedExecutable",
                            "apiName": "/managedExecutable",
                            "objTyping": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managedExecutable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "baseAccessDictionaries": [
                                {
                                    "polariList": []
                                }
                            ],
                            "basePermissionDictionaries": [
                                {
                                    "polariList": []
                                }
                            ],
                            "CreateMethod": [
                                "CLASS-type-IDs",
                                [
                                    {
                                        "NoneType": null
                                    }
                                ]
                            ],
                            "CreateDefaultParameters": [
                                {
                                    "polariList": [
                                        "name",
                                        "extension",
                                        "Path",
                                        "manager"
                                    ]
                                }
                            ],
                            "CreateRequiredParameters": [
                                {
                                    "polariList": []
                                }
                            ],
                            "validVarsList": [
                                {
                                    "polariList": [
                                        "id",
                                        "branch",
                                        "inTree",
                                        "manager",
                                        "name",
                                        "extension",
                                        "version",
                                        "Path",
                                        "url",
                                        "active",
                                        "isRemote",
                                        "complete",
                                        "fileSize_bytes",
                                        "maxFileSize_bytes",
                                        "fileInstance",
                                        "isOpen",
                                        "language",
                                        "codeStrings",
                                        "AccountingLogicNodes",
                                        "innerContext",
                                        "outerContext"
                                    ]
                                }
                            ]
                        },
                        {
                            "id": "qMdFM3w1U",
                            "branch": [
                                "CLASS-polariServer-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "NEW_SERVER"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        "Kp7wG8NXX"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polServer": [
                                "CLASS-polariServer-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "NEW_SERVER"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        "Kp7wG8NXX"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "apiObject": "polyTypedObject",
                            "apiName": "/polyTypedObject",
                            "objTyping": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "baseAccessDictionaries": [
                                {
                                    "polariList": []
                                }
                            ],
                            "basePermissionDictionaries": [
                                {
                                    "polariList": []
                                }
                            ],
                            "CreateMethod": [
                                "CLASS-type-IDs",
                                [
                                    {
                                        "NoneType": null
                                    }
                                ]
                            ],
                            "CreateDefaultParameters": [
                                {
                                    "polariList": [
                                        "objectReferencesDict",
                                        "sourceFiles",
                                        "identifierVariables",
                                        "variableNameList",
                                        "baseAccessDict",
                                        "basePermDict",
                                        "classDefinition",
                                        "sampleInstances",
                                        "kwRequiredParams",
                                        "kwDefaultParams"
                                    ]
                                }
                            ],
                            "CreateRequiredParameters": [
                                {
                                    "polariList": [
                                        "className",
                                        "manager"
                                    ]
                                }
                            ],
                            "validVarsList": [
                                {
                                    "polariList": [
                                        "id",
                                        "branch",
                                        "inTree",
                                        "manager",
                                        "isTreeObject",
                                        "isManagerObject",
                                        "className",
                                        "kwRequiredParams",
                                        "kwDefaultParams",
                                        "hasBaseSample",
                                        "objectReferencesDict",
                                        "requiredInitKeywordParams",
                                        "initKeywordParamsWdefaults",
                                        "sourceFiles",
                                        "polariSourceFile",
                                        "inheritedTyping",
                                        "identifiers",
                                        "variableNameList",
                                        "polyTypedVars",
                                        "baseAccessDictionary",
                                        "basePermissionDictionary",
                                        "name",
                                        "eventsList",
                                        "typingDicts",
                                        "pythonTypeDefault"
                                    ]
                                }
                            ]
                        },
                        {
                            "id": "M5XSBZTQM",
                            "branch": [
                                "CLASS-polariServer-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "NEW_SERVER"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        "Kp7wG8NXX"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polServer": [
                                "CLASS-polariServer-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "NEW_SERVER"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        "Kp7wG8NXX"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "apiObject": "polariServer",
                            "apiName": "/polariServer",
                            "objTyping": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polariServer"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "baseAccessDictionaries": [
                                {
                                    "polariList": []
                                }
                            ],
                            "basePermissionDictionaries": [
                                {
                                    "polariList": []
                                }
                            ],
                            "CreateMethod": [
                                "CLASS-type-IDs",
                                [
                                    {
                                        "NoneType": null
                                    }
                                ]
                            ],
                            "CreateDefaultParameters": [
                                {
                                    "polariList": [
                                        "name",
                                        "displayName",
                                        "hostSystem",
                                        "serverChannel",
                                        "serverDataStream"
                                    ]
                                }
                            ],
                            "CreateRequiredParameters": [
                                {
                                    "polariList": []
                                }
                            ],
                            "validVarsList": [
                                {
                                    "polariList": []
                                }
                            ]
                        },
                        {
                            "id": "fN911QN6Nh",
                            "branch": [
                                "CLASS-polariServer-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "NEW_SERVER"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        "Kp7wG8NXX"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polServer": [
                                "CLASS-polariServer-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "NEW_SERVER"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        "Kp7wG8NXX"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "apiObject": "User",
                            "apiName": "/User",
                            "objTyping": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "User"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "baseAccessDictionaries": [
                                {
                                    "polariList": []
                                }
                            ],
                            "basePermissionDictionaries": [
                                {
                                    "polariList": []
                                }
                            ],
                            "CreateMethod": [
                                "CLASS-type-IDs",
                                [
                                    {
                                        "NoneType": null
                                    }
                                ]
                            ],
                            "CreateDefaultParameters": [
                                {
                                    "polariList": [
                                        "username",
                                        "password",
                                        "unregistered"
                                    ]
                                }
                            ],
                            "CreateRequiredParameters": [
                                {
                                    "polariList": []
                                }
                            ],
                            "validVarsList": [
                                {
                                    "polariList": []
                                }
                            ]
                        },
                        {
                            "id": "gc10QAHfKI",
                            "branch": [
                                "CLASS-polariServer-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "NEW_SERVER"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        "Kp7wG8NXX"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polServer": [
                                "CLASS-polariServer-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "NEW_SERVER"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        "Kp7wG8NXX"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "apiObject": "UserGroup",
                            "apiName": "/UserGroup",
                            "objTyping": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "UserGroup"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "baseAccessDictionaries": [
                                {
                                    "polariList": []
                                }
                            ],
                            "basePermissionDictionaries": [
                                {
                                    "polariList": []
                                }
                            ],
                            "CreateMethod": [
                                "CLASS-type-IDs",
                                [
                                    {
                                        "NoneType": null
                                    }
                                ]
                            ],
                            "CreateDefaultParameters": [
                                {
                                    "polariList": [
                                        "assignedUsers",
                                        "userMembersQuery",
                                        "permissionSets"
                                    ]
                                }
                            ],
                            "CreateRequiredParameters": [
                                {
                                    "polariList": [
                                        "name"
                                    ]
                                }
                            ],
                            "validVarsList": [
                                {
                                    "polariList": []
                                }
                            ]
                        },
                        {
                            "id": "lk6FLCw59",
                            "branch": [
                                "CLASS-polariServer-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "NEW_SERVER"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        "Kp7wG8NXX"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polServer": [
                                "CLASS-polariServer-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "NEW_SERVER"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        "Kp7wG8NXX"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "apiObject": "polariAPI",
                            "apiName": "/polariAPI",
                            "objTyping": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polariAPI"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "baseAccessDictionaries": [
                                {
                                    "polariList": []
                                }
                            ],
                            "basePermissionDictionaries": [
                                {
                                    "polariList": []
                                }
                            ],
                            "CreateMethod": [
                                "CLASS-type-IDs",
                                [
                                    {
                                        "NoneType": null
                                    }
                                ]
                            ],
                            "CreateDefaultParameters": [
                                {
                                    "polariList": [
                                        "minAccessDict",
                                        "maxAccessDict",
                                        "minPermissionsDict",
                                        "maxPermissionsDict",
                                        "eventAPI",
                                        "eventObject",
                                        "event"
                                    ]
                                }
                            ],
                            "CreateRequiredParameters": [
                                {
                                    "polariList": [
                                        "apiName",
                                        "polServer"
                                    ]
                                }
                            ],
                            "validVarsList": [
                                {
                                    "polariList": []
                                }
                            ]
                        },
                        {
                            "id": "9s10nTSurk",
                            "branch": [
                                "CLASS-polariServer-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "NEW_SERVER"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        "Kp7wG8NXX"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polServer": [
                                "CLASS-polariServer-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "NEW_SERVER"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        "Kp7wG8NXX"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "apiObject": "polariCRUDE",
                            "apiName": "/polariCRUDE",
                            "objTyping": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polariCRUDE"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "baseAccessDictionaries": [
                                {
                                    "polariList": []
                                }
                            ],
                            "basePermissionDictionaries": [
                                {
                                    "polariList": []
                                }
                            ],
                            "CreateMethod": [
                                "CLASS-type-IDs",
                                [
                                    {
                                        "NoneType": null
                                    }
                                ]
                            ],
                            "CreateDefaultParameters": [
                                {
                                    "polariList": []
                                }
                            ],
                            "CreateRequiredParameters": [
                                {
                                    "polariList": [
                                        "apiObject",
                                        "polServer"
                                    ]
                                }
                            ],
                            "validVarsList": [
                                {
                                    "polariList": []
                                }
                            ]
                        },
                        {
                            "id": "ytXRH2IzG",
                            "branch": [
                                "CLASS-polariServer-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "NEW_SERVER"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        "Kp7wG8NXX"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polServer": [
                                "CLASS-polariServer-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "NEW_SERVER"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        "Kp7wG8NXX"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "apiObject": "isoSys",
                            "apiName": "/isoSys",
                            "objTyping": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "isoSys"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "baseAccessDictionaries": [
                                {
                                    "polariList": []
                                }
                            ],
                            "basePermissionDictionaries": [
                                {
                                    "polariList": []
                                }
                            ],
                            "CreateMethod": [
                                "CLASS-type-IDs",
                                [
                                    {
                                        "NoneType": null
                                    }
                                ]
                            ],
                            "CreateDefaultParameters": [
                                {
                                    "dict": {}
                                }
                            ],
                            "CreateRequiredParameters": [
                                {
                                    "polariList": [
                                        "self"
                                    ]
                                }
                            ],
                            "validVarsList": [
                                {
                                    "polariList": [
                                        "id",
                                        "branch",
                                        "inTree",
                                        "manager",
                                        "name",
                                        "networkName",
                                        "IPaddress",
                                        "domainName",
                                        "mainMonitorPixelWidth",
                                        "mainMonitorPixelHeight",
                                        "virtualMonitorPixelWidth",
                                        "virtualMonitorPixelHeight",
                                        "NumMonitors",
                                        "numPhysicalCPUs",
                                        "numLogicalCPUs",
                                        "totalMainMemoryInBytes",
                                        "availableMainMemoryInBytes",
                                        "percentMainMemoryUsed",
                                        "usedMainMemoryInBytes",
                                        "freeMainMemoryInBytes",
                                        "swappedOutMemory",
                                        "swappedInMemory",
                                        "freeSwapMemoryInBytes",
                                        "usedSwapMemoryInBytes",
                                        "totalSwapMemoryInBytes",
                                        "SwapMemoryConsumptionVectorInBytesPerVarMilliSeconds"
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ],
            "polariServer": [
                {
                    "class": "polariServer",
                    "varsLimited": [],
                    "data": [
                        {
                            "id": "Kp7wG8NXX",
                            "branch": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "NEW_SERVER",
                            "serverPasswordSaltDict": [
                                {
                                    "dict": {
                                        "*": "*"
                                    }
                                }
                            ],
                            "temporaryUsersLimit": 10,
                            "registeredUsersLimit": 10,
                            "displayName": "NEW_POLARI_SERVER",
                            "passwordRequirements": [
                                {
                                    "dict": {
                                        "min-length": "min-length",
                                        "max-length": "max-length",
                                        "min-special-chars": "min-special-chars",
                                        "min-nums": "min-nums"
                                    }
                                }
                            ],
                            "publicFrontendKey": null,
                            "privateFrontendKey": null,
                            "falconServer": [
                                "CLASS-App-IDs",
                                [
                                    {
                                        "NoneType": null
                                    }
                                ]
                            ],
                            "active": false,
                            "objectEndpoints": [
                                {
                                    "dict": {}
                                }
                            ],
                            "dataChannelEndpoints": [
                                {
                                    "dict": {}
                                }
                            ],
                            "timeActiveInMinutes": 5,
                            "lastCycleTime": [
                                "CLASS-struct_time-IDs",
                                [
                                    {
                                        "NoneType": null
                                    }
                                ]
                            ],
                            "secureManagerObjects": [
                                {
                                    "polariList": []
                                }
                            ],
                            "protectedManagerObjects": [
                                {
                                    "polariList": [
                                        "managerObject"
                                    ]
                                }
                            ],
                            "tempUsersList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "tempUsersDict": [
                                {
                                    "dict": {}
                                }
                            ],
                            "usersList": [
                                {
                                    "polariList": [
                                        [
                                            "CLASS-User-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "id",
                                                                    "Im9OkyKZA"
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ]
                                    ]
                                }
                            ],
                            "usersDict": [
                                {
                                    "dict": {
                                        "topadmin": "User"
                                    }
                                }
                            ],
                            "userGroupsList": [
                                {
                                    "polariList": [
                                        [
                                            "CLASS-UserGroup-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "id",
                                                                    "dufa2IaZo"
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ]
                                    ]
                                }
                            ],
                            "userGroupsDict": [
                                {
                                    "dict": {
                                        "adminGroup": "UserGroup"
                                    }
                                }
                            ],
                            "managersOnServer": [
                                {
                                    "polariList": [
                                        [
                                            "CLASS-managerObject-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "id",
                                                                    null
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ]
                                    ]
                                }
                            ],
                            "publicManagersList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "apiRestrictedObjects": [
                                {
                                    "polariList": [
                                        "isoSys"
                                    ]
                                }
                            ],
                            "secureTreeObjects": [
                                {
                                    "polariList": []
                                }
                            ],
                            "protectedTreeObjects": [
                                {
                                    "polariList": [
                                        "polyTypedObject",
                                        "polyTypedVar",
                                        "polariServer",
                                        "managedDatabase"
                                    ]
                                }
                            ],
                            "publicTreeObjectsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "uriList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "customAPIsList": [
                                {
                                    "polariList": [
                                        [
                                            "CLASS-polariAPI-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "id",
                                                                    "1VXo4542w"
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polariAPI-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "id",
                                                                    "u0Op9M7mA"
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ]
                                    ]
                                }
                            ],
                            "crudeObjectsList": [
                                {
                                    "polariList": [
                                        [
                                            "CLASS-polariCRUDE-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "id",
                                                                    "tRtzcDN8K"
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polariCRUDE-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "id",
                                                                    "fQp10ty6zF"
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polariCRUDE-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "id",
                                                                    "CFyXBDs53"
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polariCRUDE-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "id",
                                                                    "z116yB4x4x"
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polariCRUDE-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "id",
                                                                    "ydyAVrCLF"
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polariCRUDE-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "id",
                                                                    "840XrZtsX"
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polariCRUDE-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "id",
                                                                    "YjJfzIfxq"
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polariCRUDE-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "id",
                                                                    "rVteU10Nl10"
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polariCRUDE-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "id",
                                                                    "Ic11EE8Jko"
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polariCRUDE-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "id",
                                                                    "D3YeQjg7d"
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polariCRUDE-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "id",
                                                                    "BC1AKr27r"
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polariCRUDE-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "id",
                                                                    "5lnwXAxDb"
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polariCRUDE-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "id",
                                                                    "UzCxzGo48"
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polariCRUDE-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "id",
                                                                    "qMdFM3w1U"
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polariCRUDE-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "id",
                                                                    "M5XSBZTQM"
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polariCRUDE-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "id",
                                                                    "fN911QN6Nh"
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polariCRUDE-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "id",
                                                                    "gc10QAHfKI"
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polariCRUDE-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "id",
                                                                    "lk6FLCw59"
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polariCRUDE-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "id",
                                                                    "9s10nTSurk"
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polariCRUDE-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "id",
                                                                    "ytXRH2IzG"
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ]
                                    ]
                                }
                            ],
                            "siblingSystems": [
                                {
                                    "polariList": []
                                }
                            ],
                            "siblingServers": [
                                {
                                    "polariList": []
                                }
                            ],
                            "certFile": null,
                            "apps": [
                                {
                                    "polariList": []
                                }
                            ],
                            "streams": [
                                {
                                    "polariList": []
                                }
                            ],
                            "groups": [
                                {
                                    "polariList": []
                                }
                            ],
                            "serverInstance": null
                        }
                    ]
                }
            ],
            "polyTypedObject": [
                {
                    "class": "polyTypedObject",
                    "varsLimited": [],
                    "data": [
                        {
                            "id": "XYmRNzLMb",
                            "branch": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "isTreeObject": null,
                            "isManagerObject": null,
                            "className": "managerObject",
                            "kwRequiredParams": [
                                {
                                    "polariList": []
                                }
                            ],
                            "kwDefaultParams": [
                                {
                                    "dict": {}
                                }
                            ],
                            "hasBaseSample": false,
                            "objectReferencesDict": [
                                {
                                    "dict": {}
                                }
                            ],
                            "requiredInitKeywordParams": [
                                {
                                    "polariList": []
                                }
                            ],
                            "initKeywordParamsWdefaults": [
                                {
                                    "dict": {}
                                }
                            ],
                            "sourceFiles": [
                                {
                                    "polariList": [
                                        [
                                            "CLASS-managedExecutable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "objectTreeManagerDecorators"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "extension",
                                                                    "py"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "Path",
                                                                    "C:\\Users\\dusti\\Documents\\Polari-Framework"
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ]
                                    ]
                                }
                            ],
                            "polariSourceFile": [
                                "CLASS-managedExecutable-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "objectTreeManagerDecorators"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "extension",
                                                        "py"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "Path",
                                                        "C:\\Users\\dusti\\Documents\\Polari-Framework"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inheritedTyping": [
                                {
                                    "polariList": []
                                }
                            ],
                            "identifiers": [
                                {
                                    "polariList": [
                                        "id"
                                    ]
                                }
                            ],
                            "variableNameList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "polyTypedVars": [
                                {
                                    "polariList": [
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "complete"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "managerObject"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "manager"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "managerObject"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "hostSys"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "managerObject"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "hasDB"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "managerObject"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "objectTypingDict"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "managerObject"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "objectTyping"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "managerObject"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "objectTree"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "managerObject"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "objectTables"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "managerObject"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "managedFiles"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "managerObject"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "id"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "managerObject"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "db"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "managerObject"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "polServer"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "managerObject"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "subManagers"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "managerObject"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "idList"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "managerObject"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "branch"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "managerObject"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "cloudIdList"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "managerObject"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "hasServer"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "managerObject"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ]
                                    ]
                                }
                            ],
                            "baseAccessDictionary": [
                                {
                                    "dict": {}
                                }
                            ],
                            "basePermissionDictionary": [
                                {
                                    "dict": {}
                                }
                            ]
                        },
                        {
                            "id": "PkG1yn8zf",
                            "branch": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "isTreeObject": null,
                            "isManagerObject": null,
                            "className": "polyTypedVariable",
                            "kwRequiredParams": [
                                {
                                    "polariList": []
                                }
                            ],
                            "kwDefaultParams": [
                                {
                                    "polariList": []
                                }
                            ],
                            "hasBaseSample": false,
                            "objectReferencesDict": [
                                {
                                    "dict": {
                                        "polyTypedObject": [
                                            {
                                                "str": null
                                            }
                                        ],
                                        "polyTypedVariable": [
                                            {
                                                "str": null
                                            }
                                        ]
                                    }
                                }
                            ],
                            "requiredInitKeywordParams": [
                                {
                                    "polariList": []
                                }
                            ],
                            "initKeywordParamsWdefaults": [
                                {
                                    "dict": {}
                                }
                            ],
                            "sourceFiles": [
                                {
                                    "polariList": [
                                        [
                                            "CLASS-managedExecutable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "polyTypedVars"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "extension",
                                                                    "py"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "Path",
                                                                    "C:\\Users\\dusti\\Documents\\Polari-Framework\\polariDataTyping"
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ]
                                    ]
                                }
                            ],
                            "polariSourceFile": [
                                "CLASS-managedExecutable-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "polyTypedVars"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "extension",
                                                        "py"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "Path",
                                                        "C:\\Users\\dusti\\Documents\\Polari-Framework\\polariDataTyping"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inheritedTyping": [
                                {
                                    "polariList": []
                                }
                            ],
                            "identifiers": [
                                {
                                    "polariList": [
                                        "name",
                                        "polyTypedObj"
                                    ]
                                }
                            ],
                            "variableNameList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "polyTypedVars": [
                                {
                                    "polariList": [
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "id"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "polyTypedVariable"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "branch"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "polyTypedVariable"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "inTree"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "polyTypedVariable"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "manager"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "polyTypedVariable"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "name"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "polyTypedVariable"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "eventsList"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "polyTypedVariable"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "typingDicts"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "polyTypedVariable"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "pythonTypeDefault"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "polyTypedVariable"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ]
                                    ]
                                }
                            ],
                            "baseAccessDictionary": [
                                {
                                    "dict": {}
                                }
                            ],
                            "basePermissionDictionary": [
                                {
                                    "dict": {}
                                }
                            ]
                        },
                        {
                            "id": "wCosIK50b",
                            "branch": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "isTreeObject": null,
                            "isManagerObject": null,
                            "className": "Polari",
                            "kwRequiredParams": [
                                {
                                    "polariList": []
                                }
                            ],
                            "kwDefaultParams": [
                                {
                                    "polariList": []
                                }
                            ],
                            "hasBaseSample": false,
                            "objectReferencesDict": [
                                {
                                    "dict": {}
                                }
                            ],
                            "requiredInitKeywordParams": [
                                {
                                    "polariList": []
                                }
                            ],
                            "initKeywordParamsWdefaults": [
                                {
                                    "dict": {}
                                }
                            ],
                            "sourceFiles": [
                                {
                                    "polariList": [
                                        [
                                            "CLASS-managedExecutable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "definePolari"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "extension",
                                                                    "py"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "Path",
                                                                    "C:\\Users\\dusti\\Documents\\Polari-Framework\\polariAI"
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ]
                                    ]
                                }
                            ],
                            "polariSourceFile": [
                                "CLASS-managedExecutable-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "definePolari"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "extension",
                                                        "py"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "Path",
                                                        "C:\\Users\\dusti\\Documents\\Polari-Framework\\polariAI"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inheritedTyping": [
                                {
                                    "polariList": []
                                }
                            ],
                            "identifiers": [
                                {
                                    "polariList": [
                                        "id"
                                    ]
                                }
                            ],
                            "variableNameList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "polyTypedVars": [
                                {
                                    "polariList": []
                                }
                            ],
                            "baseAccessDictionary": [
                                {
                                    "dict": {}
                                }
                            ],
                            "basePermissionDictionary": [
                                {
                                    "dict": {}
                                }
                            ]
                        },
                        {
                            "id": "bwyiGmhN11",
                            "branch": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "isTreeObject": null,
                            "isManagerObject": null,
                            "className": "dataStream",
                            "kwRequiredParams": [
                                {
                                    "polariList": [
                                        "source"
                                    ]
                                }
                            ],
                            "kwDefaultParams": [
                                {
                                    "polariList": [
                                        "channels",
                                        "sinkInstances",
                                        "recurring"
                                    ]
                                }
                            ],
                            "hasBaseSample": false,
                            "objectReferencesDict": [
                                {
                                    "dict": {
                                        "managedApp": [
                                            {
                                                "str": null
                                            }
                                        ]
                                    }
                                }
                            ],
                            "requiredInitKeywordParams": [
                                {
                                    "polariList": []
                                }
                            ],
                            "initKeywordParamsWdefaults": [
                                {
                                    "dict": {}
                                }
                            ],
                            "sourceFiles": [
                                {
                                    "polariList": [
                                        [
                                            "CLASS-managedExecutable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "dataStreams"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "extension",
                                                                    "py"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "Path",
                                                                    "C:\\Users\\dusti\\Documents\\Polari-Framework\\polariApiServer"
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ]
                                    ]
                                }
                            ],
                            "polariSourceFile": [
                                "CLASS-managedExecutable-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "dataStreams"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "extension",
                                                        "py"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "Path",
                                                        "C:\\Users\\dusti\\Documents\\Polari-Framework\\polariApiServer"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inheritedTyping": [
                                {
                                    "polariList": []
                                }
                            ],
                            "identifiers": [
                                {
                                    "polariList": [
                                        "id"
                                    ]
                                }
                            ],
                            "variableNameList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "polyTypedVars": [
                                {
                                    "polariList": []
                                }
                            ],
                            "baseAccessDictionary": [
                                {
                                    "dict": {}
                                }
                            ],
                            "basePermissionDictionary": [
                                {
                                    "dict": {}
                                }
                            ]
                        },
                        {
                            "id": "LhJiskvPf",
                            "branch": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "isTreeObject": null,
                            "isManagerObject": null,
                            "className": "remoteEvent",
                            "kwRequiredParams": [
                                {
                                    "polariList": []
                                }
                            ],
                            "kwDefaultParams": [
                                {
                                    "polariList": [
                                        "eventName",
                                        "source",
                                        "sink",
                                        "channels"
                                    ]
                                }
                            ],
                            "hasBaseSample": false,
                            "objectReferencesDict": [
                                {
                                    "dict": {
                                        "managedApp": [
                                            {
                                                "str": null
                                            }
                                        ]
                                    }
                                }
                            ],
                            "requiredInitKeywordParams": [
                                {
                                    "polariList": []
                                }
                            ],
                            "initKeywordParamsWdefaults": [
                                {
                                    "dict": {}
                                }
                            ],
                            "sourceFiles": [
                                {
                                    "polariList": [
                                        [
                                            "CLASS-managedExecutable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "remoteEvents"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "extension",
                                                                    "py"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "Path",
                                                                    "C:\\Users\\dusti\\Documents\\Polari-Framework\\polariApiServer"
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ]
                                    ]
                                }
                            ],
                            "polariSourceFile": [
                                "CLASS-managedExecutable-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "remoteEvents"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "extension",
                                                        "py"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "Path",
                                                        "C:\\Users\\dusti\\Documents\\Polari-Framework\\polariApiServer"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inheritedTyping": [
                                {
                                    "polariList": []
                                }
                            ],
                            "identifiers": [
                                {
                                    "polariList": [
                                        "id"
                                    ]
                                }
                            ],
                            "variableNameList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "polyTypedVars": [
                                {
                                    "polariList": []
                                }
                            ],
                            "baseAccessDictionary": [
                                {
                                    "dict": {}
                                }
                            ],
                            "basePermissionDictionary": [
                                {
                                    "dict": {}
                                }
                            ]
                        },
                        {
                            "id": "fQJMOIpxz",
                            "branch": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "isTreeObject": null,
                            "isManagerObject": null,
                            "className": "managedUserInterface",
                            "kwRequiredParams": [
                                {
                                    "polariList": []
                                }
                            ],
                            "kwDefaultParams": [
                                {
                                    "polariList": [
                                        "hostApp",
                                        "launchMethod"
                                    ]
                                }
                            ],
                            "hasBaseSample": false,
                            "objectReferencesDict": [
                                {
                                    "dict": {
                                        "managedApp": [
                                            {
                                                "str": null
                                            }
                                        ]
                                    }
                                }
                            ],
                            "requiredInitKeywordParams": [
                                {
                                    "polariList": []
                                }
                            ],
                            "initKeywordParamsWdefaults": [
                                {
                                    "dict": {}
                                }
                            ],
                            "sourceFiles": [
                                {
                                    "polariList": [
                                        [
                                            "CLASS-managedExecutable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "managedUserInterface"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "extension",
                                                                    "py"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "Path",
                                                                    "C:\\Users\\dusti\\Documents\\Polari-Framework\\polariFrontendManagement"
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ]
                                    ]
                                }
                            ],
                            "polariSourceFile": [
                                "CLASS-managedExecutable-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "managedUserInterface"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "extension",
                                                        "py"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "Path",
                                                        "C:\\Users\\dusti\\Documents\\Polari-Framework\\polariFrontendManagement"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inheritedTyping": [
                                {
                                    "polariList": []
                                }
                            ],
                            "identifiers": [
                                {
                                    "polariList": [
                                        "id"
                                    ]
                                }
                            ],
                            "variableNameList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "polyTypedVars": [
                                {
                                    "polariList": []
                                }
                            ],
                            "baseAccessDictionary": [
                                {
                                    "dict": {}
                                }
                            ],
                            "basePermissionDictionary": [
                                {
                                    "dict": {}
                                }
                            ]
                        },
                        {
                            "id": "WJBAVgjH0",
                            "branch": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "isTreeObject": null,
                            "isManagerObject": null,
                            "className": "managedFile",
                            "kwRequiredParams": [
                                {
                                    "polariList": []
                                }
                            ],
                            "kwDefaultParams": [
                                {
                                    "polariList": [
                                        "name",
                                        "Path",
                                        "extension"
                                    ]
                                }
                            ],
                            "hasBaseSample": false,
                            "objectReferencesDict": [
                                {
                                    "dict": {
                                        "managedApp": [
                                            {
                                                "str": null
                                            }
                                        ]
                                    }
                                }
                            ],
                            "requiredInitKeywordParams": [
                                {
                                    "polariList": []
                                }
                            ],
                            "initKeywordParamsWdefaults": [
                                {
                                    "dict": {}
                                }
                            ],
                            "sourceFiles": [
                                {
                                    "polariList": [
                                        [
                                            "CLASS-managedExecutable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "managedFiles"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "extension",
                                                                    "py"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "Path",
                                                                    "C:\\Users\\dusti\\Documents\\Polari-Framework\\polariFiles"
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ]
                                    ]
                                }
                            ],
                            "polariSourceFile": [
                                "CLASS-managedExecutable-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "managedFiles"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "extension",
                                                        "py"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "Path",
                                                        "C:\\Users\\dusti\\Documents\\Polari-Framework\\polariFiles"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inheritedTyping": [
                                {
                                    "polariList": []
                                }
                            ],
                            "identifiers": [
                                {
                                    "polariList": [
                                        "name",
                                        "extension",
                                        "Path"
                                    ]
                                }
                            ],
                            "variableNameList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "polyTypedVars": [
                                {
                                    "polariList": []
                                }
                            ],
                            "baseAccessDictionary": [
                                {
                                    "dict": {}
                                }
                            ],
                            "basePermissionDictionary": [
                                {
                                    "dict": {}
                                }
                            ]
                        },
                        {
                            "id": "7bbBYeQ8Y",
                            "branch": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "isTreeObject": null,
                            "isManagerObject": null,
                            "className": "managedApp",
                            "kwRequiredParams": [
                                {
                                    "polariList": []
                                }
                            ],
                            "kwDefaultParams": [
                                {
                                    "polariList": [
                                        "name",
                                        "displayName",
                                        "Path",
                                        "manager"
                                    ]
                                }
                            ],
                            "hasBaseSample": false,
                            "objectReferencesDict": [
                                {
                                    "dict": {
                                        "managedApp": [
                                            {
                                                "str": null
                                            }
                                        ]
                                    }
                                }
                            ],
                            "requiredInitKeywordParams": [
                                {
                                    "polariList": []
                                }
                            ],
                            "initKeywordParamsWdefaults": [
                                {
                                    "dict": {}
                                }
                            ],
                            "sourceFiles": [
                                {
                                    "polariList": [
                                        [
                                            "CLASS-managedExecutable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "managedApp"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "extension",
                                                                    "py"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "Path",
                                                                    "C:\\Users\\dusti\\Documents\\Polari-Framework\\polariFrontendManagement"
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ]
                                    ]
                                }
                            ],
                            "polariSourceFile": [
                                "CLASS-managedExecutable-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "managedApp"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "extension",
                                                        "py"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "Path",
                                                        "C:\\Users\\dusti\\Documents\\Polari-Framework\\polariFrontendManagement"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inheritedTyping": [
                                {
                                    "polariList": []
                                }
                            ],
                            "identifiers": [
                                {
                                    "polariList": [
                                        "name"
                                    ]
                                }
                            ],
                            "variableNameList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "polyTypedVars": [
                                {
                                    "polariList": []
                                }
                            ],
                            "baseAccessDictionary": [
                                {
                                    "dict": {}
                                }
                            ],
                            "basePermissionDictionary": [
                                {
                                    "dict": {}
                                }
                            ]
                        },
                        {
                            "id": "yh410CX43M",
                            "branch": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "isTreeObject": null,
                            "isManagerObject": null,
                            "className": "browserSourcePage",
                            "kwRequiredParams": [
                                {
                                    "polariList": []
                                }
                            ],
                            "kwDefaultParams": [
                                {
                                    "polariList": [
                                        "name",
                                        "sourceHTMLfile",
                                        "supportFiles",
                                        "supportPages"
                                    ]
                                }
                            ],
                            "hasBaseSample": false,
                            "objectReferencesDict": [
                                {
                                    "dict": {
                                        "managedApp": [
                                            {
                                                "str": null
                                            }
                                        ]
                                    }
                                }
                            ],
                            "requiredInitKeywordParams": [
                                {
                                    "polariList": []
                                }
                            ],
                            "initKeywordParamsWdefaults": [
                                {
                                    "dict": {}
                                }
                            ],
                            "sourceFiles": [
                                {
                                    "polariList": [
                                        [
                                            "CLASS-managedExecutable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "managedApp"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "extension",
                                                                    "py"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "Path",
                                                                    "C:\\Users\\dusti\\Documents\\Polari-Framework\\polariFrontendManagement"
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ]
                                    ]
                                }
                            ],
                            "polariSourceFile": [
                                "CLASS-managedExecutable-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "managedApp"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "extension",
                                                        "py"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "Path",
                                                        "C:\\Users\\dusti\\Documents\\Polari-Framework\\polariFrontendManagement"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inheritedTyping": [
                                {
                                    "polariList": []
                                }
                            ],
                            "identifiers": [
                                {
                                    "polariList": [
                                        "name",
                                        "Path"
                                    ]
                                }
                            ],
                            "variableNameList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "polyTypedVars": [
                                {
                                    "polariList": []
                                }
                            ],
                            "baseAccessDictionary": [
                                {
                                    "dict": {}
                                }
                            ],
                            "basePermissionDictionary": [
                                {
                                    "dict": {}
                                }
                            ]
                        },
                        {
                            "id": "FVrxaRbDs",
                            "branch": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "isTreeObject": null,
                            "isManagerObject": null,
                            "className": "managedDatabase",
                            "kwRequiredParams": [
                                {
                                    "polariList": []
                                }
                            ],
                            "kwDefaultParams": [
                                {
                                    "polariList": [
                                        "name",
                                        "manager",
                                        "DBurl",
                                        "DBtype",
                                        "tables",
                                        "inRAM"
                                    ]
                                }
                            ],
                            "hasBaseSample": false,
                            "objectReferencesDict": [
                                {
                                    "dict": {
                                        "managedApp": [
                                            {
                                                "str": null
                                            }
                                        ]
                                    }
                                }
                            ],
                            "requiredInitKeywordParams": [
                                {
                                    "polariList": []
                                }
                            ],
                            "initKeywordParamsWdefaults": [
                                {
                                    "dict": {}
                                }
                            ],
                            "sourceFiles": [
                                {
                                    "polariList": [
                                        [
                                            "CLASS-managedExecutable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "managedDB"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "extension",
                                                                    "py"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "Path",
                                                                    "C:\\Users\\dusti\\Documents\\Polari-Framework\\polariDBmanagement"
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ]
                                    ]
                                }
                            ],
                            "polariSourceFile": [
                                "CLASS-managedExecutable-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "managedDB"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "extension",
                                                        "py"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "Path",
                                                        "C:\\Users\\dusti\\Documents\\Polari-Framework\\polariDBmanagement"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inheritedTyping": [
                                {
                                    "polariList": []
                                }
                            ],
                            "identifiers": [
                                {
                                    "polariList": [
                                        "name",
                                        "Path"
                                    ]
                                }
                            ],
                            "variableNameList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "polyTypedVars": [
                                {
                                    "polariList": []
                                }
                            ],
                            "baseAccessDictionary": [
                                {
                                    "dict": {}
                                }
                            ],
                            "basePermissionDictionary": [
                                {
                                    "dict": {}
                                }
                            ]
                        },
                        {
                            "id": "stNN3o102I",
                            "branch": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "isTreeObject": null,
                            "isManagerObject": null,
                            "className": "dataChannel",
                            "kwRequiredParams": [
                                {
                                    "polariList": [
                                        "manager"
                                    ]
                                }
                            ],
                            "kwDefaultParams": [
                                {
                                    "polariList": [
                                        "name",
                                        "Path"
                                    ]
                                }
                            ],
                            "hasBaseSample": false,
                            "objectReferencesDict": [
                                {
                                    "dict": {
                                        "polariServer": [
                                            {
                                                "str": null
                                            }
                                        ],
                                        "managedApp": [
                                            {
                                                "str": null
                                            }
                                        ]
                                    }
                                }
                            ],
                            "requiredInitKeywordParams": [
                                {
                                    "polariList": []
                                }
                            ],
                            "initKeywordParamsWdefaults": [
                                {
                                    "dict": {}
                                }
                            ],
                            "sourceFiles": [
                                {
                                    "polariList": [
                                        [
                                            "CLASS-managedExecutable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "dataChannels"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "extension",
                                                                    "py"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "Path",
                                                                    "C:\\Users\\dusti\\Documents\\Polari-Framework\\polariFiles"
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ]
                                    ]
                                }
                            ],
                            "polariSourceFile": [
                                "CLASS-managedExecutable-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "dataChannels"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "extension",
                                                        "py"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "Path",
                                                        "C:\\Users\\dusti\\Documents\\Polari-Framework\\polariFiles"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inheritedTyping": [
                                {
                                    "polariList": []
                                }
                            ],
                            "identifiers": [
                                {
                                    "polariList": [
                                        "name",
                                        "Path"
                                    ]
                                }
                            ],
                            "variableNameList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "polyTypedVars": [
                                {
                                    "polariList": []
                                }
                            ],
                            "baseAccessDictionary": [
                                {
                                    "dict": {}
                                }
                            ],
                            "basePermissionDictionary": [
                                {
                                    "dict": {}
                                }
                            ]
                        },
                        {
                            "id": "7VVTig7vC",
                            "branch": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "isTreeObject": null,
                            "isManagerObject": null,
                            "className": "managedExecutable",
                            "kwRequiredParams": [
                                {
                                    "polariList": []
                                }
                            ],
                            "kwDefaultParams": [
                                {
                                    "polariList": [
                                        "name",
                                        "extension",
                                        "Path",
                                        "manager"
                                    ]
                                }
                            ],
                            "hasBaseSample": false,
                            "objectReferencesDict": [
                                {
                                    "dict": {}
                                }
                            ],
                            "requiredInitKeywordParams": [
                                {
                                    "polariList": []
                                }
                            ],
                            "initKeywordParamsWdefaults": [
                                {
                                    "dict": {}
                                }
                            ],
                            "sourceFiles": [
                                {
                                    "polariList": [
                                        [
                                            "CLASS-managedExecutable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "managedExecutables"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "extension",
                                                                    "py"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "Path",
                                                                    "C:\\Users\\dusti\\Documents\\Polari-Framework\\polariFiles"
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ]
                                    ]
                                }
                            ],
                            "polariSourceFile": [
                                "CLASS-managedExecutable-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "managedExecutables"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "extension",
                                                        "py"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "Path",
                                                        "C:\\Users\\dusti\\Documents\\Polari-Framework\\polariFiles"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inheritedTyping": [
                                {
                                    "polariList": []
                                }
                            ],
                            "identifiers": [
                                {
                                    "polariList": [
                                        "name",
                                        "extension",
                                        "Path"
                                    ]
                                }
                            ],
                            "variableNameList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "polyTypedVars": [
                                {
                                    "polariList": [
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "id"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "managedExecutable"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "branch"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "managedExecutable"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "inTree"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "managedExecutable"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "manager"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "managedExecutable"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "name"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "managedExecutable"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "extension"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "managedExecutable"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "version"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "managedExecutable"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "Path"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "managedExecutable"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "url"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "managedExecutable"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "active"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "managedExecutable"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "isRemote"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "managedExecutable"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "complete"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "managedExecutable"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "fileSize_bytes"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "managedExecutable"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "maxFileSize_bytes"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "managedExecutable"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "fileInstance"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "managedExecutable"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "isOpen"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "managedExecutable"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "language"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "managedExecutable"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "codeStrings"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "managedExecutable"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "AccountingLogicNodes"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "managedExecutable"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "innerContext"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "managedExecutable"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "outerContext"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "managedExecutable"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ]
                                    ]
                                }
                            ],
                            "baseAccessDictionary": [
                                {
                                    "dict": {}
                                }
                            ],
                            "basePermissionDictionary": [
                                {
                                    "dict": {}
                                }
                            ]
                        },
                        {
                            "id": "10x6phAAlC",
                            "branch": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "isTreeObject": null,
                            "isManagerObject": null,
                            "className": "polyTypedObject",
                            "kwRequiredParams": [
                                {
                                    "polariList": [
                                        "className",
                                        "manager"
                                    ]
                                }
                            ],
                            "kwDefaultParams": [
                                {
                                    "polariList": [
                                        "objectReferencesDict",
                                        "sourceFiles",
                                        "identifierVariables",
                                        "variableNameList",
                                        "baseAccessDict",
                                        "basePermDict",
                                        "classDefinition",
                                        "sampleInstances",
                                        "kwRequiredParams",
                                        "kwDefaultParams"
                                    ]
                                }
                            ],
                            "hasBaseSample": false,
                            "objectReferencesDict": [
                                {
                                    "dict": {
                                        "managerObject": [
                                            {
                                                "str": null
                                            }
                                        ]
                                    }
                                }
                            ],
                            "requiredInitKeywordParams": [
                                {
                                    "polariList": []
                                }
                            ],
                            "initKeywordParamsWdefaults": [
                                {
                                    "dict": {}
                                }
                            ],
                            "sourceFiles": [
                                {
                                    "polariList": [
                                        [
                                            "CLASS-managedExecutable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "polyTyping"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "extension",
                                                                    "py"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "Path",
                                                                    "C:\\Users\\dusti\\Documents\\Polari-Framework\\polariDataTyping"
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ]
                                    ]
                                }
                            ],
                            "polariSourceFile": [
                                "CLASS-managedExecutable-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "polyTyping"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "extension",
                                                        "py"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "Path",
                                                        "C:\\Users\\dusti\\Documents\\Polari-Framework\\polariDataTyping"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inheritedTyping": [
                                {
                                    "polariList": []
                                }
                            ],
                            "identifiers": [
                                {
                                    "polariList": [
                                        "className"
                                    ]
                                }
                            ],
                            "variableNameList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "polyTypedVars": [
                                {
                                    "polariList": [
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "id"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "polyTypedObject"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "branch"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "polyTypedObject"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "inTree"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "polyTypedObject"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "manager"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "polyTypedObject"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "isTreeObject"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "polyTypedObject"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "isManagerObject"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "polyTypedObject"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "className"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "polyTypedObject"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "kwRequiredParams"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "polyTypedObject"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "kwDefaultParams"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "polyTypedObject"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "hasBaseSample"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "polyTypedObject"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "objectReferencesDict"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "polyTypedObject"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "requiredInitKeywordParams"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "polyTypedObject"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "initKeywordParamsWdefaults"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "polyTypedObject"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "sourceFiles"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "polyTypedObject"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "polariSourceFile"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "polyTypedObject"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "inheritedTyping"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "polyTypedObject"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "identifiers"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "polyTypedObject"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "variableNameList"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "polyTypedObject"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "polyTypedVars"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "polyTypedObject"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "baseAccessDictionary"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "polyTypedObject"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "basePermissionDictionary"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "polyTypedObject"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "name"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "polyTypedObject"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "eventsList"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "polyTypedObject"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "typingDicts"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "polyTypedObject"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "pythonTypeDefault"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "polyTypedObject"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ]
                                    ]
                                }
                            ],
                            "baseAccessDictionary": [
                                {
                                    "dict": {}
                                }
                            ],
                            "basePermissionDictionary": [
                                {
                                    "dict": {}
                                }
                            ]
                        },
                        {
                            "id": "c8OobMWKe",
                            "branch": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "isTreeObject": null,
                            "isManagerObject": null,
                            "className": "polariServer",
                            "kwRequiredParams": [
                                {
                                    "polariList": []
                                }
                            ],
                            "kwDefaultParams": [
                                {
                                    "polariList": [
                                        "name",
                                        "displayName",
                                        "hostSystem",
                                        "serverChannel",
                                        "serverDataStream"
                                    ]
                                }
                            ],
                            "hasBaseSample": false,
                            "objectReferencesDict": [
                                {
                                    "dict": {
                                        "polariServer": [
                                            {
                                                "str": null
                                            }
                                        ]
                                    }
                                }
                            ],
                            "requiredInitKeywordParams": [
                                {
                                    "polariList": []
                                }
                            ],
                            "initKeywordParamsWdefaults": [
                                {
                                    "dict": {}
                                }
                            ],
                            "sourceFiles": [
                                {
                                    "polariList": [
                                        [
                                            "CLASS-managedExecutable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "polariServer"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "extension",
                                                                    "py"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "Path",
                                                                    "C:\\Users\\dusti\\Documents\\Polari-Framework\\polariApiServer"
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ]
                                    ]
                                }
                            ],
                            "polariSourceFile": [
                                "CLASS-managedExecutable-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "polariServer"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "extension",
                                                        "py"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "Path",
                                                        "C:\\Users\\dusti\\Documents\\Polari-Framework\\polariApiServer"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inheritedTyping": [
                                {
                                    "polariList": []
                                }
                            ],
                            "identifiers": [
                                {
                                    "polariList": [
                                        "name",
                                        "id"
                                    ]
                                }
                            ],
                            "variableNameList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "polyTypedVars": [
                                {
                                    "polariList": []
                                }
                            ],
                            "baseAccessDictionary": [
                                {
                                    "dict": {}
                                }
                            ],
                            "basePermissionDictionary": [
                                {
                                    "dict": {}
                                }
                            ]
                        },
                        {
                            "id": "410KxJHKpX",
                            "branch": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "isTreeObject": null,
                            "isManagerObject": null,
                            "className": "User",
                            "kwRequiredParams": [
                                {
                                    "polariList": []
                                }
                            ],
                            "kwDefaultParams": [
                                {
                                    "polariList": [
                                        "username",
                                        "password",
                                        "unregistered"
                                    ]
                                }
                            ],
                            "hasBaseSample": false,
                            "objectReferencesDict": [
                                {
                                    "dict": {
                                        "managerObject": [
                                            {
                                                "str": null
                                            }
                                        ]
                                    }
                                }
                            ],
                            "requiredInitKeywordParams": [
                                {
                                    "polariList": []
                                }
                            ],
                            "initKeywordParamsWdefaults": [
                                {
                                    "dict": {}
                                }
                            ],
                            "sourceFiles": [
                                {
                                    "polariList": [
                                        [
                                            "CLASS-managedExecutable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "polariUser"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "extension",
                                                                    "py"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "Path",
                                                                    "C:\\Users\\dusti\\Documents\\Polari-Framework\\accessControl"
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ]
                                    ]
                                }
                            ],
                            "polariSourceFile": [
                                "CLASS-managedExecutable-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "polariUser"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "extension",
                                                        "py"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "Path",
                                                        "C:\\Users\\dusti\\Documents\\Polari-Framework\\accessControl"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inheritedTyping": [
                                {
                                    "polariList": []
                                }
                            ],
                            "identifiers": [
                                {
                                    "polariList": [
                                        "id"
                                    ]
                                }
                            ],
                            "variableNameList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "polyTypedVars": [
                                {
                                    "polariList": []
                                }
                            ],
                            "baseAccessDictionary": [
                                {
                                    "dict": {}
                                }
                            ],
                            "basePermissionDictionary": [
                                {
                                    "dict": {}
                                }
                            ]
                        },
                        {
                            "id": "rUIbXGR3h",
                            "branch": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "isTreeObject": null,
                            "isManagerObject": null,
                            "className": "UserGroup",
                            "kwRequiredParams": [
                                {
                                    "polariList": [
                                        "name"
                                    ]
                                }
                            ],
                            "kwDefaultParams": [
                                {
                                    "polariList": [
                                        "assignedUsers",
                                        "userMembersQuery",
                                        "permissionSets"
                                    ]
                                }
                            ],
                            "hasBaseSample": false,
                            "objectReferencesDict": [
                                {
                                    "dict": {
                                        "managerObject": [
                                            {
                                                "str": null
                                            }
                                        ]
                                    }
                                }
                            ],
                            "requiredInitKeywordParams": [
                                {
                                    "polariList": []
                                }
                            ],
                            "initKeywordParamsWdefaults": [
                                {
                                    "dict": {}
                                }
                            ],
                            "sourceFiles": [
                                {
                                    "polariList": [
                                        [
                                            "CLASS-managedExecutable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "polariUserGroup"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "extension",
                                                                    "py"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "Path",
                                                                    "C:\\Users\\dusti\\Documents\\Polari-Framework\\accessControl"
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ]
                                    ]
                                }
                            ],
                            "polariSourceFile": [
                                "CLASS-managedExecutable-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "polariUserGroup"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "extension",
                                                        "py"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "Path",
                                                        "C:\\Users\\dusti\\Documents\\Polari-Framework\\accessControl"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inheritedTyping": [
                                {
                                    "polariList": []
                                }
                            ],
                            "identifiers": [
                                {
                                    "polariList": [
                                        "id"
                                    ]
                                }
                            ],
                            "variableNameList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "polyTypedVars": [
                                {
                                    "polariList": []
                                }
                            ],
                            "baseAccessDictionary": [
                                {
                                    "dict": {}
                                }
                            ],
                            "basePermissionDictionary": [
                                {
                                    "dict": {}
                                }
                            ]
                        },
                        {
                            "id": "3KdPTfvQw",
                            "branch": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "isTreeObject": null,
                            "isManagerObject": null,
                            "className": "polariAPI",
                            "kwRequiredParams": [
                                {
                                    "polariList": [
                                        "apiName",
                                        "polServer"
                                    ]
                                }
                            ],
                            "kwDefaultParams": [
                                {
                                    "polariList": [
                                        "minAccessDict",
                                        "maxAccessDict",
                                        "minPermissionsDict",
                                        "maxPermissionsDict",
                                        "eventAPI",
                                        "eventObject",
                                        "event"
                                    ]
                                }
                            ],
                            "hasBaseSample": false,
                            "objectReferencesDict": [
                                {
                                    "dict": {
                                        "polariServer": [
                                            {
                                                "str": null
                                            }
                                        ]
                                    }
                                }
                            ],
                            "requiredInitKeywordParams": [
                                {
                                    "polariList": []
                                }
                            ],
                            "initKeywordParamsWdefaults": [
                                {
                                    "dict": {}
                                }
                            ],
                            "sourceFiles": [
                                {
                                    "polariList": [
                                        [
                                            "CLASS-managedExecutable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "polariAPI"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "extension",
                                                                    "py"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "Path",
                                                                    "C:\\Users\\dusti\\Documents\\Polari-Framework\\polariApiServer"
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ]
                                    ]
                                }
                            ],
                            "polariSourceFile": [
                                "CLASS-managedExecutable-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "polariAPI"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "extension",
                                                        "py"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "Path",
                                                        "C:\\Users\\dusti\\Documents\\Polari-Framework\\polariApiServer"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inheritedTyping": [
                                {
                                    "polariList": []
                                }
                            ],
                            "identifiers": [
                                {
                                    "polariList": [
                                        "id"
                                    ]
                                }
                            ],
                            "variableNameList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "polyTypedVars": [
                                {
                                    "polariList": []
                                }
                            ],
                            "baseAccessDictionary": [
                                {
                                    "dict": {}
                                }
                            ],
                            "basePermissionDictionary": [
                                {
                                    "dict": {}
                                }
                            ]
                        },
                        {
                            "id": "cuCIU4v8Z",
                            "branch": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "isTreeObject": null,
                            "isManagerObject": null,
                            "className": "polariCRUDE",
                            "kwRequiredParams": [
                                {
                                    "polariList": [
                                        "apiObject",
                                        "polServer"
                                    ]
                                }
                            ],
                            "kwDefaultParams": [
                                {
                                    "polariList": []
                                }
                            ],
                            "hasBaseSample": false,
                            "objectReferencesDict": [
                                {
                                    "dict": {
                                        "polariServer": [
                                            {
                                                "str": null
                                            }
                                        ]
                                    }
                                }
                            ],
                            "requiredInitKeywordParams": [
                                {
                                    "polariList": []
                                }
                            ],
                            "initKeywordParamsWdefaults": [
                                {
                                    "dict": {}
                                }
                            ],
                            "sourceFiles": [
                                {
                                    "polariList": [
                                        [
                                            "CLASS-managedExecutable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "polariCRUDE"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "extension",
                                                                    "py"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "Path",
                                                                    "C:\\Users\\dusti\\Documents\\Polari-Framework\\polariApiServer"
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ]
                                    ]
                                }
                            ],
                            "polariSourceFile": [
                                "CLASS-managedExecutable-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "polariCRUDE"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "extension",
                                                        "py"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "Path",
                                                        "C:\\Users\\dusti\\Documents\\Polari-Framework\\polariApiServer"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inheritedTyping": [
                                {
                                    "polariList": []
                                }
                            ],
                            "identifiers": [
                                {
                                    "polariList": [
                                        "id"
                                    ]
                                }
                            ],
                            "variableNameList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "polyTypedVars": [
                                {
                                    "polariList": []
                                }
                            ],
                            "baseAccessDictionary": [
                                {
                                    "dict": {}
                                }
                            ],
                            "basePermissionDictionary": [
                                {
                                    "dict": {}
                                }
                            ]
                        },
                        {
                            "id": "cFKA7pfod",
                            "branch": [
                                "CLASS-polariServer-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "NEW_SERVER"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        "Kp7wG8NXX"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "isTreeObject": null,
                            "isManagerObject": null,
                            "className": "isoSys",
                            "kwRequiredParams": [
                                {
                                    "polariList": [
                                        "self"
                                    ]
                                }
                            ],
                            "kwDefaultParams": [
                                {
                                    "dict": {}
                                }
                            ],
                            "hasBaseSample": false,
                            "objectReferencesDict": [
                                {
                                    "dict": {
                                        "isoSys": [
                                            {
                                                "str": null
                                            }
                                        ]
                                    }
                                }
                            ],
                            "requiredInitKeywordParams": [
                                {
                                    "polariList": []
                                }
                            ],
                            "initKeywordParamsWdefaults": [
                                {
                                    "dict": {}
                                }
                            ],
                            "sourceFiles": [
                                {
                                    "polariList": [
                                        [
                                            "CLASS-managedExecutable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "defineLocalSys"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "extension",
                                                                    "py"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "Path",
                                                                    "C:\\Users\\dusti\\Documents\\Polari-Framework\\polariNetworking"
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ]
                                    ]
                                }
                            ],
                            "polariSourceFile": [
                                "CLASS-managedExecutable-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "name",
                                                        "defineLocalSys"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "extension",
                                                        "py"
                                                    ]
                                                }
                                            ],
                                            [
                                                {
                                                    "tuple": [
                                                        "Path",
                                                        "C:\\Users\\dusti\\Documents\\Polari-Framework\\polariNetworking"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inheritedTyping": [
                                {
                                    "polariList": []
                                }
                            ],
                            "identifiers": [
                                {
                                    "polariList": [
                                        "id"
                                    ]
                                }
                            ],
                            "variableNameList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "polyTypedVars": [
                                {
                                    "polariList": [
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "id"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "isoSys"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "branch"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "isoSys"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "inTree"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "isoSys"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "manager"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "isoSys"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "name"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "isoSys"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "networkName"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "isoSys"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "IPaddress"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "isoSys"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "domainName"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "isoSys"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "mainMonitorPixelWidth"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "isoSys"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "mainMonitorPixelHeight"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "isoSys"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "virtualMonitorPixelWidth"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "isoSys"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "virtualMonitorPixelHeight"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "isoSys"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "NumMonitors"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "isoSys"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "numPhysicalCPUs"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "isoSys"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "numLogicalCPUs"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "isoSys"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "totalMainMemoryInBytes"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "isoSys"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "availableMainMemoryInBytes"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "isoSys"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "percentMainMemoryUsed"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "isoSys"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "usedMainMemoryInBytes"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "isoSys"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "freeMainMemoryInBytes"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "isoSys"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "swappedOutMemory"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "isoSys"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "swappedInMemory"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "isoSys"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "freeSwapMemoryInBytes"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "isoSys"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "usedSwapMemoryInBytes"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "isoSys"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "totalSwapMemoryInBytes"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "isoSys"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ],
                                        [
                                            "CLASS-polyTypedVariable-IDs",
                                            [
                                                {
                                                    "tuple": [
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "name",
                                                                    "SwapMemoryConsumptionVectorInBytesPerVarMilliSeconds"
                                                                ]
                                                            }
                                                        ],
                                                        [
                                                            {
                                                                "tuple": [
                                                                    "polyTypedObj",
                                                                    [
                                                                        "CLASS-polyTypedObject-IDs",
                                                                        [
                                                                            {
                                                                                "tuple": [
                                                                                    [
                                                                                        {
                                                                                            "tuple": [
                                                                                                "className",
                                                                                                "isoSys"
                                                                                            ]
                                                                                        }
                                                                                    ]
                                                                                ]
                                                                            }
                                                                        ]
                                                                    ]
                                                                ]
                                                            }
                                                        ]
                                                    ]
                                                }
                                            ]
                                        ]
                                    ]
                                }
                            ],
                            "baseAccessDictionary": [
                                {
                                    "dict": {}
                                }
                            ],
                            "basePermissionDictionary": [
                                {
                                    "dict": {}
                                }
                            ]
                        }
                    ]
                }
            ],
            "polyTypedVariable": [
                {
                    "class": "polyTypedVariable",
                    "varsLimited": [],
                    "data": [
                        {
                            "id": "BHBRp9aUM",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "id",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "str"
                        },
                        {
                            "id": "qZzBHUg3N",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "branch",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "NoneType"
                        },
                        {
                            "id": "gz10ie1111oX",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "inTree",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "NoneType"
                        },
                        {
                            "id": "m5RpicBBp",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "manager",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "object(managerObject)"
                        },
                        {
                            "id": "4lDxNLqvN",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "isTreeObject",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "NoneType"
                        },
                        {
                            "id": "CZPvqP10iv",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "isManagerObject",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "NoneType"
                        },
                        {
                            "id": "K5jpsLpBi",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "className",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "str"
                        },
                        {
                            "id": "oZ44C10U2U",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "kwRequiredParams",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "polariList)"
                        },
                        {
                            "id": "11hL0Igelh",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "kwDefaultParams",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "dict)"
                        },
                        {
                            "id": "1DbNdEQMZ",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "hasBaseSample",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "bool"
                        },
                        {
                            "id": "aSvVGsDVz",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "objectReferencesDict",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "dict)"
                        },
                        {
                            "id": "Hrb6s2rGP",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "requiredInitKeywordParams",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "polariList)"
                        },
                        {
                            "id": "XHxFM2xj1",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "initKeywordParamsWdefaults",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "dict)"
                        },
                        {
                            "id": "11hsSj6gWz",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "sourceFiles",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "polariList(managedExecutable))"
                        },
                        {
                            "id": "eYsGH711hd",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "polariSourceFile",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "object(managedExecutable)"
                        },
                        {
                            "id": "DIyIDVNNt",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "inheritedTyping",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "polariList)"
                        },
                        {
                            "id": "WGmbExfoC",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "identifiers",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "polariList(str))"
                        },
                        {
                            "id": "ej3dk07BZ",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "variableNameList",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "polariList)"
                        },
                        {
                            "id": "Yn2QXiGCn",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "polyTypedVars",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "polariList)"
                        },
                        {
                            "id": "oveq1a5rj",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "baseAccessDictionary",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "dict)"
                        },
                        {
                            "id": "J9xKW34GY",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "basePermissionDictionary",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "dict)"
                        },
                        {
                            "id": "RYatzqsqK",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "name",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "str"
                        },
                        {
                            "id": "XwQn11iRnj",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "eventsList",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "polariList)"
                        },
                        {
                            "id": "t11r2YQQlB",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "typingDicts",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "polariList(dict(str:str,str:str(?),str:int))"
                        },
                        {
                            "id": "L0nKqcBwO",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "pythonTypeDefault",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "str"
                        },
                        {
                            "id": "ZI5aK6CaE",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managerObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managerObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "complete",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "bool"
                        },
                        {
                            "id": "PVYZ6fVqc",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managerObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managerObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "manager",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "NoneType"
                        },
                        {
                            "id": "b6P11ULivA",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managerObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managerObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "hostSys",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "object(isoSys)"
                        },
                        {
                            "id": "puvZxZO10T",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managerObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managerObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "hasDB",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "bool"
                        },
                        {
                            "id": "Uv8UWd114P",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managerObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managerObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "objectTypingDict",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "dict(str:polyTypedObject)"
                        },
                        {
                            "id": "3kngS63pQ",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managerObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managerObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "objectTyping",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "polariList(polyTypedObject))"
                        },
                        {
                            "id": "qQ7ak8bZ6",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managerObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managerObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "objectTree",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "dict(tuple(str,tuple(?),managerObject):tuple(str,tuple(?),managerObject))"
                        },
                        {
                            "id": "MXOOJcmml",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managerObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managerObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "objectTables",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "dict(str:str))"
                        },
                        {
                            "id": "afXr6NkMH",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managerObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managerObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "managedFiles",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "polariList(managedExecutable))"
                        },
                        {
                            "id": "6LL10NFW1Y",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managerObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managerObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "id",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "NoneType"
                        },
                        {
                            "id": "KCNzr2R0r",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managerObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managerObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "db",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "NoneType"
                        },
                        {
                            "id": "szaKEMRKh",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managerObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managerObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "polServer",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "NoneType"
                        },
                        {
                            "id": "H10SjWxl11I",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managerObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managerObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "subManagers",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "polariList)"
                        },
                        {
                            "id": "h1b63irZn",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managerObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managerObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "idList",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "polariList(str))"
                        },
                        {
                            "id": "er0ANvn1j",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managerObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managerObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "branch",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "object(managerObject)"
                        },
                        {
                            "id": "s2mvdUKEQ",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managerObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managerObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "cloudIdList",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "polariList)"
                        },
                        {
                            "id": "GAX8Lg0D10",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managerObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managerObject"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "hasServer",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "bool"
                        },
                        {
                            "id": "VgcspqRsY",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedVariable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedVariable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "id",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "str"
                        },
                        {
                            "id": "1j4gEZBMt",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedVariable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedVariable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "branch",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "object(polyTypedObject)"
                        },
                        {
                            "id": "10ogXeBlAR",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedVariable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedVariable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "inTree",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "NoneType"
                        },
                        {
                            "id": "lSoFduhSU",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedVariable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedVariable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "manager",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "object(managerObject)"
                        },
                        {
                            "id": "2XysH8rjg",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedVariable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedVariable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "name",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "str"
                        },
                        {
                            "id": "qWc9fgpFq",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedVariable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedVariable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "eventsList",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "polariList)"
                        },
                        {
                            "id": "HHw11K4q5L",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedVariable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedVariable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "typingDicts",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "polariList(dict(str:str,str:str(?),str:int))"
                        },
                        {
                            "id": "rOER11vGYg",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedVariable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "polyTypedVariable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "pythonTypeDefault",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "str"
                        },
                        {
                            "id": "O10ksijo0z",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managedExecutable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managedExecutable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "id",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "str"
                        },
                        {
                            "id": "koDLBTW104",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managedExecutable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managedExecutable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "branch",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "object(polyTypedObject)"
                        },
                        {
                            "id": "105410mnzF11",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managedExecutable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managedExecutable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "inTree",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "NoneType"
                        },
                        {
                            "id": "Tcs10Bqua",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managedExecutable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managedExecutable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "manager",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "object(managerObject)"
                        },
                        {
                            "id": "fCj8l11nhg",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managedExecutable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managedExecutable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "name",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "str"
                        },
                        {
                            "id": "YfzHvMAgX",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managedExecutable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managedExecutable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "extension",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "str"
                        },
                        {
                            "id": "zddvmMi7R",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managedExecutable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managedExecutable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "version",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "NoneType"
                        },
                        {
                            "id": "OLVcpfiYp",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managedExecutable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managedExecutable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "Path",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "str"
                        },
                        {
                            "id": "PsKoYU60P",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managedExecutable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managedExecutable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "url",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "NoneType"
                        },
                        {
                            "id": "fBwC86wC7",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managedExecutable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managedExecutable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "active",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "bool"
                        },
                        {
                            "id": "Xz9r58Sin",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managedExecutable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managedExecutable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "isRemote",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "bool"
                        },
                        {
                            "id": "QgF11rSWQQ",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managedExecutable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managedExecutable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "complete",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "bool"
                        },
                        {
                            "id": "eFMH6FoIW",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managedExecutable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managedExecutable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "fileSize_bytes",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "NoneType"
                        },
                        {
                            "id": "C43ig0xJc",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managedExecutable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managedExecutable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "maxFileSize_bytes",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "NoneType"
                        },
                        {
                            "id": "9NTq11Y10u4",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managedExecutable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managedExecutable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "fileInstance",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "TextIOWrapper"
                        },
                        {
                            "id": "cyn10IVQkm",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managedExecutable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managedExecutable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "isOpen",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "bool"
                        },
                        {
                            "id": "ozhOecO4y",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managedExecutable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managedExecutable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "language",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "str"
                        },
                        {
                            "id": "CmmBQFVGg",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managedExecutable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managedExecutable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "codeStrings",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "polariList)"
                        },
                        {
                            "id": "Wdu6hgL710",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managedExecutable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managedExecutable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "AccountingLogicNodes",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "polariList)"
                        },
                        {
                            "id": "E59Kq7DpX",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managedExecutable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managedExecutable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "innerContext",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "polariList)"
                        },
                        {
                            "id": "811T4FC8ay",
                            "branch": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managedExecutable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "inTree": null,
                            "manager": [
                                "CLASS-managerObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "id",
                                                        null
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "polyTypedObj": [
                                "CLASS-polyTypedObject-IDs",
                                [
                                    {
                                        "tuple": [
                                            [
                                                {
                                                    "tuple": [
                                                        "className",
                                                        "managedExecutable"
                                                    ]
                                                }
                                            ]
                                        ]
                                    }
                                ]
                            ],
                            "name": "outerContext",
                            "eventsList": [
                                {
                                    "polariList": []
                                }
                            ],
                            "typingDicts": [
                                {
                                    "polariList": [
                                        [
                                            {
                                                "dict": {
                                                    "language": "language",
                                                    "manager": [
                                                        {
                                                            "str": null
                                                        }
                                                    ],
                                                    "dataType": "dataType",
                                                    "symbolCount": "symbolCount",
                                                    "occurences": "occurences"
                                                }
                                            }
                                        ]
                                    ]
                                }
                            ],
                            "pythonTypeDefault": "polariList)"
                        }
                    ]
                }
            ]
        }
    ]

    polariAccessNodeSubject = new BehaviorSubject<polariNode>(
        {
            "ip":"",
            "port":"",
            "crudeAPIs":[],
            "polariAPIs":[]
        }
    );
    connectionPendingSubject = new BehaviorSubject<boolean>(false);
    isConnectedSubject = new BehaviorSubject<boolean>(false);
    connectionFailureSubject = new BehaviorSubject<boolean>(false);
    //User Input values for changing the connection to a new IP/Port combination.
    userEntry_ipv4NumSubject = new BehaviorSubject<string>("");
    userEntry_portNumSubject = new BehaviorSubject<string>("");
    //
    navComponents = new BehaviorSubject<navComponent[]>([
        new navComponent("Home","","HomeComponent", {}, []),
        new navComponent("Polari Configuration","polari-config","PolariConfigComponent", {}, []),
        new navComponent("Template Class Test","template-class-test","templateClassTestComponent", {}, [])
    ]);
    //Actual Recieved Data From base of Polari Server
    connectionDataSubject = new BehaviorSubject<any>({});
    //Object instance of the Polari Server issuing this data itself.
    serverData = new BehaviorSubject<any>({});
    //Endpoints of any custom APIs on the server which give out grouped data which may contain dataSets of various class instances.
    serverAPIendpoints = new BehaviorSubject<any>([]);
    //Endpoints of the CRUDE (Create/Read/Update/Delete/Events) access for generalized access to a specific given class.
    serverCRUDEendpoints = new BehaviorSubject<any>([]);
    //The PolyTypingData which gives the different typing information for each of the classes used on the Server.
    polyTypedObjectsData = new BehaviorSubject<any>([]);
    //The PolyTypingData which gives the different typing information for each of the classes used on the Server.
    polyTypedVarsData = new BehaviorSubject<any>([]);
    //A list of CRUDE Services that are currently active, so that they can be re-used if a new component requiring them is created.
    crudeClassServices = []
    //A list of non-CRUDE API Services that are currently active, such that they are re-usable.
    apiServices = []
    //
    valueHolder : any;

    constructor(private http: HttpClient)
    {
        console.log("Starting PolariService")
        this.http = http
        console.log("starting fake initial subscription process for Polari Connection");
        let coreData = new dataSetCollection(this.fakeBaseAPI_json);
        this.connectionDataSubject.next(coreData);
        this.serverData.next(coreData.getClassInstanceList("polariServer"));
        console.log("serverData: ", this.serverData.value);
        this.serverAPIendpoints.next(coreData.getClassInstanceList("polariAPI"));
        this.serverCRUDEendpoints.next(coreData.getClassInstanceList("polariCRUDE"));
        this.polyTypedObjectsData.next(coreData.getClassInstanceList("polyTypedObject"));
        console.log("polyTypedObjectsData: ", this.polyTypedObjectsData.value);
        this.polyTypedVarsData.next(coreData.getClassInstanceList("polyTypedVars"));
    }
    
    //Sets the baseline connection with the Polari Server and retrieves all necessary APIs and Typing data for creating
    //or enabling any components that require data from the server.
    establishPolariConnection(){
        console.log("Starting Polari Connection in Polari Service with url: " + 'http://' + this.userEntry_ipv4NumSubject.value + ':' + this.userEntry_portNumSubject.value)
        this.connectionPendingSubject.next(true);
        console.log(this.connectionPendingSubject.value)
        this.http
        .get<any>('http://' + this.userEntry_ipv4NumSubject.value + ':' + this.userEntry_portNumSubject.value, this.backendRequestOptions)
        .subscribe({
            next: response =>{
                console.log("starting subscription process for Polari Connection");
                console.log(response);
                let coreData = new dataSetCollection(response);
                this.connectionDataSubject.next(coreData);
                this.serverData.next(coreData.getClassInstanceList("polariServer"));
                this.serverAPIendpoints.next(coreData.getClassInstanceList("polariAPI"));
                this.serverCRUDEendpoints.next(coreData.getClassInstanceList("polariCRUDE"));
                this.polyTypedObjectsData.next(coreData.getClassInstanceList("polyTypedObject"));
                this.polyTypedVarsData.next(coreData.getClassInstanceList("polyTypedVars"));
                /*
                try {
                    this.connectionDataSubject.next(response);
                    console.log("response data");
                    console.log(response);
                    //console.log("BaseElement");
                    //console.log(response.data);
                    let apisList : any[];
                    apisList = [];
                    let crudeAPIsList : any[];
                    crudeAPIsList = [];
                    let serverInstance = {};
                    let serverData : any[];
                    let objDataSetsArray : any[];
                    let keySet : any[];
                    serverData = response;
                    serverData.forEach( baseData =>{
                        keySet = Object.keys(baseData);
                        keySet.forEach( objectType => {
                            console.log("Iterating type: ", objectType)
                            objDataSetsArray = baseData[objectType]
                            objDataSetsArray.forEach(dataSet => {
                            console.log("Iterating dataSet");
                            console.log(dataSet);
                            if(dataSet["class"] == "polariAPI")
                            {
                                apisList.concat(dataSet["data"]);
                            }
                            else if(dataSet["class"] == "polariCRUDE")
                            {
                                crudeAPIsList.concat(dataSet["data"]);
                            }
                            else if(dataSet["class"] == "polariServer")
                            {
                                if(serverInstance == {})
                                {
                                    if(dataSet["data"].length == 1)
                                    {
                                        serverInstance = dataSet["data"][0];
                                    }
                                    else if(dataSet["data"].length == 0)
                                    {
                                        console.error("Recieved dataSet for PolariServer for base API, but the dataSet was empty.  Should contain data of Server being accessed.");
                                    }
                                    else
                                    {
                                        console.error("Found more than one polari server at base Polari API, should only be one - the data of the server being accessed.");
                                    }
                                }
                                else
                                {
                                    console.error("Found two server instances in polari server base data, should only be one at basis, connected servers should be retrieved through the CRUDE API.");
                                }
                            }
                            else
                            {
                                console.log("-- WARNING: Found data set that should not exist in a base API --");
                                console.log(dataSet);
                            }
                        });
                    });
                });
                    console.log("Connection DataSubject Set.")
                    console.log(this.connectionDataSubject.pipe());
                } catch (error) {
                    console.log("--Caught Error--");
                    console.log(error);
                }
                */
            },
            error: err =>{
                console.log("--Caught Error--");
                console.log(err);
                this.connectionPendingSubject.next(false);
                //Detect failure to make connection.
                this.connectionFailureSubject.next(true);
                setTimeout(() => {
                  this.connectionFailureSubject.next(false);
                }, 6000);
                  
            },
            complete: () => {

                console.log("Completed API ping on Polari Server.")
            }
        })
        //Get all PolyTypedObjects
        //this.getObjectTyping()
        //Get all polyTypedVars for the polyTypedObjects.
        //this.getTypingVars()
        this.connectionPendingSubject.next(false);
    }

    createMainObjectPages(){
        this.polyTypedObjectsData.subscribe(polyTypedObjs => {
            let navObjHolder : navComponent;
            //Create necessary navigation objects for each object type
            polyTypedObjs.array.forEach((polyTypedObj : classPolyTyping) => {
                //Create navigation object for the class.
                navObjHolder = new navComponent(
                    polyTypedObj.className, //title
                    "", //path
                    "", //comp
                    [], //queryParams
                    [] //authGroups
                    );
            });
        })
    }

    getObjectTyping()
    {
        this.http
        .get<any>('http://' + this.userEntry_ipv4NumSubject.value + ':' + this.userEntry_portNumSubject.value + '/polyTypedObjects', this.backendRequestOptions)
        .subscribe({
            next: response =>{
                console.log("getting typing data from server");
                console.log(response);
                let objectTypingData = new dataSetCollection(response);
                try {
                    this.polyTypedObjectsData.next(response.body["polyTypedObjects"]);
                    console.log("Loaded values onto polyTypedObjectsData")
                    console.log(response.body["polyTypedObjects"])
                }
                catch (error)
                {
                    console.log("--Caught Error--");
                    console.log(error);
                }
            },
            error: err =>{
                console.log("--Caught Error--");
                console.log(err);                  
            },
            complete: () => {
                console.log("Retrieved typing data, now retrieving polyTypingVars.");
                this.getTypingVars();
            }
        })
    }

    getTypingVars()
    {
        this.http
        .get<any>('http://' + this.userEntry_ipv4NumSubject.value + ':' + this.userEntry_portNumSubject.value + '/polyTypedVars', this.backendRequestOptions)
        .subscribe({
            next: response =>{
                console.log("getting variable typing data from server");
                console.log(response);
                try {
                    this.polyTypedVarsData.next(response.body["polyTypedVars"]);
                }
                catch (error)
                {
                    console.log("--Caught Error--");
                    console.log(error);
                }
            },
            error: err =>{
                console.log("--Caught Error--");
                console.log(err);                  
            },
            complete: () => {
                console.log("Retrieved typing data.")
            }
        })
    }

    /*
    //CREATE
    createOnPolariEndpoint(urlEndpoint){

    }

    //READ
    readFromPolariEndpoint(urlEndpoint){

    }

    //UPDATE
    updateOnPolariEndpoint(urlEndpoint){

    }

    //DELETE
    deleteOnPolariEndpoint(urlEndpoint){

    }

    //EVENT
    triggerEventOnPolariEndpoint(urlEndpoint){

    }
    */
}