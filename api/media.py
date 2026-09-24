import urllib.parse, urllib.request
from http.server import BaseHTTPRequestHandler

ALLOWED=('cdninstagram.com','fbcdn.net','instagram.com')

def allowed_host(host):
    host=(host or '').lower().split(':')[0]
    return any(host==d or host.endswith('.'+d) for d in ALLOWED)

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            q=urllib.parse.urlparse(self.path).query
            url=urllib.parse.parse_qs(q).get('url',[''])[0]
            p=urllib.parse.urlparse(url)
            if p.scheme not in ('https','http') or not allowed_host(p.hostname):
                self.send_response(400); self.end_headers(); self.wfile.write(b'Invalid media URL'); return
            req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0','Referer':'https://www.instagram.com/'})
            with urllib.request.urlopen(req,timeout=25) as r:
                data=r.read()
                ctype=r.headers.get('Content-Type') or 'image/jpeg'
            self.send_response(200)
            self.send_header('Content-Type',ctype)
            self.send_header('Cache-Control','private, max-age=300')
            self.send_header('Content-Length',str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except Exception as e:
            msg=('Media fetch failed: '+type(e).__name__).encode()
            self.send_response(502); self.send_header('Content-Type','text/plain'); self.send_header('Content-Length',str(len(msg))); self.end_headers(); self.wfile.write(msg)
