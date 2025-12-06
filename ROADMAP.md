# AI-Docs-Generator

> Auto-generate and update documentation from code changes using AI

## Project Overview

AI-Docs-Generator is a developer workflow tool that automatically generates, updates, and maintains documentation by analyzing code changes. It integrates with your Git workflow to keep README files, API docs, JSDoc/TSDoc comments, and CHANGELOG.md in sync with your codebase.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 20+ |
| Language | TypeScript |
| CLI Framework | Commander.js |
| AI Provider | Anthropic Claude API (claude-sonnet-4-5-20250929) |
| Git Integration | simple-git |
| AST Parsing | @typescript-eslint/parser, @babel/parser |
| File Watching | chokidar |
| Config | cosmiconfig |
| Testing | Vitest |
| Build | tsup |

---

## Architecture

```
ai-docs-generator/
├── src/
│   ├── cli/
│   │   ├── index.ts              # CLI entry point
│   │   └── commands/
│   │       ├── init.ts           # Initialize config
│   │       ├── generate.ts       # One-time generation
│   │       ├── watch.ts          # Watch mode
│   │       └── sync.ts           # Sync changelog from commits
│   ├── core/
│   │   ├── analyzer/
│   │   │   ├── git-diff.ts       # Parse git diffs
│   │   │   ├── ast-parser.ts     # Parse code AST
│   │   │   └── change-detector.ts # Detect meaningful changes
│   │   ├── generators/
│   │   │   ├── readme.ts         # README section generator
│   │   │   ├── api-docs.ts       # API documentation generator
│   │   │   ├── jsdoc.ts          # JSDoc/TSDoc comment generator
│   │   │   └── changelog.ts      # CHANGELOG generator
│   │   ├── ai/
│   │   │   ├── client.ts         # Anthropic client wrapper
│   │   │   ├── prompts.ts        # Prompt templates
│   │   │   └── context-builder.ts # Build context for AI
│   │   └── updater/
│   │       ├── file-writer.ts    # Safe file updates
│   │       └── merge-strategy.ts # Merge AI output with existing docs
│   ├── config/
│   │   ├── schema.ts             # Config validation schema
│   │   └── defaults.ts           # Default configuration
│   ├── utils/
│   │   ├── logger.ts             # Logging utility
│   │   ├── git.ts                # Git helpers
│   │   └── fs.ts                 # File system helpers
│   └── types/
│       └── index.ts              # TypeScript type definitions
├── templates/
│   ├── readme-section.hbs        # README templates
│   ├── api-endpoint.hbs          # API doc templates
│   └── changelog-entry.hbs       # Changelog templates
├── tests/
├── .aidocsrc.json                # Example config
├── package.json
└── tsconfig.json
```

---

## Implementation Phases

### Phase 1: Project Foundation

**Goal:** Set up the project structure, CLI skeleton, and configuration system.

#### Tasks

1. **Initialize project**
   ```bash
   mkdir ai-docs-generator && cd ai-docs-generator
   npm init -y
   ```

2. **Install dependencies**
   ```bash
   npm install commander cosmiconfig simple-git chokidar chalk ora
   npm install @anthropic-ai/sdk
   npm install @typescript-eslint/parser @babel/parser
   npm install zod handlebars
   npm install -D typescript tsup vitest @types/node
   ```

3. **Create TypeScript config** (`tsconfig.json`)
   ```json
   {
     "compilerOptions": {
       "target": "ES2022",
       "module": "NodeNext",
       "moduleResolution": "NodeNext",
       "outDir": "./dist",
       "rootDir": "./src",
       "strict": true,
       "esModuleInterop": true,
       "declaration": true,
       "skipLibCheck": true
     },
     "include": ["src/**/*"],
     "exclude": ["node_modules", "dist", "tests"]
   }
   ```

4. **Create CLI entry point** (`src/cli/index.ts`)
   ```typescript
   #!/usr/bin/env node
   import { Command } from 'commander';
   import { initCommand } from './commands/init';
   import { generateCommand } from './commands/generate';
   import { watchCommand } from './commands/watch';
   import { syncCommand } from './commands/sync';

   const program = new Command();

   program
     .name('aidocs')
     .description('Auto-generate documentation from code changes')
     .version('1.0.0');

   program.addCommand(initCommand);
   program.addCommand(generateCommand);
   program.addCommand(watchCommand);
   program.addCommand(syncCommand);

   program.parse();
   ```

5. **Create config schema** (`src/config/schema.ts`)
   ```typescript
   import { z } from 'zod';

   export const ConfigSchema = z.object({
     ai: z.object({
       provider: z.literal('anthropic').default('anthropic'),
       model: z.string().default('claude-sonnet-4-5-20250929'),
       apiKey: z.string().optional(), // Falls back to env var
     }).default({}),
     readme: z.object({
       enabled: z.boolean().default(true),
       path: z.string().default('README.md'),
       sections: z.array(z.string()).default(['features', 'installation', 'usage']),
       updateOnNewFeature: z.boolean().default(true),
     }).default({}),
     apiDocs: z.object({
       enabled: z.boolean().default(true),
       outputPath: z.string().default('docs/api'),
       format: z.enum(['markdown', 'html']).default('markdown'),
       includeExamples: z.boolean().default(true),
     }).default({}),
     jsdoc: z.object({
       enabled: z.boolean().default(true),
       style: z.enum(['jsdoc', 'tsdoc']).default('tsdoc'),
       includeTypes: z.boolean().default(true),
       includExamples: z.boolean().default(false),
     }).default({}),
     changelog: z.object({
       enabled: z.boolean().default(true),
       path: z.string().default('CHANGELOG.md'),
       format: z.enum(['keepachangelog', 'conventional']).default('keepachangelog'),
       groupBy: z.enum(['type', 'scope', 'date']).default('type'),
     }).default({}),
     ignore: z.array(z.string()).default([
       'node_modules/**',
       'dist/**',
       '**/*.test.ts',
       '**/*.spec.ts',
     ]),
   });

   export type Config = z.infer<typeof ConfigSchema>;
   ```

6. **Create config loader** (`src/config/loader.ts`)
   ```typescript
   import { cosmiconfig } from 'cosmiconfig';
   import { ConfigSchema, Config } from './schema';

   const explorer = cosmiconfig('aidocs');

   export async function loadConfig(): Promise<Config> {
     const result = await explorer.search();
     const rawConfig = result?.config ?? {};
     return ConfigSchema.parse(rawConfig);
   }
   ```

---

### Phase 2: Git Integration & Change Detection

**Goal:** Build the system to detect and analyze code changes.

#### Tasks

1. **Create Git diff parser** (`src/core/analyzer/git-diff.ts`)
   ```typescript
   import simpleGit, { SimpleGit, DiffResult } from 'simple-git';

   export interface FileChange {
     path: string;
     status: 'added' | 'modified' | 'deleted' | 'renamed';
     additions: number;
     deletions: number;
     diff: string;
     hunks: DiffHunk[];
   }

   export interface DiffHunk {
     oldStart: number;
     oldLines: number;
     newStart: number;
     newLines: number;
     content: string;
   }

   export class GitDiffAnalyzer {
     private git: SimpleGit;

     constructor(repoPath: string = process.cwd()) {
       this.git = simpleGit(repoPath);
     }

     async getStagedChanges(): Promise<FileChange[]> {
       // Get staged diff
       const diff = await this.git.diff(['--cached', '--unified=3']);
       return this.parseDiff(diff);
     }

     async getChangesSince(ref: string): Promise<FileChange[]> {
       const diff = await this.git.diff([ref, 'HEAD', '--unified=3']);
       return this.parseDiff(diff);
     }

     async getUncommittedChanges(): Promise<FileChange[]> {
       const diff = await this.git.diff(['--unified=3']);
       return this.parseDiff(diff);
     }

     async getCommitMessages(since: string): Promise<CommitInfo[]> {
       const log = await this.git.log({ from: since, to: 'HEAD' });
       return log.all.map(commit => ({
         hash: commit.hash,
         message: commit.message,
         author: commit.author_name,
         date: new Date(commit.date),
       }));
     }

     private parseDiff(diffOutput: string): FileChange[] {
       // Implementation: Parse unified diff format
       // Split by file, extract hunks, categorize changes
     }
   }
   ```

2. **Create AST parser** (`src/core/analyzer/ast-parser.ts`)
   ```typescript
   import { parse } from '@typescript-eslint/parser';
   import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/types';

   export interface CodeEntity {
     type: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'export';
     name: string;
     location: { start: number; end: number };
     signature?: string;
     params?: ParameterInfo[];
     returnType?: string;
     jsdoc?: string;
     isExported: boolean;
   }

   export class ASTParser {
     parse(code: string, filename: string): CodeEntity[] {
       const ast = parse(code, {
         sourceType: 'module',
         ecmaVersion: 'latest',
         loc: true,
         range: true,
         comment: true,
       });

       return this.extractEntities(ast);
     }

     private extractEntities(ast: TSESTree.Program): CodeEntity[] {
       const entities: CodeEntity[] = [];

       for (const node of ast.body) {
         if (node.type === AST_NODE_TYPES.FunctionDeclaration) {
           entities.push(this.extractFunction(node));
         }
         if (node.type === AST_NODE_TYPES.ExportNamedDeclaration) {
           entities.push(...this.extractExport(node));
         }
         // Handle classes, interfaces, types, etc.
       }

       return entities;
     }
   }
   ```

3. **Create change detector** (`src/core/analyzer/change-detector.ts`)
   ```typescript
   import { FileChange } from './git-diff';
   import { CodeEntity, ASTParser } from './ast-parser';

   export interface DocumentationChange {
     type: 'new-feature' | 'api-change' | 'breaking-change' | 'bugfix' | 'refactor';
     scope: 'readme' | 'api-docs' | 'jsdoc' | 'changelog';
     entity?: CodeEntity;
     file: string;
     description: string;
     priority: 'high' | 'medium' | 'low';
   }

   export class ChangeDetector {
     private parser = new ASTParser();

     async detectDocumentationNeeds(changes: FileChange[]): Promise<DocumentationChange[]> {
       const docChanges: DocumentationChange[] = [];

       for (const change of changes) {
         if (!this.isDocumentableFile(change.path)) continue;

         const entities = this.parser.parse(change.diff, change.path);
         
         for (const entity of entities) {
           if (this.isNewExport(entity, change)) {
             docChanges.push({
               type: 'new-feature',
               scope: 'readme',
               entity,
               file: change.path,
               description: `New exported ${entity.type}: ${entity.name}`,
               priority: 'high',
             });
           }

           if (this.isAPIChange(entity, change)) {
             docChanges.push({
               type: 'api-change',
               scope: 'api-docs',
               entity,
               file: change.path,
               description: `API change in ${entity.name}`,
               priority: 'high',
             });
           }

           if (this.needsJSDoc(entity)) {
             docChanges.push({
               type: 'new-feature',
               scope: 'jsdoc',
               entity,
               file: change.path,
               description: `Missing documentation for ${entity.name}`,
               priority: 'medium',
             });
           }
         }
       }

       return docChanges;
     }

     private isDocumentableFile(path: string): boolean {
       return /\.(ts|js|tsx|jsx)$/.test(path);
     }
   }
   ```

---

### Phase 3: AI Integration

**Goal:** Build the AI client and prompt system for documentation generation.

#### Tasks

1. **Create Anthropic client wrapper** (`src/core/ai/client.ts`)
   ```typescript
   import Anthropic from '@anthropic-ai/sdk';
   import { Config } from '../../config/schema';

   export class AIClient {
     private client: Anthropic;
     private model: string;

     constructor(config: Config['ai']) {
       this.client = new Anthropic({
         apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
       });
       this.model = config.model;
     }

     async generate(prompt: string, systemPrompt: string): Promise<string> {
       const response = await this.client.messages.create({
         model: this.model,
         max_tokens: 4096,
         system: systemPrompt,
         messages: [{ role: 'user', content: prompt }],
       });

       const textBlock = response.content.find(block => block.type === 'text');
       return textBlock?.text ?? '';
     }

     async generateWithStructure<T>(
       prompt: string,
       systemPrompt: string,
       schema: string
     ): Promise<T> {
       const structuredPrompt = `${prompt}\n\nRespond with valid JSON matching this schema:\n${schema}`;
       const response = await this.generate(structuredPrompt, systemPrompt);
       return JSON.parse(response);
     }
   }
   ```

2. **Create prompt templates** (`src/core/ai/prompts.ts`)
   ```typescript
   export const SYSTEM_PROMPTS = {
     readme: `You are a technical documentation expert. Generate clear, concise README content.
   - Use markdown formatting
   - Be specific and actionable
   - Include code examples where helpful
   - Match the existing documentation style`,

     apiDocs: `You are an API documentation specialist. Generate comprehensive API documentation.
   - Document all parameters with types
   - Include request/response examples
   - Note any breaking changes
   - Use consistent formatting`,

     jsdoc: `You are a code documentation expert. Generate JSDoc/TSDoc comments.
   - Include @param tags with types and descriptions
   - Include @returns with type and description
   - Add @example when helpful
   - Include @throws for error conditions
   - Be concise but complete`,

     changelog: `You are a changelog writer following Keep a Changelog format.
   - Categorize changes: Added, Changed, Deprecated, Removed, Fixed, Security
   - Write from user perspective
   - Be specific about what changed
   - Link to relevant issues/PRs when available`,
   };

   export const PROMPT_TEMPLATES = {
     readmeFeature: (context: FeatureContext) => `
   Analyze this new feature and generate a README section:

   Feature Name: ${context.name}
   File: ${context.file}
   
   Code:
   \`\`\`typescript
   ${context.code}
   \`\`\`

   Existing README sections:
   ${context.existingSections.join(', ')}

   Generate a documentation section that:
   1. Explains what this feature does
   2. Shows how to use it with a code example
   3. Matches the style of existing documentation
   `,

     apiEndpoint: (context: APIContext) => `
   Generate API documentation for this endpoint:

   Method: ${context.method}
   Path: ${context.path}
   Handler Code:
   \`\`\`typescript
   ${context.code}
   \`\`\`

   Include:
   - Description
   - Parameters (path, query, body)
   - Response format
   - Example request/response
   - Error codes
   `,

     jsdocComment: (context: JSDocContext) => `
   Generate a ${context.style} comment for this code:

   \`\`\`typescript
   ${context.code}
   \`\`\`

   Function signature: ${context.signature}
   ${context.existingComment ? `Existing comment to improve:\n${context.existingComment}` : ''}
   `,

     changelogEntry: (context: ChangelogContext) => `
   Generate changelog entries from these commits:

   ${context.commits.map(c => `- ${c.hash.slice(0, 7)}: ${c.message}`).join('\n')}

   Changed files:
   ${context.changedFiles.join('\n')}

   Categorize into: Added, Changed, Fixed, Removed, Security
   Write user-facing descriptions.
   `,
   };
   ```

3. **Create context builder** (`src/core/ai/context-builder.ts`)
   ```typescript
   import { DocumentationChange } from '../analyzer/change-detector';
   import { FileChange } from '../analyzer/git-diff';
   import fs from 'fs/promises';
   import path from 'path';

   export class ContextBuilder {
     async buildReadmeContext(change: DocumentationChange): Promise<FeatureContext> {
       const fileContent = await fs.readFile(change.file, 'utf-8');
       const existingReadme = await this.loadExistingReadme();

       return {
         name: change.entity?.name ?? 'Unknown',
         file: change.file,
         code: this.extractRelevantCode(fileContent, change.entity),
         existingSections: this.extractSections(existingReadme),
       };
     }

     async buildAPIContext(change: DocumentationChange): Promise<APIContext> {
       // Extract route handler info, method, path from code
     }

     async buildJSDocContext(change: DocumentationChange): Promise<JSDocContext> {
       return {
         code: change.entity?.signature ?? '',
         signature: this.buildSignature(change.entity),
         style: 'tsdoc',
         existingComment: change.entity?.jsdoc,
       };
     }

     async buildChangelogContext(
       commits: CommitInfo[],
       changes: FileChange[]
     ): Promise<ChangelogContext> {
       return {
         commits,
         changedFiles: changes.map(c => c.path),
         previousVersion: await this.getLastVersion(),
       };
     }
   }
   ```

---

### Phase 4: Documentation Generators

**Goal:** Build the individual generators for each documentation type.

#### Tasks

1. **README generator** (`src/core/generators/readme.ts`)
   ```typescript
   import { AIClient } from '../ai/client';
   import { ContextBuilder } from '../ai/context-builder';
   import { SYSTEM_PROMPTS, PROMPT_TEMPLATES } from '../ai/prompts';
   import { DocumentationChange } from '../analyzer/change-detector';
   import { Config } from '../../config/schema';

   export class ReadmeGenerator {
     constructor(
       private ai: AIClient,
       private contextBuilder: ContextBuilder,
       private config: Config['readme']
     ) {}

     async generateSection(change: DocumentationChange): Promise<ReadmeUpdate> {
       const context = await this.contextBuilder.buildReadmeContext(change);
       const prompt = PROMPT_TEMPLATES.readmeFeature(context);

       const content = await this.ai.generate(prompt, SYSTEM_PROMPTS.readme);

       return {
         section: this.determineBestSection(change, context),
         content,
         insertAfter: this.findInsertionPoint(context),
       };
     }

     async updateReadme(updates: ReadmeUpdate[]): Promise<string> {
       let readme = await fs.readFile(this.config.path, 'utf-8');

       for (const update of updates) {
         readme = this.insertSection(readme, update);
       }

       return readme;
     }

     private determineBestSection(
       change: DocumentationChange,
       context: FeatureContext
     ): string {
       // Logic to determine which section the new content belongs in
       if (change.type === 'new-feature') return 'features';
       if (change.type === 'api-change') return 'api';
       return 'usage';
     }
   }
   ```

2. **API documentation generator** (`src/core/generators/api-docs.ts`)
   ```typescript
   import { AIClient } from '../ai/client';
   import { ContextBuilder } from '../ai/context-builder';
   import { SYSTEM_PROMPTS, PROMPT_TEMPLATES } from '../ai/prompts';
   import Handlebars from 'handlebars';

   export class APIDocsGenerator {
     private template: Handlebars.TemplateDelegate;

     constructor(
       private ai: AIClient,
       private contextBuilder: ContextBuilder,
       private config: Config['apiDocs']
     ) {
       this.template = this.loadTemplate();
     }

     async generateEndpointDoc(change: DocumentationChange): Promise<APIDoc> {
       const context = await this.contextBuilder.buildAPIContext(change);
       const prompt = PROMPT_TEMPLATES.apiEndpoint(context);

       const docContent = await this.ai.generateWithStructure<APIDocStructure>(
         prompt,
         SYSTEM_PROMPTS.apiDocs,
         API_DOC_SCHEMA
       );

       return {
         path: this.getOutputPath(context),
         content: this.template(docContent),
       };
     }

     async generateIndex(endpoints: APIDoc[]): Promise<string> {
       // Generate index file linking all endpoints
     }
   }

   const API_DOC_SCHEMA = `{
     "method": "string",
     "path": "string",
     "description": "string",
     "parameters": [{ "name": "string", "type": "string", "required": "boolean", "description": "string" }],
     "requestBody": { "type": "string", "example": "object" },
     "responses": [{ "status": "number", "description": "string", "example": "object" }]
   }`;
   ```

3. **JSDoc/TSDoc generator** (`src/core/generators/jsdoc.ts`)
   ```typescript
   import { AIClient } from '../ai/client';
   import { ContextBuilder } from '../ai/context-builder';
   import { SYSTEM_PROMPTS, PROMPT_TEMPLATES } from '../ai/prompts';
   import { CodeEntity } from '../analyzer/ast-parser';

   export class JSDocGenerator {
     constructor(
       private ai: AIClient,
       private contextBuilder: ContextBuilder,
       private config: Config['jsdoc']
     ) {}

     async generateComment(entity: CodeEntity, fileContent: string): Promise<JSDocUpdate> {
       const context: JSDocContext = {
         code: this.extractEntityCode(entity, fileContent),
         signature: entity.signature ?? '',
         style: this.config.style,
         existingComment: entity.jsdoc,
       };

       const prompt = PROMPT_TEMPLATES.jsdocComment(context);
       const comment = await this.ai.generate(prompt, SYSTEM_PROMPTS.jsdoc);

       return {
         file: entity.file,
         insertAt: entity.location.start,
         comment: this.formatComment(comment),
       };
     }

     async processFile(filePath: string): Promise<JSDocUpdate[]> {
       const content = await fs.readFile(filePath, 'utf-8');
       const parser = new ASTParser();
       const entities = parser.parse(content, filePath);

       const updates: JSDocUpdate[] = [];

       for (const entity of entities) {
         if (entity.isExported && !entity.jsdoc) {
           updates.push(await this.generateComment(entity, content));
         }
       }

       return updates;
     }

     private formatComment(comment: string): string {
       // Ensure proper formatting with leading asterisks
       const lines = comment.trim().split('\n');
       if (!lines[0].startsWith('/**')) {
         return `/**\n${lines.map(l => ` * ${l}`).join('\n')}\n */`;
       }
       return comment;
     }
   }
   ```

4. **CHANGELOG generator** (`src/core/generators/changelog.ts`)
   ```typescript
   import { AIClient } from '../ai/client';
   import { ContextBuilder } from '../ai/context-builder';
   import { SYSTEM_PROMPTS, PROMPT_TEMPLATES } from '../ai/prompts';
   import { GitDiffAnalyzer, CommitInfo } from '../analyzer/git-diff';

   export class ChangelogGenerator {
     private git: GitDiffAnalyzer;

     constructor(
       private ai: AIClient,
       private contextBuilder: ContextBuilder,
       private config: Config['changelog']
     ) {
       this.git = new GitDiffAnalyzer();
     }

     async syncFromCommits(since: string): Promise<ChangelogUpdate> {
       const commits = await this.git.getCommitMessages(since);
       const changes = await this.git.getChangesSince(since);

       const context = await this.contextBuilder.buildChangelogContext(commits, changes);
       const prompt = PROMPT_TEMPLATES.changelogEntry(context);

       const entries = await this.ai.generateWithStructure<ChangelogEntries>(
         prompt,
         SYSTEM_PROMPTS.changelog,
         CHANGELOG_SCHEMA
       );

       return {
         version: this.determineVersion(entries),
         date: new Date().toISOString().split('T')[0],
         entries,
       };
     }

     async updateChangelog(update: ChangelogUpdate): Promise<string> {
       const existing = await fs.readFile(this.config.path, 'utf-8').catch(() => '');
       return this.insertVersion(existing, update);
     }

     private insertVersion(existing: string, update: ChangelogUpdate): string {
       const newSection = this.formatVersion(update);

       if (!existing) {
         return `# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n${newSection}`;
       }

       // Insert after header, before first version
       const insertPoint = existing.indexOf('\n## ');
       if (insertPoint === -1) {
         return existing + '\n' + newSection;
       }
       return existing.slice(0, insertPoint) + '\n' + newSection + existing.slice(insertPoint);
     }

     private formatVersion(update: ChangelogUpdate): string {
       const sections = [];

       if (update.entries.added?.length) {
         sections.push(`### Added\n${update.entries.added.map(e => `- ${e}`).join('\n')}`);
       }
       if (update.entries.changed?.length) {
         sections.push(`### Changed\n${update.entries.changed.map(e => `- ${e}`).join('\n')}`);
       }
       if (update.entries.fixed?.length) {
         sections.push(`### Fixed\n${update.entries.fixed.map(e => `- ${e}`).join('\n')}`);
       }
       if (update.entries.removed?.length) {
         sections.push(`### Removed\n${update.entries.removed.map(e => `- ${e}`).join('\n')}`);
       }

       return `## [${update.version}] - ${update.date}\n\n${sections.join('\n\n')}`;
     }
   }

   const CHANGELOG_SCHEMA = `{
     "added": ["string"],
     "changed": ["string"],
     "fixed": ["string"],
     "removed": ["string"],
     "security": ["string"]
   }`;
   ```

---

### Phase 5: CLI Commands

**Goal:** Implement the CLI commands that orchestrate the generators.

#### Tasks

1. **Init command** (`src/cli/commands/init.ts`)
   ```typescript
   import { Command } from 'commander';
   import fs from 'fs/promises';
   import path from 'path';
   import chalk from 'chalk';
   import { ConfigSchema } from '../../config/schema';

   export const initCommand = new Command('init')
     .description('Initialize AI-Docs-Generator configuration')
     .option('--force', 'Overwrite existing config')
     .action(async (options) => {
       const configPath = path.join(process.cwd(), '.aidocsrc.json');

       const exists = await fs.access(configPath).then(() => true).catch(() => false);
       if (exists && !options.force) {
         console.log(chalk.yellow('Config already exists. Use --force to overwrite.'));
         return;
       }

       const defaultConfig = ConfigSchema.parse({});
       await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2));

       console.log(chalk.green('✓ Created .aidocsrc.json'));
       console.log(chalk.dim('  Set ANTHROPIC_API_KEY environment variable to get started.'));
     });
   ```

2. **Generate command** (`src/cli/commands/generate.ts`)
   ```typescript
   import { Command } from 'commander';
   import ora from 'ora';
   import chalk from 'chalk';
   import { loadConfig } from '../../config/loader';
   import { GitDiffAnalyzer } from '../../core/analyzer/git-diff';
   import { ChangeDetector } from '../../core/analyzer/change-detector';
   import { AIClient } from '../../core/ai/client';
   import { ContextBuilder } from '../../core/ai/context-builder';
   import { ReadmeGenerator } from '../../core/generators/readme';
   import { APIDocsGenerator } from '../../core/generators/api-docs';
   import { JSDocGenerator } from '../../core/generators/jsdoc';

   export const generateCommand = new Command('generate')
     .description('Generate documentation from recent changes')
     .option('--since <ref>', 'Generate from changes since this ref', 'HEAD~1')
     .option('--readme', 'Only update README')
     .option('--api', 'Only update API docs')
     .option('--jsdoc', 'Only add JSDoc comments')
     .option('--dry-run', 'Show what would be generated without writing')
     .action(async (options) => {
       const spinner = ora('Loading configuration...').start();

       try {
         const config = await loadConfig();
         const git = new GitDiffAnalyzer();
         const detector = new ChangeDetector();
         const ai = new AIClient(config.ai);
         const contextBuilder = new ContextBuilder();

         spinner.text = 'Analyzing changes...';
         const changes = await git.getChangesSince(options.since);
         const docNeeds = await detector.detectDocumentationNeeds(changes);

         spinner.succeed(`Found ${docNeeds.length} documentation updates needed`);

         const generators = {
           readme: new ReadmeGenerator(ai, contextBuilder, config.readme),
           api: new APIDocsGenerator(ai, contextBuilder, config.apiDocs),
           jsdoc: new JSDocGenerator(ai, contextBuilder, config.jsdoc),
         };

         for (const need of docNeeds) {
           if (options.readme && need.scope !== 'readme') continue;
           if (options.api && need.scope !== 'api-docs') continue;
           if (options.jsdoc && need.scope !== 'jsdoc') continue;

           const genSpinner = ora(`Generating ${need.scope} for ${need.entity?.name}...`).start();

           try {
             switch (need.scope) {
               case 'readme':
                 const readmeUpdate = await generators.readme.generateSection(need);
                 if (!options.dryRun) {
                   await generators.readme.applyUpdate(readmeUpdate);
                 }
                 genSpinner.succeed(`Updated README: ${need.entity?.name}`);
                 break;

               case 'api-docs':
                 const apiDoc = await generators.api.generateEndpointDoc(need);
                 if (!options.dryRun) {
                   await fs.writeFile(apiDoc.path, apiDoc.content);
                 }
                 genSpinner.succeed(`Generated API doc: ${apiDoc.path}`);
                 break;

               case 'jsdoc':
                 const jsdocUpdate = await generators.jsdoc.generateComment(need.entity!, '');
                 if (!options.dryRun) {
                   await applyJSDocUpdate(jsdocUpdate);
                 }
                 genSpinner.succeed(`Added JSDoc: ${need.entity?.name}`);
                 break;
             }
           } catch (error) {
             genSpinner.fail(`Failed: ${need.entity?.name}`);
             console.error(chalk.red(error.message));
           }
         }

         console.log(chalk.green('\n✓ Documentation generation complete'));
       } catch (error) {
         spinner.fail('Generation failed');
         console.error(chalk.red(error.message));
         process.exit(1);
       }
     });
   ```

3. **Watch command** (`src/cli/commands/watch.ts`)
   ```typescript
   import { Command } from 'commander';
   import chokidar from 'chokidar';
   import chalk from 'chalk';
   import { loadConfig } from '../../config/loader';
   import { debounce } from '../../utils/debounce';

   export const watchCommand = new Command('watch')
     .description('Watch for changes and auto-generate documentation')
     .option('--debounce <ms>', 'Debounce time in milliseconds', '2000')
     .action(async (options) => {
       const config = await loadConfig();

       console.log(chalk.blue('👀 Watching for changes...'));
       console.log(chalk.dim('   Press Ctrl+C to stop\n'));

       const processChanges = debounce(async (paths: string[]) => {
         console.log(chalk.yellow(`\nProcessing ${paths.length} changed files...`));
         // Trigger generation for changed files
         await runGeneration(paths, config);
       }, parseInt(options.debounce));

       const changedFiles: string[] = [];

       const watcher = chokidar.watch(['**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx'], {
         ignored: config.ignore,
         persistent: true,
         ignoreInitial: true,
       });

       watcher.on('change', (path) => {
         console.log(chalk.dim(`  Changed: ${path}`));
         changedFiles.push(path);
         processChanges(changedFiles);
       });

       watcher.on('add', (path) => {
         console.log(chalk.dim(`  Added: ${path}`));
         changedFiles.push(path);
         processChanges(changedFiles);
       });
     });
   ```

4. **Sync command** (`src/cli/commands/sync.ts`)
   ```typescript
   import { Command } from 'commander';
   import ora from 'ora';
   import chalk from 'chalk';
   import { loadConfig } from '../../config/loader';
   import { AIClient } from '../../core/ai/client';
   import { ContextBuilder } from '../../core/ai/context-builder';
   import { ChangelogGenerator } from '../../core/generators/changelog';

   export const syncCommand = new Command('sync')
     .description('Sync CHANGELOG.md from commits')
     .argument('[since]', 'Sync commits since this ref (tag, commit, or branch)', 'latest-tag')
     .option('--version <version>', 'Specify version number')
     .option('--dry-run', 'Show changelog without writing')
     .action(async (since, options) => {
       const spinner = ora('Loading configuration...').start();

       try {
         const config = await loadConfig();
         const ai = new AIClient(config.ai);
         const contextBuilder = new ContextBuilder();
         const generator = new ChangelogGenerator(ai, contextBuilder, config.changelog);

         // Resolve 'latest-tag' to actual tag
         const resolvedSince = since === 'latest-tag' 
           ? await getLatestTag() 
           : since;

         spinner.text = `Analyzing commits since ${resolvedSince}...`;
         const update = await generator.syncFromCommits(resolvedSince);

         if (options.version) {
           update.version = options.version;
         }

         spinner.succeed(`Generated changelog for version ${update.version}`);

         const content = await generator.updateChangelog(update);

         if (options.dryRun) {
           console.log(chalk.yellow('\n--- Dry Run Output ---\n'));
           console.log(content);
         } else {
           await fs.writeFile(config.changelog.path, content);
           console.log(chalk.green(`\n✓ Updated ${config.changelog.path}`));
         }
       } catch (error) {
         spinner.fail('Sync failed');
         console.error(chalk.red(error.message));
         process.exit(1);
       }
     });

   async function getLatestTag(): Promise<string> {
     const git = simpleGit();
     const tags = await git.tags();
     return tags.latest ?? 'HEAD~10';
   }
   ```

---

### Phase 6: File Writing & Merging

**Goal:** Safely update files while preserving existing content.

#### Tasks

1. **File writer** (`src/core/updater/file-writer.ts`)
   ```typescript
   import fs from 'fs/promises';
   import path from 'path';

   export class FileWriter {
     async writeWithBackup(filePath: string, content: string): Promise<void> {
       const exists = await fs.access(filePath).then(() => true).catch(() => false);

       if (exists) {
         const backupPath = `${filePath}.backup`;
         await fs.copyFile(filePath, backupPath);
       }

       await fs.mkdir(path.dirname(filePath), { recursive: true });
       await fs.writeFile(filePath, content, 'utf-8');
     }

     async insertAtLine(filePath: string, line: number, content: string): Promise<void> {
       const existing = await fs.readFile(filePath, 'utf-8');
       const lines = existing.split('\n');
       lines.splice(line, 0, content);
       await this.writeWithBackup(filePath, lines.join('\n'));
     }
   }
   ```

2. **Merge strategy** (`src/core/updater/merge-strategy.ts`)
   ```typescript
   export class MergeStrategy {
     mergeReadmeSection(existing: string, newSection: string, sectionName: string): string {
       const sectionRegex = new RegExp(
         `(## ${sectionName}\\n)([\\s\\S]*?)(?=\\n## |$)`,
         'i'
       );

       if (sectionRegex.test(existing)) {
         // Append to existing section
         return existing.replace(sectionRegex, (_, header, content) => {
           return `${header}${content.trim()}\n\n${newSection}\n`;
         });
       }

       // Add new section before first ## or at end
       const insertPoint = existing.search(/\n## /);
       if (insertPoint === -1) {
         return `${existing}\n\n## ${sectionName}\n\n${newSection}\n`;
       }
       return `${existing.slice(0, insertPoint)}\n\n## ${sectionName}\n\n${newSection}\n${existing.slice(insertPoint)}`;
     }

     mergeJSDoc(code: string, comment: string, insertPosition: number): string {
       // Check if there's already a JSDoc comment
       const beforeInsert = code.slice(0, insertPosition);
       const existingCommentMatch = beforeInsert.match(/\/\*\*[\s\S]*?\*\/\s*$/);

       if (existingCommentMatch) {
         // Replace existing comment
         return code.slice(0, insertPosition - existingCommentMatch[0].length) 
           + comment + '\n' 
           + code.slice(insertPosition);
       }

       // Insert new comment
       return code.slice(0, insertPosition) + comment + '\n' + code.slice(insertPosition);
     }
   }
   ```

---

### Phase 7: Testing

**Goal:** Add comprehensive tests for all components.

#### Tasks

1. **Test setup** (`vitest.config.ts`)
   ```typescript
   import { defineConfig } from 'vitest/config';

   export default defineConfig({
     test: {
       globals: true,
       environment: 'node',
       coverage: {
         provider: 'v8',
         reporter: ['text', 'html'],
       },
     },
   });
   ```

2. **Unit tests** (`tests/unit/`)
   - `git-diff.test.ts` - Test diff parsing
   - `ast-parser.test.ts` - Test code parsing
   - `change-detector.test.ts` - Test change detection logic
   - `merge-strategy.test.ts` - Test file merging

3. **Integration tests** (`tests/integration/`)
   - `readme-generator.test.ts` - Test full README generation flow
   - `changelog-sync.test.ts` - Test changelog generation from commits

4. **E2E tests** (`tests/e2e/`)
   - `cli.test.ts` - Test CLI commands end-to-end

---

### Phase 8: Polish & Distribution

**Goal:** Prepare for publication and real-world use.

#### Tasks

1. **Build configuration** (`tsup.config.ts`)
   ```typescript
   import { defineConfig } from 'tsup';

   export default defineConfig({
     entry: ['src/cli/index.ts'],
     format: ['esm'],
     dts: true,
     clean: true,
     shims: true,
   });
   ```

2. **Package.json updates**
   ```json
   {
     "name": "ai-docs-generator",
     "version": "1.0.0",
     "type": "module",
     "bin": {
       "aidocs": "./dist/index.js"
     },
     "files": ["dist"],
     "scripts": {
       "build": "tsup",
       "dev": "tsup --watch",
       "test": "vitest",
       "prepublishOnly": "npm run build"
     }
   }
   ```

3. **Create project README**

4. **Add GitHub Actions CI/CD**

---

## Configuration Reference

### .aidocsrc.json

```json
{
  "ai": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-5-20250929"
  },
  "readme": {
    "enabled": true,
    "path": "README.md",
    "sections": ["features", "installation", "usage", "api"],
    "updateOnNewFeature": true
  },
  "apiDocs": {
    "enabled": true,
    "outputPath": "docs/api",
    "format": "markdown",
    "includeExamples": true
  },
  "jsdoc": {
    "enabled": true,
    "style": "tsdoc",
    "includeTypes": true,
    "includeExamples": false
  },
  "changelog": {
    "enabled": true,
    "path": "CHANGELOG.md",
    "format": "keepachangelog",
    "groupBy": "type"
  },
  "ignore": [
    "node_modules/**",
    "dist/**",
    "**/*.test.ts",
    "**/*.spec.ts"
  ]
}
```

---

## CLI Usage Reference

```bash
# Initialize configuration
aidocs init

# Generate docs from recent changes
aidocs generate
aidocs generate --since HEAD~5
aidocs generate --readme          # Only README
aidocs generate --jsdoc           # Only JSDoc comments
aidocs generate --dry-run         # Preview without writing

# Watch mode
aidocs watch
aidocs watch --debounce 5000

# Sync changelog
aidocs sync                       # From latest tag
aidocs sync v1.0.0               # From specific tag
aidocs sync --version 1.1.0      # Specify new version
aidocs sync --dry-run            # Preview output
```

---

## Development Milestones

| Milestone | Description | Estimated Effort |
|-----------|-------------|------------------|
| M1 | Project setup, config, CLI skeleton | 2-3 hours |
| M2 | Git integration, diff parsing | 3-4 hours |
| M3 | AST parsing, change detection | 4-5 hours |
| M4 | AI client, prompt engineering | 3-4 hours |
| M5 | README generator | 3-4 hours |
| M6 | API docs generator | 3-4 hours |
| M7 | JSDoc generator | 2-3 hours |
| M8 | Changelog generator | 2-3 hours |
| M9 | Watch mode | 2 hours |
| M10 | Testing | 4-5 hours |
| M11 | Polish, docs, publish | 2-3 hours |

**Total estimated:** 30-40 hours

---

## Cursor Development Tips

When building with Cursor:

1. **Start each phase by creating the directory structure** first
2. **Build interfaces/types before implementations** - define the contracts
3. **Test each component in isolation** before integration
4. **Use the AI to generate boilerplate** but review prompt templates carefully
5. **Keep prompts in separate files** for easy iteration
6. **Add logging early** - helps debug AI responses

---

## Future Enhancements

- [ ] Support for multiple AI providers (OpenAI, local models)
- [ ] Git hooks integration (pre-commit, post-commit)
- [ ] VS Code extension
- [ ] Interactive mode for reviewing generated docs
- [ ] Custom template support
- [ ] Multi-language support (Python, Go, Rust)
- [ ] Documentation quality scoring
- [ ] PR comment integration (GitHub, GitLab)