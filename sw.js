// v2.7.22 — AGGRESSIVE updates. skipWaiting on install, clients.claim on activate,
// notify all clients to reload so the new SW never sits behind old cached HTML.
const CACHE='finplan-v2-8-0';
const ASSETS=['./manifest.json'];

self.addEventListener('install',e=>{
  e.waitUntil(
    caches.open(CACHE)
      .then(c=>c.addAll(ASSETS))
      // Immediately activate the new SW so old cached HTML can't linger.
      // The tab reload happens via the controllerchange listener in index.html.
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    // Purge every cache that isn't the current version
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
    // Take control of all open clients immediately
    await self.clients.claim();
    // Ask every open client to reload — they'll pick up the new HTML from network
    const clients=await self.clients.matchAll({type:'window'});
    clients.forEach(c=>c.postMessage({type:'SW_ACTIVATED',cache:CACHE}));
  })());
});

self.addEventListener('message',e=>{
  if(e.data==='SKIP_WAITING'){self.skipWaiting();return;}
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
    e.respondWith(fetch(e.request).catch(()=>new Response('',{status:503})));
    return;
  }
  // SW file itself — always fresh, no-store, ignore any cache
  if(url.endsWith('sw.js')||url.includes('sw.js?')){
    e.respondWith(fetch(e.request,{cache:'no-store'}).catch(()=>new Response('',{status:503})));
    return;
  }
  // HTML — NETWORK FIRST with strict no-store, only fall back to cache if offline
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
  // manifest.json — network first too, so PWA icon/name changes propagate
  if(url.endsWith('manifest.json')){
    e.respondWith(
      fetch(e.request,{cache:'no-store'}).then(res=>{
        if(res.ok){const c=res.clone();caches.open(CACHE).then(ca=>ca.put(e.request,c));}
        return res;
      }).catch(()=>caches.match(e.request).then(r=>r||new Response('{}',{status:503})))
    );
    return;
  }
  // Other assets — cache first, revalidate in background
  e.respondWith(caches.match(e.request).then(r=>{
    const fp=fetch(e.request).then(res=>{if(res.ok){const c=res.clone();caches.open(CACHE).then(ca=>ca.put(e.request,c));}return res;}).catch(()=>r||new Response('',{status:503}));
    return r||fp;
  }));
});
