// api-profiler.service.ts
// ==============================================================================
// API PROFILER SERVICE - Service for API Profiling functionality
// ==============================================================================
// Provides methods to:
// - Query external APIs and analyze responses
// - Match responses against stored profiles
// - Build profiles from API responses
// - Create Polari classes from profiles
// - Detect multiple object types in responses
// ==============================================================================

import { Injectable } from "@angular/core";
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from "rxjs";
import { catchError, tap } from 'rxjs/operators';
import { PolariService } from "./polari-service";

export interface SignatureMatchDetail {
    level: number;
    expected: string | string[] | null;  // Expected value (type string or field names) - for type signatures
    found: string | string[] | null;  // What was found in the response
    matched: boolean;  // Whether it matched
    extra?: boolean;  // True if this is an extra/unexpected field (not in profile)
    required?: boolean;  // True if this is a required field
    optional?: boolean;  // True if this is an optional field
    // New fields for levelSignatures format
    field?: string;  // The field name (for field signatures)
    expectedType?: string | null;  // The expected type of the field value
}

export interface LevelSignature {
    containerType: string;
    requiredFields: { [field: string]: string };
    optionalFields: { [field: string]: string };
}

export interface RankingWeights {
    requiredCount: number;  // W1 = 0.40 (highest)
    requiredPct: number;    // W2 = 0.30
    optionalCount: number;  // W3 = 0.20
    optionalPct: number;    // W4 = 0.10 (lowest)
}

export interface RawScoreComponents {
    requiredCount: number;
    requiredPct: number;
    optionalCount: number;
    optionalPct: number;
}

export interface ProfileMatch {
    profileName: string;
    displayName?: string;
    // Match category: "Match" (100% required), "Partial Match" (>60% required), or null
    matchCategory: 'Match' | 'Partial Match' | null;
    isMatch: boolean;           // True if matchCategory === 'Match'
    isPartialMatch?: boolean;   // True if matchCategory === 'Partial Match'
    isTemplate: boolean;
    dataPath?: string;
    // Ranking within category
    normalizedScore?: number;   // 0-1, normalized within category (lowest=0, highest=1)
    categoryRank?: number;      // 1, 2, 3... within category
    totalMatches?: number;      // Total profiles in "Match" category
    totalPartialMatches?: number;  // Total profiles in "Partial Match" category
    // Score components for transparency
    rawScoreComponents?: RawScoreComponents;
    weights?: RankingWeights;
    rawWeightedScore?: number;
    weightedScore?: number;
    // Type signature matching details
    typeSignatureMatches?: SignatureMatchDetail[];
    matchedTypeSignatures?: number;
    totalTypeSignatures?: number;
    // Required vs Optional type breakdown
    matchedRequiredTypes?: number;
    totalRequiredTypes?: number;
    matchedOptionalTypes?: number;
    totalOptionalTypes?: number;
    // Field signature matching details (combined)
    fieldSignatureMatches?: SignatureMatchDetail[];
    matchedFieldSignatures?: number;
    totalFieldSignatures?: number;
    // Required vs Optional field breakdown
    matchedRequiredFields?: number;
    totalRequiredFields?: number;
    matchedOptionalFields?: number;
    totalOptionalFields?: number;
    // Level signatures from profile (new format)
    levelSignatures?: { [level: number]: LevelSignature } | null;
    // Legacy/additional fields
    fieldMatches?: any;
    scoreBreakdown?: any;
    matchDetails?: any;
}

export interface DetectedType {
    typeId: string;
    sampleCount: number;
    fieldSignature: string[];
    method: string;
    samples: any[];
}

export interface APIProfile {
    profileName: string;
    displayName: string;
    description: string;
    apiEndpoint: string;
    httpMethod: string;
    responseRootPath: string;
    // fieldSignatures: level -> list of field names at that nesting depth
    // e.g., {0: ['data', 'status'], 1: ['id', 'name'], 2: ['nested_field']}
    fieldSignatures: { [level: number]: string[] };
    // typeSignatures: level -> list of types at that depth
    // e.g., {0: ['dict'], 1: ['str', 'list[dict]'], 2: ['int']}
    typeSignatures: { [level: number]: string[] };
    // Total count of unique field signatures across all levels
    totalFieldSignatures: number;
    // Total count of type signatures (number of levels)
    totalTypeSignatures: number;
    fieldTypes: { [key: string]: string };
    sampleCount: number;
    isTemplate: boolean;
    matchConfidenceThreshold: number;
}

export interface FormatAnalysis {
    description: string;
    rootType: string;
    typeSignatures: { [level: number]: string[] };  // Now a list of types per level
    fieldSignatures: { [level: number]: string[] };
    totalTypeSignatures: number;
    totalFieldSignatures: number;
    maxDepth: number;
    detectedFormat: string | null;
    detectedFormatDisplayName: string | null;
    detectedFormatConfidence: number;
    detectedDataPath: string;
}

export interface RecordsAnalysis {
    description: string;
    effectiveDataPath: string;
    sampleCount: number;
    fieldCount: number;
    fields: string[];
    detectedTypes: { [key: string]: string };
    rootType: string;
    typeSignatures: { [level: number]: string[] };
    fieldSignatures: { [level: number]: string[] };
}

export interface QueryResult {
    success: boolean;
    response?: any;
    extractedData?: any;
    detectedDataPath?: string;
    effectiveDataPath?: string;
    // New separate analysis sections
    formatAnalysis?: FormatAnalysis;
    recordsAnalysis?: RecordsAnalysis;
    // Legacy analysis field for backwards compatibility
    analysis?: {
        sampleCount: number;
        fieldCount: number;
        fields: string[];
        detectedTypes: { [key: string]: string };
        suggestedTemplates: string[];
        detectedFormat?: string;
        detectedFormatConfidence?: number;
    };
    matches?: ProfileMatch[];
    profile?: APIProfile;
    error?: string;
}

export interface BuildProfileResult {
    success: boolean;
    profile?: APIProfile;
    polyTypedObject?: {
        className: string;
        variableCount: number;
        variables: { name: string; type: string }[];
    };
    detectedTypes?: DetectedType[];
    subProfiles?: APIProfile[];
    error?: string;
}

export interface CreateClassResult {
    success: boolean;
    className?: string;
    classDisplayName?: string;
    apiEndpoint?: string;
    crudeRegistered?: boolean;
    isStateSpaceObject?: boolean;
    variableCount?: number;
    variables?: any[];
    error?: string;
}

export interface APIDomain {
    id?: number;
    name: string;
    displayName: string;
    description: string;
    host: string;
    port: number | null;
    protocol: string;
    trustSelfSigned: boolean;
    customCertPath: string;
    verifySSL: boolean;
    hostType: string;  // 'localhost', 'ipv4', 'ipv6', 'domain'
    isDefault: boolean;
    tags: string[];
    baseUrl?: string;  // Computed full base URL
    isCommon?: boolean;  // True for pre-defined common domains
}

export interface APIEndpoint {
    id?: number;
    name: string;
    displayName: string;
    description: string;
    domainName: string;  // Reference to APIDomain
    endpointPath: string;  // Path part of URL (e.g., "/api/v1/users")
    url: string;  // Computed full URL (for display/backwards compatibility)
    httpMethod: string;
    defaultHeaders: { [key: string]: string };
    bodyTemplate: string;
    responseRootPath: string;
    linkedProfileName: string;
    persistData: boolean;
    polariClassName: string;
    fetchIntervalMinutes: number;
    lastFetchTime: string;
    lastFetchSuccess: boolean;
    lastFetchError: string;
    lastResponseSample: any;
    lastResponseFieldCount: number;
    lastResponseRecordCount: number;
    isActive: boolean;
    authType: string;
    hasAuth: boolean;
    authConfig?: string;  // Only used when creating/updating, not returned from GET
}

export interface FetchResult {
    success: boolean;
    endpointName?: string;
    recordCount?: number;
    fieldCount?: number;
    fetchTime?: string;
    data?: any;
    persisted?: boolean;
    persistedClassName?: string;
    persistedCount?: number;
    classCreated?: boolean;
    error?: string;
    debug?: any;
}

@Injectable({
    providedIn: 'root'
})
export class ApiProfilerService {

    // State subjects
    isLoading$ = new BehaviorSubject<boolean>(false);
    lastError$ = new BehaviorSubject<string>('');
    lastQueryResult$ = new BehaviorSubject<QueryResult | null>(null);
    storedProfiles$ = new BehaviorSubject<APIProfile[]>([]);
    availableTemplates$ = new BehaviorSubject<string[]>([]);
    storedDomains$ = new BehaviorSubject<APIDomain[]>([]);
    storedEndpoints$ = new BehaviorSubject<APIEndpoint[]>([]);
    lastFetchResult$ = new BehaviorSubject<FetchResult | null>(null);

    constructor(
        private http: HttpClient,
        private polariService: PolariService
    ) {
        // Load templates, domains, and endpoints on init
        this.loadTemplates();
        this.loadDomains();
        this.loadEndpoints();
    }

    /**
     * Get the API Profiler base URL
     */
    private getProfilerBaseUrl(): string {
        return `${this.polariService.getBackendBaseUrl()}/apiProfiler`;
    }

    /**
     * Load available profile templates from backend
     */
    loadTemplates(): void {
        this.http.get<any>(`${this.getProfilerBaseUrl()}/templates`, this.polariService.backendRequestOptions)
            .pipe(
                catchError(error => {
                    console.error('[ApiProfilerService] Failed to load templates:', error);
                    return of({ success: false, templateNames: [] });
                })
            )
            .subscribe(response => {
                if (response?.success && response?.templateNames) {
                    this.availableTemplates$.next(response.templateNames);
                }
            });
    }

    /**
     * Query an external API and analyze the response
     */
    queryExternalApi(
        url: string,
        method: string = 'GET',
        headers: { [key: string]: string } = {},
        body?: any,
        responseRootPath: string = '',
        matchProfiles: boolean = true,
        profileName?: string
    ): Observable<QueryResult> {
        this.isLoading$.next(true);
        this.lastError$.next('');

        const requestBody = {
            url,
            method,
            headers,
            body,
            responseRootPath,
            matchProfiles,
            profileName
        };

        return this.http.post<QueryResult>(
            `${this.getProfilerBaseUrl()}/query`,
            requestBody,
            this.polariService.backendRequestOptions
        ).pipe(
            tap(result => {
                this.isLoading$.next(false);
                this.lastQueryResult$.next(result);
                if (!result.success && result.error) {
                    this.lastError$.next(result.error);
                }
            }),
            catchError(error => {
                this.isLoading$.next(false);
                const errorMsg = error?.error?.error || error?.message || 'Query failed';
                this.lastError$.next(errorMsg);
                return of({ success: false, error: errorMsg });
            })
        );
    }

    /**
     * Match response data against stored profiles
     */
    matchResponse(
        responseData: any,
        profileNames?: string[],
        includeTemplates: boolean = true,
        threshold?: number
    ): Observable<{ success: boolean; matches: ProfileMatch[]; summary: any; error?: string }> {
        this.isLoading$.next(true);

        const requestBody: any = {
            responseData,
            includeTemplates
        };

        if (profileNames && profileNames.length > 0) {
            requestBody.profileNames = profileNames;
        }
        if (threshold !== undefined) {
            requestBody.threshold = threshold;
        }

        return this.http.post<any>(
            `${this.getProfilerBaseUrl()}/match`,
            requestBody,
            this.polariService.backendRequestOptions
        ).pipe(
            tap(() => this.isLoading$.next(false)),
            catchError(error => {
                this.isLoading$.next(false);
                const errorMsg = error?.error?.error || error?.message || 'Match failed';
                this.lastError$.next(errorMsg);
                return of({ success: false, matches: [], summary: {}, error: errorMsg });
            })
        );
    }

    /**
     * Build a profile from response data
     */
    buildProfile(
        responseData: any,
        profileName: string,
        displayName?: string,
        description?: string,
        apiEndpoint?: string,
        httpMethod: string = 'GET',
        responseRootPath: string = '',
        detectTypes: boolean = false,
        objectTypeField?: string
    ): Observable<BuildProfileResult> {
        this.isLoading$.next(true);

        const requestBody: any = {
            responseData,
            profileName,
            displayName: displayName || profileName,
            description: description || '',
            apiEndpoint: apiEndpoint || '',
            httpMethod,
            responseRootPath,
            detectTypes
        };

        if (objectTypeField) {
            requestBody.objectTypeField = objectTypeField;
        }

        return this.http.post<BuildProfileResult>(
            `${this.getProfilerBaseUrl()}/buildProfile`,
            requestBody,
            this.polariService.backendRequestOptions
        ).pipe(
            tap(result => {
                this.isLoading$.next(false);
                if (result.success && result.profile) {
                    // Add to stored profiles
                    const current = this.storedProfiles$.value;
                    const exists = current.find(p => p.profileName === result.profile!.profileName);
                    if (!exists) {
                        this.storedProfiles$.next([...current, result.profile]);
                    }
                }
            }),
            catchError(error => {
                this.isLoading$.next(false);
                const errorMsg = error?.error?.error || error?.message || 'Build profile failed';
                this.lastError$.next(errorMsg);
                return of({ success: false, error: errorMsg });
            })
        );
    }

    /**
     * Create a Polari class from a profile
     */
    createPolariClass(
        profileName?: string,
        profileData?: APIProfile,
        className?: string,
        registerCRUDE: boolean = true,
        isStateSpaceObject: boolean = true
    ): Observable<CreateClassResult> {
        this.isLoading$.next(true);

        const requestBody: any = {
            registerCRUDE,
            isStateSpaceObject
        };

        if (profileName) {
            requestBody.profileName = profileName;
        } else if (profileData) {
            requestBody.profileData = profileData;
        }

        if (className) {
            requestBody.className = className;
        }

        return this.http.post<CreateClassResult>(
            `${this.getProfilerBaseUrl()}/createPolariClass`,
            requestBody,
            this.polariService.backendRequestOptions
        ).pipe(
            tap(result => {
                this.isLoading$.next(false);
                if (result.success) {
                    // Refresh polari connection to pick up new class
                    console.log('[ApiProfilerService] Class created, refreshing connection...');
                    this.polariService.establishPolariConnection();
                }
            }),
            catchError(error => {
                this.isLoading$.next(false);
                const errorMsg = error?.error?.error || error?.message || 'Create class failed';
                this.lastError$.next(errorMsg);
                return of({ success: false, error: errorMsg });
            })
        );
    }

    /**
     * Detect multiple object types in response data
     */
    detectTypes(
        responseData: any,
        typeField?: string,
        similarityThreshold: number = 0.7
    ): Observable<{ success: boolean; typeCount: number; detectedTypes: DetectedType[]; error?: string }> {
        this.isLoading$.next(true);

        const requestBody: any = {
            responseData,
            similarityThreshold
        };

        if (typeField) {
            requestBody.typeField = typeField;
        }

        return this.http.post<any>(
            `${this.getProfilerBaseUrl()}/detectTypes`,
            requestBody,
            this.polariService.backendRequestOptions
        ).pipe(
            tap(() => this.isLoading$.next(false)),
            catchError(error => {
                this.isLoading$.next(false);
                const errorMsg = error?.error?.error || error?.message || 'Detect types failed';
                this.lastError$.next(errorMsg);
                return of({ success: false, typeCount: 0, detectedTypes: [], error: errorMsg });
            })
        );
    }

    /**
     * Clear the last error
     */
    clearError(): void {
        this.lastError$.next('');
    }

    /**
     * Clear the last query result
     */
    clearQueryResult(): void {
        this.lastQueryResult$.next(null);
    }

    // ============================================================================
    // API DOMAIN MANAGEMENT METHODS
    // ============================================================================

    /**
     * Get the API Domain base URL
     */
    private getDomainBaseUrl(): string {
        return `${this.polariService.getBackendBaseUrl()}/apiDomain`;
    }

    /**
     * Load all stored API domains from backend (includes common pre-defined domains)
     */
    loadDomains(): void {
        this.http.get<any>(this.getDomainBaseUrl(), this.polariService.backendRequestOptions)
            .pipe(
                catchError(error => {
                    console.error('[ApiProfilerService] Failed to load domains:', error);
                    return of({ success: false, domains: [] });
                })
            )
            .subscribe(response => {
                if (response?.success && response?.domains) {
                    this.storedDomains$.next(response.domains);
                }
            });
    }

    /**
     * Get a specific API domain by name or ID
     */
    getDomain(nameOrId: string): Observable<{ success: boolean; domain?: APIDomain; isCommon?: boolean; error?: string }> {
        return this.http.get<any>(
            `${this.getDomainBaseUrl()}/${nameOrId}`,
            this.polariService.backendRequestOptions
        ).pipe(
            catchError(error => {
                const errorMsg = error?.error?.error || error?.message || 'Get domain failed';
                return of({ success: false, error: errorMsg });
            })
        );
    }

    /**
     * Create a new API domain
     */
    createDomain(domain: Partial<APIDomain>): Observable<{ success: boolean; domain?: APIDomain; error?: string }> {
        this.isLoading$.next(true);

        return this.http.post<any>(
            this.getDomainBaseUrl(),
            domain,
            this.polariService.backendRequestOptions
        ).pipe(
            tap(result => {
                this.isLoading$.next(false);
                if (result.success && result.domain) {
                    // Add to stored domains
                    const current = this.storedDomains$.value;
                    this.storedDomains$.next([...current, result.domain]);
                }
            }),
            catchError(error => {
                this.isLoading$.next(false);
                const errorMsg = error?.error?.error || error?.message || 'Create domain failed';
                this.lastError$.next(errorMsg);
                return of({ success: false, error: errorMsg });
            })
        );
    }

    /**
     * Update an existing API domain
     */
    updateDomain(nameOrId: string, domain: Partial<APIDomain>): Observable<{ success: boolean; domain?: APIDomain; error?: string }> {
        this.isLoading$.next(true);

        return this.http.put<any>(
            `${this.getDomainBaseUrl()}/${nameOrId}`,
            domain,
            this.polariService.backendRequestOptions
        ).pipe(
            tap(result => {
                this.isLoading$.next(false);
                if (result.success && result.domain) {
                    // Update in stored domains
                    const current = this.storedDomains$.value;
                    const index = current.findIndex(d => d.name === nameOrId || (d.id && d.id.toString() === nameOrId));
                    if (index >= 0) {
                        current[index] = result.domain;
                        this.storedDomains$.next([...current]);
                    }
                }
            }),
            catchError(error => {
                this.isLoading$.next(false);
                const errorMsg = error?.error?.error || error?.message || 'Update domain failed';
                this.lastError$.next(errorMsg);
                return of({ success: false, error: errorMsg });
            })
        );
    }

    /**
     * Delete an API domain
     */
    deleteDomain(nameOrId: string): Observable<{ success: boolean; message?: string; error?: string; usingEndpoints?: string[] }> {
        this.isLoading$.next(true);

        return this.http.delete<any>(
            `${this.getDomainBaseUrl()}/${nameOrId}`,
            this.polariService.backendRequestOptions
        ).pipe(
            tap(result => {
                this.isLoading$.next(false);
                if (result.success) {
                    // Remove from stored domains
                    const current = this.storedDomains$.value;
                    this.storedDomains$.next(
                        current.filter(d => d.name !== nameOrId && (!d.id || d.id.toString() !== nameOrId))
                    );
                }
            }),
            catchError(error => {
                this.isLoading$.next(false);
                const errorMsg = error?.error?.error || error?.message || 'Delete domain failed';
                this.lastError$.next(errorMsg);
                return of({ success: false, error: errorMsg });
            })
        );
    }

    /**
     * Get domain by name from the stored domains
     */
    getDomainByName(name: string): APIDomain | undefined {
        return this.storedDomains$.value.find(d => d.name === name);
    }

    /**
     * Build a full URL from a domain and endpoint path
     */
    buildUrlFromDomain(domainName: string, endpointPath: string): string {
        const domain = this.getDomainByName(domainName);
        if (!domain) return endpointPath;

        let path = endpointPath || '';
        if (path && !path.startsWith('/')) {
            path = '/' + path;
        }
        return (domain.baseUrl || '') + path;
    }

    // ============================================================================
    // API ENDPOINT MANAGEMENT METHODS
    // ============================================================================

    /**
     * Get the API Endpoint base URL
     */
    private getEndpointBaseUrl(): string {
        return `${this.polariService.getBackendBaseUrl()}/apiEndpoint`;
    }

    /**
     * Load all stored API endpoints from backend
     */
    loadEndpoints(): void {
        this.http.get<any>(this.getEndpointBaseUrl(), this.polariService.backendRequestOptions)
            .pipe(
                catchError(error => {
                    console.error('[ApiProfilerService] Failed to load endpoints:', error);
                    return of({ success: false, endpoints: [] });
                })
            )
            .subscribe(response => {
                if (response?.success && response?.endpoints) {
                    this.storedEndpoints$.next(response.endpoints);
                }
            });
    }

    /**
     * Get a specific API endpoint by name or ID
     */
    getEndpoint(nameOrId: string): Observable<{ success: boolean; endpoint?: APIEndpoint; error?: string }> {
        return this.http.get<any>(
            `${this.getEndpointBaseUrl()}/${nameOrId}`,
            this.polariService.backendRequestOptions
        ).pipe(
            catchError(error => {
                const errorMsg = error?.error?.error || error?.message || 'Get endpoint failed';
                return of({ success: false, error: errorMsg });
            })
        );
    }

    /**
     * Create a new API endpoint
     */
    createEndpoint(endpoint: Partial<APIEndpoint>): Observable<{ success: boolean; endpoint?: APIEndpoint; error?: string }> {
        this.isLoading$.next(true);

        return this.http.post<any>(
            this.getEndpointBaseUrl(),
            endpoint,
            this.polariService.backendRequestOptions
        ).pipe(
            tap(result => {
                this.isLoading$.next(false);
                if (result.success && result.endpoint) {
                    // Add to stored endpoints
                    const current = this.storedEndpoints$.value;
                    this.storedEndpoints$.next([...current, result.endpoint]);
                }
            }),
            catchError(error => {
                this.isLoading$.next(false);
                const errorMsg = error?.error?.error || error?.message || 'Create endpoint failed';
                this.lastError$.next(errorMsg);
                return of({ success: false, error: errorMsg });
            })
        );
    }

    /**
     * Update an existing API endpoint
     */
    updateEndpoint(nameOrId: string, endpoint: Partial<APIEndpoint>): Observable<{ success: boolean; endpoint?: APIEndpoint; error?: string }> {
        this.isLoading$.next(true);

        return this.http.put<any>(
            `${this.getEndpointBaseUrl()}/${nameOrId}`,
            endpoint,
            this.polariService.backendRequestOptions
        ).pipe(
            tap(result => {
                this.isLoading$.next(false);
                if (result.success && result.endpoint) {
                    // Update in stored endpoints
                    const current = this.storedEndpoints$.value;
                    const index = current.findIndex(ep => ep.name === nameOrId || (ep.id && ep.id.toString() === nameOrId));
                    if (index >= 0) {
                        current[index] = result.endpoint;
                        this.storedEndpoints$.next([...current]);
                    }
                }
            }),
            catchError(error => {
                this.isLoading$.next(false);
                const errorMsg = error?.error?.error || error?.message || 'Update endpoint failed';
                this.lastError$.next(errorMsg);
                return of({ success: false, error: errorMsg });
            })
        );
    }

    /**
     * Delete an API endpoint
     */
    deleteEndpoint(nameOrId: string): Observable<{ success: boolean; message?: string; error?: string }> {
        this.isLoading$.next(true);

        return this.http.delete<any>(
            `${this.getEndpointBaseUrl()}/${nameOrId}`,
            this.polariService.backendRequestOptions
        ).pipe(
            tap(result => {
                this.isLoading$.next(false);
                if (result.success) {
                    // Remove from stored endpoints
                    const current = this.storedEndpoints$.value;
                    this.storedEndpoints$.next(
                        current.filter(ep => ep.name !== nameOrId && (!ep.id || ep.id.toString() !== nameOrId))
                    );
                }
            }),
            catchError(error => {
                this.isLoading$.next(false);
                const errorMsg = error?.error?.error || error?.message || 'Delete endpoint failed';
                this.lastError$.next(errorMsg);
                return of({ success: false, error: errorMsg });
            })
        );
    }

    /**
     * Fetch data from an API endpoint
     */
    fetchFromEndpoint(
        endpointName: string,
        persist?: boolean,
        applyProfile: boolean = true
    ): Observable<FetchResult> {
        this.isLoading$.next(true);
        this.lastError$.next('');

        const requestBody: any = {};
        if (persist !== undefined) {
            requestBody.persist = persist;
        }
        requestBody.applyProfile = applyProfile;

        return this.http.post<FetchResult>(
            `${this.getEndpointBaseUrl()}/fetch/${endpointName}`,
            requestBody,
            this.polariService.backendRequestOptions
        ).pipe(
            tap(result => {
                this.isLoading$.next(false);
                this.lastFetchResult$.next(result);
                if (!result.success && result.error) {
                    this.lastError$.next(result.error);
                }
                // Refresh endpoints to get updated fetch status
                this.loadEndpoints();
            }),
            catchError(error => {
                this.isLoading$.next(false);
                const errorMsg = error?.error?.error || error?.message || 'Fetch failed';
                this.lastError$.next(errorMsg);
                return of({ success: false, error: errorMsg });
            })
        );
    }

    /**
     * Get fetch status for an endpoint
     */
    getFetchStatus(endpointName: string): Observable<{
        success: boolean;
        endpointName?: string;
        displayName?: string;
        url?: string;
        linkedProfileName?: string;
        persistData?: boolean;
        polariClassName?: string;
        lastFetchTime?: string;
        lastFetchSuccess?: boolean;
        lastFetchError?: string;
        lastResponseSample?: any;
        lastResponseFieldCount?: number;
        lastResponseRecordCount?: number;
        isActive?: boolean;
        error?: string;
    }> {
        return this.http.get<any>(
            `${this.getEndpointBaseUrl()}/fetch/${endpointName}`,
            this.polariService.backendRequestOptions
        ).pipe(
            catchError(error => {
                const errorMsg = error?.error?.error || error?.message || 'Get fetch status failed';
                return of({ success: false, error: errorMsg });
            })
        );
    }

    /**
     * Clear the last fetch result
     */
    clearFetchResult(): void {
        this.lastFetchResult$.next(null);
    }
}
