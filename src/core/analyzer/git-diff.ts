import simpleGit, { SimpleGit } from 'simple-git';

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

export interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  date: Date;
}

export class GitDiffAnalyzer {
  private git: SimpleGit;

  constructor(repoPath: string = process.cwd()) {
    this.git = simpleGit(repoPath);
  }

  async getStagedChanges(): Promise<FileChange[]> {
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
    return log.all.map((commit) => ({
      hash: commit.hash,
      message: commit.message,
      author: commit.author_name,
      date: new Date(commit.date),
    }));
  }

  private parseDiff(diffOutput: string): FileChange[] {
    if (!diffOutput.trim()) {
      return [];
    }

    const fileChanges: FileChange[] = [];
    const fileSections = this.splitByFile(diffOutput);

    for (const section of fileSections) {
      const fileChange = this.parseFileSection(section);
      if (fileChange) {
        fileChanges.push(fileChange);
      }
    }

    return fileChanges;
  }

  private splitByFile(diffOutput: string): string[] {
    // Split by "diff --git" which marks the start of each file
    const sections = diffOutput.split(/^diff --git/gm);
    return sections.filter((s) => s.trim().length > 0).map((s) => 'diff --git' + s);
  }

  private parseFileSection(section: string): FileChange | null {
    // Extract file paths from "diff --git a/path b/path" or "--- a/path" / "+++ b/path"
    const diffGitMatch = section.match(/^diff --git\s+a\/(.+?)\s+b\/(.+?)$/m);
    const oldPathMatch = section.match(/^---\s+a\/(.+?)$/m);
    const newPathMatch = section.match(/^\+\+\+\s+b\/(.+?)$/m);

    let oldPath = diffGitMatch?.[1] || oldPathMatch?.[1] || '';
    let newPath = diffGitMatch?.[2] || newPathMatch?.[1] || '';

    // Handle deleted files (newPath is /dev/null or empty)
    if (newPath === '/dev/null' || newPath === '' || section.includes('deleted file')) {
      return {
        path: oldPath,
        status: 'deleted',
        additions: 0,
        deletions: this.countLines(section, /^-/gm),
        diff: section,
        hunks: this.parseHunks(section),
      };
    }

    // Handle added files (oldPath is /dev/null or empty)
    if (oldPath === '/dev/null' || oldPath === '' || section.includes('new file')) {
      return {
        path: newPath,
        status: 'added',
        additions: this.countLines(section, /^\+/gm),
        deletions: 0,
        diff: section,
        hunks: this.parseHunks(section),
      };
    }

    // Handle renamed files
    if (oldPath !== newPath && oldPath && newPath) {
      return {
        path: newPath,
        status: 'renamed',
        additions: this.countLines(section, /^\+/gm),
        deletions: this.countLines(section, /^-/gm),
        diff: section,
        hunks: this.parseHunks(section),
      };
    }

    // Modified file
    const path = newPath || oldPath;
    if (!path) {
      return null;
    }

    return {
      path,
      status: 'modified',
      additions: this.countLines(section, /^\+/gm),
      deletions: this.countLines(section, /^-/gm),
      diff: section,
      hunks: this.parseHunks(section),
    };
  }

  private parseHunks(diffSection: string): DiffHunk[] {
    const hunks: DiffHunk[] = [];
    const hunkRegex = /^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/gm;

    let match;
    while ((match = hunkRegex.exec(diffSection)) !== null) {
      const oldStart = parseInt(match[1], 10);
      const oldLines = match[2] ? parseInt(match[2], 10) : 1;
      const newStart = parseInt(match[3], 10);
      const newLines = match[4] ? parseInt(match[4], 10) : 1;

      // Extract hunk content (lines between this hunk header and next, or end)
      const hunkStart = match.index + match[0].length;
      const nextMatch = hunkRegex.exec(diffSection);
      const hunkEnd = nextMatch ? nextMatch.index : diffSection.length;
      hunkRegex.lastIndex = hunkStart; // Reset for next iteration

      const content = diffSection.slice(hunkStart, hunkEnd).trim();

      hunks.push({
        oldStart,
        oldLines,
        newStart,
        newLines,
        content,
      });
    }

    return hunks;
  }

  private countLines(text: string, pattern: RegExp): number {
    const matches = text.match(pattern);
    return matches ? matches.length : 0;
  }
}

