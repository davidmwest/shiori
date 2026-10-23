// File-system host for the CLI: Node.js, or macOS JavaScriptCore (jsc).
// jsc cannot list directories, so bin/shiori passes a file listing.

export async function createHost(argv) {
  const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
  if (isNode) {
    const fs = await import('node:fs');
    const path = await import('node:path');
    return {
      kind: 'node',
      args: process.argv.slice(2),
      print: (s) => process.stdout.write(s + '\n'),
      printErr: (s) => process.stderr.write(s + '\n'),
      read(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } },
      write(p, text) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); },
      exists(p) { try { fs.statSync(p); return true; } catch { return false; } },
      isDir(p) { try { return fs.statSync(p).isDirectory(); } catch { return false; } },
      list(dir) {
        try {
          return fs.readdirSync(dir, { recursive: true, withFileTypes: true })
            .filter(d => d.isFile())
            .map(d => path.relative(dir, path.join(d.parentPath || d.path, d.name)).split(path.sep).join('/'))
            .filter(p => !p.startsWith('.git/') && !p.includes('/node_modules/'));
        } catch { return null; }
      },
      readLine() {
        const buf = Buffer.alloc(1); let s = '';
        for (;;) { let n = 0; try { n = fs.readSync(0, buf, 0, 1, null); } catch { return null; } if (!n) return s || null; const c = buf.toString(); if (c === '\n') return s; s += c; }
      },
      exit(code) { process.exitCode = code; },
      moduleUrl(p) { return 'file://' + path.resolve(p).split(path.sep).map(encodeURIComponent).join('/').replace(/^\/?/, '/').replace(/^\/\//, '/'); },
    };
  }
  // JavaScriptCore
  const raw = Array.from(argv || []);
  let listing = null, cwdHint = null;
  const args = [];
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '--host-listing') { listing = raw[++i]; continue; }
    if (raw[i] === '--host-cwd') { cwdHint = raw[++i]; continue; }
    args.push(raw[i]);
  }
  let files = null;
  if (listing) { try { files = readFile(listing).split('\n').filter(Boolean); } catch { files = null; } }
  const fileSet = files ? new Set(files) : null;
  let listedRoot = null;
  return {
    kind: 'jsc',
    args,
    setListingRoot(dir) { listedRoot = dir.replace(/\/+$/, ''); },
    print: (s) => print(s),
    printErr: (s) => print(s),
    read(p) {
      if (fileSet && listedRoot != null) {
        const rel = relTo(listedRoot, p);
        if (rel != null && !fileSet.has(rel)) return null;
      }
      try { return readFile(p); } catch { return null; }
    },
    write(p, text) { writeFile(p, text); },
    exists(p) {
      if (fileSet && listedRoot != null) {
        const rel = relTo(listedRoot, p);
        if (rel != null) return fileSet.has(rel);
      }
      try { readFile(p); return true; } catch { return false; }
    },
    isDir() { return true; },
    list() { return files; },
    readLine() { return typeof readline === 'function' ? readline() : null; },
    exit(code) { globalThis.__shioriExit = code; },
    moduleUrl(p) { return p.startsWith('/') ? p : (cwdHint || '.') + '/' + p.replace(/^\.\//, ''); },
  };
}

function relTo(root, p) {
  const r = root === '.' || root === '' ? '' : root + '/';
  if (!r) return p.replace(/^\.\//, '');
  return p.startsWith(r) ? p.slice(r.length) : null;
}
