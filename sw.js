// v1.7.0 — network-first for HTML (so updates apply immediately), cache-first for other assets
const CACHE='finplan-v2-6-1';
const ASSETS=['./manifest.json'];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('message',e=>{
  // Manual force-refresh from the app
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
  // HTML pages — NETWORK FIRST so version updates apply immediately.
  // Falls back to cache only if you're offline.
  const isHtml=e.request.mode==='navigate'||url.endsWith('.html')||url.endsWith('/');
  if(isHtml){
    e.respondWith(
      fetch(e.request).then(res=>{
        if(res.ok){const c=res.clone();caches.open(CACHE).then(ca=>ca.put(e.request,c));}
        return res;
      }).catch(()=>caches.match(e.request).then(r=>r||new Response('Offline',{status:503})))
    );
    return;
  }
  // Other assets — cache first (fine for icons, manifest, etc.)
  e.respondWith(caches.match(e.request).then(r=>{
    const fp=fetch(e.request).then(res=>{if(res.ok){const c=res.clone();caches.open(CACHE).then(ca=>ca.put(e.request,c));}return res;}).catch(()=>r||new Response('',{status:503}));
    return r||fp;
  }));
});
