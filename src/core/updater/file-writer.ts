import fs from 'fs/promises';
import path from 'path';

/**
 * Safe file writing utility with backup support.
 */
export class FileWriter {
  /**
   * Write content to a file, creating a backup if the file already exists.
   *
   * @param filePath - Path to the file to write
   * @param content - Content to write
   */
  async writeWithBackup(filePath: string, content: string): Promise<void> {
    const exists = await fs
      .access(filePath)
      .then(() => true)
      .catch(() => false);

    if (exists) {
      const backupPath = `${filePath}.backup`;
      await fs.copyFile(filePath, backupPath);
    }

    // Ensure directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
  }

  /**
   * Insert content at a specific line number in a file.
   *
   * @param filePath - Path to the file
   * @param line - Line number to insert at (0-indexed)
   * @param content - Content to insert
   */
  async insertAtLine(filePath: string, line: number, content: string): Promise<void> {
    const existing = await fs.readFile(filePath, 'utf-8');
    const lines = existing.split('\n');
    lines.splice(line, 0, content);
    await this.writeWithBackup(filePath, lines.join('\n'));
  }

  /**
   * Append content to a file.
   *
   * @param filePath - Path to the file
   * @param content - Content to append
   */
  async append(filePath: string, content: string): Promise<void> {
    const existing = await fs
      .readFile(filePath, 'utf-8')
      .catch(() => '');

    const newContent = existing ? `${existing.trimEnd()}\n\n${content}` : content;
    await this.writeWithBackup(filePath, newContent);
  }

  /**
   * Read a file's content, returning empty string if it doesn't exist.
   *
   * @param filePath - Path to the file
   * @returns File content or empty string
   */
  async readOrEmpty(filePath: string): Promise<string> {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch {
      return '';
    }
  }

  /**
   * Delete the backup file if it exists.
   *
   * @param filePath - Path to the original file (backup will be filePath.backup)
   */
  async deleteBackup(filePath: string): Promise<void> {
    const backupPath = `${filePath}.backup`;
    try {
      await fs.unlink(backupPath);
    } catch {
      // Backup doesn't exist, ignore
    }
  }

  /**
   * Restore a file from its backup.
   *
   * @param filePath - Path to the original file
   * @returns true if backup was restored, false if no backup existed
   */
  async restoreFromBackup(filePath: string): Promise<boolean> {
    const backupPath = `${filePath}.backup`;
    try {
      await fs.copyFile(backupPath, filePath);
      await fs.unlink(backupPath);
      return true;
    } catch {
      return false;
    }
  }
}

