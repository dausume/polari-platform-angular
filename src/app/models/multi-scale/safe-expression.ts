/**
 * Tiny SAFE arithmetic-expression evaluator for IC-interface
 * `derivedParams` (e.g. "pi * bob_radius ** 2"). Recursive descent over
 * numbers, identifiers, + - * / ** and parentheses — deliberately NO
 * eval(), NO property access, NO function calls. Unknown identifiers
 * (beyond the provided scope and `pi`) throw.
 */

type Token =
  | { kind: 'num'; value: number }
  | { kind: 'ident'; name: string }
  | { kind: 'op'; op: string };

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < expr.length && /[0-9.eE]/.test(expr[j])) {
        // Allow exponent signs like 1e-3 / 1e+3.
        if ((expr[j] === 'e' || expr[j] === 'E')
            && (expr[j + 1] === '-' || expr[j + 1] === '+')) j++;
        j++;
      }
      const num = Number(expr.slice(i, j));
      if (isNaN(num)) throw new Error(`Bad number near "${expr.slice(i, j)}"`);
      tokens.push({ kind: 'num', value: num });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < expr.length && /[A-Za-z0-9_]/.test(expr[j])) j++;
      tokens.push({ kind: 'ident', name: expr.slice(i, j) });
      i = j;
      continue;
    }
    if (ch === '*' && expr[i + 1] === '*') {
      tokens.push({ kind: 'op', op: '**' });
      i += 2;
      continue;
    }
    if ('+-*/()'.includes(ch)) {
      tokens.push({ kind: 'op', op: ch });
      i++;
      continue;
    }
    throw new Error(`Unexpected character "${ch}" in expression`);
  }
  return tokens;
}

/**
 * Evaluate `expr` against `scope` (identifier → number). `pi` is always
 * available. Throws on malformed input or unknown identifiers.
 */
export function evaluateExpression(
  expr: string,
  scope: Record<string, number>,
): number {
  const tokens = tokenize(expr);
  let pos = 0;

  const peek = (): Token | undefined => tokens[pos];
  const takeOp = (op: string): boolean => {
    const t = tokens[pos];
    if (t?.kind === 'op' && t.op === op) { pos++; return true; }
    return false;
  };

  // additive := multiplicative (('+'|'-') multiplicative)*
  function additive(): number {
    let left = multiplicative();
    for (;;) {
      if (takeOp('+')) left += multiplicative();
      else if (takeOp('-')) left -= multiplicative();
      else return left;
    }
  }

  // multiplicative := power (('*'|'/') power)*
  function multiplicative(): number {
    let left = power();
    for (;;) {
      if (takeOp('*')) left *= power();
      else if (takeOp('/')) left /= power();
      else return left;
    }
  }

  // power := unary ('**' power)?   (right-associative)
  function power(): number {
    const base = unary();
    if (takeOp('**')) return Math.pow(base, power());
    return base;
  }

  // unary := ('+'|'-')* primary
  function unary(): number {
    if (takeOp('-')) return -unary();
    if (takeOp('+')) return unary();
    return primary();
  }

  function primary(): number {
    const t = peek();
    if (!t) throw new Error('Unexpected end of expression');
    if (t.kind === 'num') { pos++; return t.value; }
    if (t.kind === 'ident') {
      pos++;
      if (t.name === 'pi') return Math.PI;
      const v = scope[t.name];
      if (typeof v !== 'number' || isNaN(v)) {
        throw new Error(`Unknown identifier "${t.name}"`);
      }
      return v;
    }
    if (takeOp('(')) {
      const v = additive();
      if (!takeOp(')')) throw new Error('Missing closing parenthesis');
      return v;
    }
    throw new Error(`Unexpected token in expression`);
  }

  const result = additive();
  if (pos !== tokens.length) throw new Error('Trailing input in expression');
  if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
    throw new Error('Expression did not evaluate to a finite number');
  }
  return result;
}
