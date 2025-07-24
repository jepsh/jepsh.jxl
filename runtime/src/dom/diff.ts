import { VNode, Patch, ChildMove } from './vdom';

/**
 * diffs two VNode trees and produces a list of patches to update the DOM
 * @param oldVNode
 * @param newVNode
 * @param parentDom
 * @returns
 */
export function diff(oldVNode: VNode | null, newVNode: VNode | null, parentDom: Node): Patch[] {
  const patches: Patch[] = [];
  diffNode(oldVNode, newVNode, parentDom, patches);
  return patches;
}

/**
 * internal recursive function to diff single node and its children
 * @param oldVNode
 * @param newVNode
 * @param parentDom
 * @param patches
 */
function diffNode(
  oldVNode: VNode | null,
  newVNode: VNode | null,
  parentDom: Node,
  patches: Patch[]
): void {
  if (newVNode === null) {
    // case 1: node removed
    if (oldVNode && oldVNode._dom) {
      patches.push({ type: 'REMOVE', node: oldVNode._dom });
    }

    return;
  }

  if (oldVNode === null) {
    // case 2: node added
    patches.push({ type: 'CREATE', vnode: newVNode, parentDom });
    return;
  }

  if (oldVNode.type !== newVNode.type) {
    // case 3: code type changed, replace entirely
    if (oldVNode._dom) {
      patches.push({ type: 'REPLACE', oldNode: oldVNode._dom, newVNode });
    }

    return;
  }

  // case 4: node type is the same
  const domNode = oldVNode._dom;
  if (!domNode) {
    // shouldn't happen in a normal diff cycle, but guard just in case
    console.warn('diffNode: oldVNode._dom is null for an existing node');
    return;
  }

  diffProps(domNode, oldVNode.props, newVNode.props, patches);
  diffChildren(domNode, oldVNode.children, newVNode.children, patches);
}

/**
 * compares props of two nodes and generates 'SET_PROP'/'REMOVE_PROP' patches
 * @param domNode
 * @param oldProps
 * @param newProps
 * @param patches
 */
function diffProps(domNode: Node, oldProps: any, newProps: any, patches: Patch[]): void {
  for (const name in newProps) {
    if (newProps.hasOwnProperty(name)) {
      if (oldProps[name] !== newProps[name]) {
        patches.push({ type: 'SET_PROP', node: domNode, name, value: newProps[name] });
      }
    }
  }

  for (const name in oldProps) {
    if (oldProps.hasOwnProperty(name) && !(name in newProps)) {
      patches.push({ type: 'REMOVE_PROP', node: domNode, name, value: oldProps[name] });
    }
  }
}

/**
 * compares children arrays and generates patches for additions, removals, and reorders
 * @param parentDom
 * @param oldChildren
 * @param newChildren
 * @param patches
 */
function diffChildren(
  parentDom: Node,
  oldChildren: VNode[],
  newChildren: VNode[],
  patches: Patch[]
): void {
  // TODO: use LIS for minimal moves
  const oldKeyed: { [key: string]: { vnode: VNode; index: number } } = {};
  let oldHead = 0;
  let oldTail = oldChildren.length - 1;
  let newHead = 0;
  let newTail = newChildren.length - 1;

  for (let i = 0; i < oldChildren.length; i++) {
    const child = oldChildren[i];
    if (child && child.key != null) {
      oldKeyed[child.key] = { vnode: child, index: i };
    }
  }

  const moves: ChildMove[] = [];

  while (newHead <= newTail || oldHead <= oldTail) {
    let oldHeadVNode = oldHead <= oldTail ? oldChildren[oldHead] : null;
    let oldTailVNode = oldHead <= oldTail ? oldChildren[oldTail] : null;
    let newHeadVNode = newHead <= newTail ? newChildren[newHead] : null;
    let newTailVNode = newHead <= newTail ? newChildren[newTail] : null;

    if (oldHeadVNode && newHeadVNode && oldHeadVNode.key === newHeadVNode.key) {
      diffNode(oldHeadVNode, newHeadVNode, parentDom, patches);
      oldHead++;
      newHead++;
    } else if (oldTailVNode && newTailVNode && oldTailVNode.key === newTailVNode.key) {
      diffNode(oldTailVNode, newTailVNode, parentDom, patches);
      oldTail--;
      newTail--;
    } else if (oldHeadVNode && newTailVNode && oldHeadVNode.key === newTailVNode.key) {
      diffNode(oldHeadVNode, newTailVNode, parentDom, patches);
      // TODO: physically move the DOM node
      oldHead++;
      newTail--;
    } else if (oldTailVNode && newHeadVNode && oldTailVNode.key === newHeadVNode.key) {
      diffNode(oldTailVNode, newHeadVNode, parentDom, patches);
      oldTail--;
      newHead++;
    } else {
      // case: key mismatch or new node
      if (newHeadVNode) {
        const key = newHeadVNode.key;
        if (key != null && oldKeyed[key]) {
          const { vnode: matchedOldVNode, index } = oldKeyed[key];
          diffNode(matchedOldVNode, newHeadVNode, parentDom, patches);
          oldChildren[index] = null as any;

          if (matchedOldVNode._dom) {
            moves.push({ type: 'MOVE', node: matchedOldVNode._dom, index: newHead });
          }
        } else {
          patches.push({ type: 'CREATE', vnode: newHeadVNode, parentDom });
        }
      }

      newHead++;
    }
  }

  for (let i = 0; i < oldChildren.length; i++) {
    const oldChild = oldChildren[i];
    if (oldChild && oldChild._dom) {
      patches.push({ type: 'REMOVE', node: oldChild._dom });
    }
  }

  // if there were moves, add 'REORDER_CHILDREN' patch
  // TODO: calculate the minimal set of insertions/moves
  if (moves.length > 0) {
    patches.push({ type: 'REORDER_CHILDREN', parentDom, moves });
  }
}
