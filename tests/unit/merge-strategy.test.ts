import { describe, it, expect } from 'vitest';
import { MergeStrategy } from '../../src/core/updater/merge-strategy.js';

describe('MergeStrategy', () => {
  const strategy = new MergeStrategy();

  describe('mergeReadmeSection', () => {
    it('should append to existing section', () => {
      const existing = `# Project

## Features

- Feature 1
- Feature 2

## Installation

Run npm install
`;

      const result = strategy.mergeReadmeSection(
        existing,
        '- Feature 3',
        'Features'
      );

      expect(result).toContain('- Feature 1');
      expect(result).toContain('- Feature 2');
      expect(result).toContain('- Feature 3');
      expect(result.indexOf('- Feature 3')).toBeGreaterThan(
        result.indexOf('- Feature 2')
      );
    });

    it('should create new section if not exists', () => {
      const existing = `# Project

## Installation

Run npm install
`;

      const result = strategy.mergeReadmeSection(
        existing,
        '- Feature 1',
        'Features'
      );

      expect(result).toContain('## Features');
      expect(result).toContain('- Feature 1');
    });

    it('should handle section names with special regex characters', () => {
      const existing = `# Project

## API (v2.0)

Some content
`;

      const result = strategy.mergeReadmeSection(
        existing,
        'New API info',
        'API (v2.0)'
      );

      expect(result).toContain('New API info');
    });

    it('should add section at end if no other sections exist', () => {
      const existing = '# Project\n\nSome intro text.';

      const result = strategy.mergeReadmeSection(
        existing,
        '- Feature 1',
        'Features'
      );

      expect(result).toContain('## Features');
      expect(result).toContain('- Feature 1');
    });
  });

  describe('mergeJSDoc', () => {
    it('should insert new JSDoc comment', () => {
      const code = `export function hello() {
  return 'world';
}`;

      const comment = `/**
 * Says hello
 */`;

      const result = strategy.mergeJSDoc(code, comment, 0);

      expect(result).toContain('/**');
      expect(result).toContain('* Says hello');
      expect(result).toContain('*/');
      expect(result).toContain('export function hello');
    });

    it('should replace existing JSDoc comment', () => {
      const code = `/**
 * Old comment
 */
export function hello() {
  return 'world';
}`;

      const newComment = `/**
 * New comment
 */`;

      // Insert position is at the start of "export"
      const insertPosition = code.indexOf('export');
      const result = strategy.mergeJSDoc(code, newComment, insertPosition);

      expect(result).toContain('New comment');
      expect(result).not.toContain('Old comment');
    });

    it('should preserve code after insertion', () => {
      const code = `function a() {}
function b() {}`;

      const comment = '/** B function */';
      const insertPos = code.indexOf('function b');

      const result = strategy.mergeJSDoc(code, comment, insertPos);

      expect(result).toContain('function a');
      expect(result).toContain('/** B function */');
      expect(result).toContain('function b');
    });
  });

  describe('mergeChangelog', () => {
    it('should return new version for empty changelog', () => {
      const newVersion = '## [1.0.0] - 2024-01-01\n\n### Added\n- Initial release';

      const result = strategy.mergeChangelog('', newVersion);

      expect(result).toBe(newVersion);
    });

    it('should insert new version before existing versions', () => {
      const existing = `# Changelog

## [1.0.0] - 2024-01-01

### Added
- Initial release
`;

      const newVersion = `## [1.1.0] - 2024-02-01

### Added
- New feature`;

      const result = strategy.mergeChangelog(existing, newVersion);

      expect(result.indexOf('[1.1.0]')).toBeLessThan(result.indexOf('[1.0.0]'));
    });

    it('should append if no existing versions', () => {
      const existing = '# Changelog\n\nNo releases yet.';
      const newVersion = '## [1.0.0] - 2024-01-01\n\n### Added\n- Initial';

      const result = strategy.mergeChangelog(existing, newVersion);

      expect(result).toContain('# Changelog');
      expect(result).toContain('[1.0.0]');
    });
  });

  describe('mergeAPIIndex', () => {
    it('should add to existing category', () => {
      const existing = `# API Reference

### Users

- [GET /users](./get-users.md)
`;

      const result = strategy.mergeAPIIndex(
        existing,
        '- [POST /users](./post-users.md)',
        'Users'
      );

      expect(result).toContain('GET /users');
      expect(result).toContain('POST /users');
    });

    it('should create new category if not exists', () => {
      const existing = `# API Reference

### Users

- [GET /users](./get-users.md)
`;

      const result = strategy.mergeAPIIndex(
        existing,
        '- [GET /products](./get-products.md)',
        'Products'
      );

      expect(result).toContain('### Users');
      expect(result).toContain('### Products');
      expect(result).toContain('GET /products');
    });
  });

  describe('findReadmeInsertPoint', () => {
    it('should find correct insertion point based on section order', () => {
      const readme = `# Project

## Installation

Install here

## Contributing

Contribute here

## License

MIT
`;

      // Features should go after Installation but before Contributing
      const pos = strategy.findReadmeInsertPoint(readme, 'Features');

      expect(pos).toBeGreaterThan(readme.indexOf('## Installation'));
      expect(pos).toBeLessThanOrEqual(readme.indexOf('## Contributing'));
    });

    it('should insert before License for unknown sections', () => {
      const readme = `# Project

## Installation

Install here

## License

MIT
`;

      const pos = strategy.findReadmeInsertPoint(readme, 'Custom Section');

      expect(pos).toBeLessThan(readme.length);
      expect(pos).toBeLessThanOrEqual(readme.indexOf('## License'));
    });

    it('should return end position if no matching sections', () => {
      const readme = '# Project\n\nJust some text.';

      const pos = strategy.findReadmeInsertPoint(readme, 'Features');

      expect(pos).toBe(readme.length);
    });
  });
});

