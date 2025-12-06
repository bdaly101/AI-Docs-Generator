import type { CommitInfo } from '../analyzer/git-diff.js';

/**
 * Context for generating README feature documentation.
 */
export interface FeatureContext {
  name: string;
  file: string;
  code: string;
  existingSections: string[];
}

/**
 * Context for generating API endpoint documentation.
 */
export interface APIContext {
  method: string;
  path: string;
  code: string;
  handlerName?: string;
}

/**
 * Context for generating JSDoc/TSDoc comments.
 */
export interface JSDocContext {
  code: string;
  signature: string;
  style: 'jsdoc' | 'tsdoc';
  existingComment?: string;
}

/**
 * Context for generating changelog entries.
 */
export interface ChangelogContext {
  commits: CommitInfo[];
  changedFiles: string[];
  previousVersion?: string;
}

/**
 * System prompts for different documentation types.
 */
export const SYSTEM_PROMPTS = {
  readme: `You are a technical documentation expert. Generate clear, concise README content.
- Use markdown formatting
- Be specific and actionable
- Include code examples where helpful
- Match the existing documentation style
- Keep explanations focused and practical`,

  apiDocs: `You are an API documentation specialist. Generate comprehensive API documentation.
- Document all parameters with types
- Include request/response examples
- Note any breaking changes
- Use consistent formatting
- Include error codes and their meanings`,

  jsdoc: `You are a code documentation expert. Generate JSDoc/TSDoc comments.
- Include @param tags with types and descriptions
- Include @returns with type and description
- Add @example when helpful for complex functions
- Include @throws for error conditions
- Be concise but complete
- Do not repeat type information if it's already in TypeScript`,

  changelog: `You are a changelog writer following Keep a Changelog format.
- Categorize changes: Added, Changed, Deprecated, Removed, Fixed, Security
- Write from user perspective
- Be specific about what changed
- Link to relevant issues/PRs when available
- Use present tense (Add, Fix, Change)`,
};

/**
 * Template functions for generating prompts with context.
 */
export const PROMPT_TEMPLATES = {
  /**
   * Generate prompt for README feature documentation.
   */
  readmeFeature: (context: FeatureContext): string => `
Analyze this new feature and generate a README section:

Feature Name: ${context.name}
File: ${context.file}

Code:
\`\`\`typescript
${context.code}
\`\`\`

Existing README sections:
${context.existingSections.length > 0 ? context.existingSections.join(', ') : 'None'}

Generate a documentation section that:
1. Explains what this feature does
2. Shows how to use it with a code example
3. Matches the style of existing documentation
4. Is concise but complete

Output only the markdown content for this section.
`,

  /**
   * Generate prompt for API endpoint documentation.
   */
  apiEndpoint: (context: APIContext): string => `
Generate API documentation for this endpoint:

Method: ${context.method}
Path: ${context.path}
${context.handlerName ? `Handler: ${context.handlerName}` : ''}

Handler Code:
\`\`\`typescript
${context.code}
\`\`\`

Include:
- Description of what this endpoint does
- Parameters (path, query, body) with types
- Response format with example
- Example request/response
- Error codes and their meanings

Output only the markdown documentation.
`,

  /**
   * Generate prompt for JSDoc/TSDoc comments.
   */
  jsdocComment: (context: JSDocContext): string => `
Generate a ${context.style} comment for this code:

\`\`\`typescript
${context.code}
\`\`\`

Function signature: ${context.signature}
${context.existingComment ? `\nExisting comment to improve:\n${context.existingComment}` : ''}

Requirements:
- Use ${context.style} style
- Include @param for each parameter
- Include @returns if applicable
- Include @throws if the function can throw
- Include @example if the function is complex
- Be concise but informative

Output only the JSDoc comment (starting with /** and ending with */).
`,

  /**
   * Generate prompt for changelog entries.
   */
  changelogEntry: (context: ChangelogContext): string => `
Generate changelog entries from these commits:

${context.commits.map((c) => `- ${c.hash.slice(0, 7)}: ${c.message}`).join('\n')}

Changed files:
${context.changedFiles.join('\n')}

${context.previousVersion ? `Previous version: ${context.previousVersion}` : ''}

Categorize into: Added, Changed, Fixed, Removed, Security
Write user-facing descriptions that explain the impact.
Do not include commit hashes in the output.

Output as JSON with this structure:
{
  "added": ["description1", "description2"],
  "changed": ["description1"],
  "fixed": ["description1"],
  "removed": [],
  "security": []
}
`,
};

/**
 * JSON schema for changelog entries response.
 */
export const CHANGELOG_SCHEMA = `{
  "added": ["string"],
  "changed": ["string"],
  "fixed": ["string"],
  "removed": ["string"],
  "security": ["string"]
}`;

/**
 * JSON schema for API documentation response.
 */
export const API_DOC_SCHEMA = `{
  "method": "string",
  "path": "string",
  "description": "string",
  "parameters": [{ "name": "string", "type": "string", "required": "boolean", "description": "string" }],
  "requestBody": { "type": "string", "example": "object" },
  "responses": [{ "status": "number", "description": "string", "example": "object" }]
}`;

