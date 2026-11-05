#!/usr/bin/env python3
"""Matching tasks whose answers run in option order (1→A, 2→B …) let students score without reading.
This re-letters the shared option list in alphabetical order of the option texts (hash order if that is
still sequential), remaps every match answer, the wrongOptions keys and unambiguous letter references
(Helyes: C, (C), „C”, C – …) in explanations. A task with any ambiguous bare letter in its explanations
is skipped. Usage: python3 scripts/reletter-match-options.py content <subject>... [--dry]"""
import json, glob, re, sys, hashlib, unicodedata

args = [a for a in sys.argv[1:] if not a.startswith("--")]
dry = "--dry" in sys.argv
root, subjects = args[0], args[1:]
STRONG = [
    re.compile(r"(?:[Hh]elyes(?: válasz)?|[Mm]egoldás|Lösung|[Rr]ichtig(?:e Antwort)?|[Cc]orrect(?: answer)?)\s*:\s*([A-P])(?![\w])"),
    re.compile(r"\(([A-P])\)"),
    re.compile(r"(?<![\w(])([A-P])\)"),
    re.compile(r"„([A-P])”"),
    re.compile(r"(?<![\w])([A-P])(?= [–-] )"),
]
LOOSE = re.compile(r"(?<![\w„(])(?:[B-P](?![\w])|A(?=\s*[.,;:”)]|$))")

def mask(t):
    for p in STRONG:
        t = p.sub(lambda m: m.group(0).replace(m.group(1), "#"), t)
    return t

def remap(t, m):
    for p in STRONG:
        t = p.sub(lambda mo: mo.group(0)[: mo.start(1) - mo.start(0)] + m.get(mo.group(1), mo.group(1)) + mo.group(0)[mo.end(1) - mo.start(0):], t)
    return t

def sort_key(text):
    return unicodedata.normalize("NFKD", text).casefold()

def sequential(answers, keys):
    idx = [keys.index(a) for a in answers if a in keys]
    return sum(1 for a, b in zip(idx, idx[1:]) if b == a + 1) >= len(idx) - 2

for s in subjects:
    for f in sorted(glob.glob(f"{root}/{s}/**/*.json", recursive=True)):
        d = json.load(open(f, encoding="utf8"))
        items = [i for i in ([d.get("example")] + d.get("items", [])) if i and i.get("kind") == "match"]
        opts = d.get("options") or []
        if len(items) < 3 or not opts:
            continue
        keys = [o["key"] for o in opts]
        if not sequential([i["answer"] for i in items], keys):
            continue
        texts = [x for i in items for x in [i.get("explanation", "")] + list((i.get("wrongOptions") or {}).values())]
        if any(LOOSE.search(mask(t)) for t in texts):
            print("skip (ambiguous letters):", f.split("/")[-1]); continue
        order = sorted(opts, key=lambda o: sort_key(o["text"]))
        if sequential([[o["key"] for o in order].index(i["answer"]) and keys[[o["key"] for o in order].index(i["answer"])] or keys[0] for i in items], keys):
            order = sorted(opts, key=lambda o: hashlib.sha1((d["id"] + o["text"]).encode()).hexdigest())
        m = {o["key"]: keys[n] for n, o in enumerate(order)}
        d["options"] = [{**o, "key": keys[n]} for n, o in enumerate(order)]
        for it in items:
            it["answer"] = m[it["answer"]]
            if it.get("wrongOptions"):
                it["wrongOptions"] = dict(sorted({m.get(k, k): remap(v, m) for k, v in it["wrongOptions"].items()}.items()))
            it["explanation"] = remap(it.get("explanation", ""), m)
        print("relettered:", f.split("/")[-1], [i["answer"] for i in items])
        if not dry:
            with open(f, "w", encoding="utf8") as fh:
                json.dump(d, fh, ensure_ascii=False, indent=2)
                fh.write("\n")
