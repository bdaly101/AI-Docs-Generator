import { parse } from '@typescript-eslint/parser';
import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/types';

export interface CodeEntity {
  type: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'export';
  name: string;
  location: { start: number; end: number };
  signature?: string;
  params?: ParameterInfo[];
  returnType?: string;
  jsdoc?: string;
  isExported: boolean;
}

export interface ParameterInfo {
  name: string;
  type?: string;
  optional?: boolean;
}

export class ASTParser {
  parse(code: string, filename: string): CodeEntity[] {
    try {
      const ast = parse(code, {
        sourceType: 'module',
        ecmaVersion: 'latest',
        loc: true,
        range: true,
        comment: true,
      });

      return this.extractEntities(ast, code);
    } catch (error) {
      // If parsing fails (e.g., invalid syntax), return empty array
      console.warn(`Failed to parse ${filename}:`, error);
      return [];
    }
  }

  private extractEntities(ast: TSESTree.Program, code: string): CodeEntity[] {
    const entities: CodeEntity[] = [];

    for (const node of ast.body) {
      // Function declarations
      if (node.type === AST_NODE_TYPES.FunctionDeclaration) {
        if (node.id) {
          entities.push(this.extractFunction(node, code));
        }
      }

      // Class declarations
      if (node.type === AST_NODE_TYPES.ClassDeclaration) {
        if (node.id) {
          entities.push(this.extractClass(node, code));
        }
      }

      // Interface declarations
      if (node.type === AST_NODE_TYPES.TSInterfaceDeclaration) {
        entities.push(this.extractInterface(node, code));
      }

      // Type alias declarations
      if (node.type === AST_NODE_TYPES.TSTypeAliasDeclaration) {
        entities.push(this.extractTypeAlias(node, code));
      }

      // Export named declarations
      if (node.type === AST_NODE_TYPES.ExportNamedDeclaration) {
        if (node.declaration) {
          const entity = this.extractFromDeclaration(node.declaration, code);
          if (entity) {
            entity.isExported = true;
            entities.push(entity);
          }
        }
        // Also handle export { name } syntax
        if (node.specifiers) {
          for (const spec of node.specifiers) {
            if (spec.type === AST_NODE_TYPES.ExportSpecifier) {
              entities.push({
                type: 'export',
                name: spec.exported.name,
                location: {
                  start: spec.range[0],
                  end: spec.range[1],
                },
                isExported: true,
              });
            }
          }
        }
      }

      // Variable declarations (const, let, var)
      if (node.type === AST_NODE_TYPES.VariableDeclaration) {
        for (const declarator of node.declarations) {
          if (declarator.id.type === AST_NODE_TYPES.Identifier) {
            entities.push(this.extractVariable(declarator, node.kind, code));
          }
        }
      }
    }

    return entities;
  }

  private extractFunction(
    node: TSESTree.FunctionDeclaration,
    code: string
  ): CodeEntity {
    const name = node.id?.name || 'anonymous';
    const params = this.extractParameters(node.params);
    const returnType = this.extractReturnType(node.returnType);
    const signature = this.buildSignature(name, params, returnType);
    const jsdoc = this.extractJSDoc(node, code);

    return {
      type: 'function',
      name,
      location: {
        start: node.range[0],
        end: node.range[1],
      },
      signature,
      params,
      returnType,
      jsdoc,
      isExported: false, // Will be set by extractFromDeclaration if exported
    };
  }

  private extractClass(
    node: TSESTree.ClassDeclaration,
    code: string
  ): CodeEntity {
    const name = node.id?.name || 'AnonymousClass';
    const jsdoc = this.extractJSDoc(node, code);

    return {
      type: 'class',
      name,
      location: {
        start: node.range[0],
        end: node.range[1],
      },
      signature: `class ${name}`,
      jsdoc,
      isExported: false,
    };
  }

  private extractInterface(
    node: TSESTree.TSInterfaceDeclaration,
    code: string
  ): CodeEntity {
    const name = node.id.name;
    const jsdoc = this.extractJSDoc(node, code);

    return {
      type: 'interface',
      name,
      location: {
        start: node.range[0],
        end: node.range[1],
      },
      signature: `interface ${name}`,
      jsdoc,
      isExported: false,
    };
  }

  private extractTypeAlias(
    node: TSESTree.TSTypeAliasDeclaration,
    code: string
  ): CodeEntity {
    const name = node.id.name;
    const jsdoc = this.extractJSDoc(node, code);

    return {
      type: 'type',
      name,
      location: {
        start: node.range[0],
        end: node.range[1],
      },
      signature: `type ${name}`,
      jsdoc,
      isExported: false,
    };
  }

  private extractVariable(
    node: TSESTree.VariableDeclarator,
    kind: 'const' | 'let' | 'var',
    code: string
  ): CodeEntity {
    const name = node.id.type === AST_NODE_TYPES.Identifier ? node.id.name : 'unknown';
    const typeAnnotation =
      node.id.type === AST_NODE_TYPES.Identifier && node.id.typeAnnotation
        ? this.typeAnnotationToString(node.id.typeAnnotation.typeAnnotation)
        : undefined;

    return {
      type: 'variable',
      name,
      location: {
        start: node.range[0],
        end: node.range[1],
      },
      signature: `${kind} ${name}${typeAnnotation ? ': ' + typeAnnotation : ''}`,
      isExported: false,
    };
  }

  private extractFromDeclaration(
    declaration: TSESTree.Declaration,
    code: string
  ): CodeEntity | null {
    if (declaration.type === AST_NODE_TYPES.FunctionDeclaration) {
      return this.extractFunction(declaration, code);
    }
    if (declaration.type === AST_NODE_TYPES.ClassDeclaration) {
      return this.extractClass(declaration, code);
    }
    if (declaration.type === AST_NODE_TYPES.TSInterfaceDeclaration) {
      return this.extractInterface(declaration, code);
    }
    if (declaration.type === AST_NODE_TYPES.TSTypeAliasDeclaration) {
      return this.extractTypeAlias(declaration, code);
    }
    return null;
  }

  private extractParameters(
    params: TSESTree.Parameter[]
  ): ParameterInfo[] {
    return params.map((param) => {
      if (param.type === AST_NODE_TYPES.Identifier) {
        return {
          name: param.name,
          type: param.typeAnnotation
            ? this.typeAnnotationToString(param.typeAnnotation.typeAnnotation)
            : undefined,
          optional: false,
        };
      }
      // Handle more complex parameter types (destructuring, etc.)
      return {
        name: 'param',
        optional: false,
      };
    });
  }

  private extractReturnType(
    returnType: TSESTree.TSTypeAnnotation | null | undefined
  ): string | undefined {
    if (!returnType) {
      return undefined;
    }
    return this.typeAnnotationToString(returnType.typeAnnotation);
  }

  private typeAnnotationToString(typeAnnotation: TSESTree.TSType): string {
    // Simplified type string extraction
    // This is a basic implementation - could be enhanced
    if (typeAnnotation.type === AST_NODE_TYPES.TSTypeReference) {
      return typeAnnotation.typeName.type === AST_NODE_TYPES.Identifier
        ? typeAnnotation.typeName.name
        : 'unknown';
    }
    if (typeAnnotation.type === AST_NODE_TYPES.TSStringKeyword) {
      return 'string';
    }
    if (typeAnnotation.type === AST_NODE_TYPES.TSNumberKeyword) {
      return 'number';
    }
    if (typeAnnotation.type === AST_NODE_TYPES.TSBooleanKeyword) {
      return 'boolean';
    }
    if (typeAnnotation.type === AST_NODE_TYPES.TSVoidKeyword) {
      return 'void';
    }
    return 'unknown';
  }

  private extractJSDoc(node: TSESTree.Node, code: string): string | undefined {
    // Look for JSDoc comments before the node
    const nodeStart = node.range[0];
    const beforeNode = code.slice(0, nodeStart);

    // Match /** ... */ style comments
    const jsdocRegex = /\/\*\*[\s\S]*?\*\//g;
    const matches = beforeNode.match(jsdocRegex);

    if (matches && matches.length > 0) {
      // Return the last comment before the node (most likely the one for this node)
      return matches[matches.length - 1].trim();
    }

    return undefined;
  }

  private buildSignature(
    name: string,
    params: ParameterInfo[],
    returnType?: string
  ): string {
    const paramStr = params
      .map((p) => `${p.name}${p.optional ? '?' : ''}${p.type ? ': ' + p.type : ''}`)
      .join(', ');
    return `${name}(${paramStr})${returnType ? ': ' + returnType : ''}`;
  }
}

