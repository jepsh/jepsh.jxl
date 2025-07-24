export interface Node {
  type: string;
  // loc?: SourceLocation; // uncomment this for source maps/debugging
}

// export interface SourceLocation {
//   start: { line: number; column: number };
//   end: { line: number; column: number };
// }

export interface Program extends Node {
  type: 'Program';
  body: Statement[]; // `TopLevelStatement` is a `Statement` in JXL grammar
}

export type Statement = ViewDeclaration | SignalDeclaration | RenderBlock | ExpressionStatement;

export interface ViewDeclaration extends Node {
  type: 'ViewDeclaration';
  name: string;
  typeParameters: string[]; // not used in MVP v0.1
  returnType: Identifier | null; // not used in MVP v0.1
  body: BlockStatement;
}

export interface SignalDeclaration extends Node {
  type: 'SignalDeclaration';
  name: string;
  typeAnnotation: Identifier;
  initializer: Expression | null;
}

export interface RenderBlock extends Node {
  type: 'RenderBlock';
  body: BlockStatement;
}

export interface ExpressionStatement extends Node {
  type: 'ExpressionStatement';
  expression: Expression;
}

export interface BlockStatement extends Node {
  type: 'BlockStatement';
  body: Statement[]; // can contain nested statements
}

export type Expression =
  | Identifier
  | Literal
  | BinaryExpression
  | UnaryExpression
  | AssignmentExpression
  | CallExpression
  | EmbeddedExpression;

export interface Identifier extends Node {
  type: 'Identifier';
  name: string;
}

export interface Literal extends Node {
  type: 'Literal';
  value: string | number | boolean;
  valueType: 'String' | 'Int' | 'Float' | 'Boolean' | 'unknown';
}

export interface BinaryExpression extends Node {
  type: 'BinaryExpression';
  operator: string; // "+", "==", "||"
  left: Expression;
  right: Expression;
}

export interface UnaryExpression extends Node {
  type: 'UnaryExpression';
  operator: string; // "!", "-"
  argument: Expression;
}

export interface AssignmentExpression extends Node {
  type: 'AssignmentExpression';
  operator: string; // "=", "+="
  left: Identifier; // in MVP v0.1, LHS is restricted to Identifier
  right: Expression;
}

export interface CallExpression extends Node {
  type: 'CallExpression';
  callee: Identifier;
  arguments: Expression[]; // psitional arguments
  properties: Property[];
  children: Statement[];
}

export interface Property extends Node {
  type: 'Property';
  key: Identifier;
  value: Expression;
}

export interface EmbeddedExpression extends Node {
  type: 'EmbeddedExpression';
  expression: Expression;
}
