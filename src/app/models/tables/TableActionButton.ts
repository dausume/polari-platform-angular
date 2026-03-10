/**
 * Maps an instance field to a solution input parameter.
 */
export interface ParamMapping {
  instanceField: string;
  solutionParam: string;
}

/**
 * Base properties shared by both action button types.
 */
interface ActionButtonBase {
  id: string;
  label: string;
  /** SVG icon name from SvgIconLibrary */
  iconName: string;
  solutionName: string;
  targetRuntime?: 'python_backend' | 'typescript_frontend';
  color?: 'primary' | 'accent' | 'warn';
}

/**
 * A per-row action button that launches a solution with instance data.
 */
export class InstanceActionButton implements ActionButtonBase {
  id: string;
  label: string;
  iconName: string;
  solutionName: string;
  targetRuntime: 'python_backend' | 'typescript_frontend';
  paramMappings: ParamMapping[];
  color: 'primary' | 'accent' | 'warn';

  constructor(data?: Partial<InstanceActionButton>) {
    this.id = data?.id || crypto.randomUUID();
    this.label = data?.label || 'Run';
    this.iconName = data?.iconName || 'play';
    this.solutionName = data?.solutionName || '';
    this.targetRuntime = data?.targetRuntime || 'python_backend';
    this.paramMappings = (data?.paramMappings || []).map(m => ({ ...m }));
    this.color = data?.color || 'primary';
  }

  toJSON(): any {
    return {
      id: this.id,
      label: this.label,
      iconName: this.iconName,
      solutionName: this.solutionName,
      targetRuntime: this.targetRuntime,
      paramMappings: this.paramMappings,
      color: this.color
    };
  }

  static fromJSON(json: any): InstanceActionButton {
    return new InstanceActionButton(json);
  }
}

/**
 * A table-level action button that launches a solution with the current dataset.
 */
export class DatasetActionButton implements ActionButtonBase {
  id: string;
  label: string;
  iconName: string;
  solutionName: string;
  targetRuntime: 'python_backend' | 'typescript_frontend';
  includeFilteredOnly: boolean;
  color: 'primary' | 'accent' | 'warn';

  constructor(data?: Partial<DatasetActionButton>) {
    this.id = data?.id || crypto.randomUUID();
    this.label = data?.label || 'Run on Dataset';
    this.iconName = data?.iconName || 'play';
    this.solutionName = data?.solutionName || '';
    this.targetRuntime = data?.targetRuntime || 'python_backend';
    this.includeFilteredOnly = data?.includeFilteredOnly ?? true;
    this.color = data?.color || 'primary';
  }

  toJSON(): any {
    return {
      id: this.id,
      label: this.label,
      iconName: this.iconName,
      solutionName: this.solutionName,
      targetRuntime: this.targetRuntime,
      includeFilteredOnly: this.includeFilteredOnly,
      color: this.color
    };
  }

  static fromJSON(json: any): DatasetActionButton {
    return new DatasetActionButton(json);
  }
}
