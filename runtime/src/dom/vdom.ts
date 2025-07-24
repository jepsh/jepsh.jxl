export interface VNode {
  type: string | Function | null;
  props: VNodeProps;
  children: VNode[];
  key?: string | number;
  // --- internal runtime properties (not part of JXL spec directly, used by renderer/diff) ---
  _dom?: Node | null;
  _component?: any;
}

export interface VNodeProps {
  [key: string]: any;
  // TODO: specific props could be defined for better intellisense if needed
  // children?: VNode[]; // often implicit in the VNode structure
  // key?: string | number; // also implicit
  // special handling for common props like `style`, `className`, event handlers is done in the renderer
}

export type Patch =
  | { type: 'CREATE'; vnode: VNode; parentDom: Node }
  | { type: 'REMOVE'; node: Node }
  | { type: 'SET_PROP'; node: Node; name: string; value: any }
  | { type: 'REMOVE_PROP'; node: Node; name: string; value?: any }
  | { type: 'REPLACE'; oldNode: Node; newVNode: VNode }
  | { type: 'REORDER_CHILDREN'; parentDom: Node; moves: ChildMove[] }; // reorder based on keys

export interface ChildMove {
  type: 'INSERT' | 'MOVE';
  node: Node; // DOM node to insert/move
  index: number; // target index within the parent's `childNodes`
}

/**
 * simple function to create a VNode
 * @param type
 * @param props
 * @param children
 * @param key
 * @returns
 */
export function h(
  type: string | Function | null,
  props: VNodeProps | null,
  children: (VNode | string | number | boolean | null | undefined)[] = [],
  key?: string | number
): VNode {
  // filter out null/undefined
  const normalizedChildren: VNode[] = children.flat().map((child) => {
    if (child == null || typeof child === 'boolean') {
      // null, undefined, true, false -> empty text node or comment?
      return { type: null, props: {}, children: [] };
    }

    if (typeof child === 'string' || typeof child === 'number') {
      // primitive values become text nodes
      return { type: null, props: { nodeValue: String(child) }, children: [] };
    }

    return child;
  });

  return {
    type,
    props: props || {},
    children: normalizedChildren,
    key,
  };
}
