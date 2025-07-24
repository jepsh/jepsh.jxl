import { Atom } from './atom';

interface PersistOptions {
  key?: string;
  storage?: Storage;
  serialize?: (value: any) => string;
  deserialize?: (value: string) => any;
}

const DEFAULT_OPTIONS: PersistOptions = {
  storage: typeof localStorage !== 'undefined' ? localStorage : undefined,
  serialize: (value: any) => JSON.stringify(value),
  deserialize: (value: string) => {
    try {
      return JSON.parse(value);
    } catch (e) {
      console.error('Failed to deserialize persisted value:', value);
      return undefined;
    }
  },
};

/**
 * applies persistence logic to an Atom
 * @param options
 * @returns
 *
 * @example
 * // as function
 * const myAtom = new Atom(0, 'myCounter');
 * persist({ key: 'myCounter' })(myAtom);
 *
 * @example
 * // as decorator (requires TS config)
 * class MyStore {
 *   \@persist({ key: 'userProfile' })
 *   user = new Atom(null, 'user');
 * }
 */
export function persist<T>(options: PersistOptions = {}) {
  return function (atom: Atom<T>) {
    const config = { ...DEFAULT_OPTIONS, ...options };
    const storageKey =
      config.key || atom.getName() || `atom_${Math.random().toString(36).substr(2, 9)}`;

    if (!config.storage) {
      console.warn(
        `Persistence not available for Atom '${atom.getName()}' - no storage backend found.`
      );

      return;
    }

    // 1. load initial value from storage
    try {
      const storedValueStr = config.storage.getItem(storageKey);
      if (storedValueStr !== null) {
        const storedValue = config.deserialize!(storedValueStr);
        atom.set(storedValue);
      }
    } catch (e) {
      console.error(`Failed to load persisted value for Atom '${atom.getName()}':`, e);
    }

    // 2. subscribe to changes and save to storage
    const saveToStorage = () => {
      try {
        const valueToStore = atom.peek();
        const serializedValue = config.serialize!(valueToStore);
        config.storage!.setItem(storageKey, serializedValue);
      } catch (e) {
        console.error(`Failed to persist value for Atom '${atom.getName()}':`, e);
      }
    };

    let saveTimeout: number | undefined;
    const debouncedSave = () => {
      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = window.setTimeout(saveToStorage, 10); // small debounce
    };

    atom.set = new Proxy(atom.set, {
      apply(target, thisArg, argArray) {
        // @ts-ignore - 'this' context is correct
        const result = target.apply(thisArg, argArray);
        debouncedSave();
        return result;
      },
    });

    // trigger an immediate save to ensure initial state is written
    setTimeout(saveToStorage, 0);
    console.log(`Persistence enabled for Atom '${atom.getName()}' with key '${storageKey}'`);
  };
}

// export function Persist(options: PersistOptions = {}) {
//   return function (target: any, propertyKey: string) {
//     // TODO: we need the Atom instance
//     console.warn(`@Persist decorator on property '${propertyKey}' is not fully implemented. Use persist() function instead.`);
//   };
// }
