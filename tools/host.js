// File-system host for the CLI: Node.js, or macOS JavaScriptCore (jsc).
// jsc cannot list directories or stat files, so bin/shiori passes a "host info"
// file (--host-info): the current folder, a listing of every folder named on the
// command line, and the subfolders next to any named path that does not exist.

export async function createHost(argv) {
  const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
  if (isNode) {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
    return {
      kind: 'node',
      args: process.argv.slice(2),
      cwd: process.cwd(),
      print: (s) => process.stdout.write(s + '\n'),
      printErr: (s) => process.stderr.write(s + '\n'),
      read(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } },
      write(p, text) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); },
      exists(p) { try { fs.statSync(p); return true; } catch { return false; } },
      isDir,
      // Folders directly inside dir (for "did you mean" on a mistyped folder).
      subdirs(dir) {
        try { return fs.readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory() || (d.isSymbolicLink() && isDir(path.join(dir, d.name)))).map(d => d.name); }
        catch { return null; }
      },
      // Same id for two paths that are the same file (through a symlink, or ./x and x).
      fileId(p) { try { const s = fs.statSync(p); return s.dev + ':' + s.ino; } catch { return null; } },
      list(dir) {
        try {
          return fs.readdirSync(dir, { recursive: true, withFileTypes: true })
            .filter(d => d.isFile())
            .map(d => path.relative(dir, path.join(d.parentPath || d.path, d.name)).split(path.sep).join('/'))
            .filter(p => !/(^|\/)(\.git|node_modules)\//.test(p));
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
  return createJscHost(argv);
}

// jsc hands over command-line arguments (and readline() input) byte by byte, as
// if they were Latin-1: 栞 arrives as "æ \u009e". Re-decode them as UTF-8.
// A string that is not valid UTF-8 that way (or already has characters above
// U+00FF) is returned unchanged.
export function fromLatin1(s) {
  if (typeof s !== 'string' || !/[\u0080-ÿ]/.test(s) || /[^\u0000-ÿ]/.test(s)) return s;
  try { return decodeURIComponent(escape(s)); } catch { return s; }
}

// Collapse "." and "x/.." segments and repeated slashes. Keeps a leading "/"
// (absolute) and leading ".." segments (relative paths that leave the folder).
export function normalizePath(p) {
  const absolute = p.startsWith('/');
  const out = [];
  for (const seg of String(p).split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') {
      if (out.length && out[out.length - 1] !== '..') out.pop();
      else if (!absolute) out.push('..');
      continue;
    }
    out.push(seg);
  }
  const s = out.join('/');
  return absolute ? '/' + s : (s || '.');
}

// jsc's readFile() and import() parse paths as URLs: "#" and "?" end the path and
// "%41" is decoded. Escape those three so an absolute path names exactly its file.
export function jscPath(abs) {
  return abs.replace(/%/g, '%25').replace(/#/g, '%23').replace(/\?/g, '%3F');
}

// The --host-info file written by bin/shiori:
//   cwd <path>                 the current folder
//   dir <path>                 a folder named on the command line, then its files:
//   f <dev:inode> ./<path>     one per file, symlinks followed
//   parent <path>              the folder above a named path that does not exist,
//   sub <name>                 then each folder in it
export function parseHostInfo(text) {
  const info = { cwd: null, dirs: [], parents: [] };
  let dir = null, parent = null;
  for (const line of String(text).split('\n')) {
    const sp = line.indexOf(' ');
    if (sp < 0) continue;
    const tag = line.slice(0, sp), rest = line.slice(sp + 1);
    if (tag === 'cwd') info.cwd = rest;
    else if (tag === 'dir') { dir = { path: rest, files: [], ids: new Map() }; info.dirs.push(dir); }
    else if (tag === 'f' && dir) {
      const sp2 = rest.indexOf(' ');
      const id = rest.slice(0, sp2), p = rest.slice(sp2 + 1).replace(/^\.\//, '');
      if (p) { dir.files.push(p); dir.ids.set(p, id); }
    }
    else if (tag === 'parent') { parent = { path: rest, subdirs: [] }; info.parents.push(parent); }
    else if (tag === 'sub' && parent) parent.subdirs.push(rest);
  }
  return info;
}

// JavaScriptCore host. sys holds jsc's globals (readFile, writeFile, print,
// printErr, readline); tests pass their own.
export function createJscHost(argv, sys = globalThis) {
  const raw = Array.from(argv || [], fromLatin1);
  let infoFile = null, cwdArg = null;
  const args = [];
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '--host-info') { infoFile = raw[++i]; continue; }
    if (raw[i] === '--host-cwd') { cwdArg = raw[++i]; continue; }
    args.push(raw[i]);
  }
  let info = null;
  if (infoFile) { try { info = parseHostInfo(sys.readFile(infoFile)); } catch { info = null; } }
  const cwd = (info && info.cwd) || cwdArg || null;
  // Absolute, normalised form of a path (relative to the current folder).
  const abs = (p) => normalizePath(p.startsWith('/') || !cwd ? p : cwd + '/' + p);
  const fsPath = (p) => { const a = abs(p); return a.startsWith('/') ? jscPath(a) : a; };
  const roots = (info ? info.dirs : []).map(d => ({ abs: abs(d.path), files: d.files, set: new Set(d.files), ids: d.ids }));
  const parents = (info ? info.parents : []).map(d => ({ abs: abs(d.path), subdirs: d.subdirs }));
  // The listed folder that holds a path, and the path inside it.
  const locate = (p) => {
    const a = abs(p);
    let best = null;
    for (const r of roots) if (a.startsWith(r.abs === '/' ? '/' : r.abs + '/') && (!best || r.abs.length > best.abs.length)) best = r;
    return best ? { root: best, rel: a.slice(best.abs === '/' ? 1 : best.abs.length + 1) } : null;
  };
  const tryRead = (p) => { try { return sys.readFile(fsPath(p)); } catch { return null; } };
  return {
    kind: 'jsc',
    args,
    cwd,
    print: (s) => sys.print(s),
    printErr: (s) => (typeof sys.printErr === 'function' ? sys.printErr : sys.print)(s),
    // Inside a listed folder the listing decides: macOS's file system ignores
    // case, but the web server the game ends up on may not.
    read(p) {
      const l = locate(p);
      if (l && !l.root.set.has(l.rel)) return null;
      return tryRead(p);
    },
    write(p, text) { sys.writeFile(fsPath(p), text); },
    exists(p) {
      const l = locate(p);
      if (l) return l.root.set.has(l.rel);
      return tryRead(p) != null;
    },
    // true / false, or null when the wrapper did not say.
    isDir(p) {
      const a = abs(p);
      if (a === abs('.') || roots.some(r => r.abs === a)) return true;
      const slash = a.lastIndexOf('/');
      const up = slash > 0 ? a.slice(0, slash) : slash === 0 ? '/' : '.';
      const par = parents.find(x => x.abs === up);
      if (par) return par.subdirs.includes(a.slice(slash + 1));
      return info ? false : null;
    },
    subdirs(dir) {
      const par = parents.find(x => x.abs === abs(dir));
      return par ? par.subdirs.slice() : null;
    },
    fileId(p) {
      const l = locate(p);
      return l ? l.root.ids.get(l.rel) || null : null;
    },
    list(dir) {
      const a = abs(dir);
      const r = roots.find(x => x.abs === a);
      return r ? r.files.slice() : null;
    },
    readLine() { return typeof sys.readline === 'function' ? fromLatin1(sys.readline()) : null; },
    exit(code) { globalThis.__shioriExit = code; },
    moduleUrl(p) { return fsPath(p); },
  };
}
