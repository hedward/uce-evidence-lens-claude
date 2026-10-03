const MAX_JSON_CHARS = 1_000_000;
const MAX_STRING_CHARS = 20_000;
const MAX_DEPTH = 12;
const MAX_ARRAY_LENGTH = 100;
const MAX_OBJECT_KEYS = 100;
const MAX_NUMBER_CHARS = 256;

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export interface StrictJsonOptions {
  /** A smaller input limit, for example for a protected JWS header. */
  maxChars?: number;
}

function fail(message = "The supplied text is not valid JSON."): never {
  throw new ValidationError(message);
}

/** Decimal value as significant digits and a base-ten power, without BigInt. */
function decimalIdentity(literal: string): string {
  const parts = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(literal);
  if (!parts) return fail();
  const exponent = Number(parts[4] ?? "0");
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 1000)
    return fail("A JSON number is outside the safe range.");
  let digits = `${parts[2]}${parts[3] ?? ""}`.replace(/^0+/, "");
  if (!digits) return "0";
  let power = exponent - (parts[3]?.length ?? 0);
  while (digits.endsWith("0")) {
    digits = digits.slice(0, -1);
    power += 1;
  }
  return `${parts[1]}${digits}e${power}`;
}

class Scanner {
  private position = 0;

  constructor(private readonly text: string) {}

  scan(): void {
    this.whitespace();
    this.value(0);
    this.whitespace();
    if (this.position !== this.text.length) fail();
  }

  private whitespace(): void {
    while (/^[\t\n\r ]$/.test(this.text[this.position] ?? ""))
      this.position += 1;
  }

  private value(depth: number): void {
    if (depth > MAX_DEPTH) fail("JSON nesting is too deep.");
    const char = this.text[this.position];
    if (char === "{") return this.object(depth);
    if (char === "[") return this.array(depth);
    if (char === '"') {
      this.string();
      return;
    }
    if (char === "-" || (char !== undefined && /^[0-9]$/.test(char)))
      return this.number();
    for (const literal of ["true", "false", "null"]) {
      if (this.text.startsWith(literal, this.position)) {
        this.position += literal.length;
        return;
      }
    }
    fail();
  }

  private object(depth: number): void {
    this.position += 1;
    this.whitespace();
    if (this.text[this.position] === "}") {
      this.position += 1;
      return;
    }
    const names = new Set<string>();
    while (true) {
      if (this.text[this.position] !== '"') fail();
      const name = this.string();
      if (
        name === "__proto__" ||
        name === "constructor" ||
        name === "prototype"
      )
        fail("A JSON object contains a prohibited field name.");
      if (names.has(name))
        fail("A JSON object contains duplicate field names.");
      names.add(name);
      if (names.size > MAX_OBJECT_KEYS)
        fail("A JSON object has too many fields.");
      this.whitespace();
      if (this.text[this.position] !== ":") fail();
      this.position += 1;
      this.whitespace();
      this.value(depth + 1);
      this.whitespace();
      const next = this.text[this.position++];
      if (next === "}") return;
      if (next !== ",") fail();
      this.whitespace();
    }
  }

  private array(depth: number): void {
    this.position += 1;
    this.whitespace();
    if (this.text[this.position] === "]") {
      this.position += 1;
      return;
    }
    let count = 0;
    while (true) {
      count += 1;
      if (count > MAX_ARRAY_LENGTH) fail("A JSON array is too large.");
      this.value(depth + 1);
      this.whitespace();
      const next = this.text[this.position++];
      if (next === "]") return;
      if (next !== ",") fail();
      this.whitespace();
    }
  }

  private string(): string {
    const start = this.position++;
    let length = 0;
    let highSurrogate = false;
    const acceptUnit = (unit: number): void => {
      length += 1;
      if (length > MAX_STRING_CHARS)
        fail("A JSON string exceeds the safe display limit.");
      if (unit >= 0xdc00 && unit <= 0xdfff) {
        if (!highSurrogate)
          fail("A JSON string contains an unpaired surrogate.");
        highSurrogate = false;
      } else {
        if (highSurrogate)
          fail("A JSON string contains an unpaired surrogate.");
        highSurrogate = unit >= 0xd800 && unit <= 0xdbff;
      }
    };
    while (this.position < this.text.length) {
      const char = this.text.charCodeAt(this.position++);
      if (char === 0x22) {
        if (highSurrogate)
          fail("A JSON string contains an unpaired surrogate.");
        return JSON.parse(this.text.slice(start, this.position)) as string;
      }
      if (char === 0x5c) {
        const escaped = this.text[this.position++];
        if (escaped === "u") {
          const hex = this.text.slice(this.position, this.position + 4);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail();
          this.position += 4;
          acceptUnit(Number.parseInt(hex, 16));
        } else if (
          escaped &&
          /^[-"\\/bfnrt]$/.test(escaped) &&
          escaped !== "-"
        ) {
          acceptUnit(
            escaped === "b" ||
              escaped === "f" ||
              escaped === "n" ||
              escaped === "r" ||
              escaped === "t"
              ? 0x20
              : escaped.charCodeAt(0),
          );
        } else fail();
      } else {
        if (char < 0x20) fail();
        acceptUnit(char);
      }
    }
    fail();
  }

  private number(): void {
    const remaining = this.text.slice(this.position);
    const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(
      remaining,
    );
    if (!match) fail();
    const literal = match[0];
    if (literal.length > MAX_NUMBER_CHARS)
      fail("A JSON number is outside the safe range.");
    this.position += literal.length;
    const number = Number(literal);
    if (
      !Number.isFinite(number) ||
      (Number.isInteger(number) && !Number.isSafeInteger(number))
    )
      fail("A JSON number is outside the safe range.");
    if (decimalIdentity(literal) !== decimalIdentity(number.toString()))
      fail("A JSON number loses decimal precision.");
  }
}

/** Validate raw JSON before JSON.parse can erase duplicate names or number spelling. */
export function parseStrictJson(
  text: string,
  options: StrictJsonOptions = {},
): unknown {
  const maxChars = options.maxChars ?? MAX_JSON_CHARS;
  if (
    !Number.isSafeInteger(maxChars) ||
    maxChars < 1 ||
    maxChars > MAX_JSON_CHARS
  )
    throw new ValidationError("Invalid JSON size limit.");
  if (!text.trim()) fail("Paste a JSON record first.");
  if (text.length > maxChars) fail("JSON input exceeds 1 MB.");
  new Scanner(text).scan();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return fail();
  }
}
