import { Component, HostListener, Input, Output, EventEmitter } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { NoCodeSolution } from '@models/noCode/NoCodeSolution';

@Component({
  selector: 'solution-editor',
  templateUrl: 'solution-editor.html',
  styleUrls: ['./solution-editor.css']
})
export class SolutionEditorComponent {
  @Input() solution: NoCodeSolution | undefined;
  @Output() saveChanges = new EventEmitter<NoCodeSolution>();

  solutionForm: FormGroup;

  constructor(private fb: FormBuilder) {
    this.solutionForm = this.fb.group({
      solutionName: ['', Validators.required],
      xBounds: [800, Validators.required],
      yBounds: [300, Validators.required],
      leftMostLocationX:[0, Validators.required],
      rightMostLocationX:[800, Validators.required],
      topMostLocationY:[0, Validators.required],
      bottomMostLocationY:[300, Validators.required],
      stateInstances:[[], Validators.required]
    });
  }

  ngOnChanges() {
    
  }

  onSubmit() {
    
  }

  calculateWidth(): number {
    return (this.solutionForm.get('rightMostLocationX')?.value || 0) - (this.solutionForm.get('leftMostLocationX')?.value || 0);
  }

  calculateHeight(): number {
    return (this.solutionForm.get('bottomMostLocationY')?.value || 0) - (this.solutionForm.get('topMostLocationY')?.value || 0);
  }

}
