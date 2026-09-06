export const toJson = <T>(value: T) => JSON.parse(JSON.stringify(value)) as T;
