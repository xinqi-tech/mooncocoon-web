"""Loopback preview. --test enables real reservation writes to the fixed test API only."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from http.cookies import SimpleCookie
from pathlib import Path
import argparse
import os
import re

PROD = 'https://1259219143-fp8pc6xpyz.ap-guangzhou.tencentscf.com'
TEST = 'https://1259219143-3xft5qxme3.ap-guangzhou.tencentscf.com'
PREFIX = '/api/reservation-gift'
READS = {'/activity', '/mine'}
WRITES = {'POST': {'/sms', '/verify', '/reserve', '/lookup', '/subscribe', '/unsubscribe', '/logout'}, 'PATCH': {'/platform'}}

class PreviewHandler(SimpleHTTPRequestHandler):
    def proxy(self):
        path = urlsplit(self.path).path
        suffix = path.removeprefix(PREFIX)
        is_read = self.command == 'GET' and suffix in READS
        allowed = (is_read or suffix in WRITES.get(self.command, set())) if self.server.real_test else self.command == 'GET' and suffix == '/activity'
        if not path.startswith(PREFIX + '/') or not allowed or self.path != path:
            self.send_error(403, 'Endpoint not permitted in this preview mode'); return
        if self.command != 'GET':
            origins = {f'http://127.0.0.1:{self.server.server_port}', f'http://localhost:{self.server.server_port}'}
            if self.headers.get('Origin') not in origins:
                self.send_error(403, 'Loopback origin required'); return
        length = int(self.headers.get('Content-Length', '0'))
        if length > 8192:
            self.send_error(413); return
        body = self.rfile.read(length) if length else None
        headers = {'Origin': 'https://www.lunakoru.com', 'Accept': 'application/json'}
        for name in ('Content-Type', 'Cookie', 'X-Reservation-CSRF', 'User-Agent'):
            if self.headers.get(name): headers[name] = self.headers[name]
        target = TEST if self.server.real_test else PROD
        request = Request(target + path, data=body, headers=headers, method=self.command)
        try:
            response = urlopen(request, timeout=20)
        except HTTPError as error:
            response = error
        except (URLError, TimeoutError):
            self.send_error(502, 'Test service unavailable'); return
        with response:
            payload = response.read()
            self.send_response(response.status)
            self.send_header('Content-Type', response.headers.get('Content-Type', 'application/json'))
            self.send_header('Cache-Control', 'no-store')
            if self.server.real_test:
                for value in response.headers.get_all('Set-Cookie', []):
                    cookies = SimpleCookie(); cookies.load(value)
                    for cookie in cookies.values():
                        # Only the loopback copy changes; the upstream secure cookie remains untouched.
                        cookie['domain'] = ''; cookie['secure'] = ''; cookie['samesite'] = 'Lax'
                        self.send_header('Set-Cookie', cookie.OutputString())
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers(); self.wfile.write(payload)

    def do_GET(self):
        if self.path.startswith('/api/'):
            return self.proxy()
        if self.server.real_test and urlsplit(self.path).path in ('/', '/index.html'):
            html = Path('index.html').read_text(encoding='utf-8')
            html = re.sub(r'<body\b', '<body data-reservation-test="true" data-reservation-auto-open="true"', html, count=1)
            html = html.replace('</body>', '<div class="preview-environment" role="note">真实测试环境 · 短信会实际发送，预约写入测试库</div></body>')
            payload = html.encode('utf-8')
            self.send_response(200); self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Cache-Control', 'no-store'); self.send_header('Content-Length', str(len(payload)))
            self.end_headers(); self.wfile.write(payload); return
        super().do_GET()

    def do_POST(self): self.proxy()
    def do_PATCH(self): self.proxy()

if __name__ == '__main__':
    os.chdir(Path(__file__).resolve().parent)
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8769)
    parser.add_argument('--test', action='store_true', help='Enable real SMS and reservation writes to fixed TEST API')
    args = parser.parse_args()
    server = ThreadingHTTPServer(('127.0.0.1', args.port), PreviewHandler)
    server.real_test = args.test
    server.serve_forever()
