"""Loopback-only browser acceptance fixture. API responses are synthetic; no proxy or POST handler."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, parse_qs
import json

ROOT = Path(__file__).resolve().parents[1]

class Fixture(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        path = urlsplit(self.path)
        if path.path != '/':
            return super().do_GET()
        scenario = parse_qs(path.query).get('case', ['reserving'])[0]
        if scenario not in ('before', 'reserving', 'failure', 'claiming', 'ended'):
            self.send_error(400)
            return
        script = (ROOT / 'tests/acceptance_fixture.js').read_text(encoding='utf-8')
        html = (ROOT / 'index.html').read_text(encoding='utf-8')
        html = html.replace('</head>', '<script>const acceptanceScenario=' + json.dumps(scenario) + ';\n' + script + '</script></head>')
        html = html.replace('<body', '<body data-reservation-test="true" data-reservation-auto-open="true"', 1)
        html = html.replace('</body>', '<output id="qaCalls" style="position:fixed;bottom:0;left:0;z-index:200000;background:#fff;color:#111;font:12px monospace">MOCK API — isolated acceptance fixture</output></body>')
        payload = html.encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

if __name__ == '__main__':
    ThreadingHTTPServer(('127.0.0.1', 8874), Fixture).serve_forever()
