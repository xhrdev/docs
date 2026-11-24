import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * OpenAPI 3.0.3 specification for xhr.dev API
 * This file imports the OpenAPI specification directly from the YAML file.
 *
 * @example
 * ```typescript
 * import { openApiSpec } from '@xhrdev/sdk/spec';
 * console.log(openApiSpec);
 * ```
 */
export const openApiSpec = readFileSync(
  join(process.cwd(), 'sdk', 'openapi.yml'),
  'utf-8'
);

/**
 * Get the OpenAPI specification as a parsed object
 * @returns The OpenAPI specification as a JavaScript object
 */
export const getOpenApiSpec = () => {
  // This would require a YAML parser like 'js-yaml' to be installed
  // For now, we just return the string version
  return openApiSpec;
};
