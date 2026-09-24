import io, json, re, urllib.parse, urllib.request
from http.server import BaseHTTPRequestHandler
import instaloader
import requests

def clean(s):
    s = re.sub(r'[^A-Za-z0-9._-]+', '_', str(s or '')).strip('_')
    return s[:100] or 'item'

class handler(BaseHTTPRequestHandler):
    def _json(self, code, obj):
        data=json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Content-Length',str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        try:
            n=int(self.headers.get('content-length','0') or '0')
            body=json.loads(self.rfile.read(n) or b'{}')
            username=clean((body.get('username') or '').lstrip('@'))
            if not username:
                return self._json(400,{'error':'Chybí username.'})
            want_feed=bool(body.get('feed',True))
            want_hl=bool(body.get('highlights',True))
            sessionid=(body.get('sessionid') or '').strip()

            L=instaloader.Instaloader(
                download_pictures=False, download_videos=False,
                download_video_thumbnails=False, download_geotags=False,
                download_comments=False, save_metadata=False,
                compress_json=False, quiet=True
            )
            if sessionid:
                L.context._session.cookies.set('sessionid', sessionid, domain='.instagram.com')
                L.context.username='session_user'

            # Instagram has become unreliable for Instaloader's default profile lookup.
            # Try the normal path first, then the current web endpoint with browser-like headers.
            try:
                profile=instaloader.Profile.from_username(L.context, username)
            except Exception:
                url=f"https://www.instagram.com/api/v1/users/web_profile_info/?username={urllib.parse.quote(username)}"
                headers={
                    "X-IG-App-ID":"936619743392459",
                    "X-ASBD-ID":"198387",
                    "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
                    "Accept":"*/*",
                    "Referer":f"https://www.instagram.com/{username}/",
                }
                if sessionid:
                    headers["Cookie"]=f"sessionid={sessionid}"
                resp=requests.get(url,headers=headers,timeout=20)
                if resp.status_code in (401,403,429):
                    hint=" Vlož sessionid svého Instagram účtu a spusť znovu." if not sessionid else " Instagram blokuje tento serverový požadavek i s vloženou session."
                    return self._json(resp.status_code if resp.status_code!=429 else 429,{
                        'error':f'Instagram odmítl načtení profilu (HTTP {resp.status_code}).'+hint
                    })
                if resp.status_code==404:
                    return self._json(404,{'error':'Instagram profil nebyl nalezen.'})
                try:
                    payload=resp.json()
                except Exception:
                    return self._json(502,{'error':'Instagram vrátil neplatnou odpověď. Zkus vložit sessionid svého Instagram účtu.'})
                user=(payload.get("data") or {}).get("user")
                if not user:
                    return self._json(502,{'error':'Instagram nevrátil data profilu. Zkus vložit sessionid svého Instagram účtu.'})
                profile=instaloader.Profile(L.context,user)
            if profile.is_private:
                return self._json(403,{'error':'Profil je soukromý. Tato aplikace je určená pro veřejné profily.'})

            items=[]
            warnings=[]

            if want_feed:
                try:
                    for post in profile.get_posts():
                        stamp=post.date_utc.strftime('%Y-%m-%d_%H-%M-%S')
                        base=f"feed/{stamp}_{post.shortcode}"
                        if post.typename == 'GraphSidecar':
                            j=0
                            for node in post.get_sidecar_nodes():
                                j+=1
                                url=node.display_url
                                items.append({'path':f'{base}_{j}.jpg','url':url})
                        else:
                            items.append({'path':f'{base}.jpg','url':post.url})
                except Exception as e:
                    warnings.append('Feed se nepodařilo načíst kompletně: '+type(e).__name__)

            if want_hl:
                if not sessionid:
                    warnings.append('Highlights nebyly načteny: Instagram je přes Instaloader poskytuje jen přihlášené session. Vlož sessionid a spusť znovu.')
                else:
                    try:
                        for h in L.get_highlights(profile):
                            title=clean(h.title)
                            idx=0
                            for story in h.get_items():
                                idx+=1
                                stamp=story.date_utc.strftime('%Y-%m-%d_%H-%M-%S')
                                items.append({'path':f'highlights/{title}/{stamp}_{idx}.jpg','url':story.url})
                    except Exception as e:
                        warnings.append('Highlights se nepodařilo načíst: '+type(e).__name__)

            return self._json(200,{'username':username,'items':items,'count':len(items),'warnings':warnings})
        except instaloader.exceptions.ProfileNotExistsException:
            return self._json(404,{'error':'Instagram profil nebyl nalezen.'})
        except instaloader.exceptions.LoginRequiredException:
            return self._json(401,{'error':'Instagram vyžaduje přihlášenou session. Vlož sessionid svého účtu.'})
        except Exception as e:
            return self._json(500,{'error':'Instagram požadavek selhal: '+type(e).__name__+': '+str(e)[:240]})
