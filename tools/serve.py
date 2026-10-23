#!/usr/bin/env python3
"""Static file server for developing Shiori games: like `python3 -m http.server`,
but tells the browser never to cache, so edited scripts and assets always reload.

usage: python3 tools/serve.py [port]   (serves the current folder on 127.0.0.1)
"""
import http.server, sys, functools

class NoCache(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      '.js': 'text/javascript', '.mjs': 'text/javascript', '.svg': 'image/svg+xml',
                      '.story': 'text/plain; charset=utf-8', '.lmn': 'text/plain; charset=utf-8',
                      '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.vrm': 'model/gltf-binary'}
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()
    def log_message(self, fmt, *args):
        if '404' in (fmt % args): super().log_message(fmt, *args)

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8777
http.server.ThreadingHTTPServer(('127.0.0.1', port), NoCache).serve_forever()
