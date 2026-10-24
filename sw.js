/*
 * sw.js — 앱 알림 받기 (3단계 ④-1, 설계서 「주문 넣음 단추 · 21시 알림」)
 * 로봇은 내용 없는 알림을 보낸다(로봇/RobotPush.gs). 여기서 고정 문구를 띄운다. 화면 파일을 저장해 두는 일(캐시)은 하지 않는다.
 */
self.addEventListener('push', function (event) {
  event.waitUntil(self.registration.showNotification('동파앱', {
    body: '오늘 밤 주문 넣었나요? 아직 [증권사에 넣었어요]를 안 눌렀어요.',
    icon: 'icon/icon-192.png',
    badge: 'icon/icon-192.png',
    tag: 'dongpa-placed',
    renotify: true,
    data: { url: './' }
  }));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) if ('focus' in list[i]) return list[i].focus();
    return self.clients.openWindow(event.notification.data && event.notification.data.url || './');
  }));
});
