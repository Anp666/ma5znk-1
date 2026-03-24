import { auth } from '../firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  // Extract only the message from the error to avoid circularity if it's a complex object
  const errorMessage = error instanceof Error 
    ? error.message 
    : (typeof error === 'object' && error !== null ? (error as any).message || String(error) : String(error));

  const errInfo: any = {
    error: errorMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  
  let errorString: string;
  try {
    // Use a custom replacer to handle potential circularity in any part of the object
    const cache = new Set();
    errorString = JSON.stringify(errInfo, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (cache.has(value)) return '[Circular]';
        cache.add(value);
      }
      return value;
    });
  } catch (e) {
    errorString = `{"error": "${errorMessage.replace(/"/g, '\\"')}", "operationType": "${operationType}", "path": "${path || ''}", "stringifyError": "Failed to stringify error details"}`;
  }
  
  console.error('Firestore Error Details:', errorString);
  
  // Throw a new error with the JSON string as the message
  // This will be caught by the ErrorBoundary
  throw new Error(errorString);
}
