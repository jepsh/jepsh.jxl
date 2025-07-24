export function isValidAppName(name: string): boolean {
  return name.length > 0 && !/[<>:"/\\|?*\x00-\x1F]/.test(name);
}

export function formatError(error: any): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
