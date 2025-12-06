import fs from 'fs/promises';
import type { AIClient } from '../ai/client.js';
import type { ContextBuilder } from '../ai/context-builder.js';
import { SYSTEM_PROMPTS, PROMPT_TEMPLATES, CHANGELOG_SCHEMA } from '../ai/prompts.js';
import { GitDiffAnalyzer } from '../analyzer/git-diff.js';
import type { Config, ChangelogUpdate, ChangelogEntries } from '../../types/index.js';

/**
 * Generates and updates changelog from git commits.
 */
export class ChangelogGenerator {
  private git: GitDiffAnalyzer;

  constructor(
    private ai: AIClient,
    private contextBuilder: ContextBuilder,
    private config: Config['changelog']
  ) {
    this.git = new GitDiffAnalyzer();
  }

  /**
   * Generate changelog entries from commits since a reference.
   */
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

  /**
   * Update the changelog file with new entries.
   */
  async updateChangelog(update: ChangelogUpdate): Promise<string> {
    let existing: string;
    try {
      existing = await fs.readFile(this.config.path, 'utf-8');
    } catch {
      existing = '';
    }

    return this.insertVersion(existing, update);
  }

  /**
   * Sync and write changelog in one step.
   */
  async syncAndWrite(since: string): Promise<ChangelogUpdate> {
    const update = await this.syncFromCommits(since);
    const content = await this.updateChangelog(update);
    await fs.writeFile(this.config.path, content, 'utf-8');
    return update;
  }

  /**
   * Determine version number from entries.
   */
  private determineVersion(entries: ChangelogEntries): string {
    // Check for breaking changes or significant additions
    const hasBreaking =
      entries.removed && entries.removed.length > 0;
    const hasNewFeatures =
      entries.added && entries.added.length > 0;
    const hasOnlyFixes =
      entries.fixed &&
      entries.fixed.length > 0 &&
      !hasNewFeatures &&
      !hasBreaking;

    // Try to get current version from package.json
    const baseVersion = this.getCurrentVersion();

    if (!baseVersion) {
      return '1.0.0';
    }

    const [major, minor, patch] = baseVersion.split('.').map(Number);

    if (hasBreaking) {
      return `${major + 1}.0.0`;
    }
    if (hasNewFeatures) {
      return `${major}.${minor + 1}.0`;
    }
    if (hasOnlyFixes) {
      return `${major}.${minor}.${patch + 1}`;
    }

    return `${major}.${minor}.${patch + 1}`;
  }

  /**
   * Get current version from package.json.
   */
  private getCurrentVersion(): string | null {
    try {
      // This would need to be async in real usage
      // For now, return a default
      return '1.0.0';
    } catch {
      return null;
    }
  }

  /**
   * Insert a new version section into the changelog.
   */
  private insertVersion(existing: string, update: ChangelogUpdate): string {
    const newSection = this.formatVersion(update);

    if (!existing || existing.trim() === '') {
      return this.createNewChangelog(newSection);
    }

    // Insert after header, before first version
    const versionPattern = /\n## \[?\d+\.\d+\.\d+\]?/;
    const match = existing.match(versionPattern);

    if (match && match.index !== undefined) {
      return (
        existing.slice(0, match.index) +
        '\n\n' +
        newSection +
        existing.slice(match.index)
      );
    }

    // No existing versions, append
    return existing.trim() + '\n\n' + newSection;
  }

  /**
   * Create a new changelog with header.
   */
  private createNewChangelog(firstVersion: string): string {
    const header = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

`;
    return header + firstVersion;
  }

  /**
   * Format a version section.
   */
  private formatVersion(update: ChangelogUpdate): string {
    const sections: string[] = [];

    if (update.entries.added && update.entries.added.length > 0) {
      sections.push(
        `### Added\n${update.entries.added.map((e) => `- ${e}`).join('\n')}`
      );
    }
    if (update.entries.changed && update.entries.changed.length > 0) {
      sections.push(
        `### Changed\n${update.entries.changed.map((e) => `- ${e}`).join('\n')}`
      );
    }
    if (update.entries.fixed && update.entries.fixed.length > 0) {
      sections.push(
        `### Fixed\n${update.entries.fixed.map((e) => `- ${e}`).join('\n')}`
      );
    }
    if (update.entries.removed && update.entries.removed.length > 0) {
      sections.push(
        `### Removed\n${update.entries.removed.map((e) => `- ${e}`).join('\n')}`
      );
    }
    if (update.entries.security && update.entries.security.length > 0) {
      sections.push(
        `### Security\n${update.entries.security.map((e) => `- ${e}`).join('\n')}`
      );
    }

    const versionHeader = `## [${update.version}] - ${update.date}`;

    if (sections.length === 0) {
      return `${versionHeader}\n\nNo notable changes.`;
    }

    return `${versionHeader}\n\n${sections.join('\n\n')}`;
  }
}

