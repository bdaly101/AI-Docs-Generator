import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileWriter } from '../../src/core/updater/file-writer.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('FileWriter', () => {
  const writer = new FileWriter();
  let testDir: string;

  beforeEach(async () => {
    // Create a temporary directory for test files
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'file-writer-test-'));
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('writeWithBackup', () => {
    it('should write new file without creating backup', async () => {
      const filePath = path.join(testDir, 'new-file.txt');
      const content = 'Hello, World!';

      await writer.writeWithBackup(filePath, content);

      const written = await fs.readFile(filePath, 'utf-8');
      expect(written).toBe(content);

      // No backup should exist for new files
      await expect(fs.access(`${filePath}.backup`)).rejects.toThrow();
    });

    it('should create backup when overwriting existing file', async () => {
      const filePath = path.join(testDir, 'existing.txt');
      const originalContent = 'Original content';
      const newContent = 'New content';

      // Create original file
      await fs.writeFile(filePath, originalContent);

      // Write new content (should create backup)
      await writer.writeWithBackup(filePath, newContent);

      // Check new content
      const written = await fs.readFile(filePath, 'utf-8');
      expect(written).toBe(newContent);

      // Check backup exists with original content
      const backup = await fs.readFile(`${filePath}.backup`, 'utf-8');
      expect(backup).toBe(originalContent);
    });

    it('should create parent directories if needed', async () => {
      const filePath = path.join(testDir, 'deep', 'nested', 'dir', 'file.txt');
      const content = 'Nested content';

      await writer.writeWithBackup(filePath, content);

      const written = await fs.readFile(filePath, 'utf-8');
      expect(written).toBe(content);
    });
  });

  describe('insertAtLine', () => {
    it('should insert content at specified line', async () => {
      const filePath = path.join(testDir, 'lines.txt');
      await fs.writeFile(filePath, 'Line 1\nLine 2\nLine 3');

      await writer.insertAtLine(filePath, 1, 'Inserted');

      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      expect(lines[0]).toBe('Line 1');
      expect(lines[1]).toBe('Inserted');
      expect(lines[2]).toBe('Line 2');
      expect(lines[3]).toBe('Line 3');
    });

    it('should insert at beginning with line 0', async () => {
      const filePath = path.join(testDir, 'beginning.txt');
      await fs.writeFile(filePath, 'Line 1\nLine 2');

      await writer.insertAtLine(filePath, 0, 'First');

      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      expect(lines[0]).toBe('First');
      expect(lines[1]).toBe('Line 1');
    });

    it('should create backup when inserting', async () => {
      const filePath = path.join(testDir, 'backup-insert.txt');
      const original = 'Line 1\nLine 2';
      await fs.writeFile(filePath, original);

      await writer.insertAtLine(filePath, 1, 'Inserted');

      const backup = await fs.readFile(`${filePath}.backup`, 'utf-8');
      expect(backup).toBe(original);
    });
  });

  describe('append', () => {
    it('should append to existing file', async () => {
      const filePath = path.join(testDir, 'append.txt');
      await fs.writeFile(filePath, 'Original');

      await writer.append(filePath, 'Appended');

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toContain('Original');
      expect(content).toContain('Appended');
    });

    it('should create file if not exists', async () => {
      const filePath = path.join(testDir, 'new-append.txt');

      await writer.append(filePath, 'New content');

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe('New content');
    });
  });

  describe('readOrEmpty', () => {
    it('should read existing file content', async () => {
      const filePath = path.join(testDir, 'readable.txt');
      await fs.writeFile(filePath, 'Some content');

      const content = await writer.readOrEmpty(filePath);

      expect(content).toBe('Some content');
    });

    it('should return empty string for non-existent file', async () => {
      const filePath = path.join(testDir, 'non-existent.txt');

      const content = await writer.readOrEmpty(filePath);

      expect(content).toBe('');
    });
  });

  describe('deleteBackup', () => {
    it('should delete existing backup', async () => {
      const filePath = path.join(testDir, 'with-backup.txt');
      await fs.writeFile(`${filePath}.backup`, 'Backup content');

      await writer.deleteBackup(filePath);

      await expect(fs.access(`${filePath}.backup`)).rejects.toThrow();
    });

    it('should not throw for non-existent backup', async () => {
      const filePath = path.join(testDir, 'no-backup.txt');

      await expect(writer.deleteBackup(filePath)).resolves.not.toThrow();
    });
  });

  describe('restoreFromBackup', () => {
    it('should restore file from backup', async () => {
      const filePath = path.join(testDir, 'restorable.txt');
      await fs.writeFile(filePath, 'Current content');
      await fs.writeFile(`${filePath}.backup`, 'Original content');

      const restored = await writer.restoreFromBackup(filePath);

      expect(restored).toBe(true);
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe('Original content');

      // Backup should be deleted after restore
      await expect(fs.access(`${filePath}.backup`)).rejects.toThrow();
    });

    it('should return false if no backup exists', async () => {
      const filePath = path.join(testDir, 'no-backup-restore.txt');
      await fs.writeFile(filePath, 'Content');

      const restored = await writer.restoreFromBackup(filePath);

      expect(restored).toBe(false);
    });
  });
});

