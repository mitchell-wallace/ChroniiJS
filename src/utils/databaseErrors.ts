export type DatabaseErrorInfo = {
  message: string;
  details?: string;
};

const isDatabaseInitFailure = (rawMessage: string): boolean => {
  const message = rawMessage.toLowerCase();
  return (
    message.includes('database initialization failed') ||
    message.includes('better-sqlite3') ||
    message.includes("cannot find module 'bindings'")
  );
};

export const getDatabaseErrorInfo = (error: unknown): DatabaseErrorInfo | null => {
  const rawMessage = error instanceof Error ? error.message : String(error);
  if (!rawMessage) return null;
  if (!isDatabaseInitFailure(rawMessage)) return null;

  const firstLine = rawMessage.split('\n')[0];
  return {
    message: 'Database failed to initialize. Reinstall the app or rebuild native dependencies.',
    details: firstLine,
  };
};
