"""Preview; explicit --test --host RFC1918-address allows phone testing on the same LAN."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit, unquote
from http.cookies import SimpleCookie
from pathlib import Path
import argparse
import ipaddress
import os
import re

PROD = 'https://1259219143-fp8pc6xpyz.ap-guangzhou.tencentscf.com'
TEST = 'https://1259219143-3xft5qxme3.ap-guangzhou.tencentscf.com'
PREFIX = '/api/reservation-gift'
READS = {'/activity', '/mine'}
WRITES = {'POST': {'/sms', '/verify', '/reserve', '/reserve-with-code', '/lookup', '/lookup/subscribe', '/activation-code', '/subscribe', '/unsubscribe', '/logout'}, 'PATCH': {'/platform'}}
PUBLIC_ROOTS = {'index.html', 'reservation.js', 'reservation.css', 'app-ui.css', 'region.js',
                'title-plates.js', 'images', 'videos', 'audio', 'fonts', 'vendor',
                'privacy-policy', 'user-agreement'}

def preview_host(value, real_test):
    address = ipaddress.IPv4Address(value)
    if address.is_loopback:
        return str(address)
    private_networks = ('10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16')
    if not real_test or not any(address in ipaddress.IPv4Network(network) for network in private_networks):
        raise ValueError('LAN preview requires --test and an explicit RFC1918 IPv4 address')
    return str(address)

class PreviewHandler(SimpleHTTPRequestHandler):
    def origins(self):
        host, port = self.server.server_address
        if ipaddress.ip_address(host).is_loopback:
            return {f'http://{host}:{port}', f'http://localhost:{port}'}
        return {f'http://{host}:{port}'}

    def trusted_host(self):
        if 'http://' + self.headers.get('Host', '') not in self.origins():
            self.send_error(403, 'Preview host required'); return False
        return True

    def proxy(self):
        if not self.trusted_host(): return
        path = urlsplit(self.path).path
        suffix = path.removeprefix(PREFIX)
        is_read = self.command == 'GET' and suffix in READS
        allowed = (is_read or suffix in WRITES.get(self.command, set())) if self.server.real_test else self.command == 'GET' and suffix == '/activity'
        if not path.startswith(PREFIX + '/') or not allowed or self.path != path:
            self.send_error(403, 'Endpoint not permitted in this preview mode'); return
        if self.command != 'GET':
            if self.headers.get('Origin') not in self.origins():
                self.send_error(403, 'Preview origin required'); return
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
                        # Only the local preview copy changes; the upstream secure cookie remains untouched.
                        cookie['domain'] = ''; cookie['secure'] = ''; cookie['samesite'] = 'Lax'
                        self.send_header('Set-Cookie', cookie.OutputString())
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers(); self.wfile.write(payload)

    def do_GET(self):
        if not self.trusted_host(): return
        if self.path.startswith('/api/'):
            return self.proxy()
        parts = unquote(urlsplit(self.path).path).strip('/').split('/')
        if any(part.startswith('.') for part in parts) or (parts[0] and parts[0] not in PUBLIC_ROOTS):
            self.send_error(404); return
        if self.server.real_test and urlsplit(self.path).path in ('/', '/index.html'):
            html = Path('index.html').read_text(encoding='utf-8')
            host, port = self.server.server_address
            html = re.sub(r'<body\b', f'<body data-reservation-api="http://{host}:{port}" data-reservation-test="true" data-reservation-auto-open="true"', html, count=1)
            html = html.replace('</body>', '<aside style="position:fixed;bottom:0;left:0;right:0;z-index:200001;background:#fff4d0;color:#332700;text-align:center;padding:6px">测试环境：真实短信，预约仅保存到测试库</aside></body>')
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
    parser.add_argument('--host', default='127.0.0.1', help='Loopback by default; --test also permits an explicit LAN IPv4 address')
    parser.add_argument('--test', action='store_true', help='Enable real SMS and reservation writes to fixed TEST API')
    args = parser.parse_args()
    try:
        host = preview_host(args.host, args.test)
    except ValueError as error:
        parser.error(str(error))
    server = ThreadingHTTPServer((host, args.port), PreviewHandler)
    server.real_test = args.test
    print(f'Preview: http://{host}:{server.server_port}/ (test={args.test})', flush=True)
    server.serve_forever()
