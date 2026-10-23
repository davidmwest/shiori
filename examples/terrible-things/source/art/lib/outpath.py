"""Where the bg/ and cg/ generators write: --out DIR on the command line.

The output tree mirrors the game folder (DIR/bg/..., DIR/cg/...), so installing is a copy.
The default DIR is a temp folder, never the game itself.
"""
import argparse, os, tempfile

DEFAULT_ROOT = os.path.join(tempfile.gettempdir(), "terrible-things-art")


def out_path(rel, doc=None):
    """Parse --out DIR and return DIR/<rel> (for example 'bg/bakery.svg'), creating its folder."""
    ap = argparse.ArgumentParser(description=" ".join((doc or "").strip().split("\n\n")[0].split()) or None)
    ap.add_argument("--out", default=DEFAULT_ROOT, metavar="DIR",
                    help=f"output root; writes DIR/{rel} (default: %(default)s)")
    path = os.path.join(ap.parse_args().out, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    return path
