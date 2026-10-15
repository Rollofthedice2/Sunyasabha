"""Quick static check for edited Python scripts: (1) compile, (2) names read but never bound (AST), (3) a '#' comment that has swallowed a following
statement on a dense one-line script. Usage: python edit_check.py FILE [FILE ...]  (exit 1 on any problem)"""
import re, subprocess, sys, py_compile
bad = 0
for f in sys.argv[1:]:
    try: py_compile.compile(f, doraise=True)
    except py_compile.PyCompileError as e: print('COMPILE', f, e.msg.splitlines()[-1]); bad += 1; continue
    # (2) whole-module AST check without external linters: a name READ anywhere but never BOUND anywhere (assignment, import, def/class,
    # argument, for/with/except/comprehension target, global) and not a builtin is a swallowed or misspelled assignment. Coarse (ignores
    # scope), but it catches a binding that has vanished into a comment.
    import ast, builtins
    tree = ast.parse(open(f, encoding='utf-8').read()); bound, used = set(dir(builtins)) | {'__file__', '__name__'}, {}
    for n in ast.walk(tree):
        if isinstance(n, ast.Name): (bound.add(n.id) if isinstance(n.ctx, (ast.Store, ast.Del)) else used.setdefault(n.id, n.lineno))
        elif isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)): bound.add(n.name)
        elif isinstance(n, ast.arg): bound.add(n.arg)
        elif isinstance(n, (ast.Import, ast.ImportFrom)):
            for al in n.names: bound.add((al.asname or al.name).split('.')[0]) if al.name != '*' else bound.add('*')
        elif isinstance(n, ast.ExceptHandler) and n.name: bound.add(n.name)
        elif isinstance(n, (ast.Global, ast.Nonlocal)): bound.update(n.names)
    if '*' not in bound:
        for name, ln in sorted(used.items(), key=lambda kv: kv[1]):
            if name not in bound: print(f'UNDEFINED {f}:{ln}: {name}'); bad += 1
    for i, line in enumerate(open(f, encoding='utf-8'), 1):
        code, hash_, cmt = line.partition('#')
        if hash_ and code.count("'") % 2 == 0 and code.count('"') % 2 == 0 and re.search(r';\s*[A-Za-z_][A-Za-z_0-9]*(\[[^\]]*\])?\s*=[^=]', cmt):
            print(f'SWALLOWED? {f}:{i}: #{cmt.strip()[:100]}'); bad += 1
print('edit check:', 'OK' if not bad else f'{bad} problem(s)'); sys.exit(1 if bad else 0)
