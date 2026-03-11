/**
 * Safe condition parser for strategy expressions.
 *
 * Supports: indicator aliases, numeric literals, comparison operators (>, <, >=, <=, ==),
 * logical operators (AND, OR), and parentheses.
 *
 * Examples:
 *   "sma_7 > sma_30"
 *   "rsi_14 < 30"
 *   "macd_signal > 0 AND rsi_14 < 70"
 *   "(sma_7 > sma_30) AND (rsi_14 < 70 OR bollinger < 0.2)"
 *
 * NO eval() - uses a simple recursive descent parser.
 */

type Token =
  | { type: "number"; value: number }
  | { type: "identifier"; value: string }
  | { type: "operator"; value: ">" | "<" | ">=" | "<=" | "==" }
  | { type: "logical"; value: "AND" | "OR" }
  | { type: "paren"; value: "(" | ")" };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const s = input.trim();

  while (i < s.length) {
    const ch = s[i];

    // Skip whitespace
    if (ch === " " || ch === "\t") {
      i++;
      continue;
    }

    // Parentheses
    if (ch === "(" || ch === ")") {
      tokens.push({ type: "paren", value: ch });
      i++;
      continue;
    }

    // Two-char operators
    if (i + 1 < s.length) {
      const twoChar = s.slice(i, i + 2);
      if (twoChar === ">=" || twoChar === "<=" || twoChar === "==") {
        tokens.push({
          type: "operator",
          value: twoChar,
        });
        i += 2;
        continue;
      }
    }

    // Single-char operators
    if (ch === ">" || ch === "<") {
      tokens.push({ type: "operator", value: ch });
      i++;
      continue;
    }

    // Number (including negative and decimal)
    if (ch === "-" || (ch >= "0" && ch <= "9")) {
      // Check if minus is a negative sign (not subtraction)
      if (ch === "-") {
        // Minus is negative if at start, after operator, after logical, or after open paren
        if (tokens.length > 0) {
          const prev = tokens[tokens.length - 1];
          if (
            prev.type !== "operator" &&
            prev.type !== "logical" &&
            !(prev.type === "paren" && prev.value === "(")
          ) {
            // This would be subtraction — not supported
            throw new Error(
              `Unexpected '-' at position ${String(i)}. Subtraction is not supported.`
            );
          }
        }
      }
      let numStr = "";
      if (ch === "-") {
        numStr += "-";
        i++;
      }
      while (i < s.length) {
        const digit = s[i];
        if (!((digit >= "0" && digit <= "9") || digit === ".")) {
          break;
        }
        numStr += digit;
        i++;
      }
      tokens.push({ type: "number", value: parseFloat(numStr) });
      continue;
    }

    // Identifier or logical operator
    if ((ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_") {
      let ident = "";
      while (i < s.length) {
        const c = s[i];
        if (
          !(
            (c >= "a" && c <= "z") ||
            (c >= "A" && c <= "Z") ||
            (c >= "0" && c <= "9") ||
            c === "_"
          )
        ) {
          break;
        }
        ident += c;
        i++;
      }
      if (ident === "AND" || ident === "OR") {
        tokens.push({ type: "logical", value: ident });
      } else {
        tokens.push({ type: "identifier", value: ident });
      }
      continue;
    }

    throw new Error(`Unexpected character '${ch}' at position ${String(i)}`);
  }

  return tokens;
}

/*
 * Recursive descent parser for condition expressions.
 *
 * Grammar:
 *   expr     := orExpr
 *   orExpr   := andExpr ('OR' andExpr)*
 *   andExpr  := compare ('AND' compare)*
 *   compare  := value (op value)?
 *   value    := NUMBER | IDENTIFIER | '(' expr ')'
 */
class Parser {
  private pos = 0;
  constructor(
    private tokens: Token[],
    private variables: Record<string, number>
  ) {}

  evaluate(): boolean {
    const result = this.orExpr();
    if (this.pos < this.tokens.length) {
      throw new Error(
        `Unexpected token at position ${String(this.pos)}: ${JSON.stringify(this.tokens[this.pos])}`
      );
    }
    return result;
  }

  private orExpr(): boolean {
    let left = this.andExpr();
    while (this.pos < this.tokens.length) {
      const token = this.tokens[this.pos];
      if (token.type !== "logical" || token.value !== "OR") {
        break;
      }
      this.pos++; // consume OR
      const right = this.andExpr();
      left = left || right;
    }
    return left;
  }

  private andExpr(): boolean {
    let left = this.compare();
    while (this.pos < this.tokens.length) {
      const token = this.tokens[this.pos];
      if (token.type !== "logical" || token.value !== "AND") {
        break;
      }
      this.pos++; // consume AND
      const right = this.compare();
      left = left && right;
    }
    return left;
  }

  private compare(): boolean {
    const left = this.value();

    if (this.pos < this.tokens.length) {
      const token = this.tokens[this.pos];
      if (token.type === "operator") {
        const { value: op } = token;
        this.pos++; // consume operator
        const right = this.value();

        switch (op) {
          case ">":
            return left > right;
          case "<":
            return left < right;
          case ">=":
            return left >= right;
          case "<=":
            return left <= right;
          case "==":
            return left === right;
          default: {
            const _exhaustive: never = op;
            throw new Error(`Unknown operator: ${_exhaustive as string}`);
          }
        }
      }
    }

    // Bare truthy check (non-zero = true)
    return left !== 0 && !isNaN(left);
  }

  private value(): number {
    if (this.pos >= this.tokens.length) {
      throw new Error("Unexpected end of expression");
    }
    const token = this.tokens[this.pos];

    if (token.type === "number") {
      this.pos++;
      return token.value;
    }

    if (token.type === "identifier") {
      this.pos++;
      if (!(token.value in this.variables)) {
        throw new Error(`Unknown variable: ${token.value}`);
      }
      return this.variables[token.value];
    }

    if (token.type === "paren" && token.value === "(") {
      this.pos++; // consume '('
      const result = this.orExpr();
      const closeParen = this.tokens[this.pos];
      if (closeParen.type !== "paren" || closeParen.value !== ")") {
        throw new Error("Expected closing parenthesis");
      }
      this.pos++; // consume ')'
      // Return as number (boolean -> 1/0)
      return result ? 1 : 0;
    }

    throw new Error(`Unexpected token: ${JSON.stringify(token)}`);
  }
}

/**
 * Evaluate a condition expression against a set of variable values.
 *
 * @param condition - Expression string, e.g. "sma_7 > sma_30 AND rsi_14 < 70"
 * @param variables - Map of variable names to their current values
 * @returns true if the condition is met
 */
export function evaluateCondition(
  condition: string,
  variables: Record<string, number>
): boolean {
  const tokens = tokenize(condition);
  if (tokens.length === 0) {
    return false;
  }
  const parser = new Parser(tokens, variables);
  return parser.evaluate();
}

/**
 * Extract all variable names referenced in a condition expression.
 *
 * @param condition - Expression string to extract variables from
 * @returns Array of variable name strings found in the expression
 */
export function extractVariables(condition: string): string[] {
  const tokens = tokenize(condition);
  return tokens
    .filter(
      (t): t is { type: "identifier"; value: string } => t.type === "identifier"
    )
    .map((t) => t.value);
}
