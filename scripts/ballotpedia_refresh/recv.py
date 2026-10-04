import http.server, sys
class H(http.server.BaseHTTPRequestHandler):
    def _c(self):
        self.send_header('Access-Control-Allow-Origin','*'); self.send_header('Access-Control-Allow-Headers','*'); self.send_header('Access-Control-Allow-Methods','POST,OPTIONS')
    def do_OPTIONS(self): self.send_response(204); self._c(); self.end_headers()
    def do_GET(self):
        self.send_response(200); self.send_header('Content-Type','text/html'); self.end_headers()
        self.wfile.write(b"<script>fetch('/'+(new URLSearchParams(location.search).get('f')||'out.json'),{method:'POST',body:window.name}).then(r=>r.text()).then(t=>document.title='done '+window.name.length)</script>posting")
    def do_POST(self):
        n=int(self.headers['Content-Length']); b=self.rfile.read(n)
        open(self.path.strip('/') or 'out.json','wb').write(b)
        self.send_response(200); self._c(); self.end_headers(); self.wfile.write(b'ok')
http.server.HTTPServer(('127.0.0.1',8765),H).serve_forever()
