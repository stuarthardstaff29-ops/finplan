const CACHE='finplan-fixed-v1';
const ASSETS=['./index.html','./manifest.json'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',e=>{
  if(e.request.url.includes('api.anthropic.com')||e.request.url.includes('fonts.googleapis')||e.request.url.includes('cdnjs')){
    e.respondWith(fetch(e.request).catch(()=>new Response('',{status:503})));
    return;
  }
  e.respondWith(caches.match(e.request).then(r=>{
    const fetchPromise=fetch(e.request).then(res=>{
      if(res.ok){const clone=res.clone();caches.open(CACHE).then(c=>c.put(e.request,clone));}
      return res;
    }).catch(()=>r||new Response('',{status=503}));
    return r||fetchPromise;
  }));
});
self.addEventListener('push',e=>{
  const data=e.data?e.data.json():{title:'FinPlan',body:'Check your finances'};
  e.waitUntil(self.registration.showNotification(data.title,{body:data.body,icon:'./icon-192.png',badge:'./icon-192.png',tag:data.tag||'finplan'}));
});
