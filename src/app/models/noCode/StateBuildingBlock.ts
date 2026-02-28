// Author: Dustin Etts
// polari-platform-angular/src/app/models/noCode/StateBuildingBlock.ts
//
// StateBuildingBlock: Unified object tying together each block's identity,
// code templates (Python/TypeScript), and UI config. Replaces hardcoded
// inline template maps in code generator services.

import { TargetRuntime } from './mock-NCS-data';
import { SlotDefinition, FieldDisplay } from './StateDefinition';
import { StateSpaceCategory } from '../stateSpace/stateSpaceClassRegistry';

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Code template for a specific runtime.
 */
export interface CodeTemplate {
  runtime: TargetRuntime;
  template: string;
  requiredImports?: string[];
}

/**
 * Defines a building block with code templates for the no-code system.
 * Each StateBuildingBlock maps 1:1 with a StateSpaceClassMetadata.className.
 */
export interface StateBuildingBlock {
  className: string;
  displayName: string;
  description: string;
  category: StateSpaceCategory;
  supportedRuntimes: TargetRuntime[];
  codeTemplates: CodeTemplate[];
  defaultInputSlots: SlotDefinition[];
  defaultOutputSlots: SlotDefinition[];
  displayFields: FieldDisplay[];
  icon?: string;
  color?: string;
  isBuiltIn: boolean;
}

// ============================================================================
// Registry
// ============================================================================

/**
 * Singleton registry for all building blocks.
 * Mirrors the StateSpaceClassRegistry pattern.
 */
export class StateBuildingBlockRegistry {
  private static instance: StateBuildingBlockRegistry;
  private blocks: Map<string, StateBuildingBlock> = new Map();

  private constructor() {
    this.registerBuiltInBlocks();
  }

  static getInstance(): StateBuildingBlockRegistry {
    if (!StateBuildingBlockRegistry.instance) {
      StateBuildingBlockRegistry.instance = new StateBuildingBlockRegistry();
    }
    return StateBuildingBlockRegistry.instance;
  }

  /**
   * Register a building block
   */
  register(block: StateBuildingBlock): void {
    this.blocks.set(block.className, block);
  }

  /**
   * Unregister a building block
   */
  unregister(className: string): boolean {
    return this.blocks.delete(className);
  }

  /**
   * Get a building block by class name
   */
  get(className: string): StateBuildingBlock | undefined {
    return this.blocks.get(className);
  }

  /**
   * Get all registered building blocks
   */
  getAll(): StateBuildingBlock[] {
    return Array.from(this.blocks.values());
  }

  /**
   * Get building blocks available for a specific runtime
   */
  getForRuntime(runtime: TargetRuntime): StateBuildingBlock[] {
    return this.getAll().filter(b =>
      b.supportedRuntimes.length === 0 || b.supportedRuntimes.includes(runtime)
    );
  }

  /**
   * Get building blocks grouped by category
   */
  getByCategory(): Map<StateSpaceCategory, StateBuildingBlock[]> {
    const grouped = new Map<StateSpaceCategory, StateBuildingBlock[]>();
    for (const block of this.blocks.values()) {
      const existing = grouped.get(block.category) || [];
      existing.push(block);
      grouped.set(block.category, existing);
    }
    return grouped;
  }

  /**
   * Get the code template string for a className and runtime
   */
  getTemplate(className: string, runtime: TargetRuntime): string | undefined {
    const block = this.blocks.get(className);
    if (!block) return undefined;
    const tmpl = block.codeTemplates.find(t => t.runtime === runtime);
    return tmpl?.template;
  }

  /**
   * Get a { [className]: template } map for a given runtime.
   * Backward-compatible replacement for PYTHON_TEMPLATES / TYPESCRIPT_TEMPLATES.
   */
  getTemplateMap(runtime: TargetRuntime): { [className: string]: string } {
    const map: { [className: string]: string } = {};
    for (const block of this.blocks.values()) {
      const tmpl = block.codeTemplates.find(t => t.runtime === runtime);
      if (tmpl) {
        map[block.className] = tmpl.template;
      }
    }
    return map;
  }

  /**
   * Register all 19 built-in block types
   */
  private registerBuiltInBlocks(): void {
    // === Typed Initial States ===
    this.register({
      className: 'DirectInvocation',
      displayName: 'Direct Invocation',
      description: 'Generic function-call entry point - defines input parameters',
      category: 'Control Flow',
      supportedRuntimes: [],
      codeTemplates: [
        { runtime: 'python_backend', template: '# Entry point - receive input parameters' },
        { runtime: 'typescript_frontend', template: '// Entry point - receive input parameters' }
      ],
      defaultInputSlots: [],
      defaultOutputSlots: [
        { name: 'output', displayName: 'Output', slotType: 'output', dataType: 'any', isRequired: false }
      ],
      displayFields: [],
      icon: 'play_circle',
      color: '#4CAF50',
      isBuiltIn: true
    });

    this.register({
      className: 'FormSubscription',
      displayName: 'Form Subscription',
      description: 'Triggered by a form/page observable - reactive frontend entry point',
      category: 'Control Flow',
      supportedRuntimes: ['typescript_frontend'],
      codeTemplates: [
        { runtime: 'typescript_frontend', template: 'this.{sourceName}.pipe(\n    // operators\n).subscribe((value) => {\n    // Handle subscription\n});' }
      ],
      defaultInputSlots: [],
      defaultOutputSlots: [
        { name: 'subscription', displayName: 'Subscription', slotType: 'output', dataType: 'Subscription', isRequired: false }
      ],
      displayFields: [],
      icon: 'sensors',
      color: '#E91E63',
      isBuiltIn: true
    });

    this.register({
      className: 'LogicFlowEntry',
      displayName: 'Logic Flow Entry',
      description: 'Invoked by a parent solution - child solution entry point',
      category: 'Control Flow',
      supportedRuntimes: [],
      codeTemplates: [
        { runtime: 'python_backend', template: '# Entry point (invoked by {parentSolutionName})' },
        { runtime: 'typescript_frontend', template: '// Entry point (invoked by {parentSolutionName})' }
      ],
      defaultInputSlots: [],
      defaultOutputSlots: [
        { name: 'output', displayName: 'Output', slotType: 'output', dataType: 'any', isRequired: false }
      ],
      displayFields: [],
      icon: 'account_tree',
      color: '#673AB7',
      isBuiltIn: true
    });

    this.register({
      className: 'BackendStateChange',
      displayName: 'Backend State Change',
      description: 'Triggered by database state changes being committed',
      category: 'Control Flow',
      supportedRuntimes: ['python_backend'],
      codeTemplates: [
        { runtime: 'python_backend', template: '# Triggered by {modelName}.{fieldName} {changeType}' }
      ],
      defaultInputSlots: [],
      defaultOutputSlots: [
        { name: 'output', displayName: 'Change Context', slotType: 'output', dataType: 'object', isRequired: false }
      ],
      displayFields: [],
      icon: 'storage',
      color: '#FF9800',
      isBuiltIn: true
    });

    // Legacy alias for backward compatibility
    this.register({
      className: 'InitialState',
      displayName: 'Initial State',
      description: 'Legacy initial state - maps to DirectInvocation',
      category: 'Control Flow',
      supportedRuntimes: [],
      codeTemplates: [
        { runtime: 'python_backend', template: '# Entry point - receive input parameters' },
        { runtime: 'typescript_frontend', template: '// Entry point - receive input parameters' }
      ],
      defaultInputSlots: [],
      defaultOutputSlots: [
        { name: 'output', displayName: 'Output', slotType: 'output', dataType: 'any', isRequired: false }
      ],
      displayFields: [],
      icon: 'play_circle',
      color: '#4CAF50',
      isBuiltIn: true
    });

    // === Control Flow ===

    this.register({
      className: 'ReturnStatement',
      displayName: 'Return',
      description: 'Return a value and exit the solution flow',
      category: 'Control Flow',
      supportedRuntimes: [],
      codeTemplates: [
        { runtime: 'python_backend', template: 'return {value}' },
        { runtime: 'typescript_frontend', template: 'return {value};' }
      ],
      defaultInputSlots: [
        { name: 'value', displayName: 'Value', slotType: 'input', dataType: 'any', isRequired: true }
      ],
      defaultOutputSlots: [],
      displayFields: [],
      icon: 'exit_to_app',
      color: '#F44336',
      isBuiltIn: true
    });

    this.register({
      className: 'BreakStatement',
      displayName: 'Break',
      description: 'Break out of current loop',
      category: 'Control Flow',
      supportedRuntimes: [],
      codeTemplates: [
        { runtime: 'python_backend', template: 'break' },
        { runtime: 'typescript_frontend', template: 'break;' }
      ],
      defaultInputSlots: [
        { name: 'input', displayName: 'Input', slotType: 'input', dataType: 'any', isRequired: true }
      ],
      defaultOutputSlots: [],
      displayFields: [],
      icon: 'stop',
      color: '#F44336',
      isBuiltIn: true
    });

    this.register({
      className: 'ContinueStatement',
      displayName: 'Continue',
      description: 'Skip to next loop iteration',
      category: 'Control Flow',
      supportedRuntimes: [],
      codeTemplates: [
        { runtime: 'python_backend', template: 'continue' },
        { runtime: 'typescript_frontend', template: 'continue;' }
      ],
      defaultInputSlots: [
        { name: 'input', displayName: 'Input', slotType: 'input', dataType: 'any', isRequired: true }
      ],
      defaultOutputSlots: [],
      displayFields: [],
      icon: 'skip_next',
      color: '#FF9800',
      isBuiltIn: true
    });

    // === Conditionals ===
    this.register({
      className: 'ConditionalChain',
      displayName: 'Conditional Chain',
      description: 'A chainable conditional evaluation system with AND/OR/NOT logic',
      category: 'Conditionals',
      supportedRuntimes: [],
      codeTemplates: [
        { runtime: 'python_backend', template: 'if {condition}:\n    {if_body}\nelse:\n    {else_body}' },
        { runtime: 'typescript_frontend', template: 'if ({condition}) {\n    {if_body}\n} else {\n    {else_body}\n}' }
      ],
      defaultInputSlots: [
        { name: 'input', displayName: 'Input', slotType: 'input', dataType: 'any', isRequired: true }
      ],
      defaultOutputSlots: [
        { name: 'true', displayName: 'True', slotType: 'output', dataType: 'boolean', isRequired: false },
        { name: 'false', displayName: 'False', slotType: 'output', dataType: 'boolean', isRequired: false }
      ],
      displayFields: [],
      icon: 'device_hub',
      color: '#4CAF50',
      isBuiltIn: true
    });

    // === Loops ===
    this.register({
      className: 'ForLoop',
      displayName: 'For Loop',
      description: 'Traditional indexed for loop (i = start; i < end; i += step)',
      category: 'Loops',
      supportedRuntimes: [],
      codeTemplates: [
        { runtime: 'python_backend', template: 'for {iterator} in range({start}, {end}, {step}):\n    {body}' },
        { runtime: 'typescript_frontend', template: 'for (let {iterator} = {start}; {iterator} < {end}; {iterator} += {step}) {\n    {body}\n}' }
      ],
      defaultInputSlots: [
        { name: 'input', displayName: 'Input', slotType: 'input', dataType: 'any', isRequired: true }
      ],
      defaultOutputSlots: [
        { name: 'output', displayName: 'Output', slotType: 'output', dataType: 'any', isRequired: false }
      ],
      displayFields: [],
      icon: 'loop',
      color: '#2196F3',
      isBuiltIn: true
    });

    this.register({
      className: 'WhileLoop',
      displayName: 'While Loop',
      description: 'Condition-based loop that runs while condition is true',
      category: 'Loops',
      supportedRuntimes: [],
      codeTemplates: [
        { runtime: 'python_backend', template: 'while {condition}:\n    {body}' },
        { runtime: 'typescript_frontend', template: 'while ({condition}) {\n    {body}\n}' }
      ],
      defaultInputSlots: [
        { name: 'input', displayName: 'Input', slotType: 'input', dataType: 'any', isRequired: true }
      ],
      defaultOutputSlots: [
        { name: 'output', displayName: 'Output', slotType: 'output', dataType: 'any', isRequired: false }
      ],
      displayFields: [],
      icon: 'refresh',
      color: '#2196F3',
      isBuiltIn: true
    });

    this.register({
      className: 'ForEachLoop',
      displayName: 'For Each Loop',
      description: 'Iterate over each item in a collection',
      category: 'Loops',
      supportedRuntimes: [],
      codeTemplates: [
        { runtime: 'python_backend', template: 'for {item} in {collection}:\n    {body}' },
        { runtime: 'typescript_frontend', template: 'for (const {item} of {collection}) {\n    {body}\n}' }
      ],
      defaultInputSlots: [
        { name: 'collection', displayName: 'Collection', slotType: 'input', dataType: 'array', isRequired: true }
      ],
      defaultOutputSlots: [
        { name: 'output', displayName: 'Output', slotType: 'output', dataType: 'any', isRequired: false }
      ],
      displayFields: [],
      icon: 'format_list_numbered',
      color: '#2196F3',
      isBuiltIn: true
    });

    // === Data Operations ===
    this.register({
      className: 'VariableAssignment',
      displayName: 'Variable Assignment',
      description: 'Assign a value to a variable',
      category: 'Data',
      supportedRuntimes: [],
      codeTemplates: [
        { runtime: 'python_backend', template: '{variable} = {value}' },
        { runtime: 'typescript_frontend', template: 'const {variable} = {value};' }
      ],
      defaultInputSlots: [
        { name: 'input', displayName: 'Input', slotType: 'input', dataType: 'any', isRequired: true }
      ],
      defaultOutputSlots: [
        { name: 'output', displayName: 'Output', slotType: 'output', dataType: 'any', isRequired: false }
      ],
      displayFields: [],
      icon: 'edit',
      color: '#9C27B0',
      isBuiltIn: true
    });

    this.register({
      className: 'FunctionCall',
      displayName: 'Function Call',
      description: 'Call a function and optionally store the result',
      category: 'Data',
      supportedRuntimes: [],
      codeTemplates: [
        { runtime: 'python_backend', template: '{result} = {function}({arguments})' },
        { runtime: 'typescript_frontend', template: 'const {result} = {function}({arguments});' }
      ],
      defaultInputSlots: [
        { name: 'input', displayName: 'Input', slotType: 'input', dataType: 'any', isRequired: true }
      ],
      defaultOutputSlots: [
        { name: 'output', displayName: 'Output', slotType: 'output', dataType: 'any', isRequired: false }
      ],
      displayFields: [],
      icon: 'functions',
      color: '#9C27B0',
      isBuiltIn: true
    });

    this.register({
      className: 'FilterList',
      displayName: 'Filter List',
      description: 'Filter a list of objects based on type or condition',
      category: 'Data',
      supportedRuntimes: [],
      codeTemplates: [
        { runtime: 'python_backend', template: '{result} = [x for x in {collection} if {condition}]' },
        { runtime: 'typescript_frontend', template: 'const {result} = {collection}.filter(x => {condition});' }
      ],
      defaultInputSlots: [
        { name: 'collection', displayName: 'Input List', slotType: 'input', dataType: 'array', isRequired: true }
      ],
      defaultOutputSlots: [
        { name: 'result', displayName: 'Filtered List', slotType: 'output', dataType: 'array', isRequired: false }
      ],
      displayFields: [],
      icon: 'filter_list',
      color: '#00BCD4',
      isBuiltIn: true
    });

    this.register({
      className: 'MapList',
      displayName: 'Map List',
      description: 'Transform each item in a list',
      category: 'Data',
      supportedRuntimes: [],
      codeTemplates: [
        { runtime: 'python_backend', template: '{result} = [{expression} for x in {collection}]' },
        { runtime: 'typescript_frontend', template: 'const {result} = {collection}.map(x => {expression});' }
      ],
      defaultInputSlots: [
        { name: 'collection', displayName: 'Input List', slotType: 'input', dataType: 'array', isRequired: true }
      ],
      defaultOutputSlots: [
        { name: 'result', displayName: 'Mapped List', slotType: 'output', dataType: 'array', isRequired: false }
      ],
      displayFields: [],
      icon: 'transform',
      color: '#00BCD4',
      isBuiltIn: true
    });

    this.register({
      className: 'ReduceList',
      displayName: 'Reduce List',
      description: 'Reduce a list to a single value',
      category: 'Data',
      supportedRuntimes: [],
      codeTemplates: [
        { runtime: 'python_backend', template: '{result} = functools.reduce({function}, {collection}, {initial})', requiredImports: ['import functools'] },
        { runtime: 'typescript_frontend', template: 'const {result} = {collection}.reduce({function}, {initial});' }
      ],
      defaultInputSlots: [
        { name: 'collection', displayName: 'Input List', slotType: 'input', dataType: 'array', isRequired: true }
      ],
      defaultOutputSlots: [
        { name: 'result', displayName: 'Reduced Value', slotType: 'output', dataType: 'any', isRequired: false }
      ],
      displayFields: [],
      icon: 'compress',
      color: '#00BCD4',
      isBuiltIn: true
    });

    this.register({
      className: 'MathOperation',
      displayName: 'Math Operation',
      description: 'Perform basic math operations: add, subtract, multiply, divide, modulo',
      category: 'Data',
      supportedRuntimes: [],
      codeTemplates: [
        { runtime: 'python_backend', template: '{result} = {left} {operator} {right}' },
        { runtime: 'typescript_frontend', template: 'const {result} = {left} {operator} {right};' }
      ],
      defaultInputSlots: [
        { name: 'input', displayName: 'Input', slotType: 'input', dataType: 'any', isRequired: true }
      ],
      defaultOutputSlots: [
        { name: 'result', displayName: 'Result', slotType: 'output', dataType: 'number', isRequired: false }
      ],
      displayFields: [],
      icon: 'calculate',
      color: '#2196F3',
      isBuiltIn: true
    });

    // === Debug ===
    this.register({
      className: 'LogOutput',
      displayName: 'Log Output',
      description: 'Output debug/log messages',
      category: 'Debug',
      supportedRuntimes: [],
      codeTemplates: [
        { runtime: 'python_backend', template: 'print({message})' },
        { runtime: 'typescript_frontend', template: 'console.log({message});' }
      ],
      defaultInputSlots: [
        { name: 'input', displayName: 'Input', slotType: 'input', dataType: 'any', isRequired: true }
      ],
      defaultOutputSlots: [
        { name: 'output', displayName: 'Output', slotType: 'output', dataType: 'any', isRequired: false }
      ],
      displayFields: [],
      icon: 'bug_report',
      color: '#607D8B',
      isBuiltIn: true
    });

    // === Frontend ===
    // Note: StateSubscription removed - absorbed into FormSubscription initial state type

    this.register({
      className: 'ReactiveTransform',
      displayName: 'Reactive Transform',
      description: 'Apply RxJS pipe operators (map, filter, switchMap, etc.)',
      category: 'Frontend',
      supportedRuntimes: ['typescript_frontend'],
      codeTemplates: [
        { runtime: 'typescript_frontend', template: 'source$.pipe(\n    {operator}({expression})\n)' }
      ],
      defaultInputSlots: [
        { name: 'source$', displayName: 'Source Stream', slotType: 'input', dataType: 'Observable', isRequired: true }
      ],
      defaultOutputSlots: [
        { name: 'output$', displayName: 'Transformed Stream', slotType: 'output', dataType: 'Observable', isRequired: false }
      ],
      displayFields: [],
      icon: 'transform',
      color: '#E91E63',
      isBuiltIn: true
    });

    // === Cross-Runtime ===
    this.register({
      className: 'AwaitBackendCall',
      displayName: 'Await Backend Call',
      description: 'Call a backend Python solution and await response',
      category: 'Cross-Runtime',
      supportedRuntimes: ['typescript_frontend'],
      codeTemplates: [
        { runtime: 'typescript_frontend', template: "const {resultVariable} = await this.polariService.executeSolution('{targetSolutionName}', params);" }
      ],
      defaultInputSlots: [
        { name: 'params', displayName: 'Parameters', slotType: 'input', dataType: 'object', isRequired: false }
      ],
      defaultOutputSlots: [
        { name: 'result', displayName: 'Backend Response', slotType: 'output', dataType: 'any', isRequired: false }
      ],
      displayFields: [],
      icon: 'cloud_download',
      color: '#FF5722',
      isBuiltIn: true
    });

    this.register({
      className: 'EmitFrontendEvent',
      displayName: 'Emit Frontend Event',
      description: 'Emit an event from backend to trigger a frontend solution',
      category: 'Cross-Runtime',
      supportedRuntimes: ['python_backend'],
      codeTemplates: [
        { runtime: 'python_backend', template: "self.polari_event_bus.emit('{targetSolutionName}', {eventPayload})" }
      ],
      defaultInputSlots: [
        { name: 'eventData', displayName: 'Event Data', slotType: 'input', dataType: 'object', isRequired: false }
      ],
      defaultOutputSlots: [],
      displayFields: [],
      icon: 'cloud_upload',
      color: '#FF5722',
      isBuiltIn: true
    });
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Singleton accessor for the building block registry.
 */
export function getBuildingBlockRegistry(): StateBuildingBlockRegistry {
  return StateBuildingBlockRegistry.getInstance();
}

/**
 * Produce a StateDefinition-compatible object from a StateBuildingBlock.
 */
export function createStateDefinitionFromBlock(block: StateBuildingBlock): {
  name: string;
  displayName: string;
  sourceClassName: string;
  description: string;
  category: string;
  icon: string;
  color: string;
  inputSlots: SlotDefinition[];
  outputSlots: SlotDefinition[];
  displayFields: FieldDisplay[];
  fieldsPerRow: number;
} {
  return {
    name: block.className,
    displayName: block.displayName,
    sourceClassName: block.className,
    description: block.description,
    category: block.category,
    icon: block.icon || '',
    color: block.color || '#3f51b5',
    inputSlots: [...block.defaultInputSlots],
    outputSlots: [...block.defaultOutputSlots],
    displayFields: [...block.displayFields],
    fieldsPerRow: 1
  };
}
