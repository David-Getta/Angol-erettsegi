#!/usr/bin/env python3
# Kept in the repo so new banks can be rebalanced too: python3 scripts/rebalance-choice-keys.py content <subject>... [--dry] [--show]
"""Rebalances the answer keys of choice items (swap the correct option's text with the option at a target
letter so keys spread evenly over A–D). Conservative: an item is only changed when every letter reference
in its explanation / wrongOptions is an unambiguous option reference, which is then remapped.
Usage: shuffle.py <content-root> <subject>... [--dry] [--show]"""
import json, glob, re, sys, hashlib, collections

args = [a for a in sys.argv[1:] if not a.startswith("--")]
dry, show = "--dry" in sys.argv, "--show" in sys.argv
root, subjects = args[0], args[1:]
ASSOC_TYPES = {"asszociacio", "negyfele-asszociacio"}
POSITIONAL = re.compile(r"mindkett|egyik sem|mindegyik|fenti|előző|felsorolt|both|neither|none of|all of|beide|keine der|alle", re.I)
LABELS = re.compile(r"(?<![\w])[A-E] (?:ország|állomás|város|minta|kísérlet|személy|pont|tó|terület|régió|település|vállalat|csoport|kémcső|oldat|anyag|egyed|faj|növény|állat|sejt|vegyület|elem|test|tárgy|szakasz|görbe|grafikon|táblázat|land|Person|Stadt)\b|(?<![\w])[A-E]-(?:ban|ben|ból|ből|nál|nél|hoz|hez|ra|re)\b")
# unambiguous references to an option letter; group 1 = the letter
STRONG = [
    re.compile(r"(?:[Hh]elyes(?: válasz)?|[Mm]egoldás|Lösung|[Rr]ichtig(?:e Antwort)?|[Cc]orrect(?: answer)?)\s*:\s*([A-E])(?![\w])"),
    re.compile(r"\(([A-E])\)"),
    re.compile(r"(?<![\w(])([A-E])\)"),
    re.compile(r"„([A-E])”"),
    re.compile(r"(?<=\b(?:az|Az) )([A-E])(?= (?:opció|válasz|lehetőség))"),
    re.compile(r"(?<=\b[aA] )([B-E])(?= (?:opció|válasz|lehetőség))"),
    re.compile(r"(?<![\w])([A-E])(?= (?:opció|lehetőség))"),
    re.compile(r"(?<=\b[Oo]ption )([A-E])(?![\w])"),
    re.compile(r"(?<=\b[Aa]ntwort )([A-E])(?![\w])"),
]
# anything else that looks like a bare letter (A only when followed by punctuation – otherwise it is the Hungarian article)
LOOSE = re.compile(r"(?<![\w„(])(?:[B-E](?![\w])|A(?=\s*[.,;:”)]|$))")

def mask_strong(text):
    for p in STRONG:
        text = p.sub(lambda m: m.group(0).replace(m.group(1), "#"), text)
    return text

def remap(text, m):
    for p in STRONG:
        text = p.sub(lambda mo: mo.group(0)[: mo.start(1) - mo.start(0)] + m.get(mo.group(1), mo.group(1)) + mo.group(0)[mo.end(1) - mo.start(0):], text)
    return text

stats = collections.Counter()
for s in subjects:
    for f in sorted(glob.glob(f"{root}/{s}/**/*.json", recursive=True)):
        d = json.load(open(f, encoding="utf8"))
        if d.get("type") in ASSOC_TYPES:
            continue
        items = ([d["example"]] if d.get("example") else []) + d.get("items", []) + d.get("practice", [])
        task_text = " ".join(b.get("text", "") for b in (d.get("passage") or {}).get("blocks", [])) + " " + " ".join(i.get("prompt") or "" for i in items if i)
        task_labels = bool(LABELS.search(task_text))
        changed = False
        for it in items:
            if not it or it.get("kind") != "choice":
                continue
            stats["choice"] += 1
            keys = [o["key"] for o in it["options"]]
            if keys != list("ABCDE"[: len(keys)]) or len(keys) < 3:
                stats["skip-keys"] += 1; continue
            opts = " ".join(o["text"] for o in it["options"])
            if POSITIONAL.search(opts) or re.search(r"^\s*[A-E]\s*$", "\n".join(o["text"] for o in it["options"]), re.M) or LABELS.search(opts):
                stats["skip-options"] += 1; continue
            texts = [it.get("explanation", "")] + list((it.get("wrongOptions") or {}).values())
            if task_labels and any(LABELS.search(x) or LOOSE.search(mask_strong(x)) for x in texts):
                stats["skip-labels"] += 1; continue
            if any(LOOSE.search(mask_strong(x)) for x in texts):
                stats["skip-ambiguous"] += 1; continue
            h = int(hashlib.sha1(f"{d['id']}:{it['id']}".encode()).hexdigest(), 16)
            tgt = keys[h % len(keys)]
            cur = it["answer"]
            if tgt == cur:
                stats["kept"] += 1; continue
            m = {cur: tgt, tgt: cur}
            t = {o["key"]: o["text"] for o in it["options"]}
            t[cur], t[tgt] = t[tgt], t[cur]
            before = json.dumps(it, ensure_ascii=False)
            it["options"] = [{"key": k, "text": t[k]} for k in keys]
            if it.get("wrongOptions"):
                it["wrongOptions"] = dict(sorted({m.get(k, k): remap(v, m) for k, v in it["wrongOptions"].items()}.items()))
            it["explanation"] = remap(it["explanation"], m)
            it["answer"] = tgt
            changed = True
            stats["swapped"] += 1
            if show and any(mask_strong(x) != x for x in texts):
                print("==", f.split("/")[-1], it["id"], cur, "->", tgt, "\n  ", it["explanation"][:140], "\n  ", {k: v[:70] for k, v in (it.get("wrongOptions") or {}).items()})
        if changed and not dry:
            with open(f, "w", encoding="utf8") as fh:
                json.dump(d, fh, ensure_ascii=False, indent=2)
                fh.write("\n")
print(dict(stats))
