// v2.7.11 — network-first for HTML, immediate cache purge on version bump
const CACHE='finplan-v2-7-12';
const ASSETS=['./manifest.json'];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
  // Do NOT skipWaiting() automatically — wait for user click on the update banner.
  // This avoids reload loops on some browsers.
});
self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});
self.addEventListener('message',e=>{
  if(e.data==='SKIP_WAITING'){
    self.skipWaiting();
    return;
  }
  if(e.data==='CLEAR_CACHE_AND_RELOAD'){
    caches.keys().then(keys=>Promise.all(keys.map(k=>caches.delete(k)))).then(()=>{
      self.registration.unregister().then(()=>{
        self.clients.matchAll().then(cs=>cs.forEach(c=>c.navigate(c.url)));
      });
    });
  }
});
self.addEventListener('fetch',e=>{
  const url=e.request.url;
  // External APIs — always network, never cache
  if(url.includes('api.groq')||url.includes('financialmodelingprep')||url.includes('fonts.googleapis')||url.includes('cdnjs')){
    e.respondWith(fetch(e.request).catch(()=>new Response('',{status:503})));return;
  }
  // The SW file itself — always fresh, never cache (belt + braces with updateViaCache:'none')
  if(url.endsWith('sw.js')||url.includes('sw.js?')){
    e.respondWith(fetch(e.request,{cache:'no-store'}).catch(()=>new Response('',{status:503})));
    return;
  }
  // HTML pages — NETWORK FIRST so version updates apply immediately
  const isHtml=e.request.mode==='navigate'||url.endsWith('.html')||url.endsWith('/');
  if(isHtml){
    e.respondWith(
      fetch(e.request,{cache:'no-store'}).then(res=>{
        if(res.ok){const c=res.clone();caches.open(CACHE).then(ca=>ca.put(e.request,c));}
        return res;
      }).catch(()=>caches.match(e.request).then(r=>r||new Response('Offline',{status:503})))
    );
    return;
  }
  // Other assets — cache first
  e.respondWith(caches.match(e.request).then(r=>{
    const fp=fetch(e.request).then(res=>{if(res.ok){const c=res.clone();caches.open(CACHE).then(ca=>ca.put(e.request,c));}return res;}).catch(()=>r||new Response('',{status:503}));
    return r||fp;
  }));
});
