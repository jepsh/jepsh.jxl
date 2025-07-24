export type AtomListener = () => void;

interface DependencyNode {
  atom: Atom<any>;
  order: number; // to maintain stable ordering
}

interface DependentNode {
  atomOrEffect: Atom<any> | AtomEffect; // can be an Atom or a side effect
  order: number;
}

let currentConsumer: Atom<any> | AtomEffect | null = null;
let consumerStack: (Atom<any> | AtomEffect)[] = [];
let globalEpoch = 0;

/**
 * set current consumer for dependency tracking
 * @param consumer
 */
function setCurrentConsumer(consumer: Atom<any> | AtomEffect | null) {
  if (consumer) {
    consumerStack.push(consumer);
  } else if (consumerStack.length > 0) {
    consumerStack.pop();
  }

  currentConsumer = consumerStack[consumerStack.length - 1] || null;
}

const pendingAtoms = new Set<Atom<any>>();

let isBatchScheduled = false;

function scheduleFlush() {
  if (!isBatchScheduled) {
    isBatchScheduled = true;
    queueMicrotask(flushPendingAtoms);
  }
}

function flushPendingAtoms() {
  isBatchScheduled = false;

  // use temporary set to allow new atoms to be scheduled during this flush
  const atomsToNotify = Array.from(pendingAtoms).sort(
    (a, b) => a._lastChangedEpoch - b._lastChangedEpoch
  );

  pendingAtoms.clear();

  for (const atom of atomsToNotify) {
    atom._notifyDependents();
  }
}

export class AtomEffect {
  private _deps: Set<Atom<any>> = new Set();
  private _fn: () => void;
  private _isDisposed: boolean = false;

  constructor(fn: () => void) {
    this._fn = fn;
    this._execute();
  }

  private _execute() {
    if (this._isDisposed) return;
    for (const dep of this._deps) {
      dep._removeDependent(this);
    }

    this._deps.clear();

    const previousConsumer = currentConsumer;
    setCurrentConsumer(this);

    try {
      this._fn();
    } finally {
      setCurrentConsumer(previousConsumer);
    }
  }

  /**
   * internal method called by some Atom when added as dependency
   * @param atom
   */
  _addDependency(atom: Atom<any>) {
    if (!this._deps.has(atom)) {
      this._deps.add(atom);
      atom._addDependent(this);
    }
  }

  /**
   * internal method called by some Atom when removed as dependency.
   * @param atom
   */
  _removeDependency(atom: Atom<any>) {
    this._deps.delete(atom);
  }

  run() {
    this._execute();
  }

  dispose() {
    if (this._isDisposed) return;

    this._isDisposed = true;

    for (const dep of this._deps) {
      dep._removeDependent(this);
    }

    this._deps.clear();
  }
}

export class Atom<T> {
  private _value: T;
  private _dependents: Map<Atom<any> | AtomEffect, DependentNode> = new Map();
  private _dependencies: Map<Atom<any>, DependencyNode> = new Map();
  private _isDirty: boolean = false;

  _lastChangedEpoch: number = 0;

  private _name: string | undefined;

  /**
   * creates new Atom
   * @param initialValue
   * @param name
   */
  constructor(initialValue: T, name?: string) {
    this._value = initialValue;
    this._name = name;
  }

  get(): T {
    if (currentConsumer) {
      if (currentConsumer instanceof Atom) {
        currentConsumer._addDependency(this);
      } else if (currentConsumer instanceof AtomEffect) {
        currentConsumer._addDependency(this);
      }
    }

    return this._value;
  }

  /**
   * sets a new value for the atom
   * triggers notification if the value is different
   * @param newValue
   */
  set(newValue: T | ((prev: T) => T)): void {
    const finalValue = newValue instanceof Function ? newValue(this._value) : newValue;

    if (!this._isEqual(this._value, finalValue)) {
      this._value = finalValue;
      this._isDirty = true;
      this._lastChangedEpoch = ++globalEpoch;

      pendingAtoms.add(this);
      scheduleFlush();
    }
  }

  _notifyDependents(): void {
    if (this._isDirty) {
      this._isDirty = false;
      const sortedDependents = Array.from(this._dependents.values())
        .sort((a, b) => a.order - b.order)
        .map((node) => node.atomOrEffect);

      for (const dependent of sortedDependents) {
        if (dependent instanceof Atom) {
          dependent._pull();
        } else if (dependent instanceof AtomEffect) {
          dependent.run();
        }
      }
    }
  }

  /**
   * internal method called when this Atom's value might changed
   * TODO: for derived/computed atoms this would re-evaluate
   */
  _pull(): void {
    // console.warn("_pull called on base Atom, which should not happen unless computed.");
  }

  /**
   * internal method to add dependent (Atom or Effect)
   * @param dependent
   */
  _addDependent(dependent: Atom<any> | AtomEffect) {
    if (!this._dependents.has(dependent)) {
      this._dependents.set(dependent, { atomOrEffect: dependent, order: globalEpoch++ });
    }
  }

  /**
   * internal method to remove dependent
   * @param dependent
   */
  _removeDependent(dependent: Atom<any> | AtomEffect) {
    this._dependents.delete(dependent);
  }

  /**
   * internal method to add dependency
   * @param dependency
   */
  _addDependency(dependency: Atom<any>) {
    if (!this._dependencies.has(dependency)) {
      this._dependencies.set(dependency, { atom: dependency, order: globalEpoch++ });
      dependency._addDependent(this);
    }
  }

  /**
   * internal method to remove dependency
   * @param dependency
   */
  _removeDependency(dependency: Atom<any>) {
    if (this._dependencies.has(dependency)) {
      this._dependencies.delete(dependency);
      dependency._removeDependent(this);
    }
  }

  /**
   * performs structural equality check
   * @param a
   * @param b
   * @returns
   */
  private _isEqual(a: T, b: T): boolean {
    if (a === b) return true;
    if (a == null || b == null) return a === b;
    if (typeof a !== 'object' || typeof b !== 'object') return a === b;

    // TODO: robust solution needed for complex objects
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch (e) {
      return a === b;
    }
  }

  /**
   * gets the name of the atom
   * @returns
   */
  getName(): string | undefined {
    return this._name;
  }

  /**
   * gets current value without triggering dependency tracking
   * @returns
   */
  peek(): T {
    return this._value;
  }
}
