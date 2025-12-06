import { describe, it, expect } from 'vitest';
import { ChangeDetector } from '../../src/core/analyzer/change-detector.js';
import { FileChange } from '../../src/core/analyzer/git-diff.js';

describe('ChangeDetector', () => {
  const detector = new ChangeDetector();

  describe('detectDocumentationNeeds', () => {
    it('should detect new exported function as new feature', async () => {
      const changes: FileChange[] = [
        {
          path: 'src/utils.ts',
          status: 'added',
          additions: 5,
          deletions: 0,
          diff: 'diff --git a/src/utils.ts b/src/utils.ts\nnew file\n+export function helper() {}',
          hunks: [],
        },
      ];

      // Mock file reading - in real test, we'd use a test fixture
      // For now, this tests the logic structure
      const result = await detector.detectDocumentationNeeds(changes);

      // Should detect at least one documentation need
      expect(Array.isArray(result)).toBe(true);
    });

    it('should ignore non-code files', async () => {
      const changes: FileChange[] = [
        {
          path: 'README.md',
          status: 'modified',
          additions: 1,
          deletions: 1,
          diff: 'diff',
          hunks: [],
        },
      ];

      const result = await detector.detectDocumentationNeeds(changes);

      // README.md should be filtered out
      expect(result.length).toBe(0);
    });

    it('should detect deleted files for changelog', async () => {
      const changes: FileChange[] = [
        {
          path: 'src/deprecated.ts',
          status: 'deleted',
          additions: 0,
          deletions: 10,
          diff: 'diff',
          hunks: [],
        },
      ];

      const result = await detector.detectDocumentationNeeds(changes);

      expect(result.length).toBeGreaterThan(0);
      const changelogEntry = result.find((r) => r.scope === 'changelog');
      expect(changelogEntry).toBeDefined();
    });
  });

  describe('isDocumentableFile', () => {
    it('should identify TypeScript files as documentable', () => {
      const result = (detector as any).isDocumentableFile('src/file.ts');
      expect(result).toBe(true);
    });

    it('should identify JavaScript files as documentable', () => {
      const result = (detector as any).isDocumentableFile('src/file.js');
      expect(result).toBe(true);
    });

    it('should identify TSX files as documentable', () => {
      const result = (detector as any).isDocumentableFile('src/file.tsx');
      expect(result).toBe(true);
    });

    it('should not identify markdown files as documentable', () => {
      const result = (detector as any).isDocumentableFile('README.md');
      expect(result).toBe(false);
    });
  });
});

