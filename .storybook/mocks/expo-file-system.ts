/**
 * Browser stand-in for expo-file-system (aliased in .storybook/main.ts). Backs the JSON
 * key-value store in `src/core/storage` with an in-memory map — preferences read as unset and
 * writes last for the tab's lifetime, which is all a story needs.
 */

const contents = new Map<string, string>();

function childUri(parent: string | { uri: string }, name?: string): string {
  const base = typeof parent === 'string' ? parent : parent.uri;
  return name === undefined ? base : `${base.replace(/\/$/, '')}/${name}`;
}

export const Paths = {
  document: 'mock://documents',
  cache: 'mock://cache',
};

export class Directory {
  readonly uri: string;

  constructor(parent: string | Directory, name?: string) {
    this.uri = childUri(parent, name);
  }

  get exists(): boolean {
    return true;
  }

  create(_options?: { intermediates?: boolean; idempotent?: boolean }): void {}
}

export class File {
  readonly uri: string;

  constructor(parent: string | Directory, name?: string) {
    this.uri = childUri(parent, name);
  }

  get name(): string {
    return this.uri.split('/').pop() ?? this.uri;
  }

  get exists(): boolean {
    return contents.has(this.uri);
  }

  textSync(): string {
    return contents.get(this.uri) ?? '';
  }

  write(text: string): void {
    contents.set(this.uri, text);
  }

  delete(): void {
    contents.delete(this.uri);
  }
}
