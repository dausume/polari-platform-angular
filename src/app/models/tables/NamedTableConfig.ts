import { TableConfiguration, ITableConfiguration } from './TableConfiguration';
import { InstanceActionButton, DatasetActionButton } from './TableActionButton';

/**
 * Configuration for a single metric card in the detail display.
 * Each card shows a value from the instance context.
 */
export interface MetricCardConfig {
  /** Unique ID for this card */
  id: string;
  /** The field name on the instance to read the value from */
  fieldName: string;
  /** Display label (defaults to field display name if empty) */
  label: string;
  /** Material icon name */
  icon: string;
  /** Value format */
  format: 'text' | 'number' | 'percent' | 'currency';
}

/**
 * Configuration for the detail display (single-instance view).
 * Renders metric cards in a 4-column grid, filling left to right.
 */
export interface DetailDisplayConfig {
  /** Ordered list of metric cards to show */
  cards: MetricCardConfig[];
}

export interface TableDefinitionSummary {
  id: string;
  name: string;
  description: string;
  source_class: string;
  is_default_table: boolean;
  is_default_instance_display: boolean;
  is_default_dataset_display: boolean;
}

export interface RowWrappingConfig {
  enabled: boolean;
  fieldsPerRow: number;
  separatorStyle: 'thin' | 'thick' | 'double';
}

export interface CrudPermissionConfig {
  allowCreate: boolean;
  allowEdit: boolean;
  allowDelete: boolean;
}

const DEFAULT_ROW_WRAPPING: RowWrappingConfig = {
  enabled: false,
  fieldsPerRow: 5,
  separatorStyle: 'thick'
};

const DEFAULT_CRUD_PERMISSIONS: CrudPermissionConfig = {
  allowCreate: true,
  allowEdit: true,
  allowDelete: true
};

export class NamedTableConfig {
  id: string;
  name: string;
  description: string;
  source_class: string;
  is_default_table: boolean;
  is_default_instance_display: boolean;
  is_default_dataset_display: boolean;
  tableConfiguration: TableConfiguration;
  rowWrapping: RowWrappingConfig;
  crudPermissions: CrudPermissionConfig;
  instanceActions: InstanceActionButton[];
  datasetActions: DatasetActionButton[];
  detailDisplay: DetailDisplayConfig;

  constructor(id: string, name: string, description: string, sourceClass: string) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.source_class = sourceClass;
    this.is_default_table = false;
    this.is_default_instance_display = false;
    this.is_default_dataset_display = false;
    this.tableConfiguration = new TableConfiguration(sourceClass);
    this.rowWrapping = { ...DEFAULT_ROW_WRAPPING };
    this.crudPermissions = { ...DEFAULT_CRUD_PERMISSIONS };
    this.instanceActions = [];
    this.datasetActions = [];
    this.detailDisplay = { cards: [] };
  }

  toDefinitionJSON(): string {
    return JSON.stringify({
      tableConfiguration: this.tableConfiguration.toJSON(),
      rowWrapping: this.rowWrapping,
      crudPermissions: this.crudPermissions,
      instanceActions: this.instanceActions.map(a => a.toJSON()),
      datasetActions: this.datasetActions.map(a => a.toJSON()),
      detailDisplay: this.detailDisplay
    });
  }

  static fromBackend(backendObj: any, classTypeData?: Record<string, any>): NamedTableConfig {
    const config = new NamedTableConfig(
      backendObj.id || '',
      backendObj.name || '',
      backendObj.description || '',
      backendObj.source_class || ''
    );

    config.is_default_table = !!backendObj.is_default_table;
    config.is_default_instance_display = !!(backendObj.is_default_instance_display || backendObj.is_default_display);
    config.is_default_dataset_display = !!backendObj.is_default_dataset_display;

    if (backendObj.definition && backendObj.definition !== '{}') {
      try {
        const parsed = typeof backendObj.definition === 'string'
          ? JSON.parse(backendObj.definition)
          : backendObj.definition;

        if (parsed.tableConfiguration) {
          config.tableConfiguration = new TableConfiguration(
            config.source_class,
            parsed.tableConfiguration
          );
        }

        if (parsed.rowWrapping) {
          config.rowWrapping = {
            ...DEFAULT_ROW_WRAPPING,
            ...parsed.rowWrapping
          };
        }

        if (parsed.crudPermissions) {
          config.crudPermissions = {
            ...DEFAULT_CRUD_PERMISSIONS,
            ...parsed.crudPermissions
          };
        }

        if (parsed.instanceActions && Array.isArray(parsed.instanceActions)) {
          config.instanceActions = parsed.instanceActions.map((a: any) => InstanceActionButton.fromJSON(a));
        }
        if (parsed.datasetActions && Array.isArray(parsed.datasetActions)) {
          config.datasetActions = parsed.datasetActions.map((a: any) => DatasetActionButton.fromJSON(a));
        }
        if (parsed.detailDisplay && parsed.detailDisplay.cards) {
          config.detailDisplay = parsed.detailDisplay;
        }
      } catch (e) {
        console.warn('[NamedTableConfig] Failed to parse definition:', e);
      }
    }

    if (classTypeData && Object.keys(classTypeData).length > 0) {
      config.tableConfiguration.initializeFromClassTypeData(classTypeData);
    }

    return config;
  }
}
