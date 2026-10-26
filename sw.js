/*
 * sw.js — 앱 알림 받기 (3단계 ④-1, 설계서 「주문 넣음 단추 · 21시 알림」)
 * 로봇은 내용 없는 알림을 보낸다(로봇/RobotPush.gs). 여기서 고정 문구를 띄운다. 화면 파일을 저장해 두는 일(캐시)은 하지 않는다.
 * 시험 알림: 앱이 [알림 켜기]·[시험 알림] 직전에 '2분 안에 오는 알림은 시험'이라고 적어 둔다(저장소 dongpa-flags의 test-push).
 *   알림에 내용이 없어서, 안 그러면 시험 알림도 "오늘 밤 주문 넣었나요?"로 떠 진짜 21시 알림처럼 보였다 (10/26 미니 폰)
 */
var REMIND = '오늘 밤 주문 넣었나요? 아직 [증권사에 넣었어요]를 안 눌렀어요.';
var TEST = '시험 알림이에요. 알림이 잘 켜졌어요. 21시까지 [증권사에 넣었어요]를 안 누르면 이렇게 알려 드려요.';
function pushBody(testUntil, nowMs) { return testUntil && nowMs < testUntil ? TEST : REMIND; }
function testUntil() {
  return self.caches.open('dongpa-flags').then(function (c) { return c.match('test-push'); })
    .then(function (r) { return r ? r.text() : '0'; }).then(Number).catch(function () { return 0; });
}
// 새 sw.js는 앱을 다시 열 때 바로 쓴다 (알림만 하는 일꾼이라 기다릴 것이 없다)
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (event) { event.waitUntil(self.clients.claim()); });
self.addEventListener('push', function (event) {
  event.waitUntil(testUntil().then(function (t) { return self.registration.showNotification('동파앱', {
    body: pushBody(t, Date.now()),
    icon: 'icon/icon-192.png',
    badge: 'icon/icon-192.png',
    tag: 'dongpa-placed',
    renotify: true,
    data: { url: './' }
  }); }));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) if ('focus' in list[i]) return list[i].focus();
    return self.clients.openWindow(event.notification.data && event.notification.data.url || './');
  }));
});
