#!/usr/bin/env python3
"""Property-aware hex -> semantic-token rewriter.

The rule (FRONTEND_THEMING_PLAN.md): a color is chosen by the PURPOSE of
the thing it paints, not by its shade. So the same hex maps differently
depending on which property it lands on:
  background: -> a --surface-* token
  color:      -> a --text-* token
  border*:    -> a --border-* token
Data marks (chart series, category fills, semantic status colors) are NOT
in these maps and are left alone on purpose.
"""
import re
import sys

# neutral greys only — anything with hue is a deliberate mark and stays
SURFACE = {
    '#fff': 'var(--surface-primary)',
    '#ffffff': 'var(--surface-primary)',
    'white': 'var(--surface-primary)',
    '#fafafa': 'var(--surface-tertiary)',
    '#f8f8f8': 'var(--surface-secondary)',
    '#f5f5f5': 'var(--surface-secondary)',
    '#f7f7f7': 'var(--surface-secondary)',
    '#f0f0f0': 'var(--surface-hover)',
    '#eee': 'var(--surface-hover)',
    '#eeeeee': 'var(--surface-hover)',
    '#e8e8e8': 'var(--surface-hover)',
    '#fafbfc': 'var(--surface-secondary)',
}

TEXT = {
    '#000': 'var(--text-primary)',
    '#222': 'var(--text-primary)',
    '#333': 'var(--text-primary)',
    '#333333': 'var(--text-primary)',
    '#444': 'var(--text-primary)',
    '#455': 'var(--text-secondary)',
    '#555': 'var(--text-secondary)',
    '#666': 'var(--text-secondary)',
    '#666666': 'var(--text-secondary)',
    '#777': 'var(--text-tertiary)',
    '#888': 'var(--text-tertiary)',
    '#888888': 'var(--text-tertiary)',
    '#999': 'var(--text-tertiary)',
    '#999999': 'var(--text-tertiary)',
    '#aaa': 'var(--text-tertiary)',
    '#ccc': 'var(--text-disabled)',
    '#cccccc': 'var(--text-disabled)',
}

BORDER = {
    '#ddd': 'var(--border-light)',
    '#dddddd': 'var(--border-light)',
    '#e0e0e0': 'var(--border-medium)',
    '#e0e3e9': 'var(--border-light)',
    '#eee': 'var(--border-light)',
    '#eeeeee': 'var(--border-light)',
    '#e9ecef': 'var(--border-light)',
    '#ccc': 'var(--border-medium)',
    '#cccccc': 'var(--border-medium)',
    '#999': 'var(--border-dark)',
    '#bbb': 'var(--border-medium)',
}

DECL = re.compile(r'(?m)^(\s*)([-a-z]+)\s*:\s*([^;{}]+);')


def pick(prop):
    if prop == 'background' or prop.startswith('background-color'):
        return SURFACE
    if prop == 'color' or prop.endswith('-color') and 'border' not in prop:
        return TEXT
    if prop.startswith('border') or prop == 'outline' or prop == 'outline-color':
        return BORDER
    return None


def convert(text):
    changed = [0]

    def repl(m):
        indent, prop, val = m.group(1), m.group(2), m.group(3)
        table = pick(prop)
        if table is None:
            return m.group(0)
        new = val
        for hexv, token in sorted(table.items(), key=lambda kv: -len(kv[0])):
            new = re.sub(r'(?<![\w#-])' + re.escape(hexv) + r'(?![\w])',
                         token, new, flags=re.IGNORECASE)
        if new != val:
            changed[0] += 1
        return f'{indent}{prop}: {new};'

    return DECL.sub(repl, text), changed[0]


if __name__ == '__main__':
    total = 0
    for path in sys.argv[1:]:
        with open(path) as fh:
            src = fh.read()
        out, n = convert(src)
        if n:
            with open(path, 'w') as fh:
                fh.write(out)
            print(f'{n:4d}  {path}')
            total += n
    print(f'total declarations rewritten: {total}')
