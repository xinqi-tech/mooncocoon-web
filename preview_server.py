"""Local static preview with a read-only activity proxy. No SMS/account forwarding."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.request import urlopen
from pathlib import Path
import os

UPSTREAM = "https://1259219143-fp8pc6xpyz.ap-guangzhou.tencentscf.com/api/reservation-gift/activity"


class PreviewHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/api/reservation-gift/activity":
            try:
                with urlopen(UPSTREAM, timeout=10) as response:
                    payload = response.read()
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(payload)
            except Exception:
                self.send_error(502, "Activity service unavailable")
            return
        if self.path.startswith("/api/"):
            self.send_error(403, "Local preview supports activity reads only")
            return
        super().do_GET()


if __name__ == "__main__":
    os.chdir(Path(__file__).resolve().parent)
    ThreadingHTTPServer(("127.0.0.1", 8770), PreviewHandler).serve_forever()
