// Author: Dustin Etts
// polari-platform-angular/src/app/services/no-code-services/python-code-generator.service.ts
// Service for generating Python code from no-code solutions

import { Injectable } from '@angular/core';
import { NoCodeState } from '@models/noCode/NoCodeState';
import { NoCodeSolution } from '@models/noCode/NoCodeSolution';
import { BoundClassDefinition } from '../../components/custom-no-code/state-tool-sidebar/state-tool-sidebar.component';
import { getBuildingBlockRegistry } from '@models/noCode/StateBuildingBlock';
import { getStateSpaceRegistry } from '@models/stateSpace/stateSpaceClassRegistry';

/**
 * Python code templates for each block type.
 * Now sourced from the StateBuildingBlockRegistry for single-source-of-truth.
 */
export const PYTHON_TEMPLATES: { [key: string]: string } =
  getBuildingBlockRegistry().getTemplateMap('python_backend');

@Injectable({
  providedIn: 'root'
})
export class PythonCodeGeneratorService {

  constructor() {}

  /**
   * Generate Python code from a NoCodeSolution
   * @param includeSteppingInstrumentation - When true, inserts step_checkpoint() calls between states
   */
  generateFromSolution(
    solution: NoCodeSolution | null,
    boundClass: BoundClassDefinition | null,
    functionName: string,
    includeSteppingInstrumentation: boolean = false
  ): string {
    if (!solution || !solution.stateInstances || solution.stateInstances.length === 0) {
      return this.generateEmptyFunction(functionName, boundClass);
    }

    const lines: string[] = [];

    // Add stepping import if instrumentation is enabled
    if (includeSteppingInstrumentation) {
      lines.push('from polariNoCode.stepping import step_checkpoint, StepConfig');
      lines.push('');
    }

    // Add imports if bound class has them
    if (boundClass?.pythonImports) {
      boundClass.pythonImports.forEach(imp => lines.push(imp));
      lines.push('');
    }

    // Function definition
    const params = this.getFunctionParams(solution, boundClass);
    lines.push(`def ${functionName}(${params}):`);
    lines.push(`    """Generated from no-code solution: ${solution.solutionName}"""`);

    // Add stepping initialization if instrumentation is enabled
    if (includeSteppingInstrumentation) {
      lines.push('    __config = StepConfig(mode="step", record_context=True)');
      lines.push('    __trace = []');
    }

    // Build state map for graph traversal
    const stateMap = new Map<string, NoCodeState>();
    for (const s of solution.stateInstances) {
      if (s.stateName) stateMap.set(s.stateName, s);
    }

    // Find initial state
    const registry = getStateSpaceRegistry();
    const initialState = solution.stateInstances.find(s => {
      const className = s.boundObjectClass || s.stateClass || '';
      const metadata = registry.getClass(className);
      return metadata?.specialStateType === 'initial';
    });

    // Generate code via graph traversal from initial state
    const visited = new Set<string>();
    let hasBody = false;
    this._steppingEnabled = includeSteppingInstrumentation;
    this._stepCounter = 0;

    if (initialState?.stateName) {
      const flowLines = this.generateFlowFromState(
        initialState.stateName, stateMap, visited, 1, null
      );
      if (flowLines.length > 0) {
        lines.push(...flowLines);
        hasBody = true;
      }
    }

    if (!hasBody) {
      lines.push('    pass');
    }

    this._steppingEnabled = false;
    return lines.join('\n');
  }

  // Stepping instrumentation state (used during code generation)
  private _steppingEnabled = false;
  private _stepCounter = 0;

  /**
   * Generate a step_checkpoint() call for the given state.
   * Returns the line as a string with proper indentation, or empty string if stepping is disabled.
   */
  private generateStepCall(stateName: string, stateClass: string, indent: string): string {
    if (!this._steppingEnabled) return '';
    const idx = this._stepCounter++;
    return `${indent}step_checkpoint(${idx}, '${stateName}', '${stateClass}', locals(), __config, __trace)`;
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
      case 'DirectInvocation':
        return `# ${state.stateName || 'Start'}: Entry point`;

      case 'FormSubscription':
        return `# ${state.stateName || 'Form Subscription'}: Triggered by form observable`;

      case 'LogicFlowEntry':
        const parentSolution = values['parentSolutionName'] || 'parent';
        return `# Entry point (invoked by ${parentSolution})`;

      case 'BackendStateChange':
        const model = values['modelName'] || 'Model';
        const field = values['fieldName'] || '*';
        const change = values['changeType'] || 'any';
        return `# Triggered by ${model}.${field} ${change}`;

      case 'ReturnStatement':
        return 'return';

      case 'ReturnValue':
        const returnExpr = this.resolveReturnValueSource(values);
        return `return ${returnExpr}`;

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
        // Handled by generateFlowFromState graph traversal for proper nesting.
        // Fallback for direct calls:
        result = result
          .replace('{condition}', this.buildConditionExpression(values))
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

    // Find the initial state (any type with specialStateType === 'initial')
    const registry = getStateSpaceRegistry();
    const initialState = solution.stateInstances.find(s => {
      const className = s.boundObjectClass || s.stateClass || '';
      const metadata = registry.getClass(className);
      return metadata?.specialStateType === 'initial';
    });

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

  // ==================== Graph-Aware Code Generation ====================

  /**
   * Generate code by traversing the connector graph from a starting state.
   * Follows connectors and handles branching (ConditionalChain) recursively.
   */
  private generateFlowFromState(
    startName: string,
    stateMap: Map<string, NoCodeState>,
    visited: Set<string>,
    indentLevel: number,
    stopAtState: string | null
  ): string[] {
    const lines: string[] = [];
    let currentName: string | null = startName;

    while (currentName && !visited.has(currentName)) {
      if (stopAtState && currentName === stopAtState) break;

      visited.add(currentName);
      const state = stateMap.get(currentName);
      if (!state) break;

      const className = state.boundObjectClass || state.stateClass || '';

      // ConditionalChain: handle branching with recursive descent
      if (className === 'ConditionalChain') {
        const branchResult = this.generateConditionalFlowCode(
          state, stateMap, visited, indentLevel
        );
        lines.push(...branchResult.lines);
        currentName = branchResult.convergenceState;
        continue;
      }

      // Generate code for this state
      const code = this.generateCodeForState(state);
      if (code) {
        lines.push(this.indent(code, indentLevel));
      }

      // Insert stepping checkpoint if instrumentation is enabled
      const stepCall = this.generateStepCall(state.stateName || currentName, className, '    '.repeat(indentLevel));
      if (stepCall) {
        lines.push(stepCall);
      }

      // Terminal states end traversal
      if (className === 'ReturnStatement' || className === 'ReturnValue') {
        break;
      }

      currentName = this.getNextStateName(state);
    }

    return lines;
  }

  /**
   * Generate Python code for a ConditionalChain with proper branching.
   */
  private generateConditionalFlowCode(
    state: NoCodeState,
    stateMap: Map<string, NoCodeState>,
    visited: Set<string>,
    indentLevel: number
  ): { lines: string[]; convergenceState: string | null } {
    const lines: string[] = [];
    const values = state.boundObjectFieldValues || {};
    const condition = this.buildConditionExpression(values);
    const indent = '    '.repeat(indentLevel);

    const { trueTarget, falseTarget } = this.getConditionalBranchTargets(state);
    const convergence = this.findConvergencePoint(trueTarget, falseTarget, stateMap);

    // Generate if block (Python syntax)
    lines.push(`${indent}if ${condition}:`);

    if (trueTarget) {
      const trueVisited = new Set(visited);
      const trueBranchLines = this.generateFlowFromState(
        trueTarget, stateMap, trueVisited, indentLevel + 1, convergence
      );
      if (trueBranchLines.length > 0) {
        lines.push(...trueBranchLines);
      } else {
        lines.push(this.indent('pass  # If branch', indentLevel + 1));
      }
      for (const v of trueVisited) visited.add(v);
    } else {
      lines.push(this.indent('pass  # If branch', indentLevel + 1));
    }

    // Generate else block (only if there's a false branch target)
    if (falseTarget) {
      lines.push(`${indent}else:`);

      const falseVisited = new Set(visited);
      const falseBranchLines = this.generateFlowFromState(
        falseTarget, stateMap, falseVisited, indentLevel + 1, convergence
      );
      if (falseBranchLines.length > 0) {
        lines.push(...falseBranchLines);
      } else {
        lines.push(this.indent('pass  # Else branch', indentLevel + 1));
      }
      for (const v of falseVisited) visited.add(v);
    }

    return { lines, convergenceState: convergence };
  }

  /**
   * Find the true and false branch targets from a ConditionalChain state's output slots.
   */
  private getConditionalBranchTargets(state: NoCodeState): { trueTarget: string | null; falseTarget: string | null } {
    let trueTarget: string | null = null;
    let falseTarget: string | null = null;

    if (!state.slots) return { trueTarget, falseTarget };

    const outputSlots = state.slots.filter(s => !s.isInput);

    for (const slot of outputSlots) {
      if (!slot.connectors || slot.connectors.length === 0) continue;

      const target = slot.connectors[0].targetStateName || null;
      const condExpr = ((slot as any).conditionExpression || '').toString().toLowerCase();
      const condLabel = ((slot as any).conditionLabel || '').toLowerCase();

      if (condExpr === 'true' || condLabel.includes('true')) {
        trueTarget = target;
      } else if (condExpr === 'false' || condLabel.includes('false')) {
        falseTarget = target;
      } else if (!trueTarget) {
        trueTarget = target;
      } else if (!falseTarget) {
        falseTarget = target;
      }
    }

    return { trueTarget, falseTarget };
  }

  /**
   * Find the convergence point where two branches rejoin.
   */
  private findConvergencePoint(
    trueTarget: string | null,
    falseTarget: string | null,
    stateMap: Map<string, NoCodeState>
  ): string | null {
    if (!trueTarget || !falseTarget) return null;

    const trueOrder = this.bfsTraversalOrder(trueTarget, stateMap);
    const falseReachable = new Set(this.bfsTraversalOrder(falseTarget, stateMap));

    for (const name of trueOrder) {
      if (falseReachable.has(name)) {
        return name;
      }
    }

    return null;
  }

  /**
   * BFS traversal order from a starting state.
   */
  private bfsTraversalOrder(startName: string, stateMap: Map<string, NoCodeState>): string[] {
    const order: string[] = [];
    const seen = new Set<string>();
    const queue: string[] = [startName];
    seen.add(startName);

    while (queue.length > 0) {
      const name = queue.shift()!;
      order.push(name);
      const state = stateMap.get(name);
      if (!state?.slots) continue;

      for (const slot of state.slots) {
        if (slot.isInput || !slot.connectors) continue;
        for (const conn of slot.connectors) {
          if (conn.targetStateName && !seen.has(conn.targetStateName)) {
            seen.add(conn.targetStateName);
            queue.push(conn.targetStateName);
          }
        }
      }
    }

    return order;
  }

  /**
   * Get the next state name by following the first output connector.
   */
  private getNextStateName(state: NoCodeState): string | null {
    if (!state.slots) return null;

    for (const slot of state.slots) {
      if (slot.isInput) continue;
      if (slot.connectors && slot.connectors.length > 0) {
        return slot.connectors[0].targetStateName || null;
      }
    }

    return null;
  }

  /**
   * Resolve a ReturnValue state's value source to a Python expression.
   * Supports both the legacy `returnValue` string and structured `returnValueSource`.
   */
  private resolveReturnValueSource(values: { [key: string]: any }): string {
    // Structured ValueSourceConfig
    const source = values['returnValueSource'];
    if (source) {
      return this.resolveValueSource(source, values['returnValue'] || 'None');
    }
    // Legacy plain string
    if (values['returnValue']) {
      return values['returnValue'];
    }
    return 'None';
  }

  /**
   * Build a condition expression string from boundObjectFieldValues.
   * Supports both the simple `condition` field and structured `links` array.
   */
  private buildConditionExpression(values: { [key: string]: any }): string {
    // Simple condition field takes priority
    if (values['condition']) {
      return values['condition'];
    }

    // Build from structured links
    const links = values['links'];
    if (!Array.isArray(links) || links.length === 0) {
      return 'True';
    }

    const CONDITION_OPS: { [key: string]: string } = {
      'equals': '==',
      'not_equals': '!=',
      'greater_than': '>',
      'less_than': '<',
      'greater_than_or_equal': '>=',
      'less_than_or_equal': '<=',
      'contains': 'in',
      'not_contains': 'not in'
    };

    const parts = links.map((link: any) => {
      const op = CONDITION_OPS[link.conditionType] || '==';
      const left = this.resolveValueSource(link.leftSource, link.fieldName);
      const right = this.resolveValueSource(link.rightSource, link.conditionValue);
      return `${left} ${op} ${right}`;
    });

    const logicalOp = (values['defaultLogicalOperator'] || 'AND').toLowerCase() === 'or' ? ' or ' : ' and ';
    return parts.join(logicalOp);
  }

  /**
   * Resolve a ValueSourceConfig to a Python expression string.
   */
  private resolveValueSource(source: any, fallback: string): string {
    if (!source) return fallback || '...';

    switch (source.sourceType) {
      case 'from_object':
        // e.g., "self.sum_result"
        return source.objectFieldPath || fallback || '...';
      case 'from_input':
        // e.g., variable name from input slot
        return source.inputVariableName || fallback || '...';
      case 'literal':
        return source.literalValue != null ? String(source.literalValue) : fallback || '...';
      default:
        return fallback || '...';
    }
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
