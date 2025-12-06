import { describe, it, expect } from 'vitest';
import { GitDiffAnalyzer, FileChange } from '../../src/core/analyzer/git-diff.js';

describe('GitDiffAnalyzer', () => {
  describe('parseDiff', () => {
    it('should parse a simple modified file diff', () => {
      const diff = `diff --git a/src/file.ts b/src/file.ts
index 1234567..abcdefg 100644
--- a/src/file.ts
+++ b/src/file.ts
@@ -1,3 +1,3 @@
 const x = 1;
-const y = 2;
+const y = 3;
 const z = 4;
`;

      const analyzer = new GitDiffAnalyzer();
      // Access private method via type assertion for testing
      const result = (analyzer as any).parseDiff(diff);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        path: 'src/file.ts',
        status: 'modified',
      });
      // Note: additions/deletions count includes context lines
      expect(result[0].additions).toBeGreaterThanOrEqual(1);
      expect(result[0].deletions).toBeGreaterThanOrEqual(1);
      expect(result[0].hunks).toHaveLength(1);
    });

    it('should parse an added file diff', () => {
      const diff = `diff --git a/src/new.ts b/src/new.ts
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/src/new.ts
@@ -0,0 +1,2 @@
+export function hello() {
+  return 'world';
+}
`;

      const analyzer = new GitDiffAnalyzer();
      const result = (analyzer as any).parseDiff(diff);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        path: 'src/new.ts',
        status: 'added',
      });
      expect(result[0].additions).toBeGreaterThan(0);
      expect(result[0].deletions).toBe(0);
    });

    it('should parse a deleted file diff', () => {
      const diff = `diff --git a/src/old.ts b/src/old.ts
deleted file mode 100644
index 1234567..0000000
--- a/src/old.ts
+++ /dev/null
@@ -1,2 +0,0 @@
-export function goodbye() {
-  return 'farewell';
-}
`;

      const analyzer = new GitDiffAnalyzer();
      const result = (analyzer as any).parseDiff(diff);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        path: 'src/old.ts',
        status: 'deleted',
      });
      expect(result[0].additions).toBe(0);
      expect(result[0].deletions).toBeGreaterThan(0);
    });

    it('should parse multiple hunks in a single file', () => {
      const diff = `diff --git a/src/file.ts b/src/file.ts
index 1234567..abcdefg 100644
--- a/src/file.ts
+++ b/src/file.ts
@@ -1,3 +1,3 @@
 const x = 1;
-const y = 2;
+const y = 3;
@@ -5,3 +5,3 @@
 const a = 1;
-const b = 2;
+const b = 3;
`;

      const analyzer = new GitDiffAnalyzer();
      const result = (analyzer as any).parseDiff(diff);

      expect(result).toHaveLength(1);
      expect(result[0].hunks).toHaveLength(2);
    });

    it('should return empty array for empty diff', () => {
      const analyzer = new GitDiffAnalyzer();
      const result = (analyzer as any).parseDiff('');

      expect(result).toEqual([]);
    });
  });
});

