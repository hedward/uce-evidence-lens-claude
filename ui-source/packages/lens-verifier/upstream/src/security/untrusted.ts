import { parseStrictJson, ValidationError } from "./strict-json";

export { ValidationError };

export function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const prototype = Object.getPrototypeOf(value) as object | null;
  return prototype === Object.prototype || prototype === null;
}

export function parseUntrustedJson(text: string): unknown {
  return parseStrictJson(text);
}

export function requiredObject(
  value: unknown,
  label: string,
): Record<string, unknown> {
  if (!isPlainObject(value))
    throw new ValidationError(`${label} must be a JSON object.`);
  return value;
}

export function requiredString(
  value: unknown,
  label: string,
  max = 500,
): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new ValidationError(
      `${label} must be a non-empty string under ${max} characters.`,
    );
  }
  return value;
}

export function optionalString(
  value: unknown,
  label: string,
  max = 500,
): string | undefined {
  return value === undefined || value === null
    ? undefined
    : requiredString(value, label, max);
}

export function requiredInteger(
  value: unknown,
  label: string,
  min = 0,
): number {
  if (!Number.isSafeInteger(value) || (value as number) < min) {
    throw new ValidationError(
      `${label} must be an integer of at least ${min}.`,
    );
  }
  return value as number;
}

export function optionalBoolean(
  value: unknown,
  label: string,
): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "boolean")
    throw new ValidationError(`${label} must be a boolean.`);
  return value;
}

export function optionalNumber(
  value: unknown,
  label: string,
): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ValidationError(`${label} must be a finite number.`);
  }
  return value;
}

export function isSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value);
}

export function isArweaveId(value: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(value);
}

export function safeHttpsUrl(
  value: string,
  allowedHosts: readonly string[],
): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ValidationError("Enter a valid URL.");
  }
  if (url.protocol !== "https:")
    throw new ValidationError("Only HTTPS public sources are supported.");
  const allowed = allowedHosts.some(
    (host) =>
      url.hostname === host ||
      (host === "arweave.net" && url.hostname.endsWith(".arweave.net")),
  );
  if (!allowed)
    throw new ValidationError(
      "That host is not an approved public UCE source.",
    );
  if (url.username || url.password)
    throw new ValidationError("URLs containing credentials are not allowed.");
  return url;
}
