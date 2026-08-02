/**
 * Browser stand-in for expo-media-library (aliased in .storybook/main.ts). Mirrors the class-based
 * API surface `src/core/videoLibrary` uses: permissions read as granted, queries return an empty
 * library, and mutations resolve without doing anything.
 */

export enum PermissionStatus {
  GRANTED = 'granted',
  UNDETERMINED = 'undetermined',
  DENIED = 'denied',
}

export type GranularPermission = 'audio' | 'photo' | 'video';

export type PermissionResponse = {
  status: PermissionStatus;
  granted: boolean;
  canAskAgain: boolean;
  accessPrivileges: 'all' | 'limited' | 'none';
  expires: 'never';
};

const GRANTED: PermissionResponse = {
  status: PermissionStatus.GRANTED,
  granted: true,
  canAskAgain: true,
  accessPrivileges: 'all',
  expires: 'never',
};

export function usePermissions(_options?: {
  granularPermissions?: GranularPermission[];
}): [PermissionResponse, () => Promise<PermissionResponse>] {
  return [GRANTED, async () => GRANTED];
}

export async function presentPermissionsPicker(
  _types?: GranularPermission[]
): Promise<void> {}

export enum AssetField {
  CREATION_TIME = 'creationTime',
  MODIFICATION_TIME = 'modificationTime',
  MEDIA_TYPE = 'mediaType',
}

export enum MediaType {
  VIDEO = 'video',
}

export type AssetMetadata = {
  id: string;
  filename: string | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  creationTime: number | null;
  modificationTime: number | null;
};

export class Query {
  eq(_field: AssetField, _value: unknown): this {
    return this;
  }
  orderBy(_order: { key: AssetField; ascending: boolean }): this {
    return this;
  }
  limit(_count: number): this {
    return this;
  }
  offset(_count: number): this {
    return this;
  }
  async exeForMetadata(): Promise<AssetMetadata[]> {
    return [];
  }
}

export class Asset {
  constructor(readonly id: string) {}

  async getUri(): Promise<string> {
    return this.id;
  }

  async getFilename(): Promise<string> {
    return 'mock-video.mp4';
  }

  static async create(_filePath: string): Promise<{ id: string }> {
    return { id: 'mock-created-asset' };
  }

  static async delete(_assets: Asset[]): Promise<void> {}
}

export type EventSubscription = { remove: () => void };

export function addListener(_listener: () => void): EventSubscription {
  return { remove: () => {} };
}
