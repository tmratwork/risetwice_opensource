// Type declarations for FormData Web API
declare global {
  interface FormData {
    // Ensure all FormData methods are properly typed
    get(name: string): FormDataEntryValue | null;
    getAll(name: string): FormDataEntryValue[];
    has(name: string): boolean;
    set(name: string, value: string | Blob, fileName?: string): void;
    append(name: string, value: string | Blob, fileName?: string): void;
    delete(name: string): void;
    entries(): IterableIterator<[string, FormDataEntryValue]>;
    keys(): IterableIterator<string>;
    values(): IterableIterator<FormDataEntryValue>;
    forEach(
      callbackfn: (value: FormDataEntryValue, key: string, parent: FormData) => void,
      thisArg?: unknown
    ): void;
  }
}

export {};