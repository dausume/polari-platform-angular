// Author: Dustin Etts
// polari-platform-angular/src/app/services/no-code-services/typescript-code-generator.service.ts
// Service for generating TypeScript code from no-code solutions (frontend runtime)

import { Injectable } from '@angular/core';
import { NoCodeState } from '@models/noCode/NoCodeState';
import { NoCodeSolution } from '@models/noCode/NoCodeSolution';
import { BoundClassDefinition } from '../../components/custom-no-code/state-tool-sidebar/state-tool-sidebar.component';
import { getBuildingBlockRegistry } from '@models/noCode/StateBuildingBlock';
import { getStateSpaceRegistry } from '@models/stateSpace/stateSpaceClassRegistry';

/**
 * TypeScript code templates for each block type.
 * Now sourced from the StateBuildingBlockRegistry for single-source-of-truth.
 */
export const TYPESCRIPT_TEMPLATES: { [key: string]: string } =
  getBuildingBlockRegistry().getTemplateMap('typescript_frontend');

@Injectable({
  providedIn: 'root'
})
export class TypescriptCodeGeneratorService {

  constructor() {}

  /**
   * Generate TypeScript code from a NoCodeSolution
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

    // Add imports if bound class has them (typescriptImports)
    if ((boundClass as any)?.typescriptImports) {
      (boundClass as any).typescriptImports.forEach((imp: string) => lines.push(imp));
      lines.push('');
    }

    // Function definition
    const params = this.getFunctionParams(solution, boundClass);
    const returnType = this.getReturnType(solution);
    lines.push(`async ${functionName}(${params}): Promise<${returnType}> {`);

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
      lines.push('    // TODO: implement');
    }

    lines.push('}');

    // Disconnected templates: states not reached by the graph traversal
    const disconnected = solution.stateInstances.filter(s =>
      s.stateName && !visited.has(s.stateName)
    );
    if (disconnected.length > 0) {
      lines.push('');
      lines.push('// ═══════════════════════════════════════════════════════');
      lines.push('// Disconnected Templates (not yet wired into the flow)');
      lines.push('// ═══════════════════════════════════════════════════════');
      const sortedDisconnected = [...disconnected].sort((a, b) =>
        (a.index ?? 0) - (b.index ?? 0)
      );
      for (const state of sortedDisconnected) {
        const code = this.generateCodeForState(state);
        if (code) {
          lines.push(`// [${state.stateName || 'Unknown'}]`);
          lines.push(`// ${code.split('\n').join('\n// ')}`);
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate code for a single state
   */
  generateCodeForState(state: NoCodeState): string {
    const className = state.boundObjectClass || state.stateClass || '';
    const template = TYPESCRIPT_TEMPLATES[className];

    if (!template) {
      return `// ${state.stateName || 'Unknown State'}`;
    }

    const values = state.boundObjectFieldValues || {};
    return this.substituteTemplate(template, values, state);
  }

  /**
   * Substitute values into a TypeScript template
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
      result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), this.formatValue(value));
    }

    // Handle special cases based on state type
    const className = state.boundObjectClass || state.stateClass || '';

    switch (className) {
      case 'InitialState':
      case 'DirectInvocation':
        return `// ${state.stateName || 'Start'}: Entry point`;

      case 'FormSubscription':
        const source = values['sourceName'] || 'state$';
        result = `this.${source}.pipe(\n    // operators\n).subscribe((value) => {\n    // Handle subscription\n});`;
        break;

      case 'LogicFlowEntry':
        const parent = values['parentSolutionName'] || 'parent';
        return `// Entry point (invoked by ${parent})`;

      case 'BackendStateChange':
        return `// Backend state change trigger (not applicable in TypeScript frontend)`;

      case 'ReturnStatement':
        return 'return;';

      case 'ReturnValue':
        const returnExpr = this.resolveReturnValueSource(values);
        return `return ${returnExpr};`;

      case 'StateChangeCommit':
        return `// State change commit (backend only)`;

      case 'EmitEvent':
        const evtName = values['eventName'] || '';
        const evtPayload = values['eventPayload'] || '{}';
        return `this.polariService.emitEvent("${evtName}", ${evtPayload});`;

      case 'ForLoop':
        result = result
          .replace('{iterator}', values['iteratorVariable'] || 'i')
          .replace(new RegExp('\\{iterator\\}', 'g'), values['iteratorVariable'] || 'i')
          .replace('{start}', values['startValue'] ?? '0')
          .replace('{end}', values['endValue'] ?? '10')
          .replace('{step}', values['stepValue'] ?? '1')
          .replace('{body}', '// Loop body');
        break;

      case 'WhileLoop':
        result = result
          .replace('{condition}', values['condition'] || 'true')
          .replace('{body}', '// Loop body');
        break;

      case 'ForEachLoop':
        result = result
          .replace('{item}', values['itemVariable'] || 'item')
          .replace('{collection}', values['collectionVariable'] || 'items')
          .replace('{body}', '// Loop body');
        break;

      case 'ConditionalChain':
        // Handled by generateFlowFromState graph traversal for proper nesting.
        // Fallback for disconnected templates or direct calls:
        result = result
          .replace('{condition}', this.buildConditionExpression(values))
          .replace('{if_body}', '// If branch')
          .replace('{else_body}', '// Else branch');
        break;

      case 'VariableAssignment':
        result = result
          .replace('{variable}', values['variableName'] || 'variable')
          .replace('{value}', this.formatValue(values['value']) || 'null');
        break;

      case 'FunctionCall':
        const resultVar = values['resultVariableName'] || '_result';
        const funcName = values['functionName'] || 'func';
        result = `const ${resultVar} = ${funcName}();`;
        break;

      case 'LogOutput':
        const message = values['messageTemplate'] || state.stateName || '';
        result = `console.log(\`${message}\`);`;
        break;

      case 'ReactiveTransform':
        result = result
          .replace('{operator}', values['operator'] || 'map')
          .replace('{expression}', values['expression'] || 'x => x');
        break;

      case 'AwaitBackendCall':
        result = result
          .replace('{resultVariable}', values['resultVariable'] || 'result')
          .replace('{targetSolutionName}', values['targetSolutionName'] || '');
        break;

      case 'EmitFrontendEvent':
        result = result
          .replace('{targetSolutionName}', values['targetSolutionName'] || '')
          .replace('{eventPayload}', values['eventPayload'] || '{}');
        break;
    }

    // Clean up remaining placeholders
    result = result.replace(/\{[^}]+\}/g, '...');

    return result;
  }

  /**
   * Format a value for TypeScript code
   */
  private formatValue(value: any): string {
    if (value === null || value === undefined) {
      return 'null';
    }
    if (typeof value === 'string') {
      return `'${value}'`;
    }
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
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
    const params: string[] = [];

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
            params.push(`${p.name}: ${this.mapPythonTypeToTs(p.type)}`);
          }
        });
      }
    }

    return params.join(', ');
  }

  /**
   * Get the return type from solution (scan for ReturnStatement)
   */
  private getReturnType(solution: NoCodeSolution): string {
    const returnState = solution.stateInstances.find(s =>
      s.boundObjectClass === 'ReturnStatement' || s.stateClass === 'ReturnStatement' ||
      s.boundObjectClass === 'ReturnValue' || s.stateClass === 'ReturnValue'
    );

    if (returnState?.boundObjectFieldValues?.['returnType']) {
      return this.mapPythonTypeToTs(returnState.boundObjectFieldValues['returnType']);
    }

    return 'void';
  }

  /**
   * Map Python types to TypeScript types
   */
  private mapPythonTypeToTs(pythonType: string): string {
    const typeMap: { [key: string]: string } = {
      'str': 'string',
      'int': 'number',
      'float': 'number',
      'bool': 'boolean',
      'list': 'any[]',
      'dict': 'Record<string, any>',
      'None': 'void',
      'Decimal': 'number',
      'datetime': 'Date',
      'Optional': 'any | null',
    };

    // Check for exact match first
    if (typeMap[pythonType]) {
      return typeMap[pythonType];
    }

    // Check for partial matches
    const lowerType = pythonType.toLowerCase();
    for (const [pyType, tsType] of Object.entries(typeMap)) {
      if (lowerType.includes(pyType.toLowerCase())) {
        return tsType;
      }
    }

    return pythonType; // Return as-is if unknown
  }

  /**
   * Partition states into connected (reachable from initial state) and disconnected.
   * Walks the connector graph starting from any state with specialStateType 'initial'.
   */
  private partitionByReachability(states: NoCodeState[]): { connected: NoCodeState[]; disconnected: NoCodeState[] } {
    const registry = getStateSpaceRegistry();
    const statesByName = new Map<string, NoCodeState>();
    for (const s of states) {
      if (s.stateName) statesByName.set(s.stateName, s);
    }

    // Find initial states
    const initialStates = states.filter(s => {
      const className = s.boundObjectClass || s.stateClass || '';
      const metadata = registry.getClass(className);
      return metadata?.specialStateType === 'initial';
    });

    // BFS from initial states
    const visited = new Set<string>();
    const queue: string[] = [];
    for (const init of initialStates) {
      if (init.stateName && !visited.has(init.stateName)) {
        visited.add(init.stateName);
        queue.push(init.stateName);
      }
    }

    while (queue.length > 0) {
      const name = queue.shift()!;
      const state = statesByName.get(name);
      if (!state?.slots) continue;

      for (const slot of state.slots) {
        if (slot.connectors) {
          for (const conn of slot.connectors) {
            const target = conn.targetStateName;
            if (target && !visited.has(target)) {
              visited.add(target);
              queue.push(target);
            }
          }
        }
      }
    }

    const connected: NoCodeState[] = [];
    const disconnected: NoCodeState[] = [];
    for (const s of states) {
      if (s.stateName && visited.has(s.stateName)) {
        connected.push(s);
      } else {
        disconnected.push(s);
      }
    }

    return { connected, disconnected };
  }

  // ==================== Graph-Aware Code Generation ====================

  /**
   * Generate code by traversing the connector graph from a starting state.
   * Follows connectors through output slots and handles branching (ConditionalChain)
   * by recursively generating code for each branch.
   *
   * @param startName - State name to begin traversal from
   * @param stateMap - Map of state names to NoCodeState objects
   * @param visited - Set of already-visited state names (mutated in place)
   * @param indentLevel - Current indentation level
   * @param stopAtState - If set, stop traversal when reaching this state (for branch boundaries)
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
      // Stop at branch boundary (convergence point)
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
        // Continue from convergence point (where branches rejoin), or stop if null
        currentName = branchResult.convergenceState;
        continue;
      }

      // Generate code for this state
      const code = this.generateCodeForState(state);
      if (code) {
        lines.push(this.indent(code, indentLevel));
      }

      // Terminal states end traversal
      if (className === 'ReturnStatement' || className === 'ReturnValue') {
        break;
      }

      // Follow output connector to next state
      currentName = this.getNextStateName(state);
    }

    return lines;
  }

  /**
   * Generate code for a ConditionalChain state with proper branching.
   * Detects convergence points where branches rejoin.
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

    // Find true and false branch targets from output slots
    const { trueTarget, falseTarget } = this.getConditionalBranchTargets(state);

    // Detect convergence: first state reachable from both branches
    const convergence = this.findConvergencePoint(trueTarget, falseTarget, stateMap);

    // Generate if block
    lines.push(`${indent}if (${condition}) {`);

    if (trueTarget) {
      const trueVisited = new Set(visited);
      const trueBranchLines = this.generateFlowFromState(
        trueTarget, stateMap, trueVisited, indentLevel + 1, convergence
      );
      if (trueBranchLines.length > 0) {
        lines.push(...trueBranchLines);
      } else {
        lines.push(this.indent('// If branch', indentLevel + 1));
      }
      // Merge branch visited states back into main set
      for (const v of trueVisited) visited.add(v);
    } else {
      lines.push(this.indent('// If branch', indentLevel + 1));
    }

    // Generate else block (only if there's a false branch target)
    if (falseTarget) {
      lines.push(`${indent}} else {`);

      const falseVisited = new Set(visited);
      const falseBranchLines = this.generateFlowFromState(
        falseTarget, stateMap, falseVisited, indentLevel + 1, convergence
      );
      if (falseBranchLines.length > 0) {
        lines.push(...falseBranchLines);
      } else {
        lines.push(this.indent('// Else branch', indentLevel + 1));
      }
      for (const v of falseVisited) visited.add(v);

      lines.push(`${indent}}`);
    } else {
      lines.push(`${indent}}`);
    }

    return { lines, convergenceState: convergence };
  }

  /**
   * Find the true and false branch targets from a ConditionalChain state's output slots.
   * Uses conditionExpression/conditionLabel to identify branches, with fallback to slot order.
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
        // Fallback: first output slot is true branch
        trueTarget = target;
      } else if (!falseTarget) {
        // Fallback: second output slot is false branch
        falseTarget = target;
      }
    }

    return { trueTarget, falseTarget };
  }

  /**
   * Find the convergence point where two branches rejoin.
   * Returns the first state reachable from both branch starting points via BFS.
   */
  private findConvergencePoint(
    trueTarget: string | null,
    falseTarget: string | null,
    stateMap: Map<string, NoCodeState>
  ): string | null {
    if (!trueTarget || !falseTarget) return null;

    // BFS order from true branch
    const trueOrder = this.bfsTraversalOrder(trueTarget, stateMap);
    // Set of states reachable from false branch
    const falseReachable = new Set(this.bfsTraversalOrder(falseTarget, stateMap));

    // First state in true's BFS order that's also reachable from false = convergence
    for (const name of trueOrder) {
      if (falseReachable.has(name)) {
        return name;
      }
    }

    return null; // Branches don't converge (e.g., both end with return)
  }

  /**
   * BFS traversal order from a starting state, following output connectors.
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
   * Skips conditional output slots to avoid following branch paths from non-conditional states.
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
      return 'true';
    }

    const CONDITION_OPS: { [key: string]: string } = {
      'equals': '===',
      'not_equals': '!==',
      'greater_than': '>',
      'less_than': '<',
      'greater_than_or_equal': '>=',
      'less_than_or_equal': '<=',
      'contains': '.includes',
      'not_contains': '!.includes'
    };

    const parts = links.map((link: any) => {
      const op = CONDITION_OPS[link.conditionType] || '===';
      const left = this.resolveValueSource(link.leftSource, link.fieldName);
      const right = this.resolveValueSource(link.rightSource, link.conditionValue);

      // Handle contains/not_contains with method call syntax
      if (link.conditionType === 'contains') {
        return `${left}.includes(${right})`;
      }
      if (link.conditionType === 'not_contains') {
        return `!${left}.includes(${right})`;
      }

      return `${left} ${op} ${right}`;
    });

    const logicalOp = (values['defaultLogicalOperator'] || 'AND').toLowerCase() === 'or' ? ' || ' : ' && ';
    return parts.join(logicalOp);
  }

  /**
   * Resolve a ValueSourceConfig to a TypeScript expression string.
   */
  private resolveValueSource(source: any, fallback: string): string {
    if (!source) return fallback || '...';

    switch (source.sourceType) {
      case 'from_object':
        // e.g., "this.sum_result" — convert self. to this. for TypeScript
        const path = source.objectFieldPath || fallback || '...';
        return path.replace(/^self\./, 'this.');
      case 'from_input':
        return source.inputVariableName || fallback || '...';
      case 'literal':
        return source.literalValue != null ? String(source.literalValue) : fallback || '...';
      default:
        return fallback || '...';
    }
  }

  /**
   * Resolve a ReturnValue state's value source to a TypeScript expression.
   * Supports both the legacy `returnValue` string and structured `returnValueSource`.
   */
  private resolveReturnValueSource(values: { [key: string]: any }): string {
    const source = values['returnValueSource'];
    if (source) {
      return this.resolveValueSource(source, values['returnValue'] || 'null');
    }
    if (values['returnValue']) {
      return values['returnValue'];
    }
    return 'null';
  }

  /**
   * Generate an empty function
   */
  private generateEmptyFunction(
    functionName: string,
    boundClass: BoundClassDefinition | null
  ): string {
    const lines: string[] = [];

    if ((boundClass as any)?.typescriptImports) {
      (boundClass as any).typescriptImports.forEach((imp: string) => lines.push(imp));
      lines.push('');
    }

    lines.push(`async ${functionName}(): Promise<void> {`);
    lines.push('    // TODO: implement');
    lines.push('}');

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
   * Generate a complete TypeScript class with the function as a method
   */
  generateClassWithMethod(
    boundClass: BoundClassDefinition,
    functionCode: string
  ): string {
    const lines: string[] = [];

    // Imports
    if ((boundClass as any).typescriptImports) {
      (boundClass as any).typescriptImports.forEach((imp: string) => lines.push(imp));
      lines.push('');
    }

    // Class definition
    lines.push(`export class ${boundClass.className} {`);

    // Fields
    if (boundClass.fields.length > 0) {
      boundClass.fields.forEach(field => {
        const tsType = this.mapPythonTypeToTs(field.type);
        const defaultVal = this.getDefaultForType(tsType, field.defaultValue);
        lines.push(`    ${field.name}: ${tsType} = ${defaultVal};`);
      });
      lines.push('');
    }

    // Constructor
    lines.push('    constructor() {}');
    lines.push('');

    // Add the generated function as a method
    const methodLines = functionCode.split('\n');
    methodLines.forEach(line => {
      lines.push('    ' + line);
    });

    lines.push('}');

    return lines.join('\n');
  }

  /**
   * Get TypeScript default value for a type
   */
  private getDefaultForType(tsType: string, defaultValue?: any): string {
    if (defaultValue !== undefined) {
      return this.formatValue(defaultValue);
    }

    if (tsType === 'string') return "''";
    if (tsType === 'number') return '0';
    if (tsType === 'boolean') return 'false';
    if (tsType.includes('[]')) return '[]';
    if (tsType.includes('Record')) return '{}';
    if (tsType === 'Date') return 'new Date()';
    return 'null';
  }
}
