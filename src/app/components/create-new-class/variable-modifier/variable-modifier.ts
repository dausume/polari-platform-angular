import { Component } from '@angular/core';
import { FormControl } from '@angular/forms';
import { variableConfigDef } from '@models/classEditor/variableDef';
import { ChangeDetectorRef } from '@angular/core';

@Component({
  standalone: false,
  selector: 'variable-modifier',
  templateUrl: 'variable-modifier.html',
  styleUrls: ['./variable-modifier.css']
})
export class VariableModifierComponent {

  variableConfigDefs : variableConfigDef[] = []
  typesAllowed = ["String", "Integer", "Decimal", "List", "Dictionary", "Reference","Unique Identifier - Alphanumeric", "Numeric Index"]
  selectedType = "Select Type"
  varName = ""
  typeControl = new FormControl();

  constructor(private changeDetectorRef: ChangeDetectorRef) {
    setInterval(() => {
      this.changeDetectorRef.detectChanges();
    }, 2000);
  }

  ngOnInit()
  {
    this.variableConfigDefs.push({varIndex:1, varName: 'id', varDisplayName: 'Identifier', varType:'Unique Identifier - Alphanumeric', soleIdentifier:true, jointIdentifier:false, isUnique:true, varNameControl: new FormControl(), varDisplayNameControl: new FormControl() });
    console.log("got past first push");
  }

  addVariableDef() 
  {
    //Creates indexes starting from 1, the index 1 varDef exists from the launch of the page.
    let newIndex : number = this.variableConfigDefs.length + 1;
    this.variableConfigDefs.push({varIndex:newIndex, varName: '', varDisplayName: '', varType:'', soleIdentifier:false, jointIdentifier:false, isUnique:false, varNameControl: new FormControl(), varDisplayNameControl: new FormControl() });
    //this.changeDetectorRef.detectChanges();
  }

  removeVariable(changedIndex: number) {
    this.variableConfigDefs.splice(changedIndex - 1, 1);
    this.variableConfigDefs.forEach((curVar: variableConfigDef) => {
      if(curVar.varIndex >= changedIndex) {
        curVar.varIndex = curVar.varIndex - 1;
      }
    });
}

  setType(changedIndex:number, newType:string)
  {
    let variableDefFound = this.variableConfigDefs.find(function(v){
        return v.varIndex === changedIndex;
    });
    if (variableDefFound) {
      variableDefFound.varType = newType;
    }
  }

}
