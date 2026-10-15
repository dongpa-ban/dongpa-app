// 앱 껍데기(화면 틀)를 폰에 저장해 두고 바로 띄운다. 뒤에서 새 껍데기를 받아 다음번에 쓴다.
// 데이터 파일(data/)은 여기서 손대지 않는다(항상 깃허브에서 새로 받음).
const CACHE = "dongpa-test0-v1";
const SHELL = ["./", "index.html", "b.html", "app.js", "style.css", "manifest-a.json", "manifest-b.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.includes("/data/")) return;
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
