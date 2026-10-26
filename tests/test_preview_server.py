"""LAN test preview routing; all upstream calls mocked, no real SMS or API writes."""
import http.client
import importlib.util
import io
from pathlib import Path
import threading
import unittest
from unittest.mock import patch
from http.server import ThreadingHTTPServer
from email.message import Message

spec = importlib.util.spec_from_file_location('preview', Path(__file__).resolve().parents[1] / 'preview_server.py')
preview = importlib.util.module_from_spec(spec)
spec.loader.exec_module(preview)

class PreviewTest(unittest.TestCase):
    def setUp(self):
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), preview.PreviewHandler)
        self.port = self.server.server_port
        # Socket stays loopback; model the explicit LAN address without exposing the fixture.
        self.server.server_address = ('192.168.1.4', self.port)
        self.server.real_test = True
        self.origin = f'http://192.168.1.4:{self.port}'
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.addCleanup(self.server.server_close)
        self.addCleanup(self.server.shutdown)

    def request(self, method, path, origin=None, host=None, body=None):
        conn = http.client.HTTPConnection('127.0.0.1', self.port)
        headers = {'Host': host or f'192.168.1.4:{self.port}'}
        if origin: headers['Origin'] = origin
        if body: headers['Content-Type'] = 'application/json'
        conn.request(method, path, body=body, headers=headers)
        response = conn.getresponse()
        status, data = response.status, response.read()
        conn.close()
        return status, data

    def test_lan_requires_explicit_test_and_private_address(self):
        self.assertEqual(preview.preview_host('127.0.0.1', False), '127.0.0.1')
        self.assertEqual(preview.preview_host('192.168.1.4', True), '192.168.1.4')
        for host, mode in [('192.168.1.4', False), ('0.0.0.0', True), ('8.8.8.8', True), ('example.com', True)]:
            with self.assertRaises(ValueError): preview.preview_host(host, mode)

    def test_mobile_page_pins_api_to_its_test_proxy(self):
        with patch.object(preview.Path, 'read_text', return_value='<html><body></body></html>'):
            status, data = self.request('GET', '/')
        self.assertEqual(status, 200)
        self.assertIn(f'data-reservation-api="{self.origin}"'.encode(), data)
        self.assertIn(b'data-reservation-test="true"', data)
        self.assertIn('测试环境'.encode(), data)

    def test_only_matching_origin_can_call_fixed_test_upstream(self):
        response = io.BytesIO(b'{"result":0,"data":{}}')
        response.status = 200
        response.headers = Message()
        response.headers['Content-Type'] = 'application/json'
        with patch.object(preview, 'urlopen', return_value=response) as upstream:
            status, _ = self.request('POST', preview.PREFIX + '/reserve-with-code', self.origin, body='{}')
            self.assertEqual(status, 200)
            request = upstream.call_args.args[0]
            self.assertEqual(request.full_url, preview.TEST + preview.PREFIX + '/reserve-with-code')
            self.assertEqual(request.get_header('Origin'), 'https://www.lunakoru.com')

    def test_wrong_origin_host_unknown_endpoint_and_nonpublic_files_are_denied(self):
        with patch.object(preview, 'urlopen') as upstream:
            self.assertEqual(self.request('POST', preview.PREFIX + '/reserve-with-code', 'https://untrusted.example', body='{}')[0], 403)
            self.assertEqual(self.request('GET', '/', host='untrusted.example')[0], 403)
            self.assertEqual(self.request('POST', '/api/admin/anything', self.origin, body='{}')[0], 403)
            for path in ('/.git/config', '/%2eenv', '/preview_server.py', '/tests/test_preview_server.py', '/images/../README.md'):
                self.assertEqual(self.request('GET', path)[0], 404)
            upstream.assert_not_called()

    def test_default_read_only_preview_cannot_send_sms_or_reserve(self):
        self.server.real_test = False
        with patch.object(preview, 'urlopen') as upstream:
            for path in ('/sms', '/reserve-with-code'):
                self.assertEqual(self.request('POST', preview.PREFIX + path, self.origin, body='{}')[0], 403)
            upstream.assert_not_called()

if __name__ == '__main__':
    unittest.main()
