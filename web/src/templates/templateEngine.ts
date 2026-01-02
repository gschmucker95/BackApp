export type TemplateVars = Record<string, any>;

/**
 * Interpolates a template string by replacing `{{ ... }}` placeholders with values
 * from the provided variables object.
 *
 * Placeholders support simple identifiers and dotted paths:
 * - `{{name}}`
 * - `{{user.email}}`
 *
 * If the resolved value is `null` or `undefined`, the placeholder is replaced with
 * an empty string.
 *
 * @param template - Template text containing `{{key}}` placeholders.
 * @param vars - Variables object used for placeholder lookups.
 * @returns The interpolated string.
 */
export function interpolate(template: string, vars: TemplateVars): string {
  return template.replace(/{{\s*([\w\.]+)\s*}}/g, (_, key) => {
    const value = key.split('.').reduce<any>((acc, k) => (acc ? acc[k] : undefined), vars);
    return value !== undefined && value !== null ? String(value) : '';
  });
}

/**
 * Computes derived variables from a base `vars` object using a map of expressions.
 *
 * Each entry in `computed` produces a new key on the returned object.
 * Supported expression forms:
 * - Simple interpolation: any string that may contain `{{key}}` placeholders.
 *   Example: `{ greeting: "Hello {{user.name}}" }`
 * - `dirname` helper: `{{ dirname some.path }}` extracts the directory portion of
 *   a string path (based on the last `/`).
 *   Example: `{ dir: "{{dirname user.filePath}}" }`
 *
 * Notes:
 * - Derived values are computed against the original `vars` (not incrementally
 *   against previously computed keys).
 * - If `dirname` is applied to a non-string value, the derived value is `""`.
 *
 * @param vars - Base variables used for lookups.
 * @param computed - Map of derived keys to expression strings.
 * @returns A new object containing `vars` plus the computed derived values.
 */
export function computeDerived(vars: TemplateVars, computed: Record<string, string>): TemplateVars {
  const out: TemplateVars = { ...vars };
  for (const [k, expr] of Object.entries(computed || {})) {
    // Support {{dirname var}} helper or simple interpolation
    const dirnameMatch = expr.match(/{{\s*dirname\s+([\w\.]+)\s*}}/);
    if (dirnameMatch) {
      const key = dirnameMatch[1];
      const value = key.split('.').reduce<any>((acc, kk) => (acc ? acc[kk] : undefined), vars);
      if (typeof value === 'string') {
        const idx = value.lastIndexOf('/');
        out[k] = idx > 0 ? value.substring(0, idx) : '/';
      } else {
        out[k] = '';
      }
    } else {
      out[k] = interpolate(expr, vars);
    }
  }
  return out;
}
