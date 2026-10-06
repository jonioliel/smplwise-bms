"""Local, synthetic WKWebView fixture. Standard-library only; binds exclusively to loopback."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import uuid

PAGE = b'''<!doctype html><html lang="he" dir="rtl"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#0b1220"><style>body{font:20px system-ui;background:#f5f7fb;padding:50px 24px}button,a{display:block;margin:20px 0;padding:14px}input{font-size:20px}</style><h1>SmplWise Arx</h1><p id="bridge"></p><p id="session"></p><p id="download-status"></p><button onclick="localStorage.setItem('fixture-session','yes');document.getElementById('session').textContent='Session retained'">Save synthetic session</button><button onclick="ArxApp.switchServer()">Switch server</button><a href="/arx/missing">Missing page</a><a href="/arx/server-error">Server error</a><a href="/arx/file.csv" download>Download CSV</a><button onclick="downloadFixtureBlob()">Download blob</button><a href="arx://servers">Servers link</a><input type="file" accept=".pdf,.zip"><script>function downloadFixtureBlob(){try{let a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['value'],{type:'text/csv'}));a.download='fixture-blob-'+Date.now()+'.csv';a.click();document.getElementById('download-status').textContent='Blob requested';}catch(e){document.getElementById('download-status').textContent=e.name;}}document.getElementById('bridge').textContent=ArxApp.platform+' / '+ArxApp.shell+' / '+Object.isFrozen(ArxApp)+' / '+navigator.userAgent;document.getElementById('session').textContent=localStorage.getItem('fixture-session')==='yes'?'Session retained':'No session';</script></html>'''

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass
    def do_GET(self):
        path = self.path.split('?')[0]
        if path == '/arx/api/v1/auth/remote-config':
            self.respond(200, json.dumps({'session': True, 'remote_path': '/arx/'}).encode(), 'application/json')
        elif path in ('/arx/', '/arx'):
            self.respond(200, PAGE, 'text/html; charset=utf-8')
        elif path == '/arx/file.csv':
            self.respond(200, b'value\nfixture\n', 'text/csv', {'Content-Disposition': 'attachment; filename="fixture-'+uuid.uuid4().hex+'.csv"'})
        elif path == '/arx/server-error':
            self.respond(503, b'Synthetic error', 'text/plain')
        else:
            self.respond(404, b'Not found', 'text/plain')
    def respond(self, status, data, mime, headers=None):
        self.send_response(status)
        self.send_header('Content-Type', mime)
        self.send_header('Content-Length', str(len(data)))
        for key,value in (headers or {}).items(): self.send_header(key,value)
        self.end_headers(); self.wfile.write(data)

if __name__ == '__main__':
    ThreadingHTTPServer(('127.0.0.1', 8099), Handler).serve_forever()
