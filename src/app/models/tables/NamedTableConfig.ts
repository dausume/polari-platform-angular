import { TableConfiguration, ITableConfiguration } from './TableConfiguration';

export interface TableDefinitionSummary {
  id: string;
  name: string;
  description: string;
  source_class: string;
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
  tableConfiguration: TableConfiguration;
  rowWrapping: RowWrappingConfig;
  crudPermissions: CrudPermissionConfig;

  constructor(id: string, name: string, description: string, sourceClass: string) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.source_class = sourceClass;
    this.tableConfiguration = new TableConfiguration(sourceClass);
    this.rowWrapping = { ...DEFAULT_ROW_WRAPPING };
    this.crudPermissions = { ...DEFAULT_CRUD_PERMISSIONS };
  }

  toDefinitionJSON(): string {
    return JSON.stringify({
      tableConfiguration: this.tableConfiguration.toJSON(),
      rowWrapping: this.rowWrapping,
      crudPermissions: this.crudPermissions
    });
  }

  static fromBackend(backendObj: any, classTypeData?: Record<string, any>): NamedTableConfig {
    const config = new NamedTableConfig(
      backendObj.id || '',
      backendObj.name || '',
      backendObj.description || '',
      backendObj.source_class || ''
    );

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
