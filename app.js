/*
 * app.js — 동파앱 보기 화면 (3단계 ① · 10/23 확정 시안)
 * ------------------------------------------------------------------
 * 로봇이 만든 화면 파일(screen.json)을 그대로 보여 준다. 계산은 로봇이 다 했고, 여기서는 모양만 만든다.
 *   홈: 오늘 밤 주문 → 어젯밤 결과 → 증권사 앱과 비교     모드: 지금 모드 · QQQ 주간 RSI · 시뮬레이터
 *   보유 Lot · 수익: 자리만 (동파웹앱 탭을 어떻게 옮길지는 나중에 정함)
 *
 * 화면 파일 받는 곳:
 *   #k=<보기 열쇠>    보통. 로봇이 열쇠로 잠가 올린 s/<파일 이름>.json을 받아 브라우저 암호 기능(WebCrypto AES-GCM)으로 푼다
 *                     (로봇/RobotPublish.gs와 같은 약속). 열쇠는 폰에도 저장해 # 없이 열려도 된다. 위조 확인이 실패하면 주문표를 안 띄운다
 *   ?sample=보통      시험: 화면/시험/견본/보통.json (견본 만들 때의 폰 시각까지 같이)
 *   ?src=주소         시험: 그 주소의 screen.json (잠그지 않은 것)
 * 시험 도우미: ?now=밀리초(폰 시각 고정) · ?moment=mode|bc(드문 순간 카드 보기) · ?tab=mode
 *
 * 지난번에 본 화면은 폰에 저장해 두고(localStorage) 열자마자 먼저 보여 준다. 새 화면이 오면 바꾼다.
 * 지난번 화면과 비교해 주문가·잔고가 바뀐 자리만 숫자가 굴러간다.
 */
(function () {
  'use strict';
  var C = DongpaCalc;
  var Q = new URLSearchParams(location.search);
  var KEY = 'dongpa.v1.';
  var APP_VERSION = '3a59e0c-6';   // 화면 배포가 버전으로 바꿔 넣는다 (도구/화면_버전.mjs)
  // 시험 도우미(?sample·?src·?now·?moment·?tab)는 저장소 판에서만. 배포된 앱에서는 무시한다 — 누가 ?src=로 가짜 주문표를 띄우는 링크를 못 만들게 (10/26 검토 AI)
  var DEV = APP_VERSION === 'dev';
  function testQ(k) { return DEV ? Q.get(k) : null; }

  /* ── 폰에 저장 (못 쓰는 폰·사생활 보호 모드에서도 화면은 그대로 뜨게) ── */
  function load(k) { try { var t = localStorage.getItem(KEY + k); return t ? JSON.parse(t) : null; } catch (e) { return null; } }
  function save(k, v) { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch (e) { /* 그냥 넘어간다 */ } }

  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function reduced() { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }

  var S = {
    screen: null,   // 지금 보여 주는 화면 파일
    before: null,   // 비교할 지난 화면 (같은 세션일 때만 숫자를 굴린다)
    nowFix: testQ('now') ? Number(testQ('now')) : null,
    tab: testQ('tab') || 'home', dir: 'f', menu: false,
    sim: null, moment: null, fresh: true, checked: {}
  };
  function now() { return S.nowFix || Date.now(); }

  /* ── 그림 조각 ─────────────────────────────────────────── */
  var MARK = '<svg class="mark" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 15 L8 9 L13 14 L21 5"></path><circle class="mb" cx="13" cy="14" r="2.4"></circle><circle class="ms" cx="21" cy="5" r="2.4"></circle></svg>';
  var BACK = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 L8 12 L15 19"></path></svg>';
  var SHIELD = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 L19 6 V11 C19 15.5 16 19 12 21 C8 19 5 15.5 5 11 V6 Z"></path><path d="M9 12 L11.2 14.2 L15.5 9.8"></path></svg>';
  var BOLT = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M13 3 L5 13 H11 L10 21 L19 10 H13 Z"></path></svg>';
  var CHECK = '<svg class="chk" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5 L6.5 12 L13 4.5"></path></svg>';
  function modeIcon(m) { return m === 'safe' ? SHIELD : BOLT; }
  var TABS = [
    { id: 'home', label: '홈', icon: 'M4 11 L12 4 L20 11 M6 10 V19 H18 V10', fill: 'M12 3.2 L21 11 H18.5 V19.5 H5.5 V11 H3 Z' },
    { id: 'mode', label: '모드', icon: 'M12 3 L19 6 V11 C19 15.5 16 19 12 21 C8 19 5 15.5 5 11 V6 Z', fill: 'M12 3 L19 6 V11 C19 15.5 16 19 12 21 C8 19 5 15.5 5 11 V6 Z' },
    { id: 'lots', label: '보유 Lot', icon: 'M4 7 H20 M4 12 H20 M4 17 H14', fill: 'M3.5 5.5 H20.5 V8.5 H3.5 Z M3.5 10.5 H20.5 V13.5 H3.5 Z M3.5 15.5 H14.5 V18.5 H3.5 Z' },
    { id: 'returns', label: '수익', icon: 'M4 18 L9 12 L13 15 L20 7 M15 7 H20 V12', fill: 'M4 19.5 V18 L9 12 L13 15 L20 7 V19.5 Z' }
  ];
  var TAB_IDX = { home: 0, mode: 1, lots: 2, returns: 3 };

  /** 숫자를 자리마다 나눠, 바뀐 자리만 굴린다 */
  function digits(oldS, newS, h) {
    return C.rollDigits(reduced() ? null : oldS, newS).map(function (g) {
      if (!g.roll) return esc(g.ch);
      var col = g.up ? [g.from, g.ch] : [g.ch, g.from];
      return '<span class="dg ' + h + '"><span class="dgc ' + (g.up ? 'rup' : 'rdown') + '" style="animation-delay:' + g.delay + 'ms"><span>' + col[0] + '</span><span>' + col[1] + '</span></span></span>';
    }).join('');
  }

  /* ── 알림 글 ───────────────────────────────────────────── */
  var KIND = {
    cash_negative: '현금이 마이너스예요. 증권사 잔고와 대조해 주세요',
    bc_differs: '지난 기록을 고쳐서 다시 계산한 BC가 달라요. 관리자 확인이 필요해요',
    bc_floor: 'BC가 바닥값에 걸렸어요',
    bc_now_ignored: '‘BC 지금 갱신’을 적용하지 않았어요',
    manual_ignored: '직접 넣은 기록 하나를 적용하지 않았어요',
    manual_on_closed_day: '휴장일 날짜로 넣은 기록이 있어요',
    manual_sell_skipped: '직접 넣은 매도 하나를 적용하지 못했어요',
    sell_skipped: '매도 하나를 적용하지 못했어요',
    split_applied: '주식 분할을 반영했어요',
    split_fraction: '분할 뒤 남는 주식이 있어요(증권사 현금 정산)',
    filled_gap: '빠진 종가를 채웠어요',
    closure_has_price: '휴장일에 시세가 있어요',
    fetch_older: '야후에서 받은 값이 저장된 것보다 오래됐어요',
    quote_fetch: '야후 시세 받기 실패',
    quote_file: '시세 파일을 못 읽어요',
    write_conflict: '저장이 계속 막혀요',
    tamper: '장부 기록이 강제로 바뀌어 로봇이 멈췄어요',
    plan_failed: '오늘 밤 주문을 못 만들었어요',
    late_orders: '로봇이 개장 뒤에야 돌아 주문을 ‘안 냄’으로 적었어요',
    publish_failed: '잠근 화면을 공개 저장소에 못 올렸어요(다음 실행에 다시)'
  };
  function alertText(a) {
    if (a.kind === 'token_expiring') return '깃허브 열쇠 만료까지 ' + a.daysLeft + '일';
    if (a.kind === 'quote_changed') return (a.symbol || '') + ' ' + C.md(a.date) + ' 종가가 바뀌었어요 (' + C.price(a.from) + ' → ' + C.price(a.to) + ')';
    if (a.kind === 'late_orders') return KIND.late_orders + ' (' + C.mdw(a.session) + ' · ' + a.count + '건)';
    var t = KIND[a.kind] || ('알림: ' + a.kind);
    if (a.symbol) t = a.symbol + ' ' + t;
    var d = a.detail || a.reason || '';
    return d ? t + ' · ' + d : t;
  }

  /* ── 홈 ───────────────────────────────────────────────── */
  function lotById(sc, id) {
    var ls = sc.lots || [];
    for (var i = 0; i < ls.length; i++) if (ls[i].lotId === id) return ls[i];
    return null;
  }
  function lastClose(sc) {
    if (sc.lastNight && sc.lastNight.close) return sc.lastNight.close;
    var ch = sc.view && sc.view.chart;
    return ch && ch.length ? ch[ch.length - 1].close : null;
  }
  /** 주문 순서: BUY 먼저, 그다음 SELL (시안대로) */
  function tonightOrders(sc) {
    var os = (sc.next && sc.next.orders || []).slice();
    os.sort(function (a, b) { return (a.side === 'BUY' ? 0 : 1) - (b.side === 'BUY' ? 0 : 1) || String(a.lotId).localeCompare(String(b.lotId)); });
    return os;
  }
  /** 지난 화면에서 같은 주문 (같은 세션일 때만) */
  function oldOrder(o) {
    if (S.other) return null;   // 남의 장부는 굴리지 않는다
    var b = S.before, sc = S.screen;
    if (!b || !b.next || !sc.next || b.next.session !== sc.next.session) return null;
    var os = b.next.orders || [];
    for (var i = 0; i < os.length; i++) if (os[i].id === o.id) return os[i];
    return null;
  }

  function ticket(sc, o, k) {
    var params = sc.view && sc.view.params || {};
    var buy = o.side === 'BUY';
    var old = oldOrder(o);
    var moc = o.type === 'MOC' || o.price === null;
    var p = moc ? '시장가' : C.price(o.price);
    var fixed = !!(old && !moc && (old.price !== o.price || old.qty !== o.qty));
    var sub = '';
    if (buy) {
      var c = lastClose(sc), pr = params[o.mode || sc.next.mode];
      if (c && pr) sub = '전일 종가 ' + C.price(c) + ' × ' + (1 + pr.cap).toFixed(4);
    } else if (moc) {
      sub = '보유 기간 끝 · 장 마감 때 시장가로';
    } else {
      var lot = lotById(sc, o.lotId), ps = params[o.mode];
      if (lot && ps) sub = '산 값 ' + C.price(lot.entry) + ' × ' + (1 + ps.sell).toFixed(4);
    }
    var dd = !buy && o.dday !== null && o.dday !== undefined ? (o.dday === 0 ? 'D-Day' : 'D-' + o.dday) : '';
    return '<div class="tk ' + (buy ? 'buy' : 'sell') + (fixed ? ' tkfix' : '') + '" style="animation-delay:' + (50 * k) + 'ms">' +
      '<div class="tkrow"><span class="tkside">' + o.side + '</span><span class="tktype">' + esc(o.type) + '</span>' +
      '<span class="n tklot">' + (buy ? '새 Lot' : esc(o.lotId)) + '</span>' + (dd ? '<span class="tkd n">' + dd + '</span>' : '') + '</div>' +
      '<div class="tkrow2"><span class="n tkprice' + (fixed && old.price !== o.price ? ' flash' : '') + '">' +
      (fixed && old.price !== o.price ? digits(C.price(old.price), p, 'h38') : esc(p)) + '</span>' +
      '<span class="n tkqty">× ' + o.qty + '주</span>' + (S.other ? '<span class="tkwho">(' + esc(S.other.name) + ')</span>' : '') + '</div>' +
      '<div class="tksub n"><span>' + esc(sub) + '</span>' +
      (fixed ? '<span class="pill yel">바뀜 · 전 ' + (old.price !== o.price ? C.price(old.price) : old.qty + '주') + '</span>' : '') + '</div></div>';
  }

  function chartSvg(sc) {
    var rows = sc.view && sc.view.chart || [];
    if (rows.length < 2) return '';
    var lines = tonightOrders(sc).filter(function (o) { return o.price !== null && o.type !== 'MOC'; });
    var vals = rows.map(function (r) { return r.close; }).concat(lines.map(function (o) { return o.price; }));
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    var pad = (hi - lo) * 0.08 || 1;
    lo -= pad; hi += pad;
    var top = 8, h = 96, x0 = 8, w = 262;
    var y = function (v) { return Math.round((top + (hi - v) / (hi - lo) * h) * 10) / 10; };
    var pts = rows.map(function (r, k) { return [Math.round((x0 + k * w / (rows.length - 1)) * 10) / 10, y(r.close)]; });
    var d = 'M' + pts.map(function (q) { return q[0] + ',' + q[1]; }).join(' L');
    var end = pts[pts.length - 1];
    // 주문가 글자가 겹치지 않게 12px씩 띄운다
    var labs = lines.map(function (o) { return { o: o, y: y(o.price) }; }).sort(function (a, b) { return a.y - b.y; });
    for (var i = 1; i < labs.length; i++) if (labs[i].y - labs[i - 1].y < 12) labs[i].y = labs[i - 1].y + 12;
    var last = rows[rows.length - 1];
    return '<div class="chart"><div class="chartcap">SOXL 최근 ' + rows.length + '거래일 · 점선은 오늘 밤 주문가</div>' +
      '<svg class="csvg" viewBox="0 0 326 124" role="img" aria-label="SOXL 최근 종가와 오늘 밤 주문가">' +
      '<line class="grid" x1="8" x2="270" y1="8" y2="8"></line><line class="grid" x1="8" x2="270" y1="56" y2="56"></line><line class="grid" x1="8" x2="270" y1="104" y2="104"></line>' +
      lines.map(function (o) { var yy = y(o.price); return '<line class="ol ' + (o.side === 'BUY' ? 'olbuy' : 'olsell') + '" x1="8" x2="270" y1="' + yy + '" y2="' + yy + '"></line>'; }).join('') +
      '<path class="cl" d="' + d + '" pathLength="1"></path><circle class="cd" cx="' + end[0] + '" cy="' + end[1] + '" r="4"></circle>' +
      labs.map(function (l) { return '<text class="tl ' + (l.o.side === 'BUY' ? 'tlbuy' : 'tlsell') + '" x="276" y="' + (l.y + 4) + '">' + l.o.side.charAt(0) + ' ' + C.price(l.o.price) + '</text>'; }).join('') +
      '<text class="ax" x="8" y="122">' + C.md(rows[0].date) + '</text>' +
      '<text class="ax axe" x="270" y="122">' + C.md(last.date) + ' 종가 ' + C.price(last.close) + '</text></svg></div>';
  }

  function tonightCard(sc) {
    var nx = sc.next;
    if (!nx) {
      return '<section class="card hero" id="tonight"><div class="ch"><h2 class="ct">오늘 밤 주문</h2></div>' +
        '<p class="empty">장부를 읽지 못해 주문표가 없어요. 아래 알림을 봐 주세요.</p></section>';
    }
    var st = C.sessionState(nx.session, now());
    var when;
    if (st.kind === 'before') when = '개장 전 · 한국 ' + C.kstHm(st.openMs) + ' 고정 · ' + C.span(st.left) + ' 남음';
    else if (st.kind === 'open') when = '장 중 · 한국 ' + C.kstHm(st.openMs) + '부터 고정';
    else when = '이미 끝난 세션';
    var stale = st.kind === 'stale';
    var os = tonightOrders(sc);
    var buy = null;
    os.forEach(function (o) { if (o.side === 'BUY') buy = o; });
    var foot = '';
    if (nx.buySkipped) {
      foot = '<div class="nobuy">BUY 없음: ' + (nx.buySkipped === 'cash_negative' ? '현금이 마이너스예요' : '현금 부족') +
        '<span>직접 사셨으면 입력해 주세요. 누를 필요는 없어요.</span></div>';
    } else if (buy && buy.price) {
      var cost = Math.round(buy.price * buy.qty * 100), cash = sc.holdings ? sc.holdings.cashCents : null;
      if (cash !== null) foot = '<div class="foot n">현금 충분 · BUY 대금 ' + C.money(cost) + ' 빼고도 ' + C.money(cash - cost) + ' 남아요</div>';
    }
    var mode = nx.mode;
    return '<section class="card hero" id="tonight"><div class="ch"><h2 class="ct">오늘 밤 주문</h2>' +
      (mode ? '<span class="modepill ' + mode + '">' + modeIcon(mode) + C.modeName(mode) + ' 모드</span>' : '') + '</div>' +
      '<div class="when"><span class="n">' + C.mdw(nx.session) + '</span> 밤 · <span class="n">' + esc(when) + '</span></div>' +
      (stale ? '<div class="alert al-org rise in-card" role="alert"><div class="al-head">이 주문으로 주문하지 마세요</div>이 주문표는 ' + C.mdw(nx.session) +
        '용이에요. 로봇이 ' + C.span(now() - sc.at) + '째 새 화면을 못 만들었어요.</div>' : '') +
      '<div class="dimmable' + (stale ? ' dim' : '') + '">' +
      (os.length ? '<div class="tks">' + os.map(function (o, k) { return ticket(sc, o, k); }).join('') + '</div>'
        : '<p class="empty">' + (nx.locked ? '오늘 밤 넣을 주문이 없어요.' : '오늘 밤 넣을 주문이 없어요.') + '</p>') +
      foot + placedHtml(sc, st) + chartSvg(sc) + '</div></section>';
  }

  /* ④-1 [증권사에 넣었어요] — settings.placedCheck인 사람만 (로봇/RobotPush.gs) */
  function placedHtml(sc, st) {
    var nx = sc.next;
    if (S.other || !sc.placedCheck || !nx || st.kind !== 'before' || !(nx.orders || []).length) return '';
    var mine = load('placed'), srv = sc.placed;
    var at = null, old = false;
    if (mine && mine.s === nx.session) { if (mine.d === nx.digest) at = mine.at; else old = true; }
    if (!at && srv) { if (srv.d === nx.digest) at = srv.at; else old = true; }
    var push = pushHtml();
    if (at) return '<div class="placed ok" role="status"><div class="pl1">증권사에 넣음 ✓ <span class="n">' + C.kstHm(at) + '</span></div>' + push + '</div>';
    return '<div class="placed">' + (old ? '<div class="pwarn">넣은 뒤 주문이 바뀌었어요. 증권사 주문을 고치고 다시 눌러 주세요</div>' : '') +
      '<button class="btn wide placebtn press" data-act="placed">증권사에 넣었어요</button>' +
      '<div class="pnote">한국 ' + 21 + '시까지 안 누르면 앱 알림이 한 번 가요</div>' + push + '</div>';
  }
  function pushHtml() {
    var ok = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
    if (!standalone) return '<div class="pnote">21시 알림은 홈 화면에 추가한 앱에서 켤 수 있어요</div>';
    if (!ok) return '<div class="pnote">이 폰은 앱 알림을 못 받아요(아이폰은 iOS 16.4 이상)</div>';
    if (load('pushOn') && Notification.permission === 'granted') return '<div class="pnote">21시 알림 켜짐 · <button class="linkbtn" data-act="push-test">시험 알림 보내기</button></div>';
    return '<button class="btn wide ghost2 press" data-act="push-on">21시 알림 켜기</button>';
  }

  function lastNightCard(sc) {
    var ln = sc.lastNight;
    if (!ln) return '';
    var os = (ln.orders || []).slice();
    os.sort(function (a, b) { return (a.side === 'SELL' ? 0 : 1) - (b.side === 'SELL' ? 0 : 1) || String(a.lotId).localeCompare(String(b.lotId)); });
    var filled = 0, missed = 0, pnl = 0;
    var rows = os.map(function (o, k) {
      var r = o.result;
      var ok = !!(r && r.status === 'filled');
      if (ok) filled++; else if (r) missed++;
      var lot = o.side === 'BUY' ? (ok && r.lotId ? '→ ' + r.lotId : '새 Lot') : o.lotId;
      var amt = '—', amtCls = 'mute';
      if (ok && o.side === 'SELL' && r.pnl !== undefined) { pnl += r.pnl; amt = C.usd(r.pnl, true); amtCls = r.pnl >= 0 ? 'up' : 'down'; }
      else if (ok && o.side === 'BUY') { amt = C.money(-Math.round(r.price * r.qty * 100)); amtCls = 'ink'; }
      var res = !r ? '판정 전' : ok ? '체결 @' + C.price(r.price) + (r.qty !== o.qty ? ' · ' + r.qty + '주' : '') : '미체결';
      return '<div class="lrow"><span class="side ' + (o.side === 'BUY' ? 'sbuy' : 'ssell') + '">' + o.side + '</span>' +
        '<div class="lmid"><div class="n l1">' + esc(lot) + '</div><div class="n sub">' + esc(o.type) + ' ' + (o.price === null ? '시장가' : C.price(o.price)) + ' × ' + o.qty + '주</div></div>' +
        '<div class="lrt"><div class="n lamt ' + amtCls + '">' + amt + '</div><div class="res">' +
        (ok ? CHECK.replace('<path ', '<path style="animation-delay:' + (160 + 60 * k) + 'ms" ') : '') + '<span class="n">' + res + '</span></div></div></div>';
    });
    return '<section class="card"><div class="ch"><h2 class="ct">어젯밤 결과</h2><span class="meta">' + C.mdw(ln.session) + ' 종가 <span class="n" style="color:#fff">' + C.price(ln.close) + '</span></span></div>' +
      (os.length ? '<div class="sum"><span class="pill up">체결 ' + filled + '</span><span class="pill">미체결 ' + missed + '</span>' +
        '<span class="meta">실현손익 <span class="n ' + (pnl > 0 ? 'up' : pnl < 0 ? 'down' : '') + '">' + C.usd(pnl, true) + '</span></span></div>' +
        // 원화로도: 그날 환율 (로봇이 날짜별로 적어 둔 야후 원/달러 — 보여 주기만, 증권사 환율과 몇 원 다를 수 있음)
        (pnl && ln.fx ? '<div class="krwline"><span class="n ' + (pnl > 0 ? 'up' : 'down') + '">' + C.won(pnl, ln.fx.rate) + '</span>' +
          '<span class="meta n">' + C.md(ln.fx.date) + ' 환율 ' + ln.fx.rate.toLocaleString('en-US', { minimumFractionDigits: 2 }) + '원</span></div>' : '') + rows.join('')
        : '<p class="empty">' + C.mdw(ln.session) + '에는 주문이 없었어요.</p>') + '</section>';
  }

  function compareCard(sc) {
    var h = sc.holdings;
    if (!h) return '';
    var cash = C.money(h.cashCents);
    var b = S.before && S.before.holdings;
    var oldCash = b && b.cashCents !== h.cashCents ? C.money(b.cashCents) : null;
    var fx = sc.fx, bc = sc.bc, bv = sc.view && sc.view.bc;
    return '<section class="card"><div class="ch"><h2 class="ct">증권사 앱과 비교</h2><span class="meta">둘이 같으면 끝</span></div>' +
      '<div class="cmp"><div><div class="meta">보유 수량</div><div class="n big">' + h.qty + '<span class="unit">주</span></div></div>' +
      '<div><div class="meta">달러 잔고</div><div class="n big' + (oldCash ? ' flash' : '') + '">' + (oldCash ? digits(oldCash, cash, 'h32') : esc(cash)) + '</div>' +
      (fx ? '<div class="krw n">' + C.krwApprox(h.cashCents, fx.rate) + '</div>' : '') + '</div></div>' +
      // 환율: 로봇이 세션마다 미국 장 마감 뒤 한 번 받아 둔 값 (어젯밤 실현손익 원화와 같은 값)
      (fx ? '<div class="fx n">환율 ' + fx.rate.toLocaleString('en-US', { minimumFractionDigits: 2 }) + '원 · ' + (fx.date ? C.md(fx.date) + ' 장 마감 뒤' : C.kstWhen(fx.at, now())) + ' 기준 · 보기용(계산엔 안 씀)</div>' : '') +
      (bc ? '<div class="bcline n">BC <span style="color:#fff">' + C.money(bc.cents) + '</span>' +
        (bv ? ' · 다음 갱신 ' + C.mdw(bv.nextDate) + ' · ' + bv.interval + '일 중 ' + bv.elapsed + '일째<br>지난 BC 뒤 실현손익 <span class="' + (bv.pnlSince > 0 ? 'up' : bv.pnlSince < 0 ? 'down' : '') + '">' + C.usd(bv.pnlSince, true) + '</span>' : '') +
        '</div>' : '') + '</section>';
  }

  function alertsBlock(sc) {
    var out = [];
    var nx = sc.next;
    if (S.robotStop && !S.other) out.push('<div class="alert al-org rise" role="alert"><div class="al-head">로봇이 멈췄어요 · 장부 기록이 바뀌었어요</div>' +
      '무슨 일이 있었는지 관리에서 쉬운 말로 볼 수 있어요. 확인하기 전까지 모든 장부의 계산과 저장이 멈춰 있어요.' +
      '<button class="btn sm primary press" style="margin-top:10px" data-act="admin">관리에서 보기</button></div>');
    if (nx && nx.changedAt) {
      var diffs = tonightOrders(sc).map(function (o) { var old = oldOrder(o); return old && old.price !== o.price ? o.side + ' ' + (o.lotId || '') + ' ' + C.price(old.price) + ' → ' + C.price(o.price) : ''; }).filter(Boolean);
      out.push('<div class="alert al-yel rise" role="status"><div class="al-head">주문 바뀜 · <span class="n">' + C.kstWhen(nx.changedAt, now()) + '</span></div>' +
        (diffs.length ? esc(diffs.join(' · ')) + '. ' : '입력 때문에 오늘 밤 주문이 바뀌었어요. ') + '이미 증권사에 넣었다면 고쳐 주세요.</div>');
    }
    (sc.edits || []).forEach(function (x) {
      out.push('<div class="alert al-gray rise" role="status"><div class="al-head">' + esc(x.who) + ga(x.who) + ' 고침 · <span class="n">' + C.kstWhen(x.at, now()) + '</span></div>' + esc(x.line) + (x.memo ? ' · ' + esc(x.memo) : '') + '</div>');
    });
    if (sc.next && sc.next.frozen) out.push('<div class="alert al-gray rise" role="status">고친 내용은 다음 세션부터 반영돼요. ' + C.mdw(sc.next.session) + ' 주문은 그대로예요.</div>');
    if (S.newer && !S.other) out.push('<div class="alert al-teal2 rise" role="status" id="newer"><div class="al-head">새 내용 있음</div>로봇이 화면을 새로 만들었어요. 폰에 오기까지 몇 분 걸려요. 잠시 뒤 앱을 다시 열어 주세요.</div>');
    if (sc.problems && sc.problems.length) {
      out.push('<div class="alert al-org rise" role="alert"><div class="al-head">장부를 못 읽었어요</div>' + esc(sc.problems.join(' · ')) + '. 아래 숫자는 지난번 것이에요.</div>');
    }
    (sc.alerts || []).forEach(function (a) {
      if (a.kind === 'buy_skipped') return;   // 주문 카드 안에서 크게
      if (a.kind === 'stale') {
        out.push('<div class="alert al-org rise" role="alert"><div class="al-head">시세가 늦어요</div>' + (a.lastDate ? C.mdw(a.lastDate) + ' 종가까지만 받았어요. ' : '') + '새 주문은 시세가 오면 만들어요.</div>');
        return;
      }
      out.push('<div class="alert al-gray rise" role="status">' + esc(alertText(a)) + '</div>');
    });
    var sys = (sc.system || []).filter(function (a) { return a.kind !== 'check_held'; });
    (sc.system || []).forEach(function (a) { if (a.kind === 'check_held' && !S.checked[a.ledger + '/' + a.eventId]) out.push(checkCard(a)); });
    if (sys.length) {
      out.push('<div class="alert al-gray rise" role="status"><div class="al-head">관리자만 보는 알림</div>' + sys.map(function (a) { return esc(alertText(a)); }).join('<br>') + '</div>');
    }
    return out.join('');
  }

  /* ⑤ 대조가 어긋난 입력: 관리자가 [확인]·[취소] (로봇/RobotCheck.gs) */
  function checkCard(a) {
    var who = a.by === 'Claude' ? 'Claude 제안' : '입력 확인';
    var why = a.why === 'differs' ? '로봇이 다시 계산한 값이 미리보기와 달라 반영하지 않았어요. 아래는 로봇이 계산한 것이에요.'
      : a.why === 'base_missing' ? '이 입력을 계산한 그때의 장부를 찾지 못해 반영하지 않았어요.' : '대조하지 못해 반영하지 않았어요.';
    return '<div class="alert al-yel rise ccard" role="alert"><div class="al-head">' + who + ' · ' + esc(a.name || a.ledger) + ' 장부</div>' +
      '<div class="cline">' + esc(a.line) + (a.memo ? ' · ' + esc(a.memo) : '') + '</div><div class="cwhy">' + why + '</div>' +
      (a.lines && a.lines.length ? '<ul class="pvl">' + a.lines.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') +
      '<div class="two"><button class="btn sm ghost2 press" data-act="check" data-d="cancel" data-l="' + esc(a.ledger) + '" data-e="' + esc(a.eventId) + '">취소</button>' +
      '<button class="btn sm primary press" data-act="check" data-d="confirm" data-l="' + esc(a.ledger) + '" data-e="' + esc(a.eventId) + '">확인 (반영)</button></div></div>';
  }
  function decideCheck(btn) {
    if (needPhone()) return;
    var l = btn.getAttribute('data-l'), e = btn.getAttribute('data-e'), d = btn.getAttribute('data-d');
    btn.disabled = true;
    windowCall({ a: 'check', phone: load('phoneKey'), ledger: l, eventId: e, decision: d }).then(function (r) {
      if (!r.ok) throw new Error(r.why === 'not_admin' ? '관리자 폰에서만 할 수 있어요' : r.why === 'not_held' ? '이미 정해졌어요' : why(r.why));
      S.checked[l + '/' + e] = true;
      redrawHome();
      toast(d === 'confirm' ? '확인했어요 · 로봇이 10분 안에 반영해요' : '취소했어요');
    }).catch(function (x) { btn.disabled = false; toast(x.message || '창구에 닿지 못했어요'); });
  }

  function homeHtml(sc) {
    var who = esc(sc.name || '') + ' 장부';
    var left = S.other ? '<button class="back press" data-act="admin">' + BACK + '관리</button>' : '<div class="brand" id="brand">' + MARK + '<span>동파앱</span></div>';
    return '<div class="hd over" id="hd">' + left +
      '<div class="ctitle" id="ctitle">' + who + '</div>' +
      '<div class="hdr">' + freshHtml(sc) + (S.other ? '<span class="whochip">' + who + '</span>' : '') +
      '<button class="iconbtn press" data-act="menu" aria-label="메뉴" aria-haspopup="menu"><svg class="ic dots" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h.01"></path><path d="M12 12h.01"></path><path d="M19 12h.01"></path></svg></button></div></div>' +
      sumHtml(sc) +
      '<div class="scroll top" id="scroll"><div class="wrap">' +
      '<div class="titlerow"><h1 class="h1">' + who + '</h1>' + (S.other ? '<span class="pill teal">남의 장부 · 보기</span>' : '') + '</div>' +
      (S.other ? '<div class="alert al-teal rise" role="status">' + who + '를 보는 중이에요. 내 증권사에 이 주문을 넣지 마세요. 앱을 다시 열면 내 장부로 돌아와요.</div>' : '') +
      alertsBlock(sc) + tonightCard(sc) + lastNightCard(sc) + compareCard(sc) +
      '<div class="robot n">로봇이 이 화면을 만든 때 ' + C.kstWhen(sc.at, now()) + ' · 엔진 ' + esc(sc.engine || '') + '</div>' +
      '</div></div>';
  }
  function freshHtml(sc) {
    var stale = sc.next && C.sessionState(sc.next.session, now()).kind === 'stale';
    return '<span class="n fresh' + (stale ? ' warnt' : '') + '">' + C.kstWhen(sc.at, now()) + '</span>';
  }
  function sumHtml(sc) {
    var os = tonightOrders(sc);
    if (!os.length) return '';
    return '<div class="sumwrap" id="sumwrap"><button class="sumbtn glass press" data-act="top" aria-label="맨 위 오늘 밤 주문으로"><span>오늘 밤</span>' +
      os.map(function (o) { return '<span class="n ' + (o.side === 'BUY' ? 'sb' : 'ss') + '">' + o.side.charAt(0) + ' ' + (o.price === null ? '시장가' : C.price(o.price)) + '×' + o.qty + '</span>'; }).join('') + '</button></div>';
  }

  /* ── 모드 ─────────────────────────────────────────────── */
  function paramsGrid(p) {
    return '<div><div class="meta">BUY</div><div class="n pv">' + C.pct(p.cap) + '</div></div>' +
      '<div><div class="meta">SELL</div><div class="n pv">' + C.pct(p.sell) + '</div></div>' +
      '<div><div class="meta">보유</div><div class="n pv">' + p.hold + '일</div></div>' +
      '<div><div class="meta">한 번에</div><div class="n pv">1/' + p.split + '</div></div>';
  }
  function nextMonday(fri) { return C.addDays(fri, 3); }

  function modeHtml(sc) {
    var v = sc.view && sc.view.mode, params = sc.view && sc.view.params;
    var head = '<div class="hd"><div class="brand">' + MARK + '<span>동파앱</span></div><div class="hdr">' + freshHtml(sc) + '</div></div>';
    if (!v || !params) return head + '<div class="scroll"><div class="wrap"><div class="titlerow"><h1 class="h1">모드</h1></div><section class="card"><p class="later">모드 값이 아직 없어요. 로봇이 다음에 돌면 보여요.</p></section></div></div>';
    var m = v.mode, other = m === 'safe' ? 'aggressive' : 'safe';
    var hist = v.history || [], prov = v.provisional;
    var prevMode = hist.length >= 2 ? hist[hist.length - 2].nextMode : m;
    var dec = C.decideModeRule(v.rr, v.r, prevMode);
    var ruleTxt = dec.rule ? C.RULES[dec.rule - 1].num + ' ' + C.RULES[dec.rule - 1].why : '맞는 규칙 없음 → 직전 유지';
    var session = sc.next && sc.next.session;
    var hero = '<section class="card modehero ' + m + '">' +
      '<div class="meta">' + (session ? C.mdw(session) + ' 주문에 적용' : '') + (prov ? ' · 다음 판정 ' + C.mdw(prov.weekEnd) + ' 종가' : '') + '</div>' +
      '<div class="modebig ' + m + '">' + modeIcon(m) + C.modeName(m) + ' 모드</div>' +
      (v.rr !== null && v.r !== null ? '<div class="n rsiline">QQQ 주간 RSI 전 ' + v.rr.toFixed(2) + ' → 현 ' + v.r.toFixed(2) + '<br>' + ruleTxt + '</div>' : '') +
      '<div class="params">' + paramsGrid(params[m]) + '</div>' +
      '<div class="meta n">' + C.modeName(other) + ' 모드면 ' + C.pct(params[other].cap) + ' · ' + C.pct(params[other].sell) + ' · ' + params[other].hold + '일 · 1/' + params[other].split + '</div></section>';
    return head + '<div class="scroll"><div class="wrap"><div class="titlerow"><h1 class="h1">모드</h1></div>' + hero + rsiCard(v) + simCard() + '</div></div>';
  }

  function rsiCard(v) {
    var hist = v.history || [], prov = v.provisional;
    var pts = hist.map(function (h) { return { date: C.md(h.weekEnd), rsi: h.rsi, mode: h.nextMode, pend: false }; });
    if (prov) pts.push({ date: '이번 주', rsi: prov.rsi, mode: prov.nextMode, pend: true, kept: hist.length && prov.nextMode === hist[hist.length - 1].nextMode });
    var n = pts.length;
    if (!n) return '';
    pts.forEach(function (q, k) { q.left = (k + 0.5) / n * 100; q.bottom = C.vis(q.rsi); q.x = (k + 0.5) / n * 600; q.y = 100 - C.vis(q.rsi); });
    var solid = prov ? pts.slice(0, -1) : pts, tail = prov ? pts.slice(-2) : [];
    var path = function (a) { return a.length ? 'M' + a.map(function (q) { return q.x.toFixed(1) + ',' + q.y.toFixed(1); }).join(' L') : ''; };
    var bands = C.ZONES.map(function (z) { return '<span class="hband z' + z.type + '" style="bottom:' + C.vis(z.from).toFixed(2) + '%;height:' + (C.vis(z.to) - C.vis(z.from)).toFixed(2) + '%"></span>'; }).join('');
    var label = 'QQQ 주간 RSI ' + pts.map(function (q) { return q.date + ' ' + q.rsi.toFixed(2); }).join(', ');
    var html = '<section class="card"><div class="ch"><h2 class="ct">QQQ 주간 RSI</h2><span class="meta">금요일 종가 · 14주</span></div>' +
      '<div class="hplot" role="img" aria-label="' + esc(label) + '">' + bands + '<span class="h50"><span class="n">50</span></span>' +
      '<svg class="hline" viewBox="0 0 600 100" preserveAspectRatio="none" aria-hidden="true"><path class="hl" d="' + path(solid) + '"></path>' + (tail.length ? '<path class="hl hdash" d="' + path(tail) + '"></path>' : '') + '</svg>' +
      pts.map(function (q) { return '<span class="hp' + (q.pend ? ' pend' : '') + '" style="left:' + q.left.toFixed(2) + '%;bottom:' + q.bottom.toFixed(2) + '%"><span class="hv n">' + q.rsi.toFixed(2) + '</span></span>'; }).join('') + '</div>' +
      '<div class="hcols" style="grid-template-columns:repeat(' + n + ',minmax(0,1fr))">' + pts.map(function (q) {
        var name = C.modeName(q.mode);
        return '<div class="hc"><span class="hdate n">' + q.date + '</span><span class="hm ' + (q.mode === 'safe' ? 'msafe' : 'maggr') + '">' + (q.pend ? name + (q.kept ? ' 유지?' : '?') : name) + '</span></div>';
      }).join('') + '</div>' +
      '<div class="hcap">날짜 밑 ‘공세’·‘안전’은 그 주 RSI로 정한 다음 주 모드예요.' + (prov ? ' 맨 오른쪽 점선은 이번 주 잠정값이에요.' : '') + '</div>';
    if (prov) {
      var nm = C.modeName(prov.nextMode);
      var keep = hist.length && prov.nextMode === hist[hist.length - 1].nextMode;
      html += '<div class="fcast"><div>이번 주 지금까지 <span class="pill">잠정 · ' + C.mdw(prov.asOf) + ' 종가까지</span></div>' +
        '<div class="n fbig">' + prov.rsi.toFixed(2) + '</div>' +
        '<div>이대로 금요일에 끝나면 <b class="' + (prov.nextMode === 'safe' ? 'csafe' : 'caggr') + '">다음 주(' + C.md(nextMonday(prov.weekEnd)) + '~)' + (keep ? '도 ' : ' ') + nm + (keep ? ' (그대로)' : '') + '</b></div>' +
        flipsText(prov) + '</div>';
    } else if (hist.length) {
      var lastH = hist[hist.length - 1];
      html += '<div class="fcast"><div>이번 주 RSI는 ' + C.mdw(lastH.weekEnd) + ' 종가로 다 정해졌어요.</div><div>다음 주 모드는 <b class="' + (lastH.nextMode === 'safe' ? 'csafe' : 'caggr') + '">' + C.modeName(lastH.nextMode) + '</b>예요.</div></div>';
    }
    return html + '<div class="g2note" style="padding:8px 16px 0">증권사 앱 RSI와 다를 수 있어요. 동파법은 금요일 종가로 14주 단순 평균(Cutler)을 내고, 금요일 종가로만 모드를 정해요.</div></section>';
  }

  function flipsText(prov) {
    var fs = prov.flips || [];
    if (!fs.length) return '<div class="meta">금요일 종가가 어떻게 나와도(지금의 ±50%) 다음 주 모드는 그대로예요.</div>';
    return fs.map(function (f) {
      var above = prov.close >= f.price;
      var to = above ? f.below : f.above;
      return '<div>금요일 QQQ 종가가 <b class="n">$' + f.price.toFixed(2) + '</b> ' + (above ? '밑이면' : '이상이면') +
        ' <b class="' + (to === 'safe' ? 'csafe' : 'caggr') + '">' + C.modeName(to) + '</b>' + (to === 'safe' ? '으로' : '로') + ' 바뀌어요 <span class="meta n">(RSI ' + f.rsi + (above ? ' 아래' : ' 위') + ' · 지금 $' + prov.close.toFixed(2) + ')</span></div>';
    }).join('');
  }

  /* 모드 시뮬레이터: 처음 한 번 그리고, 값이 바뀌면 그 자리만 고친다(움직임이 끊기지 않게) */
  function simCard() {
    var zones = C.ZONES.map(function (z, k) { return '<span class="gz z' + z.type + '" data-z="' + k + '" style="left:' + C.vis(z.from).toFixed(2) + '%;width:' + (C.vis(z.to) - C.vis(z.from)).toFixed(2) + '%"></span>'; }).join('');
    var ticks = C.TICKS.map(function (v) { return '<span class="g2t n' + (v === 0 || v === 100 ? ' edge' : '') + '" style="left:' + C.vis(v).toFixed(2) + '%">' + v + '</span>'; }).join('');
    var rules = C.RULES.map(function (k, j) {
      return '<div class="rule" data-rule="' + (j + 1) + '"><span class="rn">' + k.num + '</span><span class="rc n">' + k.cond + '</span><span class="rm ' + (k.mode === 'safe' ? 'msafe' : 'maggr') + '">' + C.modeName(k.mode) + '</span></div>';
    }).join('') + '<div class="rule" data-rule="0"><span class="rn">·</span><span class="rc n">어느 것도 아니면</span><span class="rm mkeep">직전 유지</span></div>';
    return '<section class="card" id="sim"><div class="ch"><h2 class="ct">모드 시뮬레이터</h2><span class="pill">가상 · 주문과 무관</span></div>' +
      '<div class="simin"><div><label class="flabel" for="simrr">전 RSI</label><input id="simrr" class="field n" inputmode="decimal" autocomplete="off"></div>' +
      '<div><label class="flabel" for="simr">현 RSI</label><input id="simr" class="field n" inputmode="decimal" autocomplete="off"></div></div>' +
      '<div class="flabel" style="margin:12px 16px 6px">직전 모드</div>' +
      '<div class="seg"><span class="segind" id="segind"></span><button class="segb press" data-prev="safe">안전</button><button class="segb press" data-prev="aggressive">공세</button></div>' +
      '<div class="g2" aria-hidden="true"><div class="g2track">' + zones + '</div><span class="g2mid"></span><span class="g2badge n">50</span>' + ticks +
      '<div class="gmk" id="gmrr"><span class="g2dot g2was"></span></div><div class="gmk" id="gmr"><span class="g2lab n" id="g2lab"></span><span class="g2dot" id="g2dot"></span></div></div>' +
      '<div class="g2leg"><span><i style="background:var(--aggr)"></i>공세 쪽</span><span><i style="background:var(--safe)"></i>안전 쪽</span><span><i style="background:#5c5c63"></i>그대로</span><span class="n" id="g2legv"></span></div>' +
      '<div class="simres" id="simres" role="status"><div class="resmode" id="resmode"></div><div class="reswhy n" id="reswhy"></div></div>' +
      '<div class="rules">' + rules + '</div></section>';
  }
  function simInit(sc) {
    var v = sc.view && sc.view.mode;
    if (!S.sim) S.sim = { rr: v && v.rr !== null ? v.rr.toFixed(2) : '50.00', r: v && v.r !== null ? v.r.toFixed(2) : '50.00', prev: v ? v.mode : 'safe' };
    var rr = document.getElementById('simrr'), r = document.getElementById('simr');
    if (!rr) return;
    rr.value = S.sim.rr; r.value = S.sim.r;
    rr.addEventListener('input', function () { S.sim.rr = rr.value; simUpdate(); });
    r.addEventListener('input', function () { S.sim.r = r.value; simUpdate(); });
    simUpdate();
  }
  function simUpdate() {
    var el = function (id) { return document.getElementById(id); };
    if (!el('sim')) return;
    var rrN = parseFloat(S.sim.rr), rN = parseFloat(S.sim.r);
    var dec = C.decideModeRule(rrN, rN, S.sim.prev);
    var hit = dec.rule ? C.RULES[dec.rule - 1] : null;
    var safe = dec.mode === 'safe';
    el('segind').style.transform = 'translateX(' + (S.sim.prev === 'safe' ? '0%' : '100%') + ')';
    document.querySelectorAll('.segb').forEach(function (b) { var on = b.getAttribute('data-prev') === S.sim.prev; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    el('gmrr').style.transform = 'translateX(' + (isNaN(rrN) ? 0 : C.vis(rrN)).toFixed(2) + '%)';
    el('gmr').style.transform = 'translateX(' + (isNaN(rN) ? 0 : C.vis(rN)).toFixed(2) + '%)';
    el('g2lab').className = 'g2lab n ' + (safe ? 'safe' : 'aggr');
    el('g2lab').textContent = '현 ' + (isNaN(rN) ? '—' : rN.toFixed(2));
    el('g2dot').className = 'g2dot ' + (safe ? 'safe' : 'aggr');
    el('g2legv').textContent = '○ 전 ' + (isNaN(rrN) ? '—' : rrN.toFixed(2)) + ' · ● 현 ' + (isNaN(rN) ? '—' : rN.toFixed(2));
    document.querySelectorAll('.gz').forEach(function (z) { z.classList.toggle('on', !isNaN(rN) && C.inZone(rN, C.ZONES[+z.getAttribute('data-z')])); });
    el('simres').className = 'simres ' + (safe ? 'rsafe' : 'raggr');
    el('resmode').textContent = '판정: ' + C.modeName(dec.mode) + ' 모드';
    el('reswhy').textContent = hit ? hit.num + ' ' + hit.cond + ' — ' + hit.why : '어느 규칙에도 안 맞아 직전 모드(' + C.modeName(S.sim.prev) + ')를 그대로 써요';
    document.querySelectorAll('.rule').forEach(function (k) { k.classList.toggle('on', +k.getAttribute('data-rule') === dec.rule); });
  }

  /* ── 자리만 있는 탭 ───────────────────────────────────── */
  function laterHtml(title) {
    return '<div class="hd"><div class="brand">' + MARK + '<span>동파앱</span></div></div><div class="scroll"><div class="wrap"><div class="titlerow"><h1 class="h1">' + title + '</h1></div>' +
      '<section class="card"><p class="later">동파웹앱의 ‘' + title + '’ 탭 자리예요. 무엇을 어떻게 보여 줄지는 나중에 정해요.</p></section></div></div>';
  }

  /* ── 드문 순간 카드 (모드 바뀐 주 · BC 갱신 날 — 한 번만, 아무 데나 누르면 닫힘) ── */
  function momentHtml(sc, kind) {
    var v = sc.view || {}, params = v.params || {};
    if (kind === 'mode' && v.mode) {
      var m = v.mode.mode, p = params[m];
      return '<div class="moment" id="moment"><button class="momscrim" data-act="moment" aria-label="닫기"></button>' +
        '<div class="mcard mv' + m + '" role="dialog" aria-modal="true" aria-label="이번 주 모드">' +
        '<div class="mlabel">이번 주 모드 · ' + (sc.next ? C.mdw(sc.next.session) + ' 주문부터' : '') + '</div>' +
        '<div class="mbig" style="color:var(--' + (m === 'safe' ? 'safe' : 'aggr') + ')">' + modeIcon(m) + C.modeName(m) + ' 모드</div>' +
        '<p class="mtext n">QQQ 주간 RSI ' + (v.mode.rr !== null ? v.mode.rr.toFixed(2) : '—') + ' → ' + (v.mode.r !== null ? v.mode.r.toFixed(2) : '—') + '. 이미 가진 Lot은 산 때의 모드대로 팔아요.</p>' +
        (p ? '<div class="mparams">' + paramsGrid(p) + '</div>' : '') +
        '<div class="meta" style="text-align:center">아무 데나 누르면 닫혀요</div></div></div>';
    }
    if (kind === 'bc' && sc.bc) {
      var was = (load('bcSeen') || {}).cents;
      var diff = was !== undefined && was !== null ? sc.bc.cents - was : null;
      return '<div class="moment" id="moment"><button class="momscrim" data-act="moment" aria-label="닫기"></button>' +
        '<div class="mcard mb" role="dialog" aria-modal="true" aria-label="BC 갱신">' +
        '<div class="mlabel">BC 갱신 · ' + C.mdw(sc.bc.lastBcDate) + ' 판정 뒤</div>' +
        '<div class="mbig n" id="bcnum">' + C.money(sc.bc.cents) + '</div>' +
        '<p class="mtext n">' + (diff !== null ? '전 ' + C.money(was) + '에서 <span class="' + (diff >= 0 ? 'up' : 'down') + '">' + C.money(diff, true) + '</span>. ' : '') +
        '다음 주문부터 새 BC로 BUY 수량을 정해요.' + (v.bc ? ' 다음 BC는 ' + C.mdw(v.bc.nextDate) + '.' : '') + '</p>' +
        '<div class="meta" style="text-align:center">아무 데나 누르면 닫혀요</div></div></div>';
    }
    return '';
  }
  /** 이번에 띄울 드문 순간: 처음 보는 폰이면 기억만 하고 띄우지 않는다 */
  function pickMoment(sc) {
    var forced = testQ('moment');
    if (forced) return forced;
    var v = sc.view || {};
    var out = null;
    if (sc.bc && sc.bc.lastBcDate) {
      var seen = load('bcSeen');
      if (seen && seen.date !== sc.bc.lastBcDate && seen.cents !== sc.bc.cents) out = 'bc';
    }
    if (!out && v.mode && v.mode.mode) {
      var ms = load('modeSeen');
      if (ms && ms !== v.mode.mode) out = 'mode';
    }
    return out;
  }
  function rememberMoments(sc) {
    if (S.moment === 'bc') return;   // BC 카드가 전 값을 보여 준 뒤에 기억
    if (sc.bc && sc.bc.lastBcDate) save('bcSeen', { date: sc.bc.lastBcDate, cents: sc.bc.cents });
    if (sc.view && sc.view.mode && sc.view.mode.mode) save('modeSeen', sc.view.mode.mode);
  }
  function countBc() {
    var el = document.getElementById('bcnum'), sc = S.screen;
    var was = (load('bcSeen') || {}).cents;
    if (!el || reduced() || was === undefined || was === null) return;
    var to = sc.bc.cents, t0 = null, dur = 1100;
    var step = function (t) {
      if (t0 === null) t0 = t + 260;
      var k = Math.max(0, Math.min(1, (t - t0) / dur)), e = 1 - Math.pow(1 - k, 3);
      el.textContent = C.money(Math.round(was + (to - was) * e));
      if (k < 1) requestAnimationFrame(step);
    };
    el.textContent = C.money(was);
    requestAnimationFrame(step);
  }

  /* ── 그리기 ────────────────────────────────────────────── */
  var root;
  function renderTabs() {
    var nav = document.getElementById('tabs');
    var i = TAB_IDX[S.tab] || 0;
    if (!nav) {
      nav = document.createElement('nav');
      nav.id = 'tabs'; nav.className = 'tabs glass'; nav.setAttribute('aria-label', '아래 메뉴');
      nav.innerHTML = '<span class="tabind" id="tabind"></span>' + TABS.map(function (t) {
        return '<button class="tab press" data-tab="' + t.id + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="ico" d="' + t.icon + '"></path><path class="icf" d="' + t.fill + '"></path></svg>' + t.label + '</button>';
      }).join('');
      root.appendChild(nav);
    }
    document.getElementById('tabind').style.transform = 'translateX(' + (i * 100) + '%)';
    nav.querySelectorAll('.tab').forEach(function (b) {
      var on = b.getAttribute('data-tab') === S.tab;
      b.classList.toggle('on', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
  }

  /** 지금 그리는 장부: 관리자가 관리에서 '장부 보기'를 눌렀으면 그 사람 것 (⑥) */
  function cur() { return S.other ? S.other.screen : S.screen; }
  function render() {
    var sc = cur();
    if (!sc) return;
    root.classList.toggle('other', !!S.other);
    var old = document.getElementById('scr');
    var scr = document.createElement('div');
    scr.id = 'scr';
    scr.className = 'scr ' + (S.dir === 'b' ? 'enterb' : 'enterf');
    scr.innerHTML = S.other || S.tab === 'home' ? homeHtml(sc) : S.tab === 'mode' ? modeHtml(sc) : laterHtml(S.tab === 'lots' ? '보유 Lot' : '수익');
    if (old) root.replaceChild(scr, old); else root.insertBefore(scr, root.firstChild);
    var boot = document.getElementById('boot');
    if (boot) boot.parentNode.removeChild(boot);
    renderTabs();
    var nav = document.getElementById('tabs');
    if (nav) nav.style.display = S.other ? 'none' : '';
    if (S.tab === 'mode' && !S.other) simInit(sc);
    var sc2 = document.getElementById('scroll');
    if (sc2 && (S.tab === 'home' || S.other)) sc2.addEventListener('scroll', onScroll, { passive: true });
    renderOverlays();
  }
  function renderOverlays() {
    var ad = document.querySelector('#adminl .scroll'), adTop = ad ? ad.scrollTop : 0;   // 관리 화면을 다시 그려도 보던 자리 그대로
    ['menuwrap', 'moment', 'pinwrap', 'formwrap', 'sheetwrap', 'adminl'].forEach(function (id) { var e = document.getElementById(id); if (e) e.parentNode.removeChild(e); });
    if (S.menu) {
      var m = document.createElement('div');
      m.id = 'menuwrap';
      var reg = load('phoneKey') ? '<button class="mi" role="menuitem" disabled>이 폰 등록됨 <span class="meta">✓</span></button>'
        : (S.fid ? '<button class="mi" role="menuitem" data-act="pin">이 폰 등록 <span class="meta">PIN</span></button>' : '');
      var nm = S.other ? esc(S.other.name) + ' 장부에 ' : '';
      var boss = !S.other && S.screen && S.screen.admin ? '<div class="msep"></div><button class="mi" role="menuitem" data-act="admin">관리 <span class="pill amber">관리자만</span></button>' : '';
      m.innerHTML = '<button class="mscrim" data-act="menu-close" aria-label="메뉴 닫기" tabindex="-1"></button>' +
        '<div class="menu glass" role="menu"><button class="mi" role="menuitem" data-act="form-deposit">' + nm + '입금</button>' +
        '<button class="mi" role="menuitem" data-act="form-edit">' + (S.other ? esc(S.other.name) + ' 장부 ' : '장부 ') + '수정</button>' + (S.other ? '' : reg) + boss + '</div>';
      root.appendChild(m);
    }
    root.classList.toggle('adminopen', !!S.adminOpen);
    if (S.adminOpen) { renderAdmin(); var ad2 = document.querySelector('#adminl .scroll'); if (ad2) ad2.scrollTop = adTop; }
    if (S.pin) renderPin();
    else if (S.form) renderForm();
    else if (S.sheet) renderSheet();
    if (S.moment) {
      var w = document.createElement('div');
      w.innerHTML = momentHtml(S.screen, S.moment);
      if (w.firstChild) { root.appendChild(w.firstChild); if (S.moment === 'bc') countBc(); }
    }
  }

  function onScroll(e) {
    var st = e.currentTarget.scrollTop;
    var hd = document.getElementById('hd'), ct = document.getElementById('ctitle'), br = document.getElementById('brand'), sw = document.getElementById('sumwrap');
    var c = st > 30;
    if (hd) hd.classList.toggle('glassy', c);
    if (ct) ct.classList.toggle('on', c);
    if (br) br.classList.toggle('fadeout', c);
    var tn = document.getElementById('tonight');
    if (sw && tn) sw.classList.toggle('on', st > tn.offsetTop + tn.offsetHeight - 60);
  }

  function onClick(e) {
    var t = e.target.closest('[data-act],[data-tab],[data-prev]');
    if (!t) return;
    var tab = t.getAttribute('data-tab');
    if (tab) {
      if (tab === S.tab) { var sc = document.getElementById('scroll') || document.querySelector('.scroll'); if (sc) sc.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' }); return; }
      S.dir = TAB_IDX[tab] < TAB_IDX[S.tab] ? 'b' : 'f';
      S.tab = tab; S.menu = false;
      render();
      return;
    }
    var prev = t.getAttribute('data-prev');
    if (prev) { S.sim.prev = prev; simUpdate(); return; }
    var act = t.getAttribute('data-act');
    if (act === 'menu') { S.menu = true; renderOverlays(); }
    else if (act === 'menu-close') { S.menu = false; renderOverlays(); }
    else if (act === 'top') { var s = document.getElementById('scroll'); if (s) s.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' }); }
    else if (act === 'moment') { S.moment = null; rememberMoments(S.screen); renderOverlays(); }
    else if (act === 'pin') { S.menu = false; S.pin = { msg: '', ok: false, busy: false }; renderOverlays(); var f = document.getElementById('pinf'); if (f) f.focus(); }
    else if (act === 'pin-later') { S.pin = null; S.pinLater = true; renderOverlays(); }
    else if (act === 'pin-go') registerPhone();
    else if (act === 'form-deposit' || act === 'form-edit') openForm(act === 'form-deposit' ? 'deposit' : 'edit');
    else if (act === 'form-close') { S.form = null; renderOverlays(); }
    else if (act === 'form-pick') { S.form.type = t.getAttribute('data-type'); S.form.fields = defaultsFor(S.form.type); S.form.pv = null; renderOverlays(); schedulePreview(); }
    else if (act === 'form-back') { S.form.type = null; S.form.pv = null; renderOverlays(); }
    else if (act === 'form-opt') { S.form.fields[t.getAttribute('data-k')] = t.getAttribute('data-v'); if (S.form.pv) S.form.pv.stale = true; renderOverlays(); schedulePreview(); }
    else if (act === 'form-save') saveForm();
    else if (act === 'placed') markPlaced(t);
    else if (act === 'check') decideCheck(t);
    else if (act === 'admin') openAdmin();
    else if (act === 'admin-close') { S.adminOpen = false; renderOverlays(); }
    else if (act === 'view') viewLedger(t.getAttribute('data-id'), t);
    else if (act === 'newlink') { S.sheet = { kind: 'confirm', id: t.getAttribute('data-id') || null, name: t.getAttribute('data-name') || '', all: !t.getAttribute('data-id'), self: !!t.getAttribute('data-self') }; renderOverlays(); }
    else if (act === 'add') { S.sheet = { kind: 'add', name: '', bc: '5,000', msg: '' }; renderOverlays(); }
    else if (act === 'nl-go') makeLinks(t);
    else if (act === 'add-go') addPerson(t);
    else if (act === 'copy') copyMsg(Number(t.getAttribute('data-i')));
    else if (act === 'sheet-close') { S.sheet = null; renderOverlays(); }
    else if (act === 'accept') { S.sheet = { kind: 'accept', ok: false }; renderOverlays(); }
    else if (act === 'accept-check') { S.sheet.ok = !S.sheet.ok; renderOverlays(); }
    else if (act === 'accept-go') acceptGo(t);
    else if (act === 'push-on') enablePush(t);
    else if (act === 'push-test') windowCall({ a: 'push_test', phone: load('phoneKey') }).then(function (r) { toast(r.ok ? '시험 알림을 보냈어요' : '보내지 못했어요'); }).catch(function () { toast('창구에 닿지 못했어요'); });
  }

  /* ── ③ 폰 등록 (PIN) — 창구: 로봇/RobotWindow.gs ─────────────── */
  var cfgP = null;
  function config() {
    if (!cfgP) cfgP = fetch('config.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; });
    return cfgP;
  }
  function windowCall(req) {
    return config().then(function (c) {
      if (!c.window) throw new Error('창구 주소가 아직 없어요');
      // 본문은 글(text/plain): 브라우저가 미리 묻지 않고 바로 보낸다 (0단계 시험 2)
      return fetch(c.window, { method: 'POST', body: JSON.stringify(req) });
    }).then(function (r) {
      if (!r.ok) throw new Error('창구 답 ' + r.status);
      return r.json();
    });
  }
  function renderPin() {
    var P = S.pin, w = document.createElement('div');
    w.id = 'pinwrap';
    w.innerHTML = '<button class="scrim" data-act="pin-later" aria-label="닫기" tabindex="-1"></button>' +
      '<div class="sheet" role="dialog" aria-modal="true" aria-label="이 폰 등록"><div class="grab"></div>' +
      '<h2 class="sh2">이 폰 등록</h2>' +
      '<p class="sp">관리자에게 받은 PIN 6자리를 넣어 주세요. 한 번만 하면 이 폰에서 입금·수정을 할 수 있어요. 보기는 등록 없이도 돼요.</p>' +
      '<input id="pinf" class="field n pinf" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="one-time-code" aria-label="PIN 6자리">' +
      '<div class="pmsg' + (P.ok ? ' ok' : '') + '" id="pmsg" role="status">' + esc(P.msg) + '</div>' +
      '<div class="two"><button class="btn ghost2 press" data-act="pin-later">나중에</button>' +
      '<button class="btn primary press" data-act="pin-go" id="pingo"' + (P.busy ? ' disabled' : '') + '>' + (P.busy ? '확인 중…' : '등록') + '</button></div></div>';
    root.appendChild(w);
    var f = document.getElementById('pinf');
    f.addEventListener('keydown', function (e) { if (e.key === 'Enter') registerPhone(); });
  }
  function pinMsg(text, ok) {
    var m = document.getElementById('pmsg');
    if (m) { m.textContent = text; m.className = 'pmsg' + (ok ? ' ok' : ''); }
  }
  function registerPhone() {
    var f = document.getElementById('pinf'), go = document.getElementById('pingo');
    if (!f || !S.pin || S.pin.busy) return;
    var pin = f.value.replace(/\D/g, '');
    if (pin.length !== 6) { pinMsg('PIN은 숫자 6자리예요'); return; }
    S.pin.busy = true;
    go.disabled = true; go.textContent = '확인 중…';
    pinMsg('');
    windowCall({ a: 'register', f: S.fid, pin: pin }).then(function (r) {
      if (r.ok && r.phone) {
        save('phoneKey', r.phone);
        S.pin = null;
        renderOverlays();
        toast('이 폰을 등록했어요');
        return;
      }
      var why = r.why === 'pin' ? 'PIN이 틀렸어요' + (r.left ? ' (남은 기회 ' + r.left + '번)' : '')
        : r.why === 'locked' ? 'PIN을 5번 틀려 잠겼어요. 관리자에게 새 링크·PIN을 받아 주세요'
        : r.why === 'unknown' ? '링크가 바뀌었어요. 관리자에게 새 링크를 받아 주세요'
        : r.why === 'busy' ? '창구가 바빠요. 잠시 뒤 다시 눌러 주세요' : '등록하지 못했어요. 잠시 뒤 다시';
      throw new Error(why);
    }).catch(function (e) {
      if (!S.pin) return;
      S.pin.busy = false;
      go.disabled = false; go.textContent = '등록';
      pinMsg(/창구 주소|Failed to fetch|NetworkError|Load failed|창구 답/.test(e.message) ? '창구에 닿지 못했어요. 잠시 뒤 다시 (' + e.message + ')' : e.message);
      f.value = '';
      f.focus();
    });
  }
  /* ── ④ 입금 · 장부 수정 (창구: 로봇/RobotInput.gs) ─────────────────
   * 폰은 고르고 숫자만 넣는다. 창구가 로봇과 같은 계산으로 미리보기를 주고, 저장 때 다시 계산해 같아야 저장한다. */
  var EDIT_ITEMS = [
    ['cash_adjust', '현금만 입금·출금', '현금 여유분만. 주문 크기(BC)는 그대로'],
    ['cash_set', '현금 = $X', '증권사 잔고와 맞출 때. 그날의 잔고를 값으로'],
    ['withdraw', '영구 출금', '현금과 BC에서 바로 뺌'],
    ['bc_now', 'BC 지금 갱신', '10거래일 전에 일찍'],
    ['not_placed', '주문 안 냄', '깜빡했거나 증권사가 거절'],
    ['fill_differs', '체결이 달랐음', '체결가·수량이 다를 때'],
    ['manual_buy', '앱 밖 매수', '직접 샀을 때'],
    ['manual_sell', '앱 밖 매도', '직접 팔았을 때'],
    ['cancel_event', '예외 취소', '잘못 넣은 입력 되돌리기']
  ];
  // ⑥d 시장 전체 (관리자 자기 장부에서만 — 창구가 관리자 장부 목록에만 market을 붙인다)
  var MARKET_ITEMS = [
    ['close_set', '종가 입력 <span class="pill amber">관리자만</span>', '야후 종가가 끝내 안 올 때'],
    ['closure', '임시 휴장 <span class="pill amber">관리자만</span>', '휴장표에 없는 휴장 (모든 장부)']
  ];
  function itemName(type) { return EDIT_ITEMS.concat(MARKET_ITEMS).filter(function (x) { return x[0] === type; })[0][1].replace(/ <span.*$/, ''); }
  /** 종가 입력에 고를 날: 시세가 빠진 거래일 + 전에 넣은 수동 종가 */
  function closeDays(sym) {
    var m = S.form.lists.market.symbols[sym] || { missing: [], manual: [] };
    return m.missing.map(function (d) { return [d, C.mdw(d) + ' · 종가 없음']; })
      .concat(m.manual.slice().reverse().map(function (x) { return [x.date, C.mdw(x.date) + ' · 넣은 값 ' + x.close + ' 고치기']; }));
  }
  function closureDays() {
    var M = S.form.lists.market;
    return M.days.map(function (d) { return [d, C.mdw(d) + (d <= M.expected ? ' · 시세 없음' : '')]; })
      .concat(M.closures.map(function (d) { return [d, C.mdw(d) + ' · 임시 휴장 빼기']; }));
  }
  function closeOf(text) { var t = String(text || '').replace(/[,\s$]/g, ''); return /^\d+(\.\d{1,4})?$/.test(t) && parseFloat(t) > 0 ? parseFloat(t) : null; }
  function cents(text) {
    var t = String(text || '').replace(/[,\s$]/g, '');
    if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
    return Math.round(parseFloat(t) * 100);
  }
  function priceOf(text) { var c = cents(text); return c && c > 0 ? c / 100 : null; }
  function intOf(text) { var t = String(text || '').trim(); return /^\d+$/.test(t) ? Number(t) : null; }
  function defaultsFor(type) {
    var L = S.form && S.form.lists;
    var f = { memo: '' };
    if (type === 'cash_adjust') f.dir = 'in';
    if (type === 'cash_set' || type === 'manual_buy' || type === 'manual_sell') f.session = L ? L.P : '';
    if (type === 'manual_buy') f.mode = L && L.mode ? L.mode : 'safe';
    if (type === 'close_set') { f.symbol = 'SOXL'; f.date = L && L.market && L.market.symbols.SOXL.missing.length ? L.market.symbols.SOXL.missing[0] : ''; }
    return f;
  }
  function openForm(kind) {
    S.menu = false;
    if (!load('phoneKey')) { S.pin = { msg: '입력하려면 먼저 이 폰을 등록해 주세요', ok: false, busy: false }; renderOverlays(); return; }
    S.form = { kind: kind, type: kind === 'deposit' ? 'deposit' : null, fields: kind === 'deposit' ? { memo: '' } : {}, pv: null, busy: false, msg: '', lists: null,
      target: S.other ? S.other.id : null };
    renderOverlays();
    if (kind === 'edit') {
      windowCall({ a: 'lists', phone: load('phoneKey'), target: S.form.target || undefined }).then(function (r) {
        if (!S.form) return;
        if (!r.ok) throw new Error(r.message || r.why);
        S.form.lists = r.lists;
        renderOverlays();
      }).catch(function (e) { if (S.form) { S.form.msg = '목록을 못 받았어요 (' + e.message + ')'; renderOverlays(); } });
    }
  }
  /** 지금 칸들 → 창구에 보낼 입력 (모자라면 null과 이유) */
  function formInput() {
    var F = S.form, f = F.fields, t = F.type, x = { type: t, memo: f.memo || '' };
    if (f.when) x.when = f.when;   // [오늘 밤부터]·[다음 세션부터] (남의 장부)
    var need = function (msg) { return { input: null, why: msg }; };
    if (t === 'deposit') {
      var c = cents(f.amount);
      if (!c) return need('금액을 넣어 주세요');
      if (!f.how) return need('‘BC에도 반영’과 ‘현금만’ 중 하나를 골라 주세요');
      x.type = f.how === 'bc' ? 'deposit' : 'cash_adjust';
      x.amountCents = c;
    } else if (t === 'cash_adjust' || t === 'withdraw') {
      var c2 = cents(f.amount);
      if (!c2) return need('금액을 넣어 주세요');
      x.amountCents = t === 'cash_adjust' && f.dir === 'out' ? -c2 : c2;
    } else if (t === 'cash_set') {
      var c3 = cents(f.amount);
      if (c3 === null) return need('현금을 넣어 주세요');
      x.cashCents = c3; x.session = f.session;
    } else if (t === 'not_placed' || t === 'cancel_event') {
      if (!f.pick) return need(t === 'not_placed' ? '주문을 골라 주세요' : '취소할 입력을 골라 주세요');
      if (t === 'not_placed') x.orderId = f.pick; else x.eventId = f.pick;
    } else if (t === 'fill_differs') {
      if (!f.pick) return need('주문을 골라 주세요');
      var q = intOf(f.qty);
      if (q === null) return need('수량을 넣어 주세요 (안 됐으면 0)');
      var p = priceOf(f.price);
      if (q > 0 && !p) return need('체결가를 넣어 주세요');
      x.orderId = f.pick; x.qty = q; x.price = q > 0 ? p : 0;
    } else if (t === 'manual_buy' || t === 'manual_sell') {
      var p2 = priceOf(f.price), q2 = intOf(f.qty);
      if (t === 'manual_sell' && !f.pick) return need('Lot을 골라 주세요');
      if (!p2) return need(t === 'manual_buy' ? '매수가를 넣어 주세요' : '매도가를 넣어 주세요');
      if (t === 'manual_buy' && !q2) return need('수량을 넣어 주세요');
      x.session = f.session; x.price = p2;
      if (q2) x.qty = q2;
      if (t === 'manual_buy') x.mode = f.mode;
      else x.lotId = f.pick;
    } else if (t === 'close_set') {
      if (!f.date || !closeDays(f.symbol).some(function (o) { return o[0] === f.date; })) return need('날짜를 골라 주세요');
      var cl = closeOf(f.price);
      if (!cl) return need('종가를 넣어 주세요 (소수 넷째 자리까지)');
      x.symbol = f.symbol; x.date = f.date; x.close = cl;
    } else if (t === 'closure') {
      if (!f.date) return need('날짜를 골라 주세요');
      x.date = f.date;
    }
    return { input: x, why: '' };
  }
  var pvTimer = null, pvSeq = 0;
  function schedulePreview() {
    // 고치는 동안에는 옛 미리보기로 저장하지 못하게 (보이는 칸과 저장할 값이 달라지지 않게)
    if (S.form && S.form.pv) S.form.pv.stale = true;
    var go = document.getElementById('pvsave');
    if (go) go.disabled = true;
    clearTimeout(pvTimer);
    pvTimer = setTimeout(runPreview, 450);
  }
  function runPreview() {
    if (!S.form || !S.form.type) return;
    var fi = formInput(), my = ++pvSeq;
    if (!fi.input) { S.form.pv = { wait: fi.why }; paintPreview(); return; }
    S.form.pv = { busy: true };
    paintPreview();
    windowCall({ a: 'preview', phone: load('phoneKey'), input: fi.input, target: S.form.target || undefined }).then(function (r) {
      if (my !== pvSeq || !S.form) return;
      S.form.pv = r.ok ? { view: r.preview, input: fi.input } : { error: r.message || why(r.why) };
      paintPreview();
    }).catch(function (e) { if (my === pvSeq && S.form) { S.form.pv = { error: '창구에 닿지 못했어요 (' + e.message + ')' }; paintPreview(); } });
  }
  /** 이름 뒤 '이'/'가' (받침 있으면 '이'). 한글이 아니면 '가' */
  function ga(name) {
    var c = String(name || '').charCodeAt(String(name || '').length - 1);
    return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 ? '이' : '가';
  }
  function why(w) {
    return { unknown_phone: '등록된 폰이 아니에요. 관리자에게 새 링크·PIN을 받아 주세요', stopped: '장부 기록이 바뀌어 로봇이 멈췄어요. 관리자가 확인하면 다시 돼요', busy: '창구가 바빠요. 잠시 뒤 다시', ledger: '장부를 읽지 못했어요', error: '창구에서 문제가 생겼어요' }[w] || ('저장하지 못했어요 (' + w + ')');
  }
  /** 미리보기 칸과 저장 단추만 다시 그린다 (적는 중인 칸은 그대로) */
  function paintPreview() {
    var box = document.getElementById('pvbox'), go = document.getElementById('pvsave');
    if (!box || !S.form) return;
    var P = S.form.pv || {}, v = P.view;
    var note = P.note ? '<div class="pvnote">' + esc(P.note) + '</div>' : '';
    if (P.busy) box.innerHTML = note + '<div class="prev mute">계산 중…</div>';
    else if (P.error) box.innerHTML = note + '<div class="prev warn">' + esc(P.error) + '</div>';
    else if (P.wait) box.innerHTML = '<div class="prev mute">' + esc(P.wait) + '</div>';
    else if (v) box.innerHTML = note + '<div class="prev"><div class="pvhead">' + esc(v.line) + '</div><ul class="pvl">' + v.lines.map(function (x) { return '<li' + (/^주의|^BC 정정/.test(x) ? ' class="warn"' : '') + '>' + esc(x) + '</li>'; }).join('') + '</ul>' +
      (v.state !== '가능' ? '<div class="pvwarn">' + esc(v.state) + ' — 지금은 저장할 수 없어요</div>' : '') + '</div>';
    else box.innerHTML = '';
    if (v && v.needWhen) S.form.wantWhen = true;   // 한 번 물었으면 다시 계산하는 동안에도 고르는 칸을 둔다
    var needWhen = S.form.wantWhen && !S.form.fields.when;
    if (S.form.wantWhen) {
      var nm = esc((S.other && S.other.name) || '');
      box.insertAdjacentHTML('afterbegin', '<div class="prev warn">' + nm + ' 오늘 밤 주문이 바뀌어요. ' + nm + ga(nm) + ' 이미 증권사에 넣었을 수 있어요. 언제부터 반영할지 골라 주세요.</div>' +
        '<div class="two">' + [['tonight', '오늘 밤부터', '바뀐 주문을 ' + nm + '에게 알려야 해요'], ['next', '다음 세션부터', '오늘 밤 주문은 그대로']].map(function (o) {
          var on = S.form.fields.when === o[0];
          return '<button class="opt press' + (on ? ' on' : '') + '" data-act="form-opt" data-k="when" data-v="' + o[0] + '" aria-pressed="' + on + '"><span class="ot">' + o[1] + '</span><span class="os">' + o[2] + '</span></button>';
        }).join('') + '</div>');
    }
    if (go) {
      var label = S.form.busy ? '저장 중…' : needWhen ? '위에서 골라 주세요' : v && v.needBc ? 'BC 정정까지 확인하고 저장' : v && v.ask ? '그래도 또 넣기' : '저장';
      go.textContent = label;
      go.disabled = !(v && !P.busy && !P.stale && !S.form.busy && v.state === '가능' && !needWhen);
      if (v && v.ask) box.insertAdjacentHTML('beforeend', '<div class="prev warn">' + esc(v.ask) + '</div>');
    }
  }
  function saveForm() {
    var F = S.form, P = F && F.pv;
    if (!P || !P.view || F.busy) return;
    F.busy = true;
    paintPreview();
    windowCall({ a: 'save', phone: load('phoneKey'), input: P.input, digest: P.view.digest, confirm: { ask: !!P.view.ask, bc: !!P.view.needBc }, target: F.target || undefined }).then(function (r) {
      if (!S.form) return;
      F.busy = false;
      if (r.ok) {
        S.form = null;
        renderOverlays();
        toast('저장했어요 · 로봇이 10분 안에 다시 계산해요');
        return;
      }
      if (r.preview) { F.pv = { view: r.preview, input: P.input, note: r.why === 'changed' ? '그 사이 장부가 바뀌어 다시 계산했어요. 확인하고 다시 저장해 주세요' : '' }; }
      else F.pv = { error: r.why === 'blocked' ? (r.message || '') + ' — 잠시 뒤 다시 저장해 주세요' : (r.message || why(r.why)), input: P.input };
      paintPreview();
    }).catch(function (e) { if (S.form) { F.busy = false; F.pv = { error: '창구에 닿지 못했어요 (' + e.message + ')' }; paintPreview(); } });
  }
  function field(k, label, attrs) {
    var v = S.form.fields[k] || '';
    return '<div><label class="flabel" for="ff-' + k + '">' + label + '</label><input id="ff-' + k + '" class="field n" data-f="' + k + '" value="' + esc(v) + '" autocomplete="off" ' + (attrs || '') + '></div>';
  }
  function opts(k, list) {
    var cur = S.form.fields[k];
    return '<div class="two">' + list.map(function (o) {
      return '<button class="opt press' + (cur === o[0] ? ' on' : '') + '" data-act="form-opt" data-k="' + k + '" data-v="' + o[0] + '" aria-pressed="' + (cur === o[0]) + '"><span class="ot">' + o[1] + '</span>' + (o[2] ? '<span class="os">' + o[2] + '</span>' : '') + '</button>';
    }).join('') + '</div>';
  }
  function select(k, label, list, empty) {
    var cur = S.form.fields[k] || '';
    return '<div><label class="flabel" for="ff-' + k + '">' + label + '</label><select id="ff-' + k + '" class="field sel" data-f="' + k + '">' +
      (empty ? '<option value="">' + empty + '</option>' : '') +
      list.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === cur ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></div>';
  }
  function sessionsList() {
    var L = S.form.lists, max = L.locked ? L.N : L.P, set = {};
    set[L.P] = true;
    L.orders.forEach(function (o) { if (o.session <= max && (!L.start || o.session > L.start)) set[o.session] = true; });
    return Object.keys(set).sort().reverse().map(function (d) { return [d, C.mdw(d) + (d === L.P ? ' · 어젯밤' : '')]; });
  }
  function orderLabel(o) {
    var r = o.result ? (o.result.status === 'filled' ? ' · 체결 @' + C.price(o.result.price) : ' · 미체결') : ' · 판정 전';
    return C.mdw(o.session) + ' ' + o.side + (o.lotId ? ' ' + o.lotId : '') + ' ' + o.type + ' ' + (o.price === null ? '시장가' : C.price(o.price)) + '×' + o.qty + r;
  }
  function formBody() {
    var F = S.form, t = F.type, L = F.lists, f = F.fields;
    if (t === 'deposit') {
      return field('amount', '금액 (달러)', 'inputmode="decimal" placeholder="예: 1,000"') +
        '<div><div class="flabel">어디에 넣을까요? (하나를 골라 주세요)</div>' + opts('how', [['bc', 'BC에도 반영', '다음 BC 갱신 때 현금·BC에 함께'], ['cash', '현금만', '현금에만 바로. 주문 크기 그대로']]) + '</div>';
    }
    if (t === 'cash_adjust') return opts('dir', [['in', '입금', ''], ['out', '출금', '']]) + field('amount', '금액 (달러)', 'inputmode="decimal"');
    if (t === 'withdraw') return field('amount', '금액 (달러)', 'inputmode="decimal"');
    if (t === 'bc_now') return '<p class="sp">지난 BC 뒤 실현손익으로 BC를 지금 갱신해요. 아래 미리보기에서 새 BC를 확인하세요.</p>';
    if (t === 'cash_set') return select('session', '그날 (그날 체결을 다 반영한 뒤의 잔고)', sessionsList()) + field('amount', '증권사 달러 잔고', 'inputmode="decimal"');
    if (t === 'not_placed') return select('pick', '안 낸 주문', L.orders.filter(function (o) { return !o.result || o.result.status; }).map(function (o) { return [o.id, orderLabel(o)]; }), '주문을 골라 주세요');
    if (t === 'fill_differs') return select('pick', '주문', L.orders.filter(function (o) { return o.result; }).map(function (o) { return [o.id, orderLabel(o)]; }), '주문을 골라 주세요') +
      '<div class="two">' + field('price', '실제 체결가', 'inputmode="decimal"') + field('qty', '실제 수량 (안 됐으면 0)', 'inputmode="numeric"') + '</div>';
    if (t === 'manual_buy') return select('session', '산 날 (미국 세션)', sessionsList()) + '<div class="two">' + field('price', '매수가', 'inputmode="decimal"') + field('qty', '수량', 'inputmode="numeric"') + '</div>' +
      '<div><div class="flabel">Lot 모드</div>' + opts('mode', [['safe', '안전', ''], ['aggressive', '공세', '']]) + '</div>';
    if (t === 'manual_sell') return select('session', '판 날 (미국 세션)', sessionsList()) + select('pick', 'Lot', L.lots.map(function (l) { return [l.lotId, l.lotId + ' · ' + C.price(l.entry) + ' × ' + l.qty + '주']; }), 'Lot을 골라 주세요') +
      '<div class="two">' + field('price', '매도가', 'inputmode="decimal"') + field('qty', '수량 (비우면 전부)', 'inputmode="numeric"') + '</div>';
    if (t === 'close_set') {
      var cd = closeDays(f.symbol);
      return '<div><div class="flabel">종목</div>' + opts('symbol', [['SOXL', 'SOXL', '판정·주문'], ['QQQ', 'QQQ', '주간 RSI·모드']]) + '</div>' +
        (cd.length ? select('date', '날짜 (미국 세션)', cd, '골라 주세요') + field('price', '종가 (달러)', 'inputmode="decimal" placeholder="증권사·다른 곳에서 본 종가"')
          : '<p class="sp">' + f.symbol + ' 빠진 종가가 없어요. 마지막 ' + C.mdw(L.market.symbols[f.symbol].last) + ' ' + L.market.symbols[f.symbol].lastClose + '</p>');
    }
    if (t === 'closure') return '<p class="sp">시장 전체의 일이라 모든 장부에 적용돼요. 이미 휴장인 날을 고르면 휴장을 빼요.</p>' + select('date', '날짜 (미국 세션)', closureDays(), '골라 주세요');
    if (t === 'cancel_event') return L.events.length ? select('pick', '취소할 입력', L.events.map(function (e) { return [e.id, C.mdw(e.session) + ' ' + e.line + (e.memo ? ' · ' + e.memo : '')]; }), '골라 주세요') : '<p class="sp">취소할 입력이 없어요.</p>';
    return '';
  }
  function renderForm() {
    var F = S.form, w = document.createElement('div'), name = esc((cur() && cur().name) || '');
    w.id = 'formwrap';
    var title = F.kind === 'deposit' ? '입금 · ' + name + ' 장부' : F.type ? itemName(F.type) + (F.target ? ' · ' + name : '') : '장부 수정 · ' + name + ' 장부';
    var body;
    if (F.kind === 'edit' && !F.type) {
      body = F.msg ? '<p class="sp warn">' + esc(F.msg) + '</p>' : !F.lists ? '<p class="sp">장부를 읽는 중…</p>' :
        '<div class="items">' + EDIT_ITEMS.concat(F.lists.market && !F.target ? MARKET_ITEMS : []).map(function (x) { return '<button class="opt press" data-act="form-pick" data-type="' + x[0] + '"><span class="ot">' + x[1] + '</span><span class="os">' + x[2] + '</span></button>'; }).join('') + '</div>';
    } else {
      body = (F.target ? '<div class="alert al-teal"><div class="al-head">' + name + ' 장부를 고치는 중</div>저장하면 ' + name + ' 앱에 ‘관리자가 고침’으로 보여요.</div>' : '') +
        formBody() + field('memo', '한 줄 메모 (선택)', 'maxlength="100"') + '<div id="pvbox"></div>' +
        '<div class="two">' + (F.kind === 'edit' ? '<button class="btn ghost2 press" data-act="form-back">뒤로</button>' : '<button class="btn ghost2 press" data-act="form-close">닫기</button>') +
        '<button class="btn primary press" id="pvsave" data-act="form-save" disabled>저장</button></div>';
    }
    w.innerHTML = '<button class="scrim" data-act="form-close" aria-label="닫기" tabindex="-1"></button>' +
      '<div class="sheet tall" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><div class="grab"></div>' +
      '<div class="shd"><h2 class="sh2">' + esc(title) + '</h2><button class="btn sm ghost2 press" data-act="form-close">닫기</button></div>' +
      '<div class="sheetin">' + body + '</div></div>';
    root.appendChild(w);
    w.addEventListener('input', onFormInput);
    w.addEventListener('change', onFormInput);
    paintPreview();
  }
  function onFormInput(e) {
    var k = e.target.getAttribute && e.target.getAttribute('data-f');
    if (!k || !S.form) return;
    if (S.form.fields[k] === e.target.value) return;   // 칸에서 손을 뗄 때(change) 같은 값이면 다시 계산하지 않는다 — 저장 단추를 누르는 순간 막히지 않게
    S.form.fields[k] = e.target.value;
    // 날짜·주문을 고르면 체결 칸을 그 주문 값으로 채워 둔다
    if (k === 'pick' && S.form.type === 'fill_differs' && S.form.lists) {
      var o = S.form.lists.orders.filter(function (x) { return x.id === e.target.value; })[0];
      if (o && o.result) { S.form.fields.price = o.result.status === 'filled' ? C.price(o.result.price) : ''; S.form.fields.qty = String(o.result.qty); renderOverlays(); }
    }
    schedulePreview();
  }

  function needPhone() {
    if (load('phoneKey')) return false;
    S.pin = { msg: '먼저 이 폰을 등록해 주세요', ok: false, busy: false };
    renderOverlays();
    return true;
  }
  function redrawHome() {
    if ((S.tab !== 'home' && !S.other) || !cur()) return;
    var s = document.getElementById('scroll'), top = s ? s.scrollTop : 0;
    var scr = document.getElementById('scr');
    scr.className = 'scr';
    scr.innerHTML = homeHtml(cur());
    scr.querySelectorAll('.tk,.rise,.cl,.cd,.chk path').forEach(function (x) { x.style.animation = 'none'; });
    var s2 = document.getElementById('scroll');
    if (s2) { s2.scrollTop = top; s2.addEventListener('scroll', onScroll, { passive: true }); onScroll({ currentTarget: s2 }); }
  }
  function markPlaced(btn) {
    var nx = S.screen && S.screen.next;
    if (!nx || needPhone()) return;
    btn.disabled = true; btn.textContent = '저장 중…';
    windowCall({ a: 'placed', phone: load('phoneKey'), session: nx.session, d: nx.digest }).then(function (r) {
      if (!r.ok) throw new Error(why(r.why));
      save('placed', { s: nx.session, d: nx.digest, at: r.at || now() });
      redrawHome();
      toast('넣었다고 적었어요');
    }).catch(function (e) { btn.disabled = false; btn.textContent = '증권사에 넣었어요'; toast(e.message || '창구에 닿지 못했어요'); });
  }
  /** 21시 알림 켜기: 알림 허용 → 알림 받는 일꾼(sw.js) → 창구 도장 열쇠로 알림 주소 만들기 → 창구에 저장 → 시험 알림 */
  function enablePush(btn) {
    if (needPhone()) return;
    btn.disabled = true; btn.textContent = '켜는 중…';
    var reg;
    Notification.requestPermission().then(function (p) {
      if (p !== 'granted') throw new Error('알림을 허용해야 켤 수 있어요 (설정 → 알림 → 동파앱)');
      return navigator.serviceWorker.register('sw.js');
    }).then(function (r) { reg = r; return navigator.serviceWorker.ready; })
      .then(function () { return windowCall({ a: 'push_key' }); })
      .then(function (k) {
        if (!k.ok) throw new Error('창구에서 열쇠를 못 받았어요');
        return reg.pushManager.getSubscription().then(function (old) { return old || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(k.key) }); });
      }).then(function (sub) { return windowCall({ a: 'push_sub', phone: load('phoneKey'), sub: { endpoint: sub.endpoint } }); })
      .then(function (r) {
        if (!r.ok) throw new Error(why(r.why));
        save('pushOn', true);
        redrawHome();
        return windowCall({ a: 'push_test', phone: load('phoneKey') });
      }).then(function () { toast('켰어요. 시험 알림이 곧 와요'); })
      .catch(function (e) { btn.disabled = false; btn.textContent = '21시 알림 켜기'; toast(e.message || '켜지 못했어요'); });
  }

  /* ── ⑥ 관리 (관리자만 — 창구가 요청마다 관리자 폰인지 다시 확인: 로봇/RobotAdmin.gs) ── */
  var AV = [['rgba(245,165,36,.18)', '#f5b544'], ['rgba(45,212,191,.18)', '#5eead4'], ['rgba(125,211,252,.18)', '#7dd3fc'], ['rgba(250,204,21,.16)', '#facc15'], ['rgba(196,181,253,.18)', '#c4b5fd']];
  function openAdmin() {
    if (needPhone()) return;
    S.menu = false;
    if (S.other) { S.other = null; render(); }
    S.adminOpen = 'slide';   // 처음 열 때만 밀려 들어온다
    renderOverlays();
    loadAdmin();
  }
  function loadAdmin() {
    windowCall({ a: 'admin', phone: load('phoneKey') }).then(function (r) {
      S.adminData = r.ok ? r : { err: r.why === 'not_admin' ? '관리자 폰에서만 열 수 있어요' : why(r.why) };
      if (S.adminOpen) renderOverlays();
    }).catch(function (e) { S.adminData = { err: '창구에 닿지 못했어요 (' + e.message + ')' }; if (S.adminOpen) renderOverlays(); });
  }
  function adminBody() {
    var D = S.adminData;
    if (!D) return '<section class="card"><p class="later">불러오는 중…</p></section>';
    if (D.err) return '<section class="card"><p class="later warn">' + esc(D.err) + '</p></section>';
    if (D.stopped) return stopBody(D);
    var R = D.robot, st = R.state || {};
    var dot = function (ok) { return '<span class="sdot' + (ok ? '' : ' bad') + '"></span>'; };
    var quote = (R.system || []).filter(function (k) { return /^quote|^fetch|stale/.test(k); });
    var rows = [
      [st.저장 === '가능', '로봇 · 창구', (st.저장 || '') + ' · 엔진 ' + (st.로봇 || '—')],
      [!R.error && !R.stopped, '마지막 실행', R.at ? C.kstWhen(R.at, now()) + (R.error ? ' · 오류 ' + R.error : R.stopped === 'tamper' ? ' · 멈춤: 장부 기록이 덮어써짐 — 깃허브 확인 뒤 구글 편집기에서 robotAcceptHead' : R.stopped ? ' · 멈춤 ' + R.stopped : ' · 정상') : '아직 없음'],
      [!quote.length, '야후 시세', quote.length ? quote.join(', ') : '문제 없음'],
      [R.tokenDays === null || R.tokenDays > 30, '깃허브 열쇠', R.tokenDays === null ? '—' : '만료까지 ' + R.tokenDays + '일']
    ];
    var people = D.people.map(function (u, i) {
      var c = AV[i % AV.length], tags = [];
      if (u.admin) tags.push('관리자');
      if (!u.phones) tags.push('초대함');
      if (u.pinLocked) tags.push('PIN 잠김');
      if (u.held) tags.push('확인 필요 ' + u.held);
      var meta = '폰 ' + u.phones + '대' + (u.bcCents !== null ? ' · BC ' + C.money(u.bcCents) : '') + (u.cashCents !== null ? ' · 현금 ' + C.money(u.cashCents) : '') + (u.placedCheck ? ' · 넣음 단추' : '');
      return '<div class="prow"><div class="pl"><div class="av" style="background:' + c[0] + ';color:' + c[1] + '">' + esc(u.name.charAt(0)) + '</div>' +
        '<div><div class="pname">' + esc(u.name) + tags.map(function (t) { return '<span class="pill">' + t + '</span>'; }).join('') + '</div><div class="sub n">' + esc(meta) + '</div></div></div>' +
        '<div class="pact"><button class="btn sm ghost2 press" data-act="view" data-id="' + esc(u.id) + '"' + (u.admin ? ' disabled' : '') + '>장부 보기</button>' +
        '<button class="btn sm ghost2 press" data-act="newlink" data-id="' + esc(u.id) + '" data-name="' + esc(u.name) + '"' + (u.admin ? ' data-self="1"' : '') + '>새 링크</button></div></div>';
    }).join('');
    return '<section class="card"><div class="ch"><h2 class="ct">로봇</h2><span class="meta n">' + C.kstHm(now()) + ' 확인</span></div>' +
      rows.map(function (r) { return '<div class="srow">' + dot(r[0]) + '<span>' + r[1] + '</span><span class="meta n">' + esc(r[2]) + '</span></div>'; }).join('') + '</section>' +
      '<section class="card" style="padding-bottom:16px"><div class="ch"><h2 class="ct">사람</h2><span class="meta n">' + D.people.length + '명</span></div>' + people +
      '<button class="addrow press" data-act="add">+ 사람 추가</button></section>' +
      '<section class="card danger"><h2 class="ct">로봇 계정을 새로 세웠을 때</h2><p class="dtext">폰 등록(PIN)이 모두 사라져요. 관리자 폰을 먼저 다시 등록한 뒤, 이 단추로 나머지 사람의 새 링크·PIN을 한 번에 만들어요.</p>' +
      '<button class="btn warnbtn press" data-act="newlink">모두에게 새 링크</button></section>';
  }
  /** ⑥e 덮어쓰기로 멈췄을 때 관리 화면: 무슨 일이 있었나(로봇이 만든 쉬운 말) + [다시 돌리기] */
  function stopBody(D) {
    var t = D.tamper, h = '';
    var item = function (c) { return '<li>' + esc(c.msg) + (c.by ? ' <span class="meta">· ' + esc(c.by) + '</span>' : '') + (c.at ? ' <span class="meta n">· ' + C.kstWhen(c.at, now()) + '</span>' : '') + '</li>'; };
    if (!t) h = '<p class="dtext">무슨 일이 있었는지 설명을 만드는 중이에요. 10분 안에 다시 열어 주세요.</p>';
    else if (t.error) h = '<p class="dtext">설명을 만들다 문제가 생겼어요(' + esc(t.error) + '). Claude에게 물어보세요.</p>';
    else {
      var how = t.status === 'missing' ? '마지막으로 정상이던 기록을 깃허브에서 찾을 수 없어요.'
        : t.status === 'behind' ? '기록 ' + t.lostCount + '개가 사라졌어요. 장부를 예전 상태로 되돌린 모양이에요.'
        : '기록 ' + t.lostCount + '개가 사라지고 새 기록 ' + t.addedCount + '개가 생겼어요. 예전 상태로 되돌린 뒤 새로 쓴 모양이에요.';
      h = '<p class="dtext"><b>' + C.kstWhen(t.at, now()) + '</b>에 알아챘어요. ' + how + '</p>';
      if (t.lost.length) h += '<div class="tlabel">사라진 기록</div><ul class="tlist">' + t.lost.map(item).join('') + (t.lostCount > t.lost.length ? '<li class="meta">그 밖에 ' + (t.lostCount - t.lost.length) + '개</li>' : '') + '</ul>';
      if (t.added.length) h += '<div class="tlabel">새 기록 <span class="meta">(이름은 깃허브에 적힌 그대로라 참고만)</span></div><ul class="tlist">' + t.added.map(item).join('') + (t.addedCount > t.added.length ? '<li class="meta">그 밖에 ' + (t.addedCount - t.added.length) + '개</li>' : '') + '</ul>';
      h += '<div class="tlabel">그래서 장부가 이렇게 달라졌어요</div>' + (t.unreadable ? '<p class="dtext">옛 기록을 못 읽어 장부를 비교할 수 없어요.</p>'
        : t.changes.map(function (c) {
          return '<div class="tw"><div class="twho">' + esc(c.who) + '</div><ul class="tlist">' + c.lines.map(function (x) { return '<li' + (/^주의/.test(x) ? ' class="warnt"' : '') + '>' + esc(x) + '</li>'; }).join('') + '</ul></div>';
        }).join(''));
    }
    return '<section class="card danger"><h2 class="ct">로봇이 멈췄어요 · 장부 기록이 바뀌었어요</h2>' + h +
      '<p class="dtext">관리자가 한 일이 맞으면 [다시 돌리기]를 눌러 주세요. 모르는 일이면 누르지 말고 Claude에게 물어보세요. 확인하기 전까지 모든 장부의 계산과 저장이 멈춰 있어요.</p>' +
      (t && !t.error ? '<button class="btn warnbtn press" data-act="accept">다시 돌리기</button>' : '') + '</section>' +
      '<section class="card"><p class="later">사람 목록은 장부를 확인한 뒤에 보여요.</p></section>';
  }
  function acceptGo(btn) {
    var t = S.adminData && S.adminData.tamper;
    if (!t || !S.sheet || !S.sheet.ok) return;
    btn.disabled = true; btn.textContent = '돌리는 중…';
    windowCall({ a: 'accept', phone: load('phoneKey'), head: t.head }).then(function (r) {
      if (!r.ok) throw new Error(r.message || why(r.why));
      S.sheet = null; S.robotStop = null; S.adminData = null;
      renderOverlays();
      toast('다시 돌려요 · 로봇이 10분 안에 다시 계산해요');
      loadAdmin();
    }).catch(function (e) { btn.disabled = false; btn.textContent = '다시 돌리기'; toast(e.message || '창구에 닿지 못했어요'); });
  }

  function renderAdmin() {
    var w = document.createElement('div');
    w.id = 'adminl';
    w.className = 'adminl' + (S.adminOpen === 'slide' ? ' slide' : '');
    S.adminOpen = true;
    w.innerHTML = '<div class="scr"><div class="hd"><button class="back press" data-act="admin-close">' + BACK + '홈</button><span class="pill amber">관리자만</span></div>' +
      '<div class="scroll"><div class="wrap"><div class="titlerow"><h1 class="h1">관리</h1></div><p class="lead">장부 보기 · 새 링크 · 사람 추가. 다른 사람 폰에는 이 화면으로 가는 길이 아예 없어요.</p>' +
      adminBody() + '</div></div></div>';
    root.appendChild(w);
  }
  function viewLedger(id, btn) {
    btn.disabled = true;
    windowCall({ a: 'view', phone: load('phoneKey'), id: id }).then(function (r) {
      if (!r.ok) throw new Error(r.why === 'no_screen' ? '아직 화면 파일이 없어요(로봇이 처음 돌기 전)' : why(r.why));
      S.other = { id: id, name: r.screen.name || id, screen: r.screen };
      S.adminOpen = false;
      S.dir = 'f';
      render();
    }).catch(function (e) { btn.disabled = false; toast(e.message || '창구에 닿지 못했어요'); });
  }
  function linkMsg(l, isNew) {
    return l.name + '님, 동파앱 ' + (isNew ? '링크' : '새 링크') + '예요.\n① 아래 링크를 사파리로 열기\n② 공유 → 홈 화면에 추가' + (isNew ? '' : ' (옛 동파앱 아이콘은 지우기)') +
      '\n③ 앱을 열고 PIN 6자리 넣기\n\n링크: ' + l.link + '\nPIN: ' + l.pin.split('').join(' ');
  }
  function makeLinks(btn) {
    var Sh = S.sheet;
    btn.disabled = true; btn.textContent = '만드는 중…';
    windowCall(Sh.all ? { a: 'newlink', phone: load('phoneKey'), all: true } : { a: 'newlink', phone: load('phoneKey'), id: Sh.id }).then(function (r) {
      if (!r.ok) throw new Error(why(r.why));
      S.sheet = { kind: 'done', links: r.links, isNew: false };
      renderOverlays();
      loadAdmin();
    }).catch(function (e) { btn.disabled = false; btn.textContent = '새 링크 만들기'; toast(e.message || '창구에 닿지 못했어요'); });
  }
  function addPerson(btn) {
    var nm = (document.getElementById('sh-name') || {}).value || '', bc = cents((document.getElementById('sh-bc') || {}).value);
    S.sheet.name = nm; S.sheet.bc = (document.getElementById('sh-bc') || {}).value || '';
    if (!nm.trim() || !bc) { S.sheet.msg = '이름과 시작 BC를 넣어 주세요'; renderOverlays(); return; }
    btn.disabled = true; btn.textContent = '만드는 중…';
    windowCall({ a: 'addperson', phone: load('phoneKey'), name: nm.trim(), bcCents: bc }).then(function (r) {
      if (!r.ok) throw new Error(r.message || why(r.why));
      S.sheet = { kind: 'done', links: r.links, isNew: true, first: r.first };
      renderOverlays();
      loadAdmin();
    }).catch(function (e) { S.sheet.msg = e.message || '만들지 못했어요'; renderOverlays(); });
  }
  function copyMsg(i) {
    var l = S.sheet && S.sheet.links && S.sheet.links[i];
    if (!l) return;
    var text = linkMsg(l, S.sheet.isNew);
    try { navigator.clipboard.writeText(text).then(function () { toast(l.name + '에게 보낼 글 복사됨 · 카톡에 붙여 넣으세요'); }, function () { toast('복사가 안 돼요. 글을 길게 눌러 복사해 주세요'); }); }
    catch (e) { toast('복사가 안 돼요. 글을 길게 눌러 복사해 주세요'); }
  }
  function renderSheet() {
    var Sh = S.sheet, w = document.createElement('div'), title, body;
    w.id = 'sheetwrap';
    if (Sh.kind === 'accept') {
      title = '로봇을 다시 돌릴까요?';
      body = '<p class="sp">지금 깃허브에 있는 장부를 새 기준으로 삼고 로봇을 다시 돌려요. 사라진 기록은 돌아오지 않아요. 잘못 누르면 바뀐 장부로 주문이 나가요.</p>' +
        '<button class="ck press' + (Sh.ok ? ' on' : '') + '" data-act="accept-check" role="checkbox" aria-checked="' + Sh.ok + '"><span class="box">' + (Sh.ok ? '✓' : '') + '</span>위의 바뀐 내용을 확인했고, 관리자가 한 일이 맞아요</button>' +
        '<div class="two"><button class="btn ghost2 press" data-act="sheet-close">취소</button><button class="btn warnbtn press" data-act="accept-go"' + (Sh.ok ? '' : ' disabled') + '>다시 돌리기</button></div>';
    } else if (Sh.kind === 'confirm') {
      title = Sh.all ? '모두에게 새 링크를 만들까요?' : esc(Sh.name) + '에게 새 링크를 만들까요?';
      body = '<p class="sp">' + (Sh.all ? '관리자를 뺀 모든 사람의 링크와 PIN을 한 번에 새로 만들어요. 옛 링크와 등록된 폰은 바로 안 열려요.'
        : esc(Sh.name) + '의 옛 링크와 등록된 폰은 바로 안 열려요. 새 링크를 열고 PIN을 다시 넣어야 해요. 폰을 잃어버렸을 때도 이 단추를 써요.') + '</p>' +
        (Sh.self ? '<div class="prev warn">지금 이 폰도 끊겨요. 새 링크로 다시 등록하기 전까지는 관리를 못 써요.</div>' : '') +
        '<div class="two"><button class="btn ghost2 press" data-act="sheet-close">취소</button><button class="btn primary press" data-act="nl-go">새 링크 만들기</button></div>';
    } else if (Sh.kind === 'add') {
      var bcC = cents(Sh.bc), N = S.screen && S.screen.next ? C.mdw(S.screen.next.session) : '다음';
      title = '사람 추가';
      body = '<div><label class="flabel" for="sh-name">이름 (띄어쓰기 없이)</label><input id="sh-name" class="field" value="' + esc(Sh.name) + '" placeholder="예: 친구B" autocomplete="off"></div>' +
        '<div><label class="flabel" for="sh-bc">시작 BC = 시작 현금 (달러)</label><input id="sh-bc" class="field n" inputmode="decimal" value="' + esc(Sh.bc) + '" autocomplete="off"></div>' +
        '<div class="prev' + (Sh.name && bcC ? '' : ' mute') + '">' + (Sh.name && bcC ? esc(Sh.name) + ' 장부를 만들어요: 시작 현금·BC ' + C.money(bcC) + ' · PCR 100% · LCR 50% · ' + N + ' 세션부터. 만들면 링크와 PIN이 나와요.' : '이름과 시작 BC를 넣어 주세요.') + '</div>' +
        (Sh.msg ? '<div class="prev warn">' + esc(Sh.msg) + '</div>' : '') +
        '<button class="btn primary wide press" data-act="add-go">만들고 링크 받기</button>';
    } else {
      title = '보낼 메시지';
      body = '<p class="sp">카톡으로 한 사람씩 보내 주세요. 링크와 PIN은 그 사람에게만.</p>' + Sh.links.map(function (l, i) {
        return '<div class="msg"><div class="msgtext">' + esc(linkMsg(l, Sh.isNew)) + '</div><button class="btn sm primary press" data-act="copy" data-i="' + i + '">' + esc(l.name) + '에게 보낼 글 복사</button></div>';
      }).join('');
    }
    w.innerHTML = '<button class="scrim" data-act="sheet-close" aria-label="닫기" tabindex="-1"></button>' +
      '<div class="sheet tall" role="dialog" aria-modal="true" aria-label="' + title + '"><div class="grab"></div>' +
      '<div class="shd"><h2 class="sh2">' + title + '</h2><button class="btn sm ghost2 press" data-act="sheet-close">닫기</button></div><div class="sheetin">' + body + '</div></div>';
    root.appendChild(w);
    w.addEventListener('input', function (e) {
      if (!S.sheet || S.sheet.kind !== 'add') return;
      if (e.target.id === 'sh-name') S.sheet.name = e.target.value;
      if (e.target.id === 'sh-bc') S.sheet.bc = e.target.value;
      var pv = w.querySelector('.prev'), bcC2 = cents(S.sheet.bc), N2 = S.screen && S.screen.next ? C.mdw(S.screen.next.session) : '다음';
      if (pv) { pv.className = 'prev' + (S.sheet.name && bcC2 ? '' : ' mute'); pv.textContent = S.sheet.name && bcC2 ? S.sheet.name + ' 장부를 만들어요: 시작 현금·BC ' + C.money(bcC2) + ' · PCR 100% · LCR 50% · ' + N2 + ' 세션부터. 만들면 링크와 PIN이 나와요.' : '이름과 시작 BC를 넣어 주세요.'; }
    });
  }

  function toast(text) {
    var old = document.getElementById('toast');
    if (old) old.parentNode.removeChild(old);
    var t = document.createElement('div');
    t.id = 'toast'; t.className = 'toast glass'; t.setAttribute('role', 'status');
    t.textContent = text;
    root.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2400);
  }

  /* ── 화면 파일 받기 ─────────────────────────────────────── */
  function fetchJson(url) {
    return fetch(url, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('받기 실패 ' + r.status);
      return r.json();
    });
  }
  /* ── 잠근 화면 파일 (로봇/RobotPublish.gs와 같은 약속) ── */
  function b64u(s) {
    var t = s.replace(/-/g, '+').replace(/_/g, '/');
    while (t.length % 4) t += '=';
    var bin = atob(t), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function b64uOf(bytes) {
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function utf8(s) { return new TextEncoder().encode(s); }
  /** 링크의 #k= 열쇠 (있으면 폰에 저장). 없으면 저장된 열쇠 */
  function viewKey() {
    var m = /(?:^#|&)k=([A-Za-z0-9_-]{43})(?:&|$)/.exec(location.hash);
    if (m) {
      if (load('viewKey') !== m[1]) { save('viewKey', m[1]); save('screen', null); save('phoneKey', null); }   // 새 링크: 지난 화면·폰 등록은 버린다
      return m[1];
    }
    return load('viewKey');
  }
  function Locked(msg) { this.message = msg; this.locked = true; }
  function lockedSource(keyText) {
    var subtle = window.crypto && window.crypto.subtle;
    if (!subtle) return Promise.reject(new Error('이 브라우저는 암호 기능이 없어요(https 주소로 열어 주세요)'));
    var key = b64u(keyText);
    var salt = utf8('dongpa-file-v1'), both = new Uint8Array(salt.length + key.length);
    both.set(salt, 0); both.set(key, salt.length);
    var fid;
    return subtle.digest('SHA-256', both).then(function (h) {
      fid = b64uOf(new Uint8Array(h)).slice(0, 22);
      S.fid = fid;
      return fetch('s/' + fid + '.json', { cache: 'no-cache' });
    }).then(function (r) {
      if (r.status === 404) { var g = new Error('화면 파일이 없어요. 링크가 바뀌었으면 관리자에게 새 링크를 받아 주세요'); g.gone = true; throw g; }
      if (!r.ok) throw new Error('받기 실패 ' + r.status);
      return r.json();
    }).then(function (j) {
      return subtle.importKey('raw', key, 'AES-GCM', false, ['decrypt']).then(function (k) {
        return subtle.decrypt({ name: 'AES-GCM', iv: b64u(j.iv), additionalData: utf8('dongpa-screen-v1:' + fid) }, k, b64u(j.ct));
      }).catch(function () { throw new Locked('화면 파일을 열 수 없어요(위조 확인 실패)'); });
    }).then(function (plain) {
      var x = JSON.parse(new TextDecoder().decode(plain));
      if (!x || x.v !== 1 || !x.screen) throw new Locked('화면 파일 모양이 달라요');
      x.screen.head = x.head;
      x.screen.d = x.d || '';
      return { screen: x.screen, before: null };
    });
  }

  function source() {
    var sample = testQ('sample');
    if (sample) {
      return fetchJson('시험/견본/' + encodeURIComponent(sample) + '.json').then(function (j) {
        if (!S.nowFix && j.now) S.nowFix = j.now;
        return { screen: j.screen, before: j.before || null };
      });
    }
    var src = testQ('src');
    if (src) return fetchJson(src).then(function (j) { return { screen: j, before: null }; });
    var k = viewKey();
    return k ? lockedSource(k) : Promise.resolve(null);
  }

  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

  /** 새 내용 있음: 창구에 마지막으로 올린 화면 지문을 물어 지금 화면과 다르면 (깃허브가 퍼뜨리는 데 몇 분) */
  function checkLatest(sc) {
    if (!S.fid || !sc || !sc.d) return;
    windowCall({ a: 'latest', f: S.fid, phone: load('phoneKey') || undefined }).then(function (r) {
      // ⑥e 덮어쓰기로 로봇이 멈췄으면 관리자 폰에만 온다 (멈춘 동안 화면 파일은 안 바뀌어서)
      if (r.robotStop && !S.robotStop) { S.robotStop = r.robotStop; if (S.tab === 'home' && !S.other) redrawHome(); }
      // 지금 보이는 화면(저장본일 수도)과 비교
      if (!r.ok || !r.d || !S.screen || r.d === (S.screen.d || sc.d)) return;
      S.newer = true;
      var el = document.getElementById('newer');
      if (!el && S.tab === 'home') redrawHome();
    }).catch(function () { /* 창구가 없어도 화면은 그대로 */ });
  }

  function show(sc, before) {
    S.before = before;
    S.screen = sc;
    S.moment = pickMoment(sc);
    // ③ 처음 열 때 PIN (설계서 「처음 한 번」). 보기는 그대로 되고, [나중에]를 누르면 이번에는 다시 안 묻는다
    if (S.fid && !load('phoneKey') && !S.pinLater && !S.pin && !S.moment) S.pin = { msg: '', ok: false, busy: false };
    render();
    rememberMoments(sc);
  }

  function bootMsg(text) {
    var b = document.getElementById('bmsg');
    if (b) b.textContent = text;
  }

  /**
   * 새 화면이 올라갔으면 한 번 새로 연다 (10/24 형님). 깃허브 페이지는 파일을 10분까지 저장해 두게 해서
   * 껐다 켜도 옛 화면이 뜰 수 있다 → version.json을 저장본 없이 물어 버전이 다르면 ?v=새 버전 주소로(새 주소라 새로 받는다).
   * 같은 버전으로는 한 번만 (새로 열어도 옛 파일이면 그대로 둔다 — 계속 다시 열지 않게)
   */
  function checkVersion() {
    if (APP_VERSION === 'dev') return;
    fetch('version.json', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j || !j.v || j.v === APP_VERSION) return;
      var tried = null;
      try { tried = sessionStorage.getItem('dongpa.vtried'); } catch (e) { /* 그냥 */ }
      if (tried === j.v) return;
      try { sessionStorage.setItem('dongpa.vtried', j.v); } catch (e) { /* 그냥 */ }
      var q = new URLSearchParams(location.search);
      q.set('v', j.v);
      location.replace(location.pathname + '?' + q.toString() + location.hash);
    }).catch(function () { /* 못 물으면 지금 화면 그대로 */ });
  }

  function start() {
    checkVersion();
    root = document.getElementById('app');
    root.addEventListener('click', onClick);
    // 새 링크(# 뒤 열쇠)로 바꿔 열면 처음부터 다시 (같은 페이지라 저절로는 안 다시 읽는다)
    window.addEventListener('hashchange', function () { location.reload(); });
    // 새 링크(#k=)면 지난 링크의 화면·폰 등록을 먼저 버린다 — 옛 사람의 주문표가 잠깐이라도 보이지 않게 (10/26 검토 AI)
    if (!testQ('sample') && !testQ('src')) viewKey();
    var cached = testQ('sample') ? null : load('screen');
    if (cached) show(cached, null);
    source().then(function (got) {
      if (!got) { if (!cached) bootMsg('보기 링크로 열어 주세요.'); return; }
      var sc = got.screen;
      checkLatest(sc);
      if (cached && same(cached, sc)) {
        // 화면은 그대로지만 등록 안 된 폰이면 PIN을 묻는다
        if (S.fid && !load('phoneKey') && !S.pinLater && !S.pin && !S.moment) { S.pin = { msg: '', ok: false, busy: false }; renderOverlays(); }
        return;
      }
      // 지난번에 본 화면과 비교해 바뀐 숫자만 굴린다
      var before = got.before || cached;
      if (!testQ('sample')) save('screen', sc);
      show(sc, before);
    }).catch(function (e) {
      if (e && (e.locked || e.gone)) {
        // 위조 확인 실패: 저장된 화면도 내리고 주문표를 안 보인다 (설계서 「안전장치」)
        // 화면 파일이 없음(링크가 바뀜)도 같다: 저장된 옛 화면으로 주문하지 않게
        save('screen', null);
        S.screen = null;
        root.innerHTML = '<div class="boot" id="boot">' + MARK + '<div class="lname">동파앱</div>' +
          '<div class="bmsg" id="bmsg" style="color:#ffb35c">' + esc(e.message) + (e.gone ? '' : '. 이 화면으로 주문하지 마세요. 관리자에게 알려 주세요.') + '</div></div>';
        return;
      }
      if (!cached) bootMsg('화면을 못 받았어요. 잠시 뒤 다시 열어 주세요. (' + e.message + ')');
    });
    // 남은 시간·오래됨은 시계로 바뀐다: 1분마다 홈만 조용히 다시 (애니메이션 없이)
    setInterval(function () {
      if (!S.screen || S.nowFix || S.tab !== 'home' || S.moment || S.menu) return;
      S.before = null;
      redrawHome();
    }, 60000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
