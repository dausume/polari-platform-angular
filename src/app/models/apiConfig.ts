/**
 * API Configuration Models
 *
 * Interfaces for the /api-config endpoint response and permission management.
 */

/**
 * CRUDE permission flags for an access level
 */
export interface CRUDEPermissions {
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
  events: boolean;
}

/**
 * Variable-level CRUD permissions (no Events at variable level)
 */
export interface VariableCRUD {
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
}

/**
 * Variable information for an object with CRUD permissions
 */
export interface VariableInfo {
  name: string;
  type: string;
  isIdentifier: boolean;
  isRequired?: boolean;
  crud: VariableCRUD;
}

/**
 * Event/method information with access permissions
 */
export interface EventInfo {
  name: string;
  accessible: boolean;
  requiresAuth: boolean;
}

/**
 * General access configuration from polyTypedObject
 */
export interface GeneralAccess {
  baseAccessDictionary: { [key: string]: any };
  basePermissionDictionary: { [key: string]: any };
  crude: CRUDEPermissions;
}

/**
 * API format types available in the system
 */
export type ApiFormatType = 'polariTree' | 'flatJson' | 'd3Column';

/**
 * Configuration for a single API format on an object
 */
export interface ApiFormatConfigEntry {
  enabled: boolean;
  endpoint: string | null;
  prefix: string | null;
  description: string;
}

/**
 * All API format configurations for an object
 */
export interface ApiFormats {
  polariTree: ApiFormatConfigEntry;
  flatJson: ApiFormatConfigEntry;
  d3Column: ApiFormatConfigEntry;
}

/**
 * Configuration for a single registered object
 */
export interface ApiConfigObject {
  className: string;
  displayName: string;
  isBaseObject: boolean;
  isUserCreated: boolean;
  excludeFromCRUDE: boolean;
  allowClassEdit: boolean;
  isStateSpaceObject: boolean;
  isDynamicClass: boolean;
  serverAccessOnly: boolean;
  generalAccess: GeneralAccess;
  crudeRegistered: boolean;
  crudeEndpoint: string | null;
  apiFormats: ApiFormats;
  permissionSetRefs: string[];
  variables: VariableInfo[];
  events: EventInfo[];
}

/**
 * User group information
 */
export interface UserGroupInfo {
  id: string;
  name: string;
  permissionSets: string[];
  assignedUsers: string[];
  userCount: number;
}

/**
 * User information (limited for security)
 */
export interface UserInfo {
  id: string;
  username: string;
  assignedPermissionSets: string[];
  groups: string[];
}

/**
 * Permission set information
 */
export interface PermissionSetInfo {
  id: string;
  name: string;
  forAllAnonymousUsers: boolean;
  forAllAuthUsers: boolean;
  assignedUserGroups: string[];
  setAccessQueries: { [key: string]: any };
  setPermissionQuery: { [key: string]: any };
  fullAPIaccess: string[];
}

/**
 * Full API configuration response
 */
export interface ApiConfigResponse {
  success: boolean;
  objects: ApiConfigObject[];
  userGroups: UserGroupInfo[];
  users: UserInfo[];
  permissionSets: PermissionSetInfo[];
  error?: string;
}

/**
 * Access levels for permission management
 */
export type AccessLevel = 'general' | 'server' | 'role' | 'user';

/**
 * Request body for updating permissions
 */
export interface PermissionUpdateRequest {
  className: string;
  accessLevel: AccessLevel;
  targetId?: string;  // Group name or user ID (for role/user access)
  permissions: {
    create?: boolean | string[];
    read?: boolean | string[];
    update?: boolean | string[];
    delete?: boolean;
    events?: boolean | string[];
    serverOnly?: boolean;  // For server access level
  };
}

/**
 * Response from permission update
 */
export interface PermissionUpdateResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Request body for updating API format configuration
 */
export interface FormatUpdateRequest {
  className: string;
  flatJson?: boolean;
  d3Column?: boolean;
  flatJsonPrefix?: string;
  d3ColumnPrefix?: string;
}

/**
 * Response from format update
 */
export interface FormatUpdateResponse {
  success: boolean;
  message?: string;
  registered?: [string, string][];
  unregistered?: string[];
  error?: string;
}

/**
 * Display model for permission matrix row
 */
export interface PermissionMatrixRow {
  object: ApiConfigObject;
  expanded: boolean;
  accessLevels: {
    general: CRUDEPermissions;
    server: { enabled: boolean };
    roles: { groupName: string; crude: CRUDEPermissions }[];
    users: { userId: string; username: string; crude: CRUDEPermissions }[];
  };
}
