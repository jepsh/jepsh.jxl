import {
  parse,
  Program,
  ViewDeclaration,
  SignalDeclaration,
  RenderBlock,
  CallExpression,
  Literal,
  Expression,
} from '@jepsh/compiler';
import { Atom, AtomEffect } from './core';
import { h, VNode, WebShellRenderer } from './dom';

interface MountOptions {
  container: Element;
}

type AtomMap = Map<string, Atom<any>>;

interface ViewInstance {
  vnode: VNode | null;
  atoms: AtomMap;
  renderEffect: AtomEffect | null;
  renderer: WebShellRenderer | null;
}

/**
 * mounts a JXL application string into a DOM container
 * @param jxlSource
 * @param options
 */
export function mount(jxlSource: string, options: MountOptions): void {
  const { container } = options;

  try {
    const ast: Program = parse(jxlSource);
    console.log('Parsed AST:', JSON.parse(JSON.stringify(ast))); // deep copy to avoid _dom refs in log

    // TODO: explicit entry point or module system
    const mainViewDecl = ast.body.find((node) => node.type === 'ViewDeclaration') as
      | ViewDeclaration
      | undefined;

    if (!mainViewDecl) {
      throw new Error('No view declaration found in JXL source.');
    }

    const viewInstance: ViewInstance = {
      vnode: null,
      atoms: new Map(),
      renderEffect: null,
      renderer: null,
    };

    const signalDecls = mainViewDecl.body.body.filter(
      (node) => node.type === 'SignalDeclaration'
    ) as SignalDeclaration[];
    for (const signalDecl of signalDecls) {
      let initialValue: any = undefined;
      if (signalDecl.initializer) {
        if (signalDecl.initializer.type === 'Literal') {
          initialValue = (signalDecl.initializer as Literal).value;
        } else {
          console.warn(
            `Complex initializers for signal '${signalDecl.name}' are not supported in MVP JIT driver.`
          );
        }
      }

      // TODO: use typeAnnotation for better default values or validation
      const atom = new Atom(initialValue, signalDecl.name);
      viewInstance.atoms.set(signalDecl.name, atom);
    }

    const renderer = new WebShellRenderer(container);
    viewInstance.renderer = renderer;

    const renderFunction = () => {
      const renderBlock = mainViewDecl.body.body.find((node) => node.type === 'RenderBlock') as
        | RenderBlock
        | undefined;
      if (!renderBlock) {
        throw new Error(`View '${mainViewDecl.name}' is missing a render block.`);
      }

      if (renderBlock.body.body.length !== 1) {
        throw new Error(
          `Render block for view '${mainViewDecl.name}' must contain exactly one root element.`
        );
      }

      const rootStmt = renderBlock.body.body[0];
      if (
        rootStmt.type !== 'ExpressionStatement' ||
        rootStmt.expression.type !== 'CallExpression'
      ) {
        throw new Error(
          `Render block for view '${mainViewDecl.name}' must contain a single UI element.`
        );
      }

      const rootCallExpr = rootStmt.expression as CallExpression;
      const vnode = interpretCallExpression(rootCallExpr, viewInstance);

      if (!viewInstance.vnode) {
        renderer.render(vnode);
      }

      viewInstance.vnode = vnode;
      return vnode;
    };

    const renderEffect = new AtomEffect(() => {
      try {
        const newVNode = renderFunction();
        if (viewInstance.vnode && viewInstance.renderer) {
          // renderer.render(newVNode); // replaces content

          // const patches = diff(viewInstance.vnode, newVNode, container);
          // renderer.patch(patches);
          viewInstance.renderer.render(newVNode);
        }
        viewInstance.vnode = newVNode;
      } catch (error) {
        console.error('Error during reactive render:', error);
      }
    });

    viewInstance.renderEffect = renderEffect;
  } catch (error) {
    console.error('Failed to mount JXL application:', error);
    container.innerHTML = `<div style="color: red;">Failed to mount JXL app: ${error instanceof Error ? error.message : String(error)}</div>`;
  }
}

/**
 * interprets CallExpression AST node (representing UI element) into VNode
 * @param callExpr
 * @param viewInstance
 * @returns
 */
function interpretCallExpression(callExpr: CallExpression, viewInstance: ViewInstance): VNode {
  const tagName = callExpr.callee.name;
  const props: Record<string, any> = {};

  for (const prop of callExpr.properties) {
    const propName = prop.key.name;
    const propValue = interpretExpression(prop.value, viewInstance);
    props[propName] = propValue;
  }

  const children: any[] = [];

  for (const childStmt of callExpr.children) {
    if (childStmt.type === 'ExpressionStatement') {
      if (childStmt.expression.type === 'CallExpression') {
        children.push(
          interpretCallExpression(childStmt.expression as CallExpression, viewInstance)
        );
      } else {
        const evaluatedChild = interpretExpression(childStmt.expression, viewInstance);
        children.push(evaluatedChild);
      }
    }
  }

  // Text("Hello") -> h(null, {nodeValue: "Hello"})
  // Button("Click") { ... } -> h("Button", ..., ["Click"])
  if (callExpr.arguments.length > 0) {
    const firstArg = callExpr.arguments[0];
    const evaluatedArg = interpretExpression(firstArg, viewInstance);

    if (children.length === 0 && typeof evaluatedArg === 'string') {
      children.push(evaluatedArg);
    } else if (children.length === 0 && typeof evaluatedArg !== 'string') {
      children.push(evaluatedArg);
    } else if (children.length > 0) {
      if (children.length === 0) {
        children.push(evaluatedArg);
      } else {
      }
    }

    if (callExpr.children.length === 0 && typeof evaluatedArg === 'string') {
      if (children.length === 0 && typeof evaluatedArg === 'string') {
        children.push(evaluatedArg);
      }
    }
  }

  return h(tagName, props, children);
}

/**
 * interprets Expression AST node into JavaScript value
 * @param expr
 * @param viewInstance
 * @returns
 */
function interpretExpression(expr: Expression, viewInstance: ViewInstance): any {
  switch (expr.type) {
    case 'Literal':
      return expr.value;
    case 'Identifier':
      const atom = viewInstance.atoms.get(expr.name);
      if (atom) {
        return atom.get();
      } else {
        console.warn(`Identifier '${expr.name}' not found in local scope.`);
        return undefined;
      }
    case 'BinaryExpression':
      const left = interpretExpression(expr.left, viewInstance);
      const right = interpretExpression(expr.right, viewInstance);
      switch (expr.operator) {
        case '+':
          return left + right;
        case '-':
          return left - right;
        case '*':
          return left * right;
        case '/':
          return left / right;
        case '==':
          return left == right;
        case '!=':
          return left != right;
        case '===':
          return left === right;
        case '!==':
          return left !== right;
        case '<':
          return left < right;
        case '<=':
          return left <= right;
        case '>':
          return left > right;
        case '>=':
          return left >= right;
        case '&&':
          return left && right;
        case '||':
          return left || right;
        default:
          throw new Error(`Unsupported binary operator: ${expr.operator}`);
      }
    case 'UnaryExpression':
      const arg = interpretExpression(expr.argument, viewInstance);
      switch (expr.operator) {
        case '!':
          return !arg;
        case '-':
          return -arg;
        case '+':
          return +arg;
        default:
          throw new Error(`Unsupported unary operator: ${expr.operator}`);
      }
    case 'AssignmentExpression':
      if (expr.left.type !== 'Identifier') {
        throw new Error('Assignment left-hand side must be an identifier (atom name) in MVP.');
      }
      const atomName = expr.left.name;
      const targetAtom = viewInstance.atoms.get(atomName);
      if (!targetAtom) {
        throw new Error(`Cannot assign to undeclared signal '${atomName}'.`);
      }

      const rightValue = interpretExpression(expr.right, viewInstance);

      switch (expr.operator) {
        case '=':
          targetAtom.set(rightValue);
          break;
        case '+=':
          targetAtom.set((prev: any) => {
            if (typeof prev !== 'number' || typeof rightValue !== 'number') {
              console.warn(`Invalid operation: ${typeof prev} += ${typeof rightValue}`);
              return prev; // or throw?
            }

            return prev + rightValue;
          });
          break;
        case '-=':
          targetAtom.set((prev: any) => {
            if (typeof prev !== 'number' || typeof rightValue !== 'number') {
              console.warn(`Invalid operation: ${typeof prev} -= ${typeof rightValue}`);
              return prev;
            }

            return prev - rightValue;
          });
          break;
        default:
          throw new Error(`Unsupported assignment operator: ${expr.operator}`);
      }
      return undefined;
    case 'EmbeddedExpression':
      // for `\(expression)` inside strings
      // evaluate the inner expression
      return interpretExpression(expr.expression, viewInstance);
    // case 'CallExpression':
    //   throw new Error('Unexpected CallExpression in interpretExpression. Should be handled by interpretCallExpression.');
    default:
      // for unhandled expression types, warn and return undefined
      console.warn(`JIT Driver: Unhandled expression type '${expr.type}'.`);
      return undefined;
  }
}
