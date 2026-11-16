// Firebase SDK disabled per user request; all persistence runs on the Express backend.

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, _operationType: OperationType, _path: string | null): never {
  if (error instanceof Error) {
    throw error;
  }
  throw new Error(String(error));
}
