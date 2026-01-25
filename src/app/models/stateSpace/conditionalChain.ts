// Author: Dustin Etts
// polari-platform-angular/src/app/models/stateSpace/conditionalChain.ts

/**
 * ConditionalChain - A chainable conditional evaluation system for the no-code state-space.
 *
 * Similar to DataSeriesFilterChain but designed for visual programming flow control.
 * Supports AND/OR logic operators, SQL-style conditions, and nested condition groups.
 *
 * Usage in state-space:
 * - Each ConditionalChainLink represents a condition node in the visual editor
 * - Links can be connected in sequence (AND) or parallel (OR)
 * - Supports direct SQL generation for database queries
 */

import { ConditionOperator, ConditionType, CONDITION_TYPE_OPTIONS } from './conditionTypeOptions';

/**
 * Logical operators for combining conditions
 */
export type LogicalOperator = 'AND' | 'OR' | 'NOT' | 'XOR';

/**
 * How conditions are grouped/evaluated
 */
export type EvaluationMode = 'sequential' | 'parallel' | 'nested';

/**
 * A single condition in the chain
 */
export interface ConditionalChainLink {
  id: string;
  displayName: string;

  // The field/variable to evaluate
  fieldName: string;

  // The comparison operator (equals, greaterThan, contains, etc.)
  conditionType: ConditionType;

  // The value to compare against
  conditionValue: any;

  // Secondary value for range operations (BETWEEN)
  conditionValueEnd?: any;

  // How this link connects to the next (AND/OR)
  logicalOperator: LogicalOperator;

  // For nested condition groups
  nestedConditions?: ConditionalChain;

  // Visual positioning in state-space
  stateLocationX?: number;
  stateLocationY?: number;

  // State-space configuration
  isStateSpaceObject: boolean;
}

/**
 * ConditionalChain - A linked list of conditions with support for complex logic.
 *
 * Modeled after DataSeriesFilterChain with added support for:
 * - Explicit AND/OR/NOT operators
 * - Nested condition groups
 * - SQL generation
 * - Visual state-space representation
 */
export class ConditionalChain {
  id: string;
  displayName: string;

  // The chain of conditions
  links: ConditionalChainLink[] = [];

  // Default operator for the chain (can be overridden per-link)
  defaultLogicalOperator: LogicalOperator = 'AND';

  // Whether this chain represents a nested group
  isNestedGroup: boolean = false;

  // Parent chain reference for nested groups
  parentChain?: ConditionalChain;

  // State-space configuration
  isStateSpaceObject: boolean = true;
  stateSpaceDisplayFields: string[] = ['displayName', 'defaultLogicalOperator'];
  stateSpaceFieldsPerRow: 1 | 2 = 1;

  constructor(
    displayName: string = 'Condition Chain',
    defaultOperator: LogicalOperator = 'AND'
  ) {
    this.id = this.generateId();
    this.displayName = displayName;
    this.defaultLogicalOperator = defaultOperator;
  }

  private generateId(): string {
    return 'cond_' + Math.random().toString(36).substring(2, 11);
  }

  // --- Chain Management Methods (modeled after filterChain) ---

  /**
   * Add a condition to the end of the chain
   */
  pushCondition(link: ConditionalChainLink): void {
    this.links.push(link);
  }

  /**
   * Remove and return the last condition
   */
  popCondition(): ConditionalChainLink | undefined {
    return this.links.pop();
  }

  /**
   * Insert a condition at a specific index
   */
  insertAtIndex(index: number, link: ConditionalChainLink): void {
    if (index < 0 || index > this.links.length) {
      throw new Error(`Index ${index} out of bounds`);
    }
    this.links.splice(index, 0, link);
  }

  /**
   * Remove condition at a specific index
   */
  removeAtIndex(index: number): ConditionalChainLink | undefined {
    if (index < 0 || index >= this.links.length) {
      return undefined;
    }
    return this.links.splice(index, 1)[0];
  }

  /**
   * Replace condition at a specific index
   */
  replaceAtIndex(index: number, link: ConditionalChainLink): boolean {
    if (index < 0 || index >= this.links.length) {
      return false;
    }
    this.links[index] = link;
    return true;
  }

  /**
   * Get condition at a specific index
   */
  getConditionAtIndex(index: number): ConditionalChainLink | undefined {
    return this.links[index];
  }

  /**
   * Get the size of the chain
   */
  getSize(): number {
    return this.links.length;
  }

  /**
   * Clear all conditions
   */
  clear(): void {
    this.links = [];
  }

  /**
   * Deep clone the entire chain
   */
  clone(): ConditionalChain {
    const cloned = new ConditionalChain(this.displayName, this.defaultLogicalOperator);
    cloned.isNestedGroup = this.isNestedGroup;
    cloned.links = this.links.map(link => ({
      ...link,
      nestedConditions: link.nestedConditions?.clone()
    }));
    return cloned;
  }

  // --- Evaluation Methods ---

  /**
   * Evaluate the chain against a data object
   */
  evaluate(data: Record<string, any>): boolean {
    if (this.links.length === 0) {
      return true; // Empty chain passes
    }

    let result = this.evaluateLink(this.links[0], data);

    for (let i = 1; i < this.links.length; i++) {
      const link = this.links[i];
      const prevLink = this.links[i - 1];
      const linkResult = this.evaluateLink(link, data);

      // Use the previous link's logical operator to combine
      switch (prevLink.logicalOperator) {
        case 'AND':
          result = result && linkResult;
          break;
        case 'OR':
          result = result || linkResult;
          break;
        case 'XOR':
          result = (result || linkResult) && !(result && linkResult);
          break;
        case 'NOT':
          result = result && !linkResult;
          break;
      }
    }

    return result;
  }

  /**
   * Evaluate a single link against data
   */
  private evaluateLink(link: ConditionalChainLink, data: Record<string, any>): boolean {
    // Handle nested conditions
    if (link.nestedConditions) {
      return link.nestedConditions.evaluate(data);
    }

    const fieldValue = data[link.fieldName];
    const conditionValue = link.conditionValue;

    return this.evaluateCondition(fieldValue, link.conditionType, conditionValue, link.conditionValueEnd);
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(
    fieldValue: any,
    conditionType: ConditionType,
    conditionValue: any,
    conditionValueEnd?: any
  ): boolean {
    switch (conditionType) {
      // Equality
      case 'equals':
        return fieldValue === conditionValue;
      case 'notEquals':
        return fieldValue !== conditionValue;

      // Numeric comparisons
      case 'greaterThan':
        return fieldValue > conditionValue;
      case 'lessThan':
        return fieldValue < conditionValue;
      case 'greaterThanOrEqual':
        return fieldValue >= conditionValue;
      case 'lessThanOrEqual':
        return fieldValue <= conditionValue;
      case 'between':
        return fieldValue >= conditionValue && fieldValue <= (conditionValueEnd ?? conditionValue);
      case 'notBetween':
        return fieldValue < conditionValue || fieldValue > (conditionValueEnd ?? conditionValue);

      // String operations
      case 'contains':
        return String(fieldValue).includes(String(conditionValue));
      case 'notContains':
        return !String(fieldValue).includes(String(conditionValue));
      case 'startsWith':
        return String(fieldValue).startsWith(String(conditionValue));
      case 'endsWith':
        return String(fieldValue).endsWith(String(conditionValue));
      case 'regexMatch':
        return new RegExp(conditionValue).test(String(fieldValue));

      // Null checks
      case 'isNull':
        return fieldValue === null || fieldValue === undefined;
      case 'isNotNull':
        return fieldValue !== null && fieldValue !== undefined;

      // Boolean
      case 'isTrue':
        return fieldValue === true;
      case 'isFalse':
        return fieldValue === false;

      // Collection operations
      case 'in':
        return Array.isArray(conditionValue) && conditionValue.includes(fieldValue);
      case 'notIn':
        return Array.isArray(conditionValue) && !conditionValue.includes(fieldValue);

      // SQL-specific
      case 'like':
        // Convert SQL LIKE pattern to regex
        const pattern = String(conditionValue)
          .replace(/%/g, '.*')
          .replace(/_/g, '.');
        return new RegExp(`^${pattern}$`, 'i').test(String(fieldValue));

      default:
        return true; // noop
    }
  }

  // --- SQL Generation ---

  /**
   * Generate SQL WHERE clause from the chain
   */
  toSQL(tableAlias?: string): string {
    if (this.links.length === 0) {
      return '1=1'; // Always true for empty chain
    }

    const prefix = tableAlias ? `${tableAlias}.` : '';
    const parts: string[] = [];

    for (let i = 0; i < this.links.length; i++) {
      const link = this.links[i];
      const sqlCondition = this.linkToSQL(link, prefix);

      if (i === 0) {
        parts.push(sqlCondition);
      } else {
        const prevLink = this.links[i - 1];
        parts.push(`${prevLink.logicalOperator} ${sqlCondition}`);
      }
    }

    return parts.join(' ');
  }

  /**
   * Convert a single link to SQL
   */
  private linkToSQL(link: ConditionalChainLink, prefix: string): string {
    if (link.nestedConditions) {
      return `(${link.nestedConditions.toSQL()})`;
    }

    const field = `${prefix}${link.fieldName}`;
    const value = this.escapeSQL(link.conditionValue);

    switch (link.conditionType) {
      case 'equals':
        return `${field} = ${value}`;
      case 'notEquals':
        return `${field} != ${value}`;
      case 'greaterThan':
        return `${field} > ${value}`;
      case 'lessThan':
        return `${field} < ${value}`;
      case 'greaterThanOrEqual':
        return `${field} >= ${value}`;
      case 'lessThanOrEqual':
        return `${field} <= ${value}`;
      case 'between':
        const endVal = this.escapeSQL(link.conditionValueEnd ?? link.conditionValue);
        return `${field} BETWEEN ${value} AND ${endVal}`;
      case 'notBetween':
        const endVal2 = this.escapeSQL(link.conditionValueEnd ?? link.conditionValue);
        return `${field} NOT BETWEEN ${value} AND ${endVal2}`;
      case 'contains':
        return `${field} LIKE '%${link.conditionValue}%'`;
      case 'notContains':
        return `${field} NOT LIKE '%${link.conditionValue}%'`;
      case 'startsWith':
        return `${field} LIKE '${link.conditionValue}%'`;
      case 'endsWith':
        return `${field} LIKE '%${link.conditionValue}'`;
      case 'like':
        return `${field} LIKE ${value}`;
      case 'isNull':
        return `${field} IS NULL`;
      case 'isNotNull':
        return `${field} IS NOT NULL`;
      case 'in':
        const inValues = Array.isArray(link.conditionValue)
          ? link.conditionValue.map(v => this.escapeSQL(v)).join(', ')
          : value;
        return `${field} IN (${inValues})`;
      case 'notIn':
        const notInValues = Array.isArray(link.conditionValue)
          ? link.conditionValue.map(v => this.escapeSQL(v)).join(', ')
          : value;
        return `${field} NOT IN (${notInValues})`;
      default:
        return '1=1';
    }
  }

  /**
   * Escape a value for SQL (basic escaping - use parameterized queries in production)
   */
  private escapeSQL(value: any): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    if (typeof value === 'number') {
      return String(value);
    }
    if (typeof value === 'boolean') {
      return value ? '1' : '0';
    }
    // String - escape single quotes
    return `'${String(value).replace(/'/g, "''")}'`;
  }

  // --- State-Space Integration ---

  /**
   * Get state-space configuration for this chain
   */
  getStateSpaceConfig() {
    return {
      className: 'ConditionalChain',
      isStateSpaceObject: this.isStateSpaceObject,
      eventMethods: [
        {
          methodName: 'evaluate',
          displayName: 'Evaluate Condition',
          description: 'Evaluate the conditional chain against input data',
          category: 'Logic',
          inputParams: [
            { name: 'data', displayName: 'Input Data', type: 'object', isRequired: true }
          ],
          output: { type: 'boolean', displayName: 'Result' }
        },
        {
          methodName: 'toSQL',
          displayName: 'Generate SQL',
          description: 'Generate SQL WHERE clause from conditions',
          category: 'SQL',
          inputParams: [
            { name: 'tableAlias', displayName: 'Table Alias', type: 'string', isRequired: false }
          ],
          output: { type: 'string', displayName: 'SQL WHERE Clause' }
        }
      ],
      displayFields: this.stateSpaceDisplayFields,
      fieldsPerRow: this.stateSpaceFieldsPerRow,
      variables: ['displayName', 'defaultLogicalOperator', 'links']
    };
  }

  // --- Serialization ---

  /**
   * Convert to JSON-serializable object
   */
  toJSON(): object {
    return {
      id: this.id,
      displayName: this.displayName,
      defaultLogicalOperator: this.defaultLogicalOperator,
      isNestedGroup: this.isNestedGroup,
      links: this.links.map(link => ({
        ...link,
        nestedConditions: link.nestedConditions?.toJSON()
      }))
    };
  }

  /**
   * Create from JSON object
   */
  static fromJSON(json: any): ConditionalChain {
    const chain = new ConditionalChain(json.displayName, json.defaultLogicalOperator);
    chain.id = json.id;
    chain.isNestedGroup = json.isNestedGroup || false;
    chain.links = (json.links || []).map((link: any) => ({
      ...link,
      nestedConditions: link.nestedConditions
        ? ConditionalChain.fromJSON(link.nestedConditions)
        : undefined
    }));
    return chain;
  }
}

// --- Factory Functions ---

/**
 * Create a new ConditionalChainLink
 */
export function createConditionLink(
  fieldName: string,
  conditionType: ConditionType,
  conditionValue: any,
  logicalOperator: LogicalOperator = 'AND',
  displayName?: string
): ConditionalChainLink {
  return {
    id: 'link_' + Math.random().toString(36).substring(2, 11),
    displayName: displayName || `${fieldName} ${conditionType} ${conditionValue}`,
    fieldName,
    conditionType,
    conditionValue,
    logicalOperator,
    isStateSpaceObject: true
  };
}

/**
 * Create a nested condition group
 */
export function createNestedConditionGroup(
  displayName: string,
  logicalOperator: LogicalOperator = 'AND'
): ConditionalChainLink {
  const nestedChain = new ConditionalChain(displayName, logicalOperator);
  nestedChain.isNestedGroup = true;

  return {
    id: 'group_' + Math.random().toString(36).substring(2, 11),
    displayName,
    fieldName: '',
    conditionType: 'noop',
    conditionValue: null,
    logicalOperator,
    nestedConditions: nestedChain,
    isStateSpaceObject: true
  };
}
