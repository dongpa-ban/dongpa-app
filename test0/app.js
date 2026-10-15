// 동파앱 0단계 시험 화면 (가짜 숫자).
// 재는 것: ① 앱을 열고 화면이 뜨기까지 걸린 시간(저장본 / 새 파일) ② 홈 화면 앱에서 링크 열쇠(#k=)가 남는지
//          ③ 깃허브 화면 주소와 raw 주소 중 어디가 빠르고 최신인지.
// 장부 내용은 글자로만 그린다(innerHTML에 데이터를 넣지 않는다).
"use strict";

const VARIANT = document.body.dataset.variant || "A";
const PAGES_URL = "data/sample.json";
const RAW_URL = "https://raw.githubusercontent.com/dongpa-ban/dongpa-app/main/test0/data/sample.json";
const STORE = "dongpa-test0";
const AAD = new TextEncoder().encode("dongpa-screen-v1");

const t = {};                                    // 걸린 시간(ms, 앱을 연 순간부터)
const mark = (name) => { t[name] = Math.round(performance.now()); };
const info = {};

// ---------- 저장소 (사파리 개인정보 보호 모드 등에서 실패해도 화면은 떠야 한다)
function load() { try { return JSON.parse(localStorage.getItem(STORE) || "{}"); } catch (e) { return {}; } }
function save(obj) { try { localStorage.setItem(STORE, JSON.stringify(obj)); } catch (e) { /* 무시 */ } }

// ---------- 열쇠: 링크(#k=)가 먼저, 없으면 이 폰에 저장된 것
function getKey() {
  const m = /(?:^#|&)k=([A-Za-z0-9_-]{43})/.exec(location.hash);
  const st = load();
  if (m) { st.key = m[1]; save(st); return { key: m[1], from: "링크" }; }
  if (st.key) return { key: st.key, from: "이 폰의 저장본" + (st.keyVia ? " · " + st.keyVia : "") };
  return { key: null, from: "없음" };
}

const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function unlock(file, keyText) {
  const key = await crypto.subtle.importKey("raw", unb64u(keyText), "AES-GCM", false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64u(file.iv), additionalData: AAD }, key, unb64u(file.ct));
  return JSON.parse(new TextDecoder().decode(plain));     // 위조됐으면 위에서 오류가 난다
}

// ---------- 그리기 (글자로만)
function el(tag, text, cls) {
  const e = document.createElement(tag);
  if (text != null) e.textContent = String(text);
  if (cls) e.className = cls;
  return e;
}
function table(rows) {
  const tb = el("table");
  for (const r of rows) {
    const tr = el("tr");
    r.forEach((c, i) => tr.appendChild(el("td", c, i > 0 && typeof c === "number" ? "n" : null)));
    tb.appendChild(tr);
  }
  return tb;
}
// 국제 표준시(…Z)를 한국 시각 "10/15 20:05:03 (3분 전)"으로
function kst(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d)) return String(iso);
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(d).map((x) => [x.type, x.value]));
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  return `${p.month}/${p.day} ${p.hour}:${p.minute}:${p.second}` + (min >= 0 ? ` (${min}분 전)` : "");
}
const money = (v) => "$" + Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function render(d, label) {
  const app = document.getElementById("app");
  app.replaceChildren();
  const top = el("p");
  top.append(el("span", `${d["대상세션"]} 세션용 · ${d["모드"]} 모드 `), el("span", label, "src"));
  app.appendChild(top);

  app.appendChild(el("h2", "어젯밤 결과"));
  app.appendChild(table(d["어젯밤"].map((x) => [x["주문"], x["결과"]])));
  const hold = el("p");
  hold.append(el("span", "장부상 보유 · 달러 잔고  "), el("span", `${d["보유수량"]}주 · ${money(d["달러잔고"])}`, "big"));
  app.appendChild(hold);

  app.appendChild(el("h2", "오늘 밤 주문"));
  app.appendChild(table(d["오늘밤"].map((o) => [
    o["종류"] + (o["Lot"] ? " " + o["Lot"] : ""),
    o["방식"] + (o["가격"] != null ? " " + o["가격"].toFixed(2) : ""),
    o["수량"],
    o["D-Day"] != null ? "D-" + o["D-Day"] : "",
  ])));
  app.appendChild(el("p", `로봇 마지막 성공: ${kst(d["로봇마지막성공"])} · 파일 만든 시각: ${kst(d["만든시각"])} (한국)`, "muted"));
}

// ---------- 결과 칸
function showResult() {
  const box = document.getElementById("result");
  box.replaceChildren(el("b", "시험 결과"));
  const nav = performance.getEntriesByType("navigation")[0];
  const firstPaint = t["저장본 표시"] ?? t["새 화면 표시"];
  const rows = [
    ["시험판", VARIANT],
    ["지금 (한국 시각)", kst(new Date().toISOString()).replace(/ \(.*\)$/, "")],
    ["기기", navigator.userAgent.replace(/^Mozilla\/5\.0 \(([^)]*)\).*$/, "$1").slice(0, 60)],
    ["홈 화면 앱으로 열림", info.standalone ? "예" : "아니요 (브라우저)"],
    ["열쇠 출처", info.keyFrom],
    ["주소의 # 부분", location.hash ? "있음" : "없음"],
    ["껍데기 받음", nav ? Math.round(nav.responseEnd) + " ms" : "-"],
    ["저장본으로 첫 화면", t["저장본 표시"] != null ? t["저장본 표시"] + " ms" : "저장본 없음"],
    ["새 파일 받음", t["새 파일 받음"] != null ? t["새 파일 받음"] + " ms" : (info.pagesError || "-")],
    ["새 화면 표시", t["새 화면 표시"] != null ? t["새 화면 표시"] + " ms" : "-"],
    ["깃허브 화면 파일 만든 시각 (한국)", kst(info.pagesMade)],
    ["깃허브 화면 캐시", info.pagesCache || "-"],
    ["raw 주소 받음", t["raw 받음"] != null ? t["raw 받음"] + " ms" : (info.rawError || "-")],
    ["raw 파일 만든 시각 (한국)", kst(info.rawMade)],
    ["raw 캐시", info.rawCache || "-"],
  ];
  for (const [k, v] of rows) {
    const r = el("div", null, "row");
    r.append(el("span", k), el("span", v));
    box.appendChild(r);
  }
  const verdict = el("p");
  if (firstPaint != null) {
    const pass = firstPaint <= 2000;
    verdict.append(el("span", "2초 안에 주문표: "), el("span", pass ? `통과 (${firstPaint} ms)` : `미달 (${firstPaint} ms)`, pass ? "ok" : "bad"));
  } else {
    verdict.append(el("span", "주문표를 못 띄움: " + (info.error || "열쇠 없음"), "bad"));
  }
  box.appendChild(verdict);

  const text = rows.map(([k, v]) => `${k}: ${v}`).join("\n") + "\n" + verdict.textContent;
  const copy = el("button", "결과 복사");
  copy.onclick = async () => {
    try { await navigator.clipboard.writeText(text); copy.textContent = "복사됨"; }
    catch (e) { const ta = el("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); copy.textContent = "복사됨"; }
  };
  const again = el("button", "다시 재기");
  again.onclick = () => location.reload();
  const clear = el("button", "저장본 지우기");
  clear.onclick = () => { const st = load(); delete st.file; save(st); location.reload(); };
  const forget = el("button", "열쇠 지우기");
  forget.onclick = () => { save({}); location.replace(location.pathname); };
  box.append(copy, again, clear, forget);
}

// ---------- 열쇠가 없을 때: PIN을 넣으면 창구가 보기 열쇠를 건네준다 (홈 화면 앱은 사파리와 저장 공간이 따로라서)
async function askPin() {
  const app = document.getElementById("app");
  let url = null;
  try { url = (await (await fetch("config.json", { cache: "no-store" })).json())["창구"]; } catch (e) { /* 아래에서 안내 */ }
  if (!url) {
    app.replaceChildren(el("p", "열쇠가 없습니다. 형님이 보낸 링크(#k= 포함)로 열어 주세요.", "bad"));
    return;
  }
  const input = el("input");
  input.inputMode = "numeric"; input.maxLength = 6; input.autocomplete = "one-time-code"; input.placeholder = "PIN 6자리";
  const btn = el("button", "등록");
  const msg = el("p", null, "muted");
  btn.onclick = async () => {
    btn.disabled = true; msg.textContent = "창구에 묻는 중…";
    const t0 = performance.now();
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ a: "register", pin: input.value.trim() }) });
      const r = await res.json();
      const ms = Math.round(performance.now() - t0);
      if (r.ok && r.viewKey) {
        const st = load(); st.key = r.viewKey; st.phoneKey = r.phoneKey; st.keyVia = `PIN 등록으로 받음 (${ms} ms)`; save(st);
        location.reload();
      } else {
        msg.textContent = `${r.오류 || "실패"} (${ms} ms)`; btn.disabled = false;
      }
    } catch (e) {
      msg.textContent = "창구 연결 실패: " + e.message; btn.disabled = false;
    }
  };
  app.replaceChildren(el("p", "이 폰에 열쇠가 없습니다. 형님께 받은 PIN 6자리를 넣어 주세요."), input, btn, msg);
}

// ---------- 순서
async function fetchFile(url) {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return { file: await res.json(), cache: res.headers.get("cache-control") || "-" };
}

async function main() {
  info.standalone = navigator.standalone === true || matchMedia("(display-mode: standalone)").matches;
  const { key, from } = getKey();
  info.keyFrom = from;

  // raw 주소는 비교만 한다(화면에는 안 씀). 동시에 출발.
  const rawJob = fetchFile(RAW_URL + "?t=" + Date.now())
    .then(({ file, cache }) => { mark("raw 받음"); info.rawMade = file["만든시각"]; info.rawCache = cache; })
    .catch((e) => { info.rawError = "실패: " + e.message; });

  // ① 저장본으로 먼저 그린다
  const st = load();
  if (key && st.file) {
    try { render(await unlock(st.file, key), "저장본"); mark("저장본 표시"); }
    catch (e) { info.error = "저장본을 못 풂: " + e.message; }
  }

  // ② 새 파일을 받아 다시 그린다
  let fresh = null;
  try {
    const { file, cache } = await fetchFile(PAGES_URL);
    mark("새 파일 받음");
    info.pagesMade = file["만든시각"]; info.pagesCache = cache;
    fresh = file;
  } catch (e) {
    info.pagesError = "실패: " + e.message;
    if (!t["저장본 표시"]) info.error = "새 파일을 못 받음: " + e.message;
  }
  if (fresh && key) {
    try {
      render(await unlock(fresh, key), "새 파일");
      mark("새 화면 표시");
      const s = load(); s.file = fresh; save(s);
    } catch (e) {
      // 위조 확인 실패 또는 틀린 열쇠: 주문표를 띄우지 않는다
      document.getElementById("app").replaceChildren(el("p", "새 파일을 풀지 못했습니다(열쇠가 틀렸거나 파일이 바뀜). 이 주문표로 주문하지 마세요.", "bad"));
      delete t["저장본 표시"];
      info.error = "새 파일을 못 풂";
    }
  } else if (!key) {
    await askPin();
  }

  await rawJob;
  showResult();
}

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
main();
