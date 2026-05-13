export interface AuthUserPreferences {
  [key: string]: any;
}

export class AuthUser {
  id: string;
  name: string;
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  roles?: string[];
  permissions?: string[];
  preferences?: AuthUserPreferences;

  constructor(data: {
    id: string;
    name?: string;
    username?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    roles?: string[];
    permissions?: string[];
    preferences?: AuthUserPreferences;
  }) {
    this.id = data.id;
    this.name = data.name || data.username || data.email || 'Unknown User';
    this.username = data.username;
    this.email = data.email;
    this.firstName = data.firstName;
    this.lastName = data.lastName;
    this.roles = data.roles || [];
    this.permissions = data.permissions || [];
    this.preferences = data.preferences || {};
  }

  toString(): string {
    return `AuthUser(id: ${this.id}, name: "${this.name}")`;
  }
}
