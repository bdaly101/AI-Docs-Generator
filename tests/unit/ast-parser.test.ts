import { describe, it, expect } from 'vitest';
import { ASTParser } from '../../src/core/analyzer/ast-parser.js';

describe('ASTParser', () => {
  const parser = new ASTParser();

  describe('parse', () => {
    it('should extract function declarations', () => {
      const code = `
        export function greet(name: string): string {
          return \`Hello, \${name}!\`;
        }
      `;

      const entities = parser.parse(code, 'test.ts');

      expect(entities.length).toBeGreaterThan(0);
      const functionEntity = entities.find((e) => e.type === 'function' && e.name === 'greet');
      expect(functionEntity).toBeDefined();
      expect(functionEntity?.isExported).toBe(true);
      expect(functionEntity?.params).toHaveLength(1);
      expect(functionEntity?.params?.[0].name).toBe('name');
      expect(functionEntity?.returnType).toBe('string');
    });

    it('should extract class declarations', () => {
      const code = `
        export class Calculator {
          add(a: number, b: number): number {
            return a + b;
          }
        }
      `;

      const entities = parser.parse(code, 'test.ts');

      const classEntity = entities.find((e) => e.type === 'class' && e.name === 'Calculator');
      expect(classEntity).toBeDefined();
      expect(classEntity?.isExported).toBe(true);
    });

    it('should extract interface declarations', () => {
      const code = `
        export interface User {
          name: string;
          age: number;
        }
      `;

      const entities = parser.parse(code, 'test.ts');

      const interfaceEntity = entities.find((e) => e.type === 'interface' && e.name === 'User');
      expect(interfaceEntity).toBeDefined();
      expect(interfaceEntity?.isExported).toBe(true);
    });

    it('should extract type alias declarations', () => {
      const code = `
        export type Status = 'active' | 'inactive';
      `;

      const entities = parser.parse(code, 'test.ts');

      const typeEntity = entities.find((e) => e.type === 'type' && e.name === 'Status');
      expect(typeEntity).toBeDefined();
      expect(typeEntity?.isExported).toBe(true);
    });

    it('should extract JSDoc comments', () => {
      const code = `
        /**
         * Greets a user by name
         * @param name - The name to greet
         * @returns A greeting message
         */
        export function greet(name: string): string {
          return \`Hello, \${name}!\`;
        }
      `;

      const entities = parser.parse(code, 'test.ts');

      const functionEntity = entities.find((e) => e.type === 'function' && e.name === 'greet');
      expect(functionEntity?.jsdoc).toBeDefined();
      expect(functionEntity?.jsdoc).toContain('Greets a user');
    });

    it('should handle non-exported functions', () => {
      const code = `
        function internalHelper(): void {
          // internal function
        }
      `;

      const entities = parser.parse(code, 'test.ts');

      const functionEntity = entities.find((e) => e.type === 'function' && e.name === 'internalHelper');
      expect(functionEntity).toBeDefined();
      expect(functionEntity?.isExported).toBe(false);
    });

    it('should return empty array for invalid syntax', () => {
      const code = `const x = { invalid syntax }`;

      const entities = parser.parse(code, 'test.ts');

      // Should not throw, but may return empty or partial results
      expect(Array.isArray(entities)).toBe(true);
    });
  });
});

