#!/usr/bin/env python3
"""Semantic (comment/quote/whitespace-insensitive) comparison of the fork's src/
against a renamed upstream src/.  See MAPMETRICS-FORK.md 1.1."""
import os, re, sys, json, difflib

FORK = sys.argv[1]
UP   = sys.argv[2]
MODE = sys.argv[3] if len(sys.argv) > 3 else "summary"

# ---------------------------------------------------------------- rename
def rename_text(s):
    # keep the style-spec package + upstream doc URLs intact
    s = s.replace('@maplibre/maplibre-gl-style-spec', '\x00SPEC\x00')
    s = re.sub(r'https?://maplibre\.org[^\s\'")\]]*', lambda m: '\x00U'+m.group(0)+'\x00', s)
    s = s.replace('maplibregl', 'mapmetricsgl')
    s = s.replace('MapLibreGL', 'MapMetricsGL')
    s = s.replace('MapLibre', 'Mapmetrics')
    s = s.replace('maplibre', 'mapmetrics')
    s = s.replace('MAPLIBRE', 'MAPMETRICS')
    s = s.replace('\x00SPEC\x00', '@maplibre/maplibre-gl-style-spec')
    s = re.sub(r'\x00U(.*?)\x00', r'\1', s)
    return s

def rename_path(p):
    return p.replace('maplibregl', 'mapmetricsgl').replace('maplibre', 'mapmetrics')

# ---------------------------------------------------------------- normalise
def strip_comments(s):
    out, i, n = [], 0, len(s)
    while i < n:
        c = s[i]
        if c in '"\'`':
            q = c; out.append(c); i += 1
            while i < n:
                if s[i] == '\\': out.append(s[i:i+2]); i += 2; continue
                out.append(s[i])
                if s[i] == q: i += 1; break
                i += 1
            continue
        if c == '/' and i+1 < n and s[i+1] == '/':
            while i < n and s[i] != '\n': i += 1
            continue
        if c == '/' and i+1 < n and s[i+1] == '*':
            j = s.find('*/', i+2); i = n if j < 0 else j+2
            out.append(' ')
            continue
        out.append(c); i += 1
    return ''.join(out)

TOKEN = re.compile(r'"(?:[^"\\]|\\.)*"|\'(?:[^\'\\]|\\.)*\'|`(?:[^`\\]|\\.)*`|[A-Za-z_$][A-Za-z0-9_$]*|\d+(?:\.\d+)?|\S')

def norm_quote(t):
    if t and t[0] == '`':
        return '`' + re.sub(r'\s+', ' ', t[1:-1]) + '`'
    if t and t[0] in '"\'':
        body = t[1:-1]
        # normalise escaped-quote style
        body = body.replace('\\"', '"').replace("\\'", "'")
        return '"' + body + '"'
    return t

def tokens(src, is_code=True):
    if is_code:
        src = strip_comments(src)
    return [norm_quote(t) for t in TOKEN.findall(src) if t not in (',', ';')]  # trailing-comma insensitive

CODE_EXT = ('.ts', '.tsx', '.js')

def read(p):
    with open(p, 'rb') as f:
        return f.read().decode('utf-8', 'replace')

def walk(root):
    out = {}
    for dp, dn, fn in os.walk(root):
        for f in fn:
            full = os.path.join(dp, f)
            out[os.path.relpath(full, root)] = full
    return out

fork = walk(os.path.join(FORK, 'src'))
up   = walk(os.path.join(UP, 'src'))
up_renamed = {rename_path(k): v for k, v in up.items()}

new_files, removed, semantic, cosmetic, identical = [], [], [], [], []

for rel in sorted(fork):
    if rel not in up_renamed:
        new_files.append(rel); continue
    a = read(fork[rel]); b = rename_text(read(up_renamed[rel]))
    if a == b:
        identical.append(rel); continue
    is_code = rel.endswith(CODE_EXT)
    ta, tb = tokens(a, is_code), tokens(b, is_code)
    if ta == tb:
        cosmetic.append(rel)
    else:
        sm = difflib.SequenceMatcher(None, tb, ta, autojunk=False)
        delta = sum(max(i2-i1, j2-j1) for tag, i1, i2, j1, j2 in sm.get_opcodes() if tag != 'equal')
        semantic.append((rel, delta, tb, ta))

for rel in sorted(up_renamed):
    if rel not in fork:
        removed.append(rel)

semantic.sort(key=lambda x: -x[1])

if MODE == "summary":
    print(f"identical:        {len(identical)}")
    print(f"cosmetic-only:    {len(cosmetic)}")
    print(f"semantic change:  {len(semantic)}")
    print(f"new in fork:      {len(new_files)}")
    print(f"deleted in fork:  {len(removed)}")
    print("\n=== SEMANTIC (delta tokens) ===")
    for rel, d, _, _ in semantic:
        print(f"{d:7d}  {rel}")
    print("\n=== COSMETIC ONLY (take upstream wholesale) ===")
    for rel in cosmetic: print(f"         {rel}")
    print("\n=== NEW IN FORK ===")
    for rel in new_files: print(f"         {rel}")
    print("\n=== DELETED IN FORK ===")
    for rel in removed: print(f"         {rel}")
elif MODE == "detail":
    want = sys.argv[4] if len(sys.argv) > 4 else None
    for rel, d, tb, ta in semantic:
        if want and want not in rel: continue
        print(f"\n########## {rel}  (delta {d})")
        sm = difflib.SequenceMatcher(None, tb, ta, autojunk=False)
        for tag, i1, i2, j1, j2 in sm.get_opcodes():
            if tag == 'equal': continue
            print(f"  -- {tag}")
            if i1 != i2: print("   UP  : " + ' '.join(tb[i1:i2])[:1500])
            if j1 != j2: print("   FORK: " + ' '.join(ta[j1:j2])[:1500])
