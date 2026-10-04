import json, re, urllib.parse, urllib.request
from http.server import BaseHTTPRequestHandler
import instaloader
import requests

def clean(s):
    s = re.sub(r'[^A-Za-z0-9._-]+', '_', str(s or '')).strip('_')
    return s[:100] or 'item'

def get_json(url, timeout=25):
    req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0','Accept':'application/json,*/*'})
    with urllib.request.urlopen(req,timeout=timeout) as r:
        return json.loads(r.read().decode('utf-8','replace'))

def highlights_public(username):
    u=get_json('https://api-ig.storiesig.info/api/userInfoByUsername/'+urllib.parse.quote(username))
    user=((u.get('result') or {}).get('user') or (u.get('user') or {})) if isinstance(u,dict) else {}
    uid=user.get('pk') or user.get('id')
    if not uid:
        raise RuntimeError('upstream_user_not_found')
    h=get_json('https://api-ig.storiesig.info/api/highlights/'+urllib.parse.quote(str(uid)))
    trays=(h.get('result') or []) if isinstance(h,dict) else []
    out=[]
    for tray in trays:
        hid=tray.get('id'); title=clean(tray.get('title') or 'highlight')
        if not hid: continue
        d=get_json('https://api-ig.storiesig.info/api/highlightStories/'+urllib.parse.quote(str(hid)))
        stories=(d.get('result') or []) if isinstance(d,dict) else []
        for i,story in enumerate(stories,1):
            # Deliberately always take the image candidate. For video highlight slides
            # this is the poster/thumbnail, matching the requested JPG-only output.
            cands=((story.get('image_versions2') or {}).get('candidates') or []) if isinstance(story,dict) else []
            url=(cands[0].get('url') if cands and isinstance(cands[0],dict) else None)
            if url:
                out.append({'path':f'highlights/{title}/{i:04d}.jpg','url':url,'kind':'highlight'})
    return out

class handler(BaseHTTPRequestHandler):
    def _json(self, code, obj):
        data=json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Content-Length',str(len(data)))
        self.end_headers(); self.wfile.write(data)

    def do_POST(self):
        try:
            n=int(self.headers.get('content-length','0') or '0')
            body=json.loads(self.rfile.read(n) or b'{}')
            username=clean((body.get('username') or '').lstrip('@'))
            if not username: return self._json(400,{'error':'Chybí username.'})
            want_feed=bool(body.get('feed',True)); want_hl=bool(body.get('highlights',True))
            limit=max(1,min(int(body.get('limit') or 1000),5000))
            items=[]; warnings=[]

            if want_feed:
                L=instaloader.Instaloader(download_pictures=False,download_videos=False,download_video_thumbnails=False,download_geotags=False,download_comments=False,save_metadata=False,compress_json=False,quiet=True)
                profile=None
                try:
                    profile=instaloader.Profile.from_username(L.context,username)
                except Exception:
                    try:
                        url=f'https://www.instagram.com/api/v1/users/web_profile_info/?username={urllib.parse.quote(username)}'
                        headers={'X-IG-App-ID':'936619743392459','X-ASBD-ID':'198387','User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154 Safari/537.36','Accept':'*/*','Referer':f'https://www.instagram.com/{username}/'}
                        resp=requests.get(url,headers=headers,timeout=20)
                        payload=resp.json() if resp.ok else {}
                        user=(payload.get('data') or {}).get('user')
                        if user: profile=instaloader.Profile(L.context,user)
                    except Exception: profile=None
                if profile and not profile.is_private:
                    try:
                        count=0
                        for post in profile.get_posts():
                            if count>=limit: break
                            stamp=post.date_utc.strftime('%Y-%m-%d_%H-%M-%S'); base=f'feed/{stamp}_{post.shortcode}'
                            if post.typename=='GraphSidecar':
                                for j,node in enumerate(post.get_sidecar_nodes(),1):
                                    items.append({'path':f'{base}_{j}.jpg','url':node.display_url,'kind':'feed'})
                            else:
                                # For feed videos use post.url (poster image) so ZIP remains JPG-only.
                                items.append({'path':f'{base}.jpg','url':post.url,'kind':'feed'})
                            count+=1
                    except Exception as e: warnings.append('Feed se nepodařilo načíst kompletně: '+type(e).__name__)
                else:
                    warnings.append('Feed Instagram z tohoto serveru momentálně blokuje.')

            if want_hl:
                try:
                    items.extend(highlights_public(username))
                except Exception as e:
                    warnings.append('Highlights fallback selhal: '+type(e).__name__+': '+str(e)[:120])

            seen=set(); dedup=[]
            for x in items:
                if x.get('url') and x['url'] not in seen:
                    seen.add(x['url']); dedup.append(x)
            if not dedup:
                return self._json(502,{'error':'Nepodařilo se načíst žádná média.','warnings':warnings})
            return self._json(200,{'username':username,'items':dedup,'count':len(dedup),'warnings':warnings})
        except Exception as e:
            return self._json(500,{'error':'Downloader selhal: '+type(e).__name__+': '+str(e)[:240]})
