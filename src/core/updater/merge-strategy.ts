/**
 * Strategies for merging new content with existing file content.
 */
export class MergeStrategy {
  /**
   * Merge a new section into an existing README.
   * If the section exists, appends to it. Otherwise, creates a new section.
   *
   * @param existing - Existing README content
   * @param newSection - New content to add
   * @param sectionName - Name of the section (without ##)
   * @returns Updated README content
   */
  mergeReadmeSection(existing: string, newSection: string, sectionName: string): string {
    // Escape special regex characters in section name
    const escapedName = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const sectionRegex = new RegExp(
      `(## ${escapedName}\\n)([\\s\\S]*?)(?=\\n## |$)`,
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

  /**
   * Merge a JSDoc comment into code at a specific position.
   * If there's an existing JSDoc comment, replaces it. Otherwise, inserts new.
   *
   * @param code - Existing code content
   * @param comment - JSDoc comment to insert
   * @param insertPosition - Character position to insert at
   * @returns Updated code with JSDoc comment
   */
  mergeJSDoc(code: string, comment: string, insertPosition: number): string {
    // Check if there's already a JSDoc comment before the insert position
    const beforeInsert = code.slice(0, insertPosition);
    const existingCommentMatch = beforeInsert.match(/\/\*\*[\s\S]*?\*\/\s*$/);

    if (existingCommentMatch) {
      // Replace existing comment
      return (
        code.slice(0, insertPosition - existingCommentMatch[0].length) +
        comment +
        '\n' +
        code.slice(insertPosition)
      );
    }

    // Insert new comment
    return code.slice(0, insertPosition) + comment + '\n' + code.slice(insertPosition);
  }

  /**
   * Merge changelog entries, placing new version at the top.
   *
   * @param existing - Existing changelog content
   * @param newVersion - New version section to add
   * @returns Updated changelog content
   */
  mergeChangelog(existing: string, newVersion: string): string {
    if (!existing || existing.trim() === '') {
      return newVersion;
    }

    // Find the first version header (## [x.x.x] or ## x.x.x)
    const versionPattern = /\n## \[?\d+\.\d+\.\d+\]?/;
    const match = existing.match(versionPattern);

    if (match && match.index !== undefined) {
      // Insert new version before the first existing version
      return (
        existing.slice(0, match.index) +
        '\n\n' +
        newVersion +
        existing.slice(match.index)
      );
    }

    // No existing versions, append after header
    return existing.trim() + '\n\n' + newVersion;
  }

  /**
   * Merge API documentation index.
   * Adds new endpoint to the appropriate section.
   *
   * @param existing - Existing index content
   * @param newEntry - New entry to add (e.g., "- [GET /users](./get-users.md)")
   * @param category - Category/section name
   * @returns Updated index content
   */
  mergeAPIIndex(existing: string, newEntry: string, category: string): string {
    const escapedCategory = category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const categoryRegex = new RegExp(
      `(### ${escapedCategory}\\n)([\\s\\S]*?)(?=\\n### |$)`,
      'i'
    );

    if (categoryRegex.test(existing)) {
      // Add to existing category
      return existing.replace(categoryRegex, (_, header, content) => {
        return `${header}${content.trim()}\n${newEntry}\n`;
      });
    }

    // Add new category at the end
    return `${existing.trim()}\n\n### ${category}\n\n${newEntry}\n`;
  }

  /**
   * Find the best insertion point for a new README section.
   * Follows conventional README section ordering.
   *
   * @param existing - Existing README content
   * @param sectionName - Name of section to insert
   * @returns Character position to insert at
   */
  findReadmeInsertPoint(existing: string, sectionName: string): number {
    // Standard README section order
    const sectionOrder = [
      'Installation',
      'Quick Start',
      'Getting Started',
      'Usage',
      'Features',
      'API',
      'API Reference',
      'Configuration',
      'Options',
      'Examples',
      'Testing',
      'Contributing',
      'License',
    ];

    const targetIndex = sectionOrder.findIndex(
      (s) => s.toLowerCase() === sectionName.toLowerCase()
    );

    if (targetIndex === -1) {
      // Unknown section, add before Contributing/License or at end
      const beforeSections = ['Contributing', 'License'];
      for (const section of beforeSections) {
        const regex = new RegExp(`\n## ${section}`, 'i');
        const match = existing.match(regex);
        if (match && match.index !== undefined) {
          return match.index;
        }
      }
      return existing.length;
    }

    // Find the section that should come after this one
    for (let i = targetIndex + 1; i < sectionOrder.length; i++) {
      const section = sectionOrder[i];
      const regex = new RegExp(`\n## ${section}`, 'i');
      const match = existing.match(regex);
      if (match && match.index !== undefined) {
        return match.index;
      }
    }

    return existing.length;
  }
}

