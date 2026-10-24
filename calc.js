/*
 * calc.js — 화면 계산 (화면 그리기 없음. 폰과 node 시험에서 같이 쓴다)
 * ------------------------------------------------------------------
 * 화면 파일(screen.json)은 로봇이 다 계산해 둔다. 여기서는 보여 주기 위한 것만:
 *   시각(미국 동부 ↔ 한국), 남은 시간, 오래된 화면인지, 돈·숫자 모양, 모드 시뮬레이터 규칙, 게이지 눈금.
 * 매매 규칙은 바꾸지 않는다. decideModeRule은 동파웹앱 5.4 decideMode와 같은 순서·같은 조건이다
 * (엔진 decideMode와 같은지는 화면/시험/계산_시험.mjs가 확인한다).
 */
var DongpaCalc = (function () {
  'use strict';

  var ET = 'America/New_York', KST = 'Asia/Seoul';
  var DOW = ['일', '월', '화', '수', '목', '금', '토'];

  /* ── 시각 ─────────────────────────────────────────────── */

  var fmtCache = {};
  function parts(ms, tz) {
    var f = fmtCache[tz] || (fmtCache[tz] = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short'
    }));
    var o = {};
    f.formatToParts(new Date(ms)).forEach(function (p) { o[p.type] = p.value; });
    return {
      date: o.year + '-' + o.month + '-' + o.day, y: +o.year, m: +o.month, d: +o.day,
      hh: +o.hour, mm: +o.minute, dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(o.weekday)
    };
  }

  /** 동부 날짜 'YYYY-MM-DD'의 minutes(0~1439)분 → UTC ms. 서머타임은 그날 낮 기준(엔진 easternToUtcMs와 같게) */
  function easternToUtcMs(date, minutes) {
    var y = +date.slice(0, 4), mo = +date.slice(5, 7) - 1, d = +date.slice(8, 10);
    var noon = Date.UTC(y, mo, d, 17);                      // 동부 낮 12~13시
    var p = parts(noon, ET);
    var offH = 17 - p.hh;                                  // 4 (서머타임) 또는 5
    return Date.UTC(y, mo, d, 0, minutes) + offH * 3600000;
  }
  function openMs(session) { return easternToUtcMs(session, 9 * 60 + 30); }
  function closeMs(session) { return easternToUtcMs(session, 16 * 60); }

  function md(date) { return (+date.slice(5, 7)) + '/' + (+date.slice(8, 10)); }
  function dowOf(date) { return DOW[new Date(date + 'T12:00:00Z').getUTCDay()]; }
  /** '10/15(목)' */
  function mdw(date) { return md(date) + '(' + dowOf(date) + ')'; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  /** 한국 시각 'HH:MM' */
  function kstHm(ms) { var p = parts(ms, KST); return pad(p.hh) + ':' + pad(p.mm); }
  /** 한국 날짜 'M/D' */
  function kstMd(ms) { var p = parts(ms, KST); return p.m + '/' + p.d; }
  /** 같은 한국 날이면 'HH:MM', 아니면 'M/D HH:MM' */
  function kstWhen(ms, nowMs) {
    return parts(ms, KST).date === parts(nowMs, KST).date ? kstHm(ms) : kstMd(ms) + ' ' + kstHm(ms);
  }
  function addDays(date, n) {
    var t = new Date(date + 'T12:00:00Z');
    t.setUTCDate(t.getUTCDate() + n);
    return t.toISOString().slice(0, 10);
  }

  /** '14시간 10분' · '35분' */
  function span(ms) {
    var m = Math.max(0, Math.round(ms / 60000));
    var h = Math.floor(m / 60);
    if (h >= 48) return Math.floor(h / 24) + '일';
    return h ? h + '시간' + (m % 60 ? ' ' + (m % 60) + '분' : '') : (m % 60) + '분';
  }

  /**
   * 오늘 밤 주문표의 상태 (폰 시계 기준)
   *   before — 개장 전 (주문 넣을 때)  · open — 장 중 (고정)  · stale — 그 세션이 이미 끝남: 이 주문표로 주문하면 안 됨
   */
  function sessionState(session, nowMs) {
    if (!session) return { kind: 'none' };
    var o = openMs(session), c = closeMs(session);
    if (nowMs < o) return { kind: 'before', openMs: o, left: o - nowMs };
    if (nowMs < c) return { kind: 'open', openMs: o };
    return { kind: 'stale', openMs: o, since: nowMs - c };
  }

  /* ── 숫자 ─────────────────────────────────────────────── */

  function money(cents, sign) {
    var neg = cents < 0, c = Math.abs(Math.round(cents));
    var s = '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (neg) return '−' + s;
    return sign && c ? '+' + s : s;
  }
  function usd(x, sign) { return money(Math.round(x * 100), sign); }
  function price(x) { return x === null || x === undefined ? '—' : Number(x).toFixed(2); }
  function pct(x) { return '+' + (x * 100).toFixed(2) + '%'; }
  /** 달러 → 원 (부호 붙임): '+167,312원' · '−5,400원' */
  function won(usdAmount, rate) {
    var n = Math.round(usdAmount * rate), s = Math.abs(n).toLocaleString('en-US') + '원';
    return n < 0 ? '−' + s : n > 0 ? '+' + s : s;
  }
  /** 원화 어림값: '≈ 3,421만 원' */
  function krwApprox(cents, rate) {
    if (!(rate > 0)) return '';
    var won = cents / 100 * rate;
    return '≈ ' + Math.round(won / 10000).toLocaleString('ko-KR') + '만 원';
  }

  /** 바뀐 자리만 굴러가게: [{ ch, roll, up }] */
  function rollDigits(oldS, newS) {
    var out = [];
    var same = oldS !== undefined && oldS !== null && String(oldS).length === String(newS).length;
    for (var k = 0; k < newS.length; k++) {
      var a = same ? oldS.charAt(k) : '', b = newS.charAt(k);
      var roll = !!(same && a !== b && /\d/.test(a) && /\d/.test(b));
      out.push({ ch: b, from: a, roll: roll, up: roll && +b > +a, delay: k * 40 });
    }
    return out;
  }

  /* ── 모드 ─────────────────────────────────────────────── */

  var RULES = [
    { num: '①', cond: '전 ≤ 35 · 전 < 현', mode: 'aggressive', why: '바닥에서 반등' },
    { num: '②', cond: '40 ≤ 전 < 50 · 전 > 현', mode: 'safe', why: '50 아래에서 꺾임' },
    { num: '③', cond: '전 ≤ 50 · 현 > 50', mode: 'aggressive', why: '50 상향 돌파' },
    { num: '④', cond: '전 ≥ 50 · 현 < 50', mode: 'safe', why: '50 하향 돌파' },
    { num: '⑤', cond: '50 ≤ 전 < 60 · 전 < 현', mode: 'aggressive', why: '상승 추세' },
    { num: '⑥', cond: '전 > 65 · 전 > 현', mode: 'safe', why: '과열 뒤 꺾임' }
  ];

  /** 동파웹앱 5.4 CoreEngine.gs decideMode와 같은 순서·같은 조건. 몇 번째 규칙인지(0 = 직전 유지)도 준다 */
  function decideModeRule(rr, r, prev) {
    if (rr === null || rr === undefined || isNaN(rr) || r === null || r === undefined || isNaN(r)) return { mode: prev, rule: 0 };
    if (rr <= 35 && rr < r) return { mode: 'aggressive', rule: 1 };
    if (rr >= 40 && rr < 50 && rr > r) return { mode: 'safe', rule: 2 };
    if (rr <= 50 && r > 50) return { mode: 'aggressive', rule: 3 };
    if (rr >= 50 && r < 50) return { mode: 'safe', rule: 4 };
    if (rr >= 50 && rr < 60 && rr < r) return { mode: 'aggressive', rule: 5 };
    if (rr > 65 && rr > r) return { mode: 'safe', rule: 6 };
    return { mode: prev, rule: 0 };
  }

  /*
   * 게이지: 구간 색은 동파웹앱 5.4 WebApp.html 그대로. 눈금 자리는 5.4 왼쪽 곡선(2.05)으로 35·40을 50에서 떨어뜨리고,
   * 오른쪽은 왼쪽을 거울처럼 뒤집어 60·65가 40·35와 같은 거리에 오게 한다(10/23 형님: 5.4 오른쪽 곡선 1.48은 60·65가 어색함).
   * 그림일 뿐 판정에는 안 쓴다. 70 눈금은 규칙에 없는 숫자라 뺐다.
   */
  var CURVE = 2.05;
  var ZONES = [
    { from: 0, to: 35, type: 'aggr' }, { from: 35, to: 40, type: 'neut' }, { from: 40, to: 50, type: 'safe' },
    { from: 50, to: 60, type: 'aggr' }, { from: 60, to: 65, type: 'neut' }, { from: 65, to: 100, type: 'safe' }
  ];
  var TICKS = [0, 35, 40, 60, 65, 100];
  function vis(rsi) {
    var v = Math.max(0, Math.min(100, Number(rsi)));
    if (v <= 50) return Math.pow(v / 50, CURVE) * 50;
    return 100 - Math.pow((100 - v) / 50, CURVE) * 50;
  }
  function inZone(r, z) { return z.to === 100 ? (r >= z.from && r <= z.to) : (r >= z.from && r < z.to); }
  function modeName(m) { return m === 'safe' ? '안전' : m === 'aggressive' ? '공세' : '—'; }

  return {
    parts: parts, easternToUtcMs: easternToUtcMs, openMs: openMs, closeMs: closeMs,
    md: md, mdw: mdw, dowOf: dowOf, kstHm: kstHm, kstMd: kstMd, kstWhen: kstWhen, addDays: addDays, span: span,
    sessionState: sessionState,
    money: money, usd: usd, won: won, price: price, pct: pct, krwApprox: krwApprox, rollDigits: rollDigits,
    RULES: RULES, decideModeRule: decideModeRule, ZONES: ZONES, TICKS: TICKS, vis: vis, inZone: inZone, modeName: modeName
  };
})();
if (typeof module !== 'undefined') module.exports = DongpaCalc;
