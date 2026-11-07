/*
 * sw.js — 앱 알림 받기 (3단계 ④-1, 설계서 「주문 넣음 단추 · 21시 알림」 · 자동주문 1단계 A)
 * 로봇은 내용 없는 알림을 보낸다(로봇/RobotPush.gs). 여기서 고정 문구를 띄운다. 화면 파일을 저장해 두는 일(캐시)은 하지 않는다.
 * 시험 알림: 앱이 [알림 켜기]·[시험 알림] 직전에 '2분 안에 오는 알림은 시험'이라고 적어 둔다(저장소 dongpa-flags의 test-push).
 *   알림에 내용이 없어서, 안 그러면 시험 알림도 "오늘 밤 주문 넣었나요?"로 떠 진짜 21시 알림처럼 보였다 (10/26 미니 폰)
 * 알림은 두 가지라 한국 시각으로 가른다 (알림 서버는 못 전한 알림을 3시간까지 들고 있다 — RobotPush.gs TTL):
 *   한국 21시~새벽 4시 = 21시 알림(21~24시에 보냄) · 그 밖 = 증권사 맞춰 보기 알림(로봇/RobotBroker.gs, 한국 05~17시에 보냄)
 * 자동주문(작은 B)을 켠 장부의 폰: 앱이 auto-order = 1을 적어 두면 밤 알림은 보내기 잊음 문구 (로봇/RobotPush.gs pushSendForgot, 11/7)
 */
var REMIND = '오늘 밤 주문 넣었나요? 아직 [증권사에 넣었어요]를 안 눌렀어요.';
var BROKER = '어젯밤 주문을 증권사 기록과 맞춰 보다 확인할 것이 생겼어요. 앱에서 어젯밤 결과를 봐 주세요.';
var TEST = '시험 알림이에요. 알림이 잘 켜졌어요. 알릴 일이 생기면 이렇게 알려 드려요.';
var SEND = '오늘 밤 주문을 아직 메리츠로 보내지 않았어요. 앱에서 [증권사로 보내기]를 해 주세요(개장 10분 전까지). 손으로 넣었으면 괜찮아요.';
function kstHour(ms) { return new Date(ms + 9 * 3600000).getUTCHours(); }
function pushKind(testUntil, nowMs) {
  if (testUntil && nowMs < testUntil) return 'test';
  var h = kstHour(nowMs);
  return h >= 21 || h < 4 ? 'remind' : 'broker';
}
function pushBody(kind) { return kind === 'test' ? TEST : kind === 'broker' ? BROKER : REMIND; }
function autoOrder() {
  return self.caches.open('dongpa-flags').then(function (c) { return c.match('auto-order'); })
    .then(function (r) { return r ? r.text() : '0'; }).catch(function () { return '0'; });
}
function testUntil() {
  return self.caches.open('dongpa-flags').then(function (c) { return c.match('test-push'); })
    .then(function (r) { return r ? r.text() : '0'; }).then(Number).catch(function () { return 0; });
}
// 새 sw.js는 앱을 다시 열 때 바로 쓴다 (알림만 하는 일꾼이라 기다릴 것이 없다)
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (event) { event.waitUntil(self.clients.claim()); });
self.addEventListener('push', function (event) {
  event.waitUntil(Promise.all([testUntil(), autoOrder()]).then(function (a) {
    var kind = pushKind(a[0], Date.now());
    return self.registration.showNotification('동파앱', {
      body: kind === 'remind' && a[1] === '1' ? SEND : pushBody(kind),
      icon: 'icon/icon-192.png',
      badge: 'icon/icon-192.png',
      tag: kind === 'broker' ? 'dongpa-broker' : 'dongpa-placed',
      renotify: true,
      data: { url: './' }
    });
  }));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) if ('focus' in list[i]) return list[i].focus();
    return self.clients.openWindow(event.notification.data && event.notification.data.url || './');
  }));
});
