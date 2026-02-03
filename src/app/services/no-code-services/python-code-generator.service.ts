// Author: Dustin Etts
// polari-platform-angular/src/app/services/no-code-services/python-code-generator.service.ts
// Service for generating Python code from no-code solutions

import { Injectable } from '@angular/core';
import { NoCodeState } from '@models/noCode/NoCodeState';
import { NoCodeSolution } from '@models/noCode/NoCodeSolution';
import { BoundClassDefinition } from '../../components/custom-no-code/state-tool-sidebar/state-tool-sidebar.component';

/**
 * Python code templates for each block type
 */
export const PYTHON_TEMPLATES: { [key: string]: string } = {
  // Control Flow
  'InitialState': '# Entry point - receive input parameters',
  'ReturnStatement': 'return {value}',
  'BreakStatement': 'break',
  'ContinueStatement': 'continue',

  // Conditionals
  'ConditionalChain': `if {condition}:
    {if_body}
else:
    {else_body}`,

  // Loops
  'ForLoop': `for {iterator} in range({start}, {end}, {step}):
    {body}`,
  'WhileLoop': `while {condition}:
    {body}`,
  'ForEachLoop': `for {item} in {collection}:
    {body}`,

  // Variables
  'VariableAssignment': '{variable} = {value}',

  // Functions
  'FunctionCall': '{result} = {function}({arguments})',

  // Debug
  'LogOutput': 'print({message})',
};

@Injectable({
  providedIn: 'root'
})
export class PythonCodeGeneratorService {

  constructor() {}

  /**
   * Generate Python code from a NoCodeSolution
   */
  generateFromSolution(
    solution: NoCodeSolution | null,
    boundClass: BoundClassDefinition | null,
    functionName: string
  ): string {
    if (!solution || !solution.stateInstances || solution.stateInstances.length === 0) {
      return this.generateEmptyFunction(functionName, boundClass);
    }

    const lines: string[] = [];

    // Add imports if bound class has them
    if (boundClass?.pythonImports) {
      boundClass.pythonImports.forEach(imp => lines.push(imp));
      lines.push('');
    }

    // Function definition
    const params = this.getFunctionParams(solution, boundClass);
    lines.push(`def ${functionName}(${params}):`);
    lines.push(`    """Generated from no-code solution: ${solution.solutionName}"""`);

    // Generate code from states (sorted by index)
    const sortedStates = [...solution.stateInstances].sort((a, b) =>
      (a.index ?? 0) - (b.index ?? 0)
    );

    let hasBody = false;
    for (const state of sortedStates) {
      const code = this.generateCodeForState(state);
      if (code) {
        lines.push(this.indent(code, 1));
        hasBody = true;
      }
    }

    // If no body generated, add pass
    if (!hasBody) {
      lines.push('    pass');
    }

    return lines.join('\n');
  }

  /**
   * Generate code for a single state
   */
  generateCodeForState(state: NoCodeState): string {
    const className = state.boundObjectClass || state.stateClass || '';
    const template = PYTHON_TEMPLATES[className];

    if (!template) {
      // Generate a comment for unknown block types
      return `# ${state.stateName || 'Unknown State'}`;
    }

    // Get field values for template substitution
    const values = state.boundObjectFieldValues || {};

    return this.substituteTemplate(template, values, state);
  }

  /**
   * Substitute values into a Python template
   */
  private substituteTemplate(
    template: string,
    values: { [key: string]: any },
    state: NoCodeState
  ): string {
    let result = template;

    // Substitute known values
    for (const [key, value] of Object.entries(values)) {
      const placeholder = `{${key}}`;
      result = result.replace(new RegExp(placeholder, 'g'), this.formatValue(value));
    }

    // Handle special cases based on state type
    const className = state.boundObjectClass || state.stateClass || '';

    switch (className) {
      case 'InitialState':
        return `# ${state.stateName || 'Start'}: Entry point`;

      case 'ReturnStatement':
        const returnValue = values['value'] || values['output'] || 'result';
        return `return ${returnValue}`;

      case 'ForLoop':
        result = result
          .replace('{iterator}', values['iteratorVariable'] || 'i')
          .replace('{start}', values['startValue'] ?? '0')
          .replace('{end}', values['endValue'] ?? '10')
          .replace('{step}', values['stepValue'] ?? '1')
          .replace('{body}', 'pass  # Loop body');
        break;

      case 'WhileLoop':
        result = result
          .replace('{condition}', values['condition'] || 'True')
          .replace('{body}', 'pass  # Loop body');
        break;

      case 'ForEachLoop':
        result = result
          .replace('{item}', values['itemVariable'] || 'item')
          .replace('{collection}', values['collectionVariable'] || 'items')
          .replace('{body}', 'pass  # Loop body');
        break;

      case 'ConditionalChain':
        result = result
          .replace('{condition}', values['condition'] || 'True')
          .replace('{if_body}', 'pass  # If branch')
          .replace('{else_body}', 'pass  # Else branch');
        break;

      case 'VariableAssignment':
        result = result
          .replace('{variable}', values['variableName'] || 'variable')
          .replace('{value}', this.formatValue(values['value']) || 'None');
        break;

      case 'FunctionCall':
        const resultVar = values['resultVariableName'] || '_';
        const funcName = values['functionName'] || 'func';
        result = `${resultVar} = ${funcName}()`;
        break;

      case 'LogOutput':
        const message = values['messageTemplate'] || state.stateName || '';
        result = `print("${message}")`;
        break;
    }

    // Clean up any remaining placeholders
    result = result.replace(/\{[^}]+\}/g, '...');

    return result;
  }

  /**
   * Format a value for Python code
   */
  private formatValue(value: any): string {
    if (value === null || value === undefined) {
      return 'None';
    }
    if (typeof value === 'string') {
      return `"${value}"`;
    }
    if (typeof value === 'boolean') {
      return value ? 'True' : 'False';
    }
    if (Array.isArray(value)) {
      return `[${value.map(v => this.formatValue(v)).join(', ')}]`;
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }

  /**
   * Get function parameters from solution
   */
  private getFunctionParams(
    solution: NoCodeSolution,
    boundClass: BoundClassDefinition | null
  ): string {
    const params: string[] = ['self'];

    // Find InitialState and get its input parameters
    const initialState = solution.stateInstances.find(s =>
      s.boundObjectClass === 'InitialState' ||
      s.stateName?.toLowerCase().includes('initial') ||
      s.stateName?.toLowerCase().includes('start')
    );

    if (initialState?.boundObjectFieldValues?.['inputParams']) {
      const inputParams = initialState.boundObjectFieldValues['inputParams'];
      if (Array.isArray(inputParams)) {
        inputParams.forEach(p => {
          if (p.name && p.type) {
            params.push(`${p.name}: ${p.type}`);
          }
        });
      }
    }

    return params.join(', ');
  }

  /**
   * Generate an empty function
   */
  private generateEmptyFunction(
    functionName: string,
    boundClass: BoundClassDefinition | null
  ): string {
    const lines: string[] = [];

    if (boundClass?.pythonImports) {
      boundClass.pythonImports.forEach(imp => lines.push(imp));
      lines.push('');
    }

    lines.push(`def ${functionName}(self):`);
    lines.push(`    """Auto-generated function"""`);
    lines.push('    pass');

    return lines.join('\n');
  }

  /**
   * Indent code by a number of levels
   */
  private indent(code: string, levels: number): string {
    const indent = '    '.repeat(levels);
    return code.split('\n').map(line => indent + line).join('\n');
  }

  /**
   * Generate a complete class with the function as a method
   */
  generateClassWithMethod(
    boundClass: BoundClassDefinition,
    functionCode: string
  ): string {
    const lines: string[] = [];

    // Imports
    if (boundClass.pythonImports) {
      boundClass.pythonImports.forEach(imp => lines.push(imp));
      lines.push('');
    }

    // Class definition
    lines.push(`class ${boundClass.className}:`);
    lines.push(`    """${boundClass.description}"""`);
    lines.push('');

    // __init__
    lines.push('    def __init__(self):');
    if (boundClass.fields.length > 0) {
      boundClass.fields.forEach(field => {
        const defaultVal = this.getDefaultForType(field.type, field.defaultValue);
        lines.push(`        self.${field.name} = ${defaultVal}`);
      });
    } else {
      lines.push('        pass');
    }
    lines.push('');

    // Add the generated function as a method
    const methodLines = functionCode.split('\n');
    methodLines.forEach(line => {
      lines.push('    ' + line);
    });

    return lines.join('\n');
  }

  /**
   * Get Python default value for a type
   */
  private getDefaultForType(type: string, defaultValue?: any): string {
    if (defaultValue !== undefined) {
      return this.formatValue(defaultValue);
    }

    const lowerType = type.toLowerCase();
    if (lowerType.includes('str')) return '""';
    if (lowerType.includes('int')) return '0';
    if (lowerType.includes('float')) return '0.0';
    if (lowerType.includes('bool')) return 'False';
    if (lowerType.includes('list')) return '[]';
    if (lowerType.includes('dict')) return '{}';
    return 'None';
  }
}
