import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, Type } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { polariNode } from '@models/polariNode';
import { PolariService } from '@services/polari-service';
import { BehaviorSubject, interval, Observable, Observer, Subscription } from 'rxjs';
import { MatTableModule } from '@angular/material/table' 
//Models
//import { templateClass } from '@models/templateClass';
import { dataSetCollection } from '@models/dataSetCollection';
import { dataSet } from '@models/dataSet';
import { classPolyTyping } from '@models/classPolyTyping';
import { objectReference } from '@models/objectReference';

@Component({
  selector: 'template-class-table',
  templateUrl: 'templateClassTable.html',
  styleUrls: ['./templateClassTable.css']
})
export class templateClassTableComponent {
  testBaseDataSet : dataSetCollection = new dataSetCollection(
    [
      {
          "polariAPI": [
              {
                  "class": "polariAPI",
                  "varsLimited": [],
                  "data": [
                      {
                          "id": "WxeTG5UjD",
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
                                                      "cS8bFotpL"
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
                          "id": "MezZHQb8k",
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
                                                      "cS8bFotpL"
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
                          "id": "c11BIWF9lR",
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
                                                      "cS8bFotpL"
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
                                                      "cS8bFotpL"
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
                          "id": "2MmBLdqxg",
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
                                                      "cS8bFotpL"
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
                                                      "cS8bFotpL"
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
                          "id": "0MBupj11CH",
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
                                                      "cS8bFotpL"
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
                                                      "cS8bFotpL"
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
                          "id": "ed1RM11ga5",
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
                                                      "cS8bFotpL"
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
                                                      "cS8bFotpL"
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
                          "id": "qI2cPQICf",
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
                                                      "cS8bFotpL"
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
                                                      "cS8bFotpL"
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
                          "id": "hG11oF25xN",
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
                                                      "cS8bFotpL"
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
                                                      "cS8bFotpL"
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
                          "id": "vYxGLuEKR",
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
                                                      "cS8bFotpL"
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
                                                      "cS8bFotpL"
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
                          "id": "mJ9uIJru1",
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
                                                      "cS8bFotpL"
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
                                                      "cS8bFotpL"
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
                          "id": "GZnll11cgg",
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
                                                      "cS8bFotpL"
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
                                                      "cS8bFotpL"
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
                          "id": "833VbRjdN",
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
                                                      "cS8bFotpL"
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
                                                      "cS8bFotpL"
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
                          "id": "KARntsw1o",
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
                                                      "cS8bFotpL"
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
                                                      "cS8bFotpL"
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
                          "id": "AJDHwuP1S",
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
                                                      "cS8bFotpL"
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
                                                      "cS8bFotpL"
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
                          "id": "f20hgvSLs",
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
                                                      "cS8bFotpL"
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
                                                      "cS8bFotpL"
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
                          "id": "0SnPCFWv5",
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
                                                      "cS8bFotpL"
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
                                                      "cS8bFotpL"
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
                          "id": "6ztIngctZ",
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
                                                      "cS8bFotpL"
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
                                                      "cS8bFotpL"
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
                          "id": "O8KLbQjeQ",
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
                                                      "cS8bFotpL"
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
                                                      "cS8bFotpL"
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
                          "id": "TJ5sdoeUD",
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
                                                      "cS8bFotpL"
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
                                                      "cS8bFotpL"
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
                          "id": "krnTCN210k",
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
                                                      "cS8bFotpL"
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
                                                      "cS8bFotpL"
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
                          "id": "ISui8X116x",
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
                                                      "cS8bFotpL"
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
                                                      "cS8bFotpL"
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
                          "id": "5y10uXq6WM",
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
                                                      "cS8bFotpL"
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
                                                      "cS8bFotpL"
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
                          "id": "cS8bFotpL",
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
                                                                  "jKqYpm39r"
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
                                                                  "FufamgdN0"
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
                                                                  "WxeTG5UjD"
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
                                                                  "MezZHQb8k"
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
                                                                  "c11BIWF9lR"
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
                                                                  "2MmBLdqxg"
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
                                                                  "0MBupj11CH"
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
                                                                  "ed1RM11ga5"
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
                                                                  "qI2cPQICf"
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
                                                                  "hG11oF25xN"
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
                                                                  "vYxGLuEKR"
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
                                                                  "mJ9uIJru1"
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
                                                                  "GZnll11cgg"
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
                                                                  "833VbRjdN"
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
                                                                  "KARntsw1o"
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
                                                                  "AJDHwuP1S"
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
                                                                  "f20hgvSLs"
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
                                                                  "0SnPCFWv5"
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
                                                                  "6ztIngctZ"
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
                                                                  "O8KLbQjeQ"
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
                                                                  "TJ5sdoeUD"
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
                                                                  "krnTCN210k"
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
                                                                  "ISui8X116x"
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
                                                                  "5y10uXq6WM"
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
          ]
      }
  ]
  );

  objectReference = objectReference
  instanceList? : any = []

  //Name of the class the data is being retrieved for.
  //@Input()
  className: string = "";

  //Filter to be applied on the data being requested.
  //@Input()
  filter?: object = {};

  //List of variable names to be shown.
  //@Input()
  shownVars?: string[] = [];

  constructor(private polService : PolariService)
  {
    this.instanceList = this.testBaseDataSet.getClassInstanceList(this.className);
    console.log(this.instanceList);
    console.log(this.shownVars);
  }

  getType(value)
  {
      console.log("getting type of value: ", value)
    let typeString : string = "undefined";
    if(Array.isArray(value))
    {
        console.log("is array");
        if(objectReference.isReferenceJson(value))
        {
            console.log("is objectReference");
            return "objectReference";
        }
        return "array";
    }
    else if(typeof value === 'string')
    {
        console.log("is string");
        return 'string';
    }
    else if(value == null)
    {
        return 'null';
    }
    return typeString;
  }

}