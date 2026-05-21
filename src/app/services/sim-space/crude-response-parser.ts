/**
 * @cross-cutting
 * @tags @xc:render-shared
 * @consumers
 *   - Shape2DLibraryService, Style2DLibraryService
 *   - Mesh3DLibraryService, Material3DLibraryService
 *   - (future) any sim-space library service consuming auto-CRUDE GET
 * @impact-on-edit
 *   This unwraps Polari's auto-CRUDE response envelope, which has
 *   evolved historically. Match the canonical implementation in
 *   `services/table/table-definition.service.ts` (parseReadAllResponse).
 * @see /OVERLAP_MAP.md
 *
 * Polari's auto-CRUDE GET endpoints respond with a nested envelope:
 *
 *   [ { "<ClassName>": [
 *       {
 *         "class": "<ClassName>",
 *         "varsLimited": [...],
 *         "data": [ ...actual rows... ]
 *       }
 *   ] } ]
 *
 * This helper unwraps that to the flat row array — matching the
 * canonical pattern used by TableDefinitionService.parseReadAllResponse.
 *
 * Also tolerates a few historical variations so we don't blow up on
 * stale fixtures:
 *   - bare array of rows (oldest)
 *   - `{ data: [...] }` wrapper (legacy)
 */

export function parseCrudeReadAllResponse(response: any, className: string): any[] {
  // Outermost envelope: [{ "<ClassName>": [...] }]
  let unwrapped = response;
  if (
    Array.isArray(response) &&
    response.length === 1 &&
    response[0] &&
    response[0][className]
  ) {
    unwrapped = response[0];
  }
  // Standard auto-CRUDE: { "<ClassName>": [ { class, varsLimited, data: [...] } ] }
  if (unwrapped && unwrapped[className]) {
    const classData = unwrapped[className];
    if (Array.isArray(classData)) {
      const instances: any[] = [];
      for (const dataSet of classData) {
        if (dataSet && Array.isArray(dataSet.data)) {
          instances.push(...dataSet.data);
        } else if (dataSet && dataSet.id !== undefined) {
          // Some endpoints emit instances directly under the class key.
          instances.push(dataSet);
        }
      }
      return instances;
    }
    // Object map of { id: row } — flatten.
    if (classData && typeof classData === 'object') {
      return Object.entries(classData).map(([id, row]: [string, any]) => ({ id, ...row }));
    }
  }
  // Legacy: bare array of rows.
  if (Array.isArray(response)) {
    return response;
  }
  // Legacy: { data: [...] }.
  if (response && Array.isArray(response.data)) {
    return response.data;
  }
  return [];
}
