/**
 * Sub-type for class-based data sources.
 */
export type ClassDataSourceSubType = 'all-instances' | 'row-instance' | 'static-data';

/**
 * A single data source that feeds into a display.
 */
export interface DisplayDataSource {
  id: string;
  label: string;
  sourceType: 'class' | 'solution' | 'static';

  // --- Class source fields ---
  className?: string;
  /** Sub-type when sourceType === 'class' */
  classSubType?: ClassDataSourceSubType;

  // --- Row-instance sub-type fields ---
  /** ID of a default instance to display */
  defaultInstanceId?: string;
  /** Mock instance data for design-time preview */
  mockInstance?: Record<string, any>;

  // --- Static-data sub-type fields ---
  /** Variable type from the shared type system (e.g. 'String', 'Integer', 'Reference') */
  staticVarType?: string;
  /** Reference class when staticVarType is Reference or Reference List */
  staticVarRefClass?: string;
  /** The actual static value */
  staticVarValue?: any;

  // --- Solution source fields ---
  solutionName?: string;
  solutionParams?: Record<string, any>;

  // --- Top-level static source fields ---
  staticData?: any;

  autoLoad: boolean;
  refreshIntervalMs?: number;
}

/**
 * An input parameter that the display expects from its parent context (route, embedding component, etc.).
 */
export interface DisplayInput {
  name: string;
  label: string;
  dataType: string;
  required: boolean;
  defaultValue?: any;
}

/**
 * Defines the data context for a Display — what classes, solutions, and inputs
 * are available to the components within the display.
 */
export class DisplayStateDefinition {
  dataSources: DisplayDataSource[] = [];
  inputs: DisplayInput[] = [];

  addDataSource(source: DisplayDataSource): void {
    this.dataSources.push(source);
  }

  removeDataSource(id: string): void {
    this.dataSources = this.dataSources.filter(ds => ds.id !== id);
  }

  getDataSource(id: string): DisplayDataSource | undefined {
    return this.dataSources.find(ds => ds.id === id);
  }

  addInput(input: DisplayInput): void {
    this.inputs.push(input);
  }

  removeInput(name: string): void {
    this.inputs = this.inputs.filter(i => i.name !== name);
  }

  toJSON(): any {
    return {
      dataSources: this.dataSources.map(ds => ({ ...ds })),
      inputs: this.inputs.map(inp => ({ ...inp }))
    };
  }

  static fromJSON(json: any): DisplayStateDefinition {
    const def = new DisplayStateDefinition();
    if (json?.dataSources && Array.isArray(json.dataSources)) {
      def.dataSources = json.dataSources.map((ds: any) => ({
        id: ds.id || crypto.randomUUID(),
        label: ds.label || '',
        sourceType: ds.sourceType || 'class',
        className: ds.className,
        classSubType: ds.classSubType || (ds.sourceType === 'class' ? 'all-instances' : undefined),
        defaultInstanceId: ds.defaultInstanceId,
        mockInstance: ds.mockInstance,
        staticVarType: ds.staticVarType,
        staticVarRefClass: ds.staticVarRefClass,
        staticVarValue: ds.staticVarValue,
        solutionName: ds.solutionName,
        solutionParams: ds.solutionParams,
        staticData: ds.staticData,
        autoLoad: ds.autoLoad !== false,
        refreshIntervalMs: ds.refreshIntervalMs
      }));
    }
    if (json?.inputs && Array.isArray(json.inputs)) {
      def.inputs = json.inputs.map((inp: any) => ({
        name: inp.name || '',
        label: inp.label || '',
        dataType: inp.dataType || 'string',
        required: inp.required === true,
        defaultValue: inp.defaultValue
      }));
    }
    return def;
  }
}
