export function removeUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const result: any = {};
  for (const key in obj) {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result;
}

