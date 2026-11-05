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
FIXED = re.compile(r"^(?:Richtig|Falsch|Steht nicht im Text|True|False|Not given|Igaz|Hamis|Nem derül ki|Nincs benne)\b", re.I)
NUM = re.compile(r"^\s*[-−]?\d+(?:[.,:]\d+)?")

def numerically_ordered(texts):
    vals = []
    for t in texts:
        m = NUM.match(t)
        if not m:
            return False
        vals.append(float(m.group(0).replace(",", ".").replace(":", ".").replace("−", "-")))
    return vals == sorted(vals)
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
    re.compile(r"^([A-E])(?=[.:)] )"),
    re.compile(r"(?<![\w])([A-E])(?= [–-] )"),
    re.compile(r"(?<=\b[Aa]ntwort )([A-E])(?![\w])"),
]
# anything else that looks like a bare letter (A only when followed by punctuation – otherwise it is the Hungarian article)
LOOSE = re.compile(r"(?<![\w„(])(?:[B-E](?![\w])|A(?=\s*[.,;:”)]|$))")

def _letter_spans(text):
    """Positions of every option-letter reference, each counted once even if several patterns match it."""
    spans = {}
    for p in STRONG:
        for mo in p.finditer(text):
            spans.setdefault(mo.start(1), mo.end(1))
    return sorted(spans.items())

def _replace_spans(text, f):
    out, last = [], 0
    for a, b in _letter_spans(text):
        out.append(text[last:a]); out.append(f(text[a:b])); last = b
    out.append(text[last:])
    return "".join(out)

def mask_strong(text):
    return _replace_spans(text, lambda _: "#")

def remap(text, m):
    # single pass: a letter matched by two patterns ("Helyes: C – …") must not be remapped twice
    return _replace_spans(text, lambda letter: m.get(letter, letter))

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
        used = {}
        choice_items = [i for i in items if i and i.get("kind") == "choice"]
        answers = [i["answer"] for i in choice_items]
        if len(answers) >= 4 and max(answers.count(k) for k in set(answers)) <= -(-len(answers) // 4) + 1 and len(set(answers)) >= 3:
            stats["task-already-balanced"] += 1
            continue
        for it in items:
            if not it or it.get("kind") != "choice":
                continue
            stats["choice"] += 1
            keys = [o["key"] for o in it["options"]]
            if keys != list("ABCDE"[: len(keys)]) or len(keys) < 3:
                stats["skip-keys"] += 1; continue
            opts = " ".join(o["text"] for o in it["options"])
            if any(FIXED.match(o["text"]) for o in it["options"]) or numerically_ordered([o["text"] for o in it["options"]]):
                stats["skip-fixed-order"] += 1; continue
            if POSITIONAL.search(opts) or re.search(r"^\s*[A-E]\s*$", "\n".join(o["text"] for o in it["options"]), re.M) or LABELS.search(opts):
                stats["skip-options"] += 1; continue
            texts = [it.get("explanation", "")] + list((it.get("wrongOptions") or {}).values())
            if task_labels and any(LABELS.search(x) for x in texts):
                stats["skip-labels"] += 1; continue
            # bare letters that may or may not mean an option (column A, output "B" …): the swap must not touch them
            loose = {m.group(0) for x in texts for m in LOOSE.finditer(mask_strong(x))}
            cur = it["answer"]
            if cur in loose:
                stats["skip-ambiguous"] += 1; continue
            free = [k for k in keys if k not in loose]
            h = int(hashlib.sha1(f"{d['id']}:{it['id']}".encode()).hexdigest(), 16)
            least = min(used.get(k, 0) for k in free)
            pool = [k for k in free if used.get(k, 0) == least]
            tgt = pool[h % len(pool)]
            used[tgt] = used.get(tgt, 0) + 1
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
