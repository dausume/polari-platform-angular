// api-profiler.component.ts
// ==============================================================================
// API PROFILER COMPONENT
// ==============================================================================
// Provides a UI for:
// - Querying external APIs
// - Analyzing response structures
// - Matching against profiles
// - Building new profiles
// - Creating Polari classes from profiles
// ==============================================================================

import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import {
    ApiProfilerService,
    QueryResult,
    ProfileMatch,
    DetectedType,
    APIProfile,
    APIDomain,
    APIEndpoint,
    FetchResult,
    BuildProfileResult,
    CreateClassResult
} from '../../services/api-profiler.service';

interface HeaderEntry {
    key: string;
    value: string;
}

@Component({
    selector: 'app-api-profiler',
    templateUrl: './api-profiler.component.html',
    styleUrls: ['./api-profiler.component.scss']
})
export class ApiProfilerComponent implements OnInit, OnDestroy {

    // Tab state
    activeTab: 'query' | 'analyze' | 'profiles' | 'endpoints' | 'create' = 'query';

    // Query form state
    queryUrl: string = '';
    queryMethod: string = 'GET';
    queryHeaders: HeaderEntry[] = [{ key: '', value: '' }];
    queryBody: string = '';
    responseRootPath: string = '';
    matchProfiles: boolean = true;
    autoCreateProfile: boolean = false;
    newProfileName: string = '';

    // HTTP methods
    httpMethods: string[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

    // Results state
    queryResult: QueryResult | null = null;
    lastResponse: any = null;
    matches: ProfileMatch[] = [];
    detectedTypes: DetectedType[] = [];

    // Profile builder state
    profileName: string = '';
    profileDisplayName: string = '';
    profileDescription: string = '';
    detectMultipleTypes: boolean = false;
    typeField: string = '';
    builtProfile: APIProfile | null = null;

    // Create class state
    selectedProfile: APIProfile | null = null;
    newClassName: string = '';
    registerCRUDE: boolean = true;
    isStateSpaceObject: boolean = true;
    createClassResult: CreateClassResult | null = null;

    // UI state
    isLoading: boolean = false;
    error: string = '';
    responseExpanded: boolean = false;
    analysisExpanded: boolean = true;
    formatAnalysisExpanded: boolean = true;  // API Format Analysis section
    recordsAnalysisExpanded: boolean = true;  // Data Records Analysis section
    matchesExpanded: boolean = true;
    formatTemplatesExpanded: boolean = true;  // Show format templates by default
    expandedProfiles: Set<string> = new Set();
    expandedMatches: Set<string> = new Set();  // Track which match cards are expanded
    previewingProfile: APIProfile | null = null;
    detectedFieldsExpanded: boolean = false;
    selectedFormatProfile: string | null = null;

    // Stored profiles
    storedProfiles: APIProfile[] = [];
    availableTemplates: string[] = [];

    // Domain management state
    storedDomains: APIDomain[] = [];
    showAddDomain: boolean = false;
    newDomainForm: Partial<APIDomain> = this.getEmptyDomainForm();

    // Endpoint management state
    storedEndpoints: APIEndpoint[] = [];
    editingEndpoint: APIEndpoint | null = null;
    endpointForm: Partial<APIEndpoint> = this.getEmptyEndpointForm();
    showAuthConfig: boolean = false;
    fetchResult: FetchResult | null = null;
    expandedEndpointSamples: Set<string> = new Set();

    // Subscriptions
    private subscriptions: Subscription[] = [];

    constructor(private profilerService: ApiProfilerService) {}

    ngOnInit(): void {
        // Subscribe to service state
        this.subscriptions.push(
            this.profilerService.isLoading$.subscribe(loading => this.isLoading = loading)
        );
        this.subscriptions.push(
            this.profilerService.lastError$.subscribe(error => this.error = error)
        );
        this.subscriptions.push(
            this.profilerService.storedProfiles$.subscribe(profiles => this.storedProfiles = profiles)
        );
        this.subscriptions.push(
            this.profilerService.availableTemplates$.subscribe(templates => this.availableTemplates = templates)
        );
        this.subscriptions.push(
            this.profilerService.storedDomains$.subscribe(domains => this.storedDomains = domains)
        );
        this.subscriptions.push(
            this.profilerService.storedEndpoints$.subscribe(endpoints => this.storedEndpoints = endpoints)
        );
        this.subscriptions.push(
            this.profilerService.lastFetchResult$.subscribe(result => this.fetchResult = result)
        );
    }

    ngOnDestroy(): void {
        this.subscriptions.forEach(sub => sub.unsubscribe());
    }

    // ============================================================================
    // Tab Navigation
    // ============================================================================

    setActiveTab(tab: 'query' | 'analyze' | 'profiles' | 'endpoints' | 'create'): void {
        this.activeTab = tab;
    }

    // ============================================================================
    // Query Tab Methods
    // ============================================================================

    addHeader(): void {
        this.queryHeaders.push({ key: '', value: '' });
    }

    removeHeader(index: number): void {
        if (this.queryHeaders.length > 1) {
            this.queryHeaders.splice(index, 1);
        }
    }

    getHeadersObject(): { [key: string]: string } {
        const headers: { [key: string]: string } = {};
        this.queryHeaders.forEach(h => {
            if (h.key.trim()) {
                headers[h.key.trim()] = h.value;
            }
        });
        return headers;
    }

    executeQuery(): void {
        if (!this.queryUrl.trim()) {
            this.error = 'Please enter a URL';
            return;
        }

        this.clearError();
        this.queryResult = null;
        this.matches = [];

        const profileName = this.autoCreateProfile && this.newProfileName.trim()
            ? this.newProfileName.trim()
            : undefined;

        let body: any = undefined;
        if (this.queryBody.trim()) {
            try {
                body = JSON.parse(this.queryBody);
            } catch (e) {
                body = this.queryBody;
            }
        }

        this.profilerService.queryExternalApi(
            this.queryUrl,
            this.queryMethod,
            this.getHeadersObject(),
            body,
            this.responseRootPath,
            this.matchProfiles,
            profileName
        ).subscribe(result => {
            this.queryResult = result;
            if (result.success) {
                this.lastResponse = result.response;
                this.matches = result.matches || [];
                if (result.profile) {
                    this.builtProfile = result.profile;
                }
            }
        });
    }

    // ============================================================================
    // Analyze Tab Methods
    // ============================================================================

    analyzeResponse(): void {
        if (!this.lastResponse) {
            this.error = 'No response data to analyze. Execute a query first.';
            return;
        }

        this.clearError();
        this.detectedTypes = [];

        this.profilerService.detectTypes(
            this.lastResponse,
            this.typeField.trim() || undefined,
            0.7
        ).subscribe(result => {
            if (result.success) {
                this.detectedTypes = result.detectedTypes;
            }
        });
    }

    matchAgainstProfiles(): void {
        if (!this.lastResponse) {
            this.error = 'No response data to match. Execute a query first.';
            return;
        }

        this.clearError();

        this.profilerService.matchResponse(
            this.lastResponse,
            undefined,
            true
        ).subscribe(result => {
            if (result.success) {
                this.matches = result.matches;
            }
        });
    }

    // ============================================================================
    // Profile Tab Methods
    // ============================================================================

    buildProfile(): void {
        if (!this.lastResponse) {
            this.error = 'No response data. Execute a query first.';
            return;
        }

        if (!this.profileName.trim()) {
            this.error = 'Please enter a profile name';
            return;
        }

        this.clearError();
        this.builtProfile = null;

        this.profilerService.buildProfile(
            this.lastResponse,
            this.profileName.trim(),
            this.profileDisplayName.trim() || undefined,
            this.profileDescription.trim() || undefined,
            this.queryUrl,
            this.queryMethod,
            this.responseRootPath,
            this.detectMultipleTypes,
            this.typeField.trim() || undefined
        ).subscribe(result => {
            if (result.success && result.profile) {
                this.builtProfile = result.profile;
            }
        });
    }

    selectProfile(profile: APIProfile): void {
        this.selectedProfile = profile;
        this.newClassName = profile.profileName;
        this.setActiveTab('create');
    }

    // ============================================================================
    // Create Class Tab Methods
    // ============================================================================

    createClass(): void {
        if (!this.selectedProfile && !this.builtProfile) {
            this.error = 'No profile selected. Build or select a profile first.';
            return;
        }

        this.clearError();
        this.createClassResult = null;

        const profile = this.selectedProfile || this.builtProfile;

        this.profilerService.createPolariClass(
            profile?.profileName,
            undefined,
            this.newClassName.trim() || undefined,
            this.registerCRUDE,
            this.isStateSpaceObject
        ).subscribe(result => {
            this.createClassResult = result;
        });
    }

    // ============================================================================
    // Utility Methods
    // ============================================================================

    clearError(): void {
        this.error = '';
        this.profilerService.clearError();
    }

    clearResults(): void {
        this.queryResult = null;
        this.lastResponse = null;
        this.matches = [];
        this.detectedTypes = [];
        this.builtProfile = null;
        this.createClassResult = null;
        this.profilerService.clearQueryResult();
    }

    formatJson(obj: any): string {
        try {
            return JSON.stringify(obj, null, 2);
        } catch {
            return String(obj);
        }
    }

    /**
     * Get object keys as an array for template iteration
     */
    getObjectKeys(obj: any): string[] {
        if (!obj) return [];
        return Object.keys(obj).sort((a, b) => parseInt(a) - parseInt(b));
    }

    copyToClipboard(text: string): void {
        navigator.clipboard.writeText(text).then(() => {
            console.log('Copied to clipboard');
        });
    }

    useResponseForProfile(): void {
        if (this.queryResult?.profile) {
            this.builtProfile = this.queryResult.profile;
            this.selectedProfile = this.queryResult.profile;
            this.newClassName = this.queryResult.profile.profileName;
        }
    }

    /**
     * Get CSS class based on match category
     */
    getMatchCategoryClass(match: ProfileMatch): string {
        if (match.matchCategory === 'Match') return 'match-full';
        if (match.matchCategory === 'Partial Match') return 'match-partial';
        return 'match-none';
    }

    /**
     * Get count of full matches
     */
    getMatchCount(): number {
        return this.matches.filter(m => m.matchCategory === 'Match').length;
    }

    /**
     * Get count of partial matches
     */
    getPartialMatchCount(): number {
        return this.matches.filter(m => m.matchCategory === 'Partial Match').length;
    }

    /**
     * Legacy method for backwards compatibility
     * @deprecated Use getMatchCategoryClass instead
     */
    getMatchClass(confidence: number): string {
        if (confidence >= 80) return 'match-high';
        if (confidence >= 60) return 'match-medium';
        return 'match-low';
    }

    // ============================================================================
    // Match Expansion and Signature Display Methods
    // ============================================================================

    /**
     * Toggle expansion of a match card to show signature details
     */
    toggleMatchExpanded(match: ProfileMatch): void {
        const key = match.profileName;
        if (this.expandedMatches.has(key)) {
            this.expandedMatches.delete(key);
        } else {
            this.expandedMatches.add(key);
        }
    }

    /**
     * Check if a match card is expanded
     */
    isMatchExpanded(match: ProfileMatch): boolean {
        return this.expandedMatches.has(match.profileName);
    }

    /**
     * Get type signature match summary string
     */
    getTypeSignatureSummary(match: ProfileMatch): string {
        const matched = match.matchedTypeSignatures || 0;
        const total = match.totalTypeSignatures || 0;
        return `${matched}/${total}`;
    }

    /**
     * Get field signature match summary string
     */
    getFieldSignatureSummary(match: ProfileMatch): string {
        const matched = match.matchedFieldSignatures || 0;
        const total = match.totalFieldSignatures || 0;
        return `${matched}/${total}`;
    }

    /**
     * Get CSS class for signature match status
     */
    getSignatureMatchClass(matched: boolean, isExtra?: boolean): string {
        if (isExtra) return 'signature-extra';
        return matched ? 'signature-matched' : 'signature-missing';
    }

    /**
     * Format a type signature for display
     */
    formatTypeSignature(sig: any): string {
        if (!sig) return '';
        const level = sig.level !== undefined ? `L${sig.level}` : '';
        const expected = sig.expected || '(none)';
        const found = sig.found || '(not found)';
        return `${level}: ${expected}`;
    }

    /**
     * Get type signatures grouped by level from a match
     */
    getTypeSignaturesByLevel(match: ProfileMatch): any[] {
        return match.typeSignatureMatches || [];
    }

    /**
     * Get field signatures grouped by level from a match
     * Returns only expected fields (not extra ones)
     */
    getFieldSignaturesByLevel(match: ProfileMatch): any[] {
        const sigs = match.fieldSignatureMatches || [];
        return sigs.filter(s => !s.extra);
    }

    /**
     * Get extra (unexpected) fields from a match
     */
    getExtraFields(match: ProfileMatch): any[] {
        const sigs = match.fieldSignatureMatches || [];
        return sigs.filter(s => s.extra);
    }

    /**
     * Group signatures by level for display
     */
    groupSignaturesByLevel(signatures: any[]): { [level: number]: any[] } {
        const grouped: { [level: number]: any[] } = {};
        for (const sig of signatures) {
            const level = sig.level || 0;
            if (!grouped[level]) {
                grouped[level] = [];
            }
            grouped[level].push(sig);
        }
        return grouped;
    }

    /**
     * Get levels from grouped signatures
     */
    getLevels(grouped: { [level: number]: any[] }): number[] {
        return Object.keys(grouped).map(Number).sort((a, b) => a - b);
    }

    trackByKey(index: number, item: HeaderEntry): number {
        return index;
    }

    trackByProfileName(index: number, item: APIProfile): string {
        return item.profileName;
    }

    trackByTypeId(index: number, item: DetectedType): string {
        return item.typeId;
    }

    trackByEndpointName(index: number, item: APIEndpoint): string {
        return item.name;
    }

    // ============================================================================
    // Profile Schema Generation Methods
    // ============================================================================

    /**
     * Generate an abstract schema representation of a profile
     * Shows the structure at each nesting level based on type and field signatures
     */
    generateProfileSchema(profile: APIProfile | null): string {
        if (!profile) return '';

        const fieldSigs = profile.fieldSignatures || {};
        const typeSigs = profile.typeSignatures || {};
        const totalFields = profile.totalFieldSignatures || 0;
        const totalLevels = profile.totalTypeSignatures || Object.keys(typeSigs).length;

        if (totalFields === 0 && totalLevels === 0) {
            return '// No structure detected';
        }

        const schemaLines: string[] = [];
        schemaLines.push(`// Structure: ${totalLevels} levels, ${totalFields} total fields`);
        schemaLines.push('');

        // Build schema based on type signatures at each level
        const levels = Object.keys(typeSigs).map(Number).sort((a, b) => a - b);

        for (const level of levels) {
            const typeAtLevel = typeSigs[level];
            const fieldsAtLevel = fieldSigs[level] || [];
            const indent = '  '.repeat(level);

            schemaLines.push(`${indent}// Level ${level}: ${typeAtLevel}`);

            if (fieldsAtLevel.length > 0) {
                if (fieldsAtLevel.length <= 5) {
                    schemaLines.push(`${indent}// Fields: ${fieldsAtLevel.join(', ')}`);
                } else {
                    const preview = fieldsAtLevel.slice(0, 3).join(', ');
                    schemaLines.push(`${indent}// Fields: ${preview}, ... (${fieldsAtLevel.length} total)`);
                }
            }
        }

        schemaLines.push('');

        // Build visual representation based on root type
        // typeSigs[0] is now an array, get the first type or 'unknown'
        const rootTypes = typeSigs[0] || [];
        const rootType = Array.isArray(rootTypes) ? (rootTypes[0] || 'unknown') : rootTypes;

        if (rootType.startsWith('list')) {
            schemaLines.push('[');
            const itemFields = fieldSigs[1] || [];
            if (itemFields.length > 0) {
                schemaLines.push('  {');
                itemFields.slice(0, 4).forEach((field, i) => {
                    const comma = i < Math.min(itemFields.length - 1, 3) ? ',' : '';
                    schemaLines.push(`    "${field}": <type>${comma}`);
                });
                if (itemFields.length > 4) {
                    schemaLines.push(`    // ... ${itemFields.length - 4} more fields`);
                }
                schemaLines.push(`  },  // ${itemFields.length} fields per item`);
            } else {
                schemaLines.push('  { ... },');
            }
            schemaLines.push('  ...');
            schemaLines.push(']');
        } else if (rootType === 'dict') {
            schemaLines.push('{');
            const rootFields = fieldSigs[0] || [];
            rootFields.slice(0, 4).forEach((field, i) => {
                const comma = i < Math.min(rootFields.length - 1, 3) ? ',' : '';
                schemaLines.push(`  "${field}": <type>${comma}`);
            });
            if (rootFields.length > 4) {
                schemaLines.push(`  // ... ${rootFields.length - 4} more fields`);
            }
            schemaLines.push('}');
        } else {
            schemaLines.push(`// Root type: ${rootType}`);
        }

        return schemaLines.join('\n');
    }

    /**
     * Get all fields from a profile across all nesting levels
     */
    getAllFieldsFromProfile(profile: APIProfile | null): string[] {
        if (!profile || !profile.fieldSignatures) return [];

        const allFields: string[] = [];
        const fieldSigs = profile.fieldSignatures;

        for (const level of Object.keys(fieldSigs)) {
            allFields.push(...fieldSigs[Number(level)]);
        }

        return allFields;
    }

    /**
     * Get field count from profile (uses totalFieldSignatures)
     */
    getProfileFieldCount(profile: APIProfile | null): number {
        if (!profile) return 0;
        return profile.totalFieldSignatures || 0;
    }

    /**
     * Convert a type name to schema notation
     */
    getTypeSchemaNotation(typeName: string): string {
        if (!typeName) return '<any>';

        const lowerType = typeName.toLowerCase();

        // Handle common Python/JS types
        if (lowerType.includes('str') || lowerType === 'string') {
            return '<str>';
        }
        if (lowerType.includes('int') || lowerType === 'integer') {
            return '<int>';
        }
        if (lowerType.includes('float') || lowerType === 'number' || lowerType === 'double') {
            return '<float>';
        }
        if (lowerType.includes('bool') || lowerType === 'boolean') {
            return '<bool>';
        }
        if (lowerType.includes('list') || lowerType === 'array') {
            return '[...]';
        }
        if (lowerType.includes('dict') || lowerType === 'object') {
            return '{...}';
        }
        if (lowerType === 'none' || lowerType === 'null' || lowerType === 'nonetype') {
            return '<null>';
        }
        if (lowerType.includes('date') || lowerType.includes('time')) {
            return '<datetime>';
        }

        return `<${typeName}>`;
    }

    /**
     * Get a friendly display name for a type
     */
    getTypeDisplayName(typeName: string): string {
        if (!typeName) return 'unknown';

        const lowerType = typeName.toLowerCase();

        const typeMap: { [key: string]: string } = {
            'str': 'string',
            'int': 'integer',
            'float': 'float',
            'bool': 'boolean',
            'list': 'array',
            'dict': 'object',
            'nonetype': 'null',
            'none': 'null'
        };

        return typeMap[lowerType] || typeName;
    }

    /**
     * Select a format template/profile
     */
    selectFormatTemplate(templateType: string): void {
        this.selectedFormatProfile = templateType;
        this.responseRootPath = this.getFormatProfileRootPath(templateType);
        console.log(`[ApiProfiler] Selected ${templateType} format. Root path: ${this.responseRootPath || '(root)'}`);
    }

    /**
     * Get the root path for a format profile
     */
    getFormatProfileRootPath(profileType: string): string {
        const paths: { [key: string]: string } = {
            'uniformArray': '',
            'singleObject': '',
            'wrappedResponse': 'data',
            'geoJson': 'features',
            'paginated': 'results',
            'hal': '_embedded.items',
            'graphql': 'data',
            'polariCrude': 'instances'
        };
        return paths[profileType] || '';
    }

    /**
     * Get display name for a format profile
     */
    getFormatProfileDisplayName(profileType: string): string {
        const names: { [key: string]: string } = {
            'uniformArray': 'Uniform Object Array',
            'singleObject': 'Single Object',
            'wrappedResponse': 'Wrapped Response',
            'geoJson': 'GeoJSON FeatureCollection',
            'paginated': 'Paginated Response',
            'hal': 'HAL+JSON',
            'graphql': 'GraphQL Response',
            'polariCrude': 'Polari CRUDE'
        };
        return names[profileType] || profileType;
    }

    /**
     * Navigate to Endpoints tab with selected profile
     */
    goToEndpointsWithProfile(): void {
        if (this.selectedFormatProfile) {
            // Pre-fill the endpoint form with the profile's root path and link the format profile
            this.endpointForm.responseRootPath = this.getFormatProfileRootPath(this.selectedFormatProfile);
            // Use the format profile key prefixed with 'format:' to distinguish from stored profiles
            this.endpointForm.linkedProfileName = `format:${this.selectedFormatProfile}`;
        }
        this.setActiveTab('endpoints');
    }

    /**
     * Get the list of format profile keys for the dropdown
     */
    getFormatProfileKeys(): string[] {
        return ['uniformArray', 'wrappedResponse', 'geoJson', 'paginated', 'hal', 'graphql', 'polariCrude', 'singleObject'];
    }

    /**
     * Check if a linked profile name refers to a format profile
     */
    isFormatProfile(linkedProfileName: string): boolean {
        return linkedProfileName?.startsWith('format:') || false;
    }

    /**
     * Get display name for a linked profile (handles both format and stored profiles)
     */
    getLinkedProfileDisplayName(linkedProfileName: string): string {
        if (!linkedProfileName) return 'None';
        if (linkedProfileName.startsWith('format:')) {
            const formatKey = linkedProfileName.replace('format:', '');
            return this.getFormatProfileDisplayName(formatKey);
        }
        // Look for stored profile
        const storedProfile = this.storedProfiles.find(p => p.profileName === linkedProfileName);
        return storedProfile?.displayName || storedProfile?.profileName || linkedProfileName;
    }

    /**
     * Toggle profile expansion state
     */
    toggleProfileExpanded(profile: APIProfile): void {
        if (this.expandedProfiles.has(profile.profileName)) {
            this.expandedProfiles.delete(profile.profileName);
        } else {
            this.expandedProfiles.add(profile.profileName);
        }
    }

    /**
     * Check if a profile is expanded
     */
    isProfileExpanded(profile: APIProfile): boolean {
        return this.expandedProfiles.has(profile.profileName);
    }

    /**
     * Open profile preview
     */
    previewProfile(profile: APIProfile): void {
        this.previewingProfile = profile;
    }

    // ============================================================================
    // Endpoint Management Methods
    // ============================================================================

    getEmptyEndpointForm(): Partial<APIEndpoint> {
        return {
            name: '',
            displayName: '',
            description: '',
            domainName: '',
            endpointPath: '',
            url: '',  // Computed/legacy
            httpMethod: 'GET',
            defaultHeaders: {},
            bodyTemplate: '',
            responseRootPath: '',
            linkedProfileName: '',
            persistData: false,
            polariClassName: '',
            authType: 'none',
            authConfig: '',
            isActive: true
        };
    }

    getEmptyDomainForm(): Partial<APIDomain> {
        return {
            name: '',
            displayName: '',
            description: '',
            host: '',
            port: null,
            protocol: 'https',
            trustSelfSigned: false,
            customCertPath: '',
            verifySSL: true,
            tags: []
        };
    }

    getAuthLabel(): string {
        switch (this.endpointForm.authType) {
            case 'bearer': return 'Bearer Token';
            case 'apikey': return 'API Key (HeaderName:Value or just value)';
            case 'basic': return 'Username:Password';
            default: return 'Auth Value';
        }
    }

    getAuthPlaceholder(): string {
        switch (this.endpointForm.authType) {
            case 'bearer': return 'your-bearer-token';
            case 'apikey': return 'X-API-Key:your-api-key';
            case 'basic': return 'username:password';
            default: return '';
        }
    }

    saveEndpoint(): void {
        if (!this.endpointForm.name || !this.endpointForm.url) {
            this.error = 'Endpoint name and URL are required';
            return;
        }

        this.clearError();

        if (this.editingEndpoint) {
            // Update existing
            this.profilerService.updateEndpoint(
                this.editingEndpoint.name,
                this.endpointForm
            ).subscribe(result => {
                if (result.success) {
                    this.cancelEditEndpoint();
                }
            });
        } else {
            // Create new
            this.profilerService.createEndpoint(this.endpointForm).subscribe(result => {
                if (result.success) {
                    this.endpointForm = this.getEmptyEndpointForm();
                }
            });
        }
    }

    editEndpoint(endpoint: APIEndpoint): void {
        this.editingEndpoint = endpoint;
        this.endpointForm = {
            name: endpoint.name,
            displayName: endpoint.displayName,
            description: endpoint.description,
            domainName: endpoint.domainName || '',
            endpointPath: endpoint.endpointPath || '',
            url: endpoint.url,
            httpMethod: endpoint.httpMethod,
            defaultHeaders: endpoint.defaultHeaders || {},
            bodyTemplate: endpoint.bodyTemplate || '',
            responseRootPath: endpoint.responseRootPath,
            linkedProfileName: endpoint.linkedProfileName,
            persistData: endpoint.persistData,
            polariClassName: endpoint.polariClassName,
            authType: endpoint.authType || 'none',
            authConfig: '',  // Don't pre-fill auth (not returned from backend for security)
            isActive: endpoint.isActive
        };
        this.showAuthConfig = false;
    }

    cancelEditEndpoint(): void {
        this.editingEndpoint = null;
        this.endpointForm = this.getEmptyEndpointForm();
        this.showAuthConfig = false;
    }

    deleteEndpoint(endpoint: APIEndpoint): void {
        if (confirm(`Are you sure you want to delete endpoint "${endpoint.displayName || endpoint.name}"?`)) {
            this.profilerService.deleteEndpoint(endpoint.name).subscribe();
        }
    }

    fetchFromEndpoint(endpoint: APIEndpoint): void {
        this.clearError();
        this.profilerService.fetchFromEndpoint(endpoint.name).subscribe();
    }

    useEndpointForQuery(endpoint: APIEndpoint): void {
        // Populate the query form with endpoint data
        this.queryUrl = endpoint.url;
        this.queryMethod = endpoint.httpMethod;
        this.responseRootPath = endpoint.responseRootPath || '';

        // Convert defaultHeaders to array format
        this.queryHeaders = [];
        if (endpoint.defaultHeaders) {
            Object.entries(endpoint.defaultHeaders).forEach(([key, value]) => {
                this.queryHeaders.push({ key, value });
            });
        }
        if (this.queryHeaders.length === 0) {
            this.queryHeaders.push({ key: '', value: '' });
        }

        // Switch to query tab
        this.setActiveTab('query');
    }

    clearFetchResult(): void {
        this.fetchResult = null;
        this.profilerService.clearFetchResult();
    }

    formatDate(isoString: string): string {
        if (!isoString) return '';
        try {
            const date = new Date(isoString);
            return date.toLocaleString();
        } catch {
            return isoString;
        }
    }

    /**
     * Generate field schema from endpoint's sample response
     * Shows the actual field names as an intermediate abstraction
     */
    generateEndpointFieldSchema(endpoint: APIEndpoint): string {
        if (!endpoint.lastResponseSample) {
            return '// No sample data';
        }

        const sample = endpoint.lastResponseSample;
        const lines: string[] = [];

        // Determine if it's part of an array based on the profile
        const isArray = endpoint.linkedProfileName !== 'Single Object';

        if (isArray) {
            lines.push('[');
            lines.push('  {');
        } else {
            lines.push('{');
        }

        const indent = isArray ? '    ' : '  ';

        // Extract fields from sample
        if (typeof sample === 'object' && sample !== null) {
            const fields = Object.keys(sample);
            fields.forEach((field, index) => {
                const value = sample[field];
                const typeStr = this.inferTypeFromValue(value);
                const comma = index < fields.length - 1 ? ',' : '';
                lines.push(`${indent}"${field}": ${typeStr}${comma}`);
            });
        }

        if (isArray) {
            lines.push('  },');
            lines.push('  { ... },');
            lines.push('  ...');
            lines.push(']');
        } else {
            lines.push('}');
        }

        return lines.join('\n');
    }

    /**
     * Infer type notation from a value
     */
    inferTypeFromValue(value: any): string {
        if (value === null || value === undefined) {
            return '<null>';
        }
        if (typeof value === 'string') {
            // Check for common patterns
            if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
                return '<datetime>';
            }
            if (value.length > 50) {
                return '<str:long>';
            }
            return '<str>';
        }
        if (typeof value === 'number') {
            return Number.isInteger(value) ? '<int>' : '<float>';
        }
        if (typeof value === 'boolean') {
            return '<bool>';
        }
        if (Array.isArray(value)) {
            if (value.length === 0) {
                return '[...]';
            }
            const firstType = this.inferTypeFromValue(value[0]);
            return `[${firstType}, ...]`;
        }
        if (typeof value === 'object') {
            const keys = Object.keys(value);
            if (keys.length <= 2) {
                return `{${keys.join(', ')}}`;
            }
            return `{...${keys.length} fields}`;
        }
        return '<any>';
    }

    /**
     * Toggle endpoint sample visibility
     */
    toggleEndpointSample(endpoint: APIEndpoint): void {
        if (this.expandedEndpointSamples.has(endpoint.name)) {
            this.expandedEndpointSamples.delete(endpoint.name);
        } else {
            this.expandedEndpointSamples.add(endpoint.name);
        }
    }

    /**
     * Check if endpoint sample is expanded
     */
    isEndpointSampleExpanded(endpoint: APIEndpoint): boolean {
        return this.expandedEndpointSamples.has(endpoint.name);
    }

    // ============================================================================
    // Domain Management Methods
    // ============================================================================

    /**
     * Toggle add domain form visibility
     */
    toggleAddDomain(): void {
        this.showAddDomain = !this.showAddDomain;
        if (!this.showAddDomain) {
            this.newDomainForm = this.getEmptyDomainForm();
        }
    }

    /**
     * Generate a domain name from host and port
     */
    generateDomainName(): void {
        if (this.newDomainForm.host) {
            let name = this.newDomainForm.host.replace(/\./g, '-');
            if (this.newDomainForm.port) {
                name += `-${this.newDomainForm.port}`;
            }
            this.newDomainForm.name = name;
            if (!this.newDomainForm.displayName) {
                this.newDomainForm.displayName = `${this.newDomainForm.host}${this.newDomainForm.port ? ':' + this.newDomainForm.port : ''}`;
            }
        }
    }

    /**
     * Save a new domain
     */
    saveDomain(): void {
        if (!this.newDomainForm.name || !this.newDomainForm.host) {
            this.error = 'Domain name and host are required';
            return;
        }

        this.clearError();
        this.profilerService.createDomain(this.newDomainForm).subscribe(result => {
            if (result.success) {
                this.showAddDomain = false;
                this.newDomainForm = this.getEmptyDomainForm();
            }
        });
    }

    /**
     * Delete a domain
     */
    deleteDomain(domain: APIDomain): void {
        if (domain.isCommon) {
            this.error = 'Cannot delete pre-defined common domains';
            return;
        }
        if (confirm(`Are you sure you want to delete domain "${domain.displayName || domain.name}"?`)) {
            this.profilerService.deleteDomain(domain.name).subscribe(result => {
                if (!result.success && result.usingEndpoints) {
                    this.error = `Cannot delete domain - ${result.usingEndpoints.length} endpoint(s) are using it`;
                }
            });
        }
    }

    /**
     * Get domain display name for select
     */
    getDomainDisplayName(domain: APIDomain): string {
        const baseUrl = domain.baseUrl || `${domain.protocol}://${domain.host}${domain.port ? ':' + domain.port : ''}`;
        return `${domain.displayName || domain.name} (${baseUrl})`;
    }

    /**
     * Build preview URL from selected domain and path
     */
    getPreviewUrl(): string {
        if (!this.endpointForm.domainName) {
            return this.endpointForm.endpointPath || '';
        }
        const domain = this.storedDomains.find(d => d.name === this.endpointForm.domainName);
        if (!domain) {
            return this.endpointForm.endpointPath || '';
        }
        let path = this.endpointForm.endpointPath || '';
        if (path && !path.startsWith('/')) {
            path = '/' + path;
        }
        return (domain.baseUrl || '') + path;
    }

    /**
     * When domain selection changes, update the form
     */
    onDomainChange(): void {
        // Update URL preview
        this.endpointForm.url = this.getPreviewUrl();
    }

    /**
     * When endpoint path changes, update the URL preview
     */
    onEndpointPathChange(): void {
        this.endpointForm.url = this.getPreviewUrl();
    }

    /**
     * Get host type icon
     */
    getHostTypeIcon(hostType: string): string {
        switch (hostType) {
            case 'localhost': return 'computer';
            case 'ipv4': return 'router';
            case 'ipv6': return 'settings_ethernet';
            case 'domain': return 'language';
            default: return 'dns';
        }
    }
}
