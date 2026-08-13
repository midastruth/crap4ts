import * as ts from "typescript";

import type { MethodDescriptor } from "./types.ts";

type ConcreteFunction =
  | ts.FunctionDeclaration
  | ts.FunctionExpression
  | ts.ArrowFunction
  | ts.MethodDeclaration
  | ts.GetAccessorDeclaration
  | ts.SetAccessorDeclaration;

export function parseTypeScriptMethods(filePath: string, source: string): MethodDescriptor[] {
  const scriptKind = filePath.toLowerCase().endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, scriptKind);
  const methods: MethodDescriptor[] = [];

  function collect(node: ts.Node, className: string | null): void {
    const nextClassName = classNameForNode(node, className);
    if (isConcreteFunction(node)) {
      const name = functionName(node);
      if (name !== null) {
        const startLine = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
        const endLine = sourceFile.getLineAndCharacterOfPosition(node.end).line + 1;
        methods.push({
          name,
          className: isClassMember(node) || ts.isPropertyDeclaration(node.parent) ? nextClassName : null,
          filePath,
          startLine,
          endLine,
          complexity: cyclomaticComplexity(node),
        });
      }
    }
    ts.forEachChild(node, (child) => collect(child, nextClassName));
  }

  collect(sourceFile, null);
  return methods;
}

function classNameForNode(node: ts.Node, current: string | null): string | null {
  if ((ts.isClassDeclaration(node) || ts.isClassExpression(node)) && node.name !== undefined) {
    return node.name.text;
  }
  return current;
}

function isConcreteFunction(node: ts.Node): node is ConcreteFunction {
  if (ts.isConstructorDeclaration(node)) {
    return false;
  }
  if (
    ts.isFunctionDeclaration(node)
    || ts.isFunctionExpression(node)
    || ts.isArrowFunction(node)
    || ts.isMethodDeclaration(node)
    || ts.isGetAccessorDeclaration(node)
    || ts.isSetAccessorDeclaration(node)
  ) {
    return node.body !== undefined;
  }
  return false;
}

function isClassMember(node: ConcreteFunction): boolean {
  return ts.isMethodDeclaration(node) || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node);
}

function functionName(node: ConcreteFunction): string | null {
  if (ts.isFunctionDeclaration(node)) {
    return node.name?.text ?? null;
  }
  if (ts.isMethodDeclaration(node) || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) {
    return propertyName(node.name);
  }
  if (ts.isFunctionExpression(node) && node.name !== undefined) {
    return node.name.text;
  }

  const parent = node.parent;
  if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
    return parent.name.text;
  }
  if (ts.isPropertyDeclaration(parent) || ts.isPropertyAssignment(parent)) {
    return propertyName(parent.name);
  }
  return null;
}

function propertyName(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isPrivateIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return null;
}

function cyclomaticComplexity(root: ConcreteFunction): number {
  let complexity = 1;

  function visit(node: ts.Node): void {
    if (node !== root && isAnyFunctionLike(node)) {
      return;
    }

    if (
      ts.isIfStatement(node)
      || ts.isForStatement(node)
      || ts.isForInStatement(node)
      || ts.isForOfStatement(node)
      || ts.isWhileStatement(node)
      || ts.isDoStatement(node)
      || ts.isCatchClause(node)
      || ts.isConditionalExpression(node)
      || ts.isCaseClause(node)
      || ts.isDefaultClause(node)
    ) {
      complexity += 1;
    } else if (ts.isBinaryExpression(node) && isShortCircuitOperator(node.operatorToken.kind)) {
      complexity += 1;
    }

    ts.forEachChild(node, visit);
  }

  visit(root);
  return complexity;
}

function isAnyFunctionLike(node: ts.Node): boolean {
  return ts.isFunctionDeclaration(node)
    || ts.isFunctionExpression(node)
    || ts.isArrowFunction(node)
    || ts.isMethodDeclaration(node)
    || ts.isGetAccessorDeclaration(node)
    || ts.isSetAccessorDeclaration(node)
    || ts.isConstructorDeclaration(node);
}

function isShortCircuitOperator(kind: ts.SyntaxKind): boolean {
  return kind === ts.SyntaxKind.AmpersandAmpersandToken
    || kind === ts.SyntaxKind.BarBarToken
    || kind === ts.SyntaxKind.QuestionQuestionToken;
}
