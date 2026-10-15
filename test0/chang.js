// 창구(구글 스크립트) 응답 시간 재기. 핑(GET)과 메아리(POST)를 차례로 10번씩 보낸다.
// POST는 구글이 다른 주소로 옮겨 답하므로, 폰 브라우저가 따라가서 받는지도 함께 본다.
"use strict";

const N = 10;
const el = (tag, text, cls) => { const e = document.createElement(tag); if (text != null) e.textContent = String(text); if (cls) e.className = cls; return e; };

async function timed(fn) {
  const t0 = performance.now();
  try { const body = await fn(); return { ms: Math.round(performance.now() - t0), ok: body && body.ok === true, err: body && body.오류 }; }
  catch (e) { return { ms: Math.round(performance.now() - t0), ok: false, err: e.message }; }
}

const ping = (url) => () => fetch(url + "?a=ping&t=" + Date.now(), { cache: "no-store" }).then((r) => r.json());
// text/plain으로 보내야 브라우저가 사전 확인(OPTIONS) 없이 바로 보낸다. 구글 스크립트는 사전 확인을 못 받는다.
const echo = (url) => () => fetch(url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ a: "echo", text: "가".repeat(500) }) }).then((r) => r.json());

function stats(list) {
  const ok = list.filter((x) => x.ok).map((x) => x.ms).sort((a, b) => a - b);
  if (!ok.length) return { text: "모두 실패", med: null };
  const med = ok[Math.floor((ok.length - 1) / 2)];
  return { text: `첫 ${list[0].ms} · 중간 ${med} · 최대 ${ok[ok.length - 1]} ms (성공 ${ok.length}/${list.length})`, med };
}

async function main() {
  const app = document.getElementById("app");
  let url;
  try { url = (await (await fetch("config.json", { cache: "no-store" })).json())["창구"]; } catch (e) { /* 아래에서 안내 */ }
  if (!url) { app.replaceChildren(el("p", "config.json에 창구 주소가 아직 없습니다.", "bad")); return; }

  app.replaceChildren(el("p", "재는 중… (약 20~40초)", "muted"));
  const pings = [], echos = [];
  for (let i = 0; i < N; i++) { pings.push(await timed(ping(url))); app.firstChild.textContent = `핑 ${i + 1}/${N}`; }
  for (let i = 0; i < N; i++) { echos.push(await timed(echo(url))); app.firstChild.textContent = `메아리 ${i + 1}/${N}`; }
  app.replaceChildren(el("p", "다 쟀습니다.", "ok"));

  const P = stats(pings), E = stats(echos);
  const standalone = navigator.standalone === true || matchMedia("(display-mode: standalone)").matches;
  const rows = [
    ["기기", navigator.userAgent.replace(/^Mozilla\/5\.0 \(([^)]*)\).*$/, "$1").slice(0, 60)],
    ["홈 화면 앱", standalone ? "예" : "아니요"],
    ["핑 (GET)", P.text],
    ["메아리 (POST, 옮긴 주소 따라가기)", E.text],
    ["실패 예", [...pings, ...echos].find((x) => !x.ok)?.err || "없음"],
  ];
  const box = document.getElementById("result");
  box.replaceChildren(el("b", "창구 시험 결과"));
  for (const [k, v] of rows) { const r = el("div", null, "row"); r.append(el("span", k), el("span", v)); box.appendChild(r); }
  const pass = E.med != null && E.med <= 3000;
  const verdict = el("p");
  verdict.append(el("span", "입력 응답 3초 안 (중간값): "), el("span", E.med == null ? "판정 못 함" : pass ? `통과 (${E.med} ms)` : `미달 (${E.med} ms)`, pass ? "ok" : "bad"));
  box.appendChild(verdict);

  const text = rows.map(([k, v]) => `${k}: ${v}`).join("\n") + "\n" + verdict.textContent;
  const copy = el("button", "결과 복사");
  copy.onclick = async () => {
    try { await navigator.clipboard.writeText(text); } catch (e) { const ta = el("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); }
    copy.textContent = "복사됨";
  };
  const again = el("button", "다시 재기");
  again.onclick = () => location.reload();
  box.append(copy, again);
}

main();
