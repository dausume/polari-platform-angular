import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RuntimeConfigService } from './runtime-config.service';
import {
  ApiConfigResponse,
  PermissionUpdateRequest,
  PermissionUpdateResponse
} from '@models/apiConfig';

/**
 * Service for interacting with the /api-config endpoint.
 *
 * Provides methods to:
 * - Get all API configurations and permissions
 * - Update permissions for user-created objects
 */
@Injectable({
  providedIn: 'root'
})
export class ApiConfigService {

  constructor(
    private http: HttpClient,
    private runtimeConfig: RuntimeConfigService
  ) {}

  /**
   * Get all API configurations including objects, user groups, users, and permission sets.
   */
  getApiConfig(): Observable<ApiConfigResponse> {
    const baseUrl = this.runtimeConfig.getBackendBaseUrl();
    return this.http.get<ApiConfigResponse>(`${baseUrl}/api-config`);
  }

  /**
   * Update permissions for a user-created object.
   *
   * Only works for objects where isUserCreated=true.
   * Framework/base objects cannot be modified.
   */
  updatePermissions(request: PermissionUpdateRequest): Observable<PermissionUpdateResponse> {
    const baseUrl = this.runtimeConfig.getBackendBaseUrl();
    return this.http.put<PermissionUpdateResponse>(`${baseUrl}/api-config/permissions`, request);
  }
}
