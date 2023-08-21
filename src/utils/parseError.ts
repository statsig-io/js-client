export default function parseError(error: unknown): {
  name: string;
  message: string | undefined;
  trace: string | undefined;
} {
  const unwrapped = (error ?? Error('[Statsig] Error was empty')) as unknown;
  const isError = unwrapped instanceof Error;
  const name = isError ? unwrapped.name : 'No Name';
  const message = isError ? unwrapped.message : undefined;
  const trace = isError ? unwrapped.stack : getDescription(unwrapped);
  return { name, message, trace };
}

function getDescription(obj: unknown): string {
  try {
    return JSON.stringify(obj);
  } catch {
    return '[Statsig] Failed to get string for error.';
  }
}
