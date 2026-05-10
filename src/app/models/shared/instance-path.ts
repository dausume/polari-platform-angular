// instance-path.ts
//
// Path-encoding helpers for cross-instance value-source paths.
//
// The value-source-selector's `from_object` branch carries a single
// `sourceObjectPath` string. Inside a no-code state, that path is typically
// `self.<field>` because the host has exactly one bound object instance.
// On the equations page (or any context where multiple instances of any
// class might be picked from), we need a path that also carries the class
// + identifier so the runtime can look up the right instance.
//
// Convention:
//   self.<field>                                — special-case for host-state's bound object
//   <ClassName>:<idField(,idField)>:<idVal(,idVal)>.<field>
//
// Examples:
//   self.input_expression
//   CalculusTester:id:42.input_expression
//   Order:order_id,user_id:o_456,u_789.total_amount
//
// The composite-id form supports classes that define their own identifier
// fields beyond `id` — multiple field names + values are comma-joined on
// each side of the second colon.

export interface InstancePathParts {
    /** `'self'` (special-case) or the className. */
    className: string;
    /** Identifier field name(s) — empty for `self`. */
    idFieldNames: string[];
    /** Identifier value(s), aligned with `idFieldNames`. */
    idValues: string[];
    /** Field on the resolved instance. */
    fieldName: string;
}

/**
 * Build a `sourceObjectPath` string from class + identifier + field metadata.
 * Pass `className: 'self'` to produce the `self.<field>` form.
 */
export function encodeInstancePath(parts: InstancePathParts): string {
    const fieldName = parts.fieldName || '';
    if (parts.className === 'self') {
        return fieldName ? `self.${fieldName}` : 'self';
    }
    const idFields = (parts.idFieldNames || []).join(',');
    const idVals = (parts.idValues || []).join(',');
    const ref = `${parts.className}:${idFields}:${idVals}`;
    return fieldName ? `${ref}.${fieldName}` : ref;
}

/**
 * Parse a `sourceObjectPath` back into its parts. Returns null on a path
 * that doesn't conform — caller should fall back to legacy interpretation.
 */
export function decodeInstancePath(path: string | undefined | null): InstancePathParts | null {
    if (!path) return null;

    // self.<field> short-form
    if (path === 'self' || path.startsWith('self.')) {
        return {
            className: 'self',
            idFieldNames: [],
            idValues: [],
            fieldName: path.startsWith('self.') ? path.slice(5) : '',
        };
    }

    // ClassName:idField(,idField):idVal(,idVal).field
    // The colons are class-and-identifier delimiters; the LAST dot separates
    // the field. (A field name shouldn't legitimately contain a dot.)
    const lastDot = path.lastIndexOf('.');
    if (lastDot < 0) return null;

    const fieldName = path.slice(lastDot + 1);
    const instanceRef = path.slice(0, lastDot);
    const colonParts = instanceRef.split(':');
    if (colonParts.length !== 3) return null;

    const [className, idFieldsStr, idValsStr] = colonParts;
    if (!className) return null;

    return {
        className,
        idFieldNames: idFieldsStr ? idFieldsStr.split(',') : [],
        idValues: idValsStr ? idValsStr.split(',') : [],
        fieldName,
    };
}

/**
 * Convenience: extract just the className from a `sourceObjectPath`.
 * Returns 'self' for self-paths, or the parsed className, or '' on failure.
 */
export function classNameFromPath(path: string | undefined | null): string {
    const parts = decodeInstancePath(path);
    return parts?.className || '';
}
