/**
 * @cross-cutting
 * @tags @xc:bindings
 * @consumers
 *   - services/api-profiler.service.ts (the HTTP surface these shapes
 *     describe)
 *   - components/api-profiler/api-profiler.component.ts
 * @impact-on-edit
 *   Moved out of api-profiler.service.ts (2026-07-14, object/interface
 *   placement audit) — no models/api-profiler/ existed before this.
 *   Add new profiling/matching/fetch response shapes here, not back
 *   in the service.
 * @see /OVERLAP_MAP.md
 *
 * API-profiling shapes: signature/level matching, profile build/match
 * results, domain/endpoint config, fetch results.
 */

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
    warnings?: string[];
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
