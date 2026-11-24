#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Read the openapi.yml file
const openapiPath = join(projectRoot, 'sdk', 'openapi.yml');
const openapiContent = readFileSync(openapiPath, 'utf-8');

// Escape the content for use in a JavaScript string literal
const escapedContent = openapiContent
  .replace(/\\/g, '\\\\')  // Escape backslashes
  .replace(/`/g, '\\`');   // Escape backticks
  // Note: We don't escape $ signs as they're not needed in template literals for this use case

// Generate the TypeScript file content
const tsContent = `/**
 * OpenAPI 3.0.3 specification for xhr.dev API
 * This file contains the OpenAPI specification as a string literal.
 * Generated automatically from sdk/openapi.yml during build.
 *
 * @example
 * \`\`\`typescript
 * import { openApiSpec } from '@xhrdev/sdk/spec';
 * console.log(openApiSpec);
 * \`\`\`
 */

/**
 * OpenAPI specification as a string literal
 */
export const openApiSpec = \`${escapedContent}\`;

/**
 * Get the OpenAPI specification as a parsed object
 * @returns The OpenAPI specification as a JavaScript object
 */
export const getOpenApiSpec = () => {
  // This would require a YAML parser like 'js-yaml' to be installed
  // For now, we just return the string version
  return openApiSpec;
};
`;

// Write the generated file
const outputPath = join(projectRoot, 'sdk', 'spec-generated.ts');
writeFileSync(outputPath, tsContent, 'utf-8');

console.log('✅ Generated spec-generated.ts with OpenAPI string literal');
