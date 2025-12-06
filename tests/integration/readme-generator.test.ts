import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReadmeGenerator } from '../../src/core/generators/readme.js';
import type { AIClient } from '../../src/core/ai/client.js';
import type { ContextBuilder } from '../../src/core/ai/context-builder.js';
import type { DocumentationChange } from '../../src/core/analyzer/change-detector.js';
import type { Config } from '../../src/types/index.js';

// Mock AIClient
const mockAIClient = {
  generate: vi.fn(),
  generateWithStructure: vi.fn(),
} as unknown as AIClient;

// Mock ContextBuilder
const mockContextBuilder = {
  buildReadmeContext: vi.fn(),
  buildAPIContext: vi.fn(),
  buildJSDocContext: vi.fn(),
  buildChangelogContext: vi.fn(),
} as unknown as ContextBuilder;

// Test config
const testConfig: Config['readme'] = {
  enabled: true,
  path: 'README.md',
  sections: ['features', 'installation', 'usage'],
  updateOnNewFeature: true,
};

describe('ReadmeGenerator', () => {
  let generator: ReadmeGenerator;

  beforeEach(() => {
    vi.clearAllMocks();
    generator = new ReadmeGenerator(mockAIClient, mockContextBuilder, testConfig);
  });

  describe('generateSection', () => {
    it('should generate a readme section for a new feature', async () => {
      const change: DocumentationChange = {
        type: 'new-feature',
        scope: 'readme',
        file: 'src/utils/helper.ts',
        description: 'New helper function',
        priority: 'high',
        entity: {
          name: 'formatDate',
          type: 'function',
          isExported: true,
          location: { start: 0, end: 100 },
        },
      };

      mockContextBuilder.buildReadmeContext = vi.fn().mockResolvedValue({
        entityName: 'formatDate',
        entityType: 'function',
        code: 'export function formatDate(date: Date): string { ... }',
        existingSections: ['Installation', 'Usage'],
        projectContext: 'A utility library',
      });

      mockAIClient.generate = vi.fn().mockResolvedValue(
        '### formatDate\n\nA helper function to format dates.\n\n```typescript\nformatDate(new Date())\n```'
      );

      const result = await generator.generateSection(change);

      expect(result).toHaveProperty('section');
      expect(result).toHaveProperty('content');
      expect(result.content).toContain('formatDate');
      expect(mockContextBuilder.buildReadmeContext).toHaveBeenCalledWith(change);
      expect(mockAIClient.generate).toHaveBeenCalled();
    });

    it('should determine correct section for API changes', async () => {
      const change: DocumentationChange = {
        type: 'api-change',
        scope: 'readme',
        file: 'src/api/users.ts',
        description: 'API endpoint change',
        priority: 'high',
        entity: {
          name: 'getUser',
          type: 'function',
          isExported: true,
          location: { start: 0, end: 50 },
        },
      };

      mockContextBuilder.buildReadmeContext = vi.fn().mockResolvedValue({
        entityName: 'getUser',
        entityType: 'function',
        code: 'export async function getUser(id: string) { ... }',
        existingSections: ['Features', 'API', 'Usage'],
        projectContext: 'REST API',
      });

      mockAIClient.generate = vi.fn().mockResolvedValue('Updated API documentation');

      const result = await generator.generateSection(change);

      // API changes should go to API section
      expect(result.section).toBe('API');
    });

    it('should handle breaking changes', async () => {
      const change: DocumentationChange = {
        type: 'breaking-change',
        scope: 'readme',
        file: 'src/core/config.ts',
        description: 'Config format changed',
        priority: 'high',
        entity: {
          name: 'Config',
          type: 'interface',
          isExported: true,
          location: { start: 0, end: 200 },
        },
      };

      mockContextBuilder.buildReadmeContext = vi.fn().mockResolvedValue({
        entityName: 'Config',
        entityType: 'interface',
        code: 'export interface Config { ... }',
        existingSections: ['Features', 'Migration'],
        projectContext: 'Configuration system',
      });

      mockAIClient.generate = vi.fn().mockResolvedValue('Migration guide for Config changes');

      const result = await generator.generateSection(change);

      // Breaking changes should go to Migration section if it exists
      expect(result.section).toBe('Migration');
    });
  });

  describe('updateReadme', () => {
    it('should apply multiple updates to README', async () => {
      const updates = [
        { section: 'Features', content: 'New feature content', insertAfter: 'Installation' },
        { section: 'API', content: 'New API content', insertAfter: 'Features' },
      ];

      // Mock file read - would need actual file system mocking for full test
      // This tests the logic flow
      const result = await generator.updateReadme(updates);

      // Should return a string (the updated README content)
      expect(typeof result).toBe('string');
    });
  });
});

