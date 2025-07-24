import { VNode, Patch } from './vdom';

export class WebShellRenderer {
  private _container: Element;

  constructor(container: Element) {
    this._container = container;
  }

  /**
   * renders VNode tree into container for the first time
   * @param vnode
   */
  render(vnode: VNode): void {
    while (this._container.firstChild) {
      this._container.removeChild(this._container.firstChild);
    }

    const domNode = this._createDOMNode(vnode);
    if (domNode) {
      this._container.appendChild(domNode);
      // link the DOM node back to the VNode for future diffing
      vnode._dom = domNode;
    }
  }

  /**
   * applies list of patches to DOM
   * @param patches
   */
  patch(patches: Patch[]): void {
    for (const patch of patches) {
      this._applyPatch(patch);
    }
  }

  /**
   * internal method to apply single patch operation
   * @param patch
   */
  private _applyPatch(patch: Patch): void {
    switch (patch.type) {
      case 'CREATE':
        this._patchCreate(patch);
        break;
      case 'REMOVE':
        this._patchRemove(patch);
        break;
      case 'SET_PROP':
        this._patchSetProp(patch);
        break;
      case 'REMOVE_PROP':
        this._patchRemoveProp(patch);
        break;
      case 'REPLACE':
        this._patchReplace(patch);
        break;
      case 'REORDER_CHILDREN':
        this._patchReorderChildren(patch);
        break;
      default:
        // @ts-ignore
        console.warn(`WebShellRenderer: Unknown patch type: ${(patch as any).type}`);
    }
  }

  private _patchCreate(patch: Patch & { type: 'CREATE' }): void {
    const { vnode, parentDom } = patch;
    const domNode = this._createDOMNode(vnode);
    if (domNode) {
      parentDom.appendChild(domNode);
      vnode._dom = domNode;
    }
  }

  private _patchRemove(patch: Patch & { type: 'REMOVE' }): void {
    const { node } = patch;
    if (node.parentNode) {
      node.parentNode.removeChild(node);
    }
  }

  private _patchSetProp(patch: Patch & { type: 'SET_PROP' }): void {
    const { node, name, value } = patch;
    this._setDOMProperty(node as Element, name, value);
  }

  private _patchRemoveProp(patch: Patch & { type: 'REMOVE_PROP' }): void {
    const { node, name, value } = patch; // value might needed for event listeners
    this._removeDOMProperty(node as Element, name, value);
  }

  private _patchReplace(patch: Patch & { type: 'REPLACE' }): void {
    const { oldNode, newVNode } = patch;
    const parent = oldNode.parentNode;
    if (!parent) return; // can't replace if unattached

    const newDomNode = this._createDOMNode(newVNode);
    if (newDomNode) {
      parent.replaceChild(newDomNode, oldNode);
      newVNode._dom = newDomNode;
      // TODO: clean up old node's resources
    }
  }

  private _patchReorderChildren(patch: Patch & { type: 'REORDER_CHILDREN' }): void {
    const { parentDom, moves } = patch;

    for (const move of moves) {
      const { node, index } = move;
      if (node.parentNode !== parentDom) {
        console.warn(
          'WebShellRenderer: Attempting to move a node that is not a child of the specified parent.'
        );
        continue;
      }

      const currentChildren: Node[] = Array.from(parentDom.childNodes);
      const currentIndex = currentChildren.indexOf(node);

      if (currentIndex === -1) {
        console.warn(
          "WebShellRenderer: Node not found in parent's current children list (unexpected)."
        );
        continue;
      }

      if (currentIndex !== index) {
        const refNode = parentDom.childNodes[index] || null;
        parentDom.insertBefore(node, refNode);
      }
    }
  }

  /**
   * creates real DOM node from a VNode
   * @param vnode
   * @returns
   */
  private _createDOMNode(vnode: VNode): Node | null {
    if (vnode.type === null || vnode.type === undefined) {
      // if props.nodeValue exists, it's text node with content
      // otherwise, it's empty placeholder (could be a comment)
      if (vnode.props && vnode.props.nodeValue !== undefined) {
        return document.createTextNode(vnode.props.nodeValue);
      } else {
        return document.createTextNode('');
      }
    }

    if (typeof vnode.type === 'string') {
      const element = document.createElement(vnode.type);

      if (vnode.props) {
        for (const name in vnode.props) {
          if (vnode.props.hasOwnProperty(name)) {
            this._setDOMProperty(element, name, vnode.props[name]);
          }
        }
      }

      if (vnode.children) {
        for (const child of vnode.children) {
          const childDomNode = this._createDOMNode(child);
          if (childDomNode) {
            element.appendChild(childDomNode);
            child._dom = childDomNode;
          }
        }
      }

      return element;
    }

    if (typeof vnode.type === 'function') {
      console.warn('WebShellRenderer: Component rendering not fully implemented in MVP.');
      const componentElement = document.createElement('div');
      componentElement.textContent = `[Component: ${(vnode.type as any).name || 'Unknown'}]`;
      componentElement.style.border = '1px dashed #ccc';
      return componentElement;
    }

    return null;
  }

  /**
   * sets a property or attribute on DOM element
   * @param element
   * @param name
   * @param value
   */
  private _setDOMProperty(element: Element, name: string, value: any): void {
    if (name.startsWith('on') && typeof value === 'function') {
      const eventName = name.substring(2).toLowerCase(); // onClick -> click
      const listenerKey = `_jepsh_listener_${eventName}`;
      const oldListener = (element as any)[listenerKey];
      if (oldListener) {
        element.removeEventListener(eventName, oldListener);
      }

      (element as any)[listenerKey] = value;
      element.addEventListener(eventName, value);
      return;
    }

    if (!(element instanceof HTMLElement)) {
      if (value === true) {
        element.setAttribute(name, '');
      } else if (value === false || value == null) {
        element.removeAttribute(name);
      } else {
        element.setAttribute(name, String(value));
      }
      return;
    }

    if (name === 'style' && typeof value === 'object' && value !== null) {
      for (const styleName in value) {
        if (value.hasOwnProperty(styleName)) {
          // @ts-ignore
          element.style[styleName] = value[styleName];
        }
      }
      return;
    }

    if (name === 'className') {
      element.className = String(value);
      return;
    }

    if (name === 'class') {
      element.className = String(value);
      return;
    }

    if (name in element) {
      try {
        // @ts-ignore
        element[name] = value;
        return;
      } catch (e) {
        // fall back to setAttribute if property assignment fails
        // console.warn(`Failed to set property ${name}, falling back to attribute:`, e);
      }
    }

    if (value === true) {
      element.setAttribute(name, '');
    } else if (value === false || value == null) {
      element.removeAttribute(name);
    } else {
      element.setAttribute(name, String(value));
    }
  }

  /**
   * removes property or attribute from DOM element
   * @param element
   * @param name
   * @param oldValue
   */
  private _removeDOMProperty(element: Element, name: string, oldValue?: any): void {
    if (name.startsWith('on')) {
      const eventName = name.substring(2).toLowerCase();
      const listenerKey = `_jepsh_listener_${eventName}`;
      const listener = (element as any)[listenerKey];
      if (listener) {
        element.removeEventListener(eventName, listener);
        delete (element as any)[listenerKey];
      } else if (oldValue && typeof oldValue === 'function') {
        element.removeEventListener(eventName, oldValue);
      } else {
        // don't have reference to the old listener, can't remove it cleanly
        console.warn(
          `WebShellRenderer: Could not remove event listener for ${name} as no reference was found.`
        );
      }

      return;
    }

    if (!(element instanceof HTMLElement)) {
      element.removeAttribute(name);
      return;
    }

    if (name === 'style') {
      // element.removeAttribute('style');
      // or:
      // if (typeof oldValue === 'object') {
      //   for (const styleName in oldValue) {
      //     if (oldValue.hasOwnProperty(styleName)) {
      //       element.style[styleName] = '';
      //     }
      //   }
      // }
      element.removeAttribute('style');
      return;
    }

    if (name === 'className' || name === 'class') {
      element.className = '';
      return;
    }

    if (name in element) {
      try {
        // @ts-ignore
        element[name] = '';
        // element.checked = false;
        return;
      } catch (e) {
        element.removeAttribute(name);
      }
    }

    element.removeAttribute(name);
  }
}
