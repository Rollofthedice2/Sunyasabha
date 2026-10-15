"""Build sync/index.html, the lyric timing page, from data/lyrics_timing.json (the timed lyric rows), data/lyrics_source_migrations.json and
sync/wave.json, filled into sync/template.html. Usage: python build.py"""
import json, hashlib
from pathlib import Path
HERE = Path(__file__).parent
source_bytes=(HERE.parent / "data" / "lyrics_timing.json").read_bytes()
lines=json.loads(source_bytes)
source_hash=hashlib.sha256(source_bytes).hexdigest()
# keep the source text, timings and flags; the page reads its initial times as est/estEnd
lines = [{**line, "est": line["start"], "estEnd": line["end"]} for line in lines]
migrations = json.loads((HERE.parent / "data" / "lyrics_source_migrations.json").read_text(encoding="utf-8"))
wave = json.loads((HERE / "wave.json").read_text())
html = (HERE / "template.html").read_text(encoding="utf-8")
safe = lambda value: json.dumps(value, ensure_ascii=False).replace("<", "\\u003c")
html = html.replace("/*WAVE*/null", safe(wave)).replace("/*LINES*/null", safe(lines)).replace("/*MIGRATIONS*/[]", safe(migrations)).replace("/*SOURCE_HASH*/null", safe(source_hash))
(HERE / "index.html").write_text(html, encoding="utf-8")
print(f"{len(lines)} canonical lines -> sync/index.html")
