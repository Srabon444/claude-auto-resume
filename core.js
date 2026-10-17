//* Pure helpers, no vscode import so test.js can run them with plain node.

//* "5h 3m", "5h3m", "1.5h", "90m", "5:03" (h:mm), bare "45" = minutes. Returns ms or null.
function parseDuration(input) {
  const s = String(input).trim().toLowerCase();
  if (!s) return null;
  let ms = null;
  let m = /^(\d+):(\d{1,2})$/.exec(s);
  if (m) {
    if (Number(m[2]) > 59) return null;
    ms = (Number(m[1]) * 60 + Number(m[2])) * 60000;
  } else if (/^\d+(\.\d+)?$/.test(s)) {
    ms = Number(s) * 60000;
  } else {
    const unit = { h: 3600000, m: 60000, s: 1000 };
    const re = /(\d+(?:\.\d+)?)\s*([hms])/g;
    let rest = s;
    let total = 0;
    while ((m = re.exec(s))) {
      total += Number(m[1]) * unit[m[2]];
      rest = rest.replace(m[0], '');
    }
    if (rest.trim() !== '' || total === 0) return null;
    ms = total;
  }
  return ms > 0 ? Math.round(ms) : null;
}

function formatRemaining(ms) {
  const t = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(t / 3600);
  const mm = String(Math.floor((t % 3600) / 60)).padStart(2, '0');
  const ss = String(t % 60).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

//* Claude tab titles can gain a leading marker (unread dot etc.); ignore it when matching.
function normLabel(label) {
  return String(label).replace(/^[^\p{L}\p{N}]+/u, '').trim();
}

//! SendKeys treats + ^ % ~ ( ) { } [ ] as special; wrap each in braces.
function escapeSendKeys(text) {
  return text.replace(/[+^%~(){}[\]]/g, (c) => `{${c}}`);
}

module.exports = { parseDuration, formatRemaining, normLabel, escapeSendKeys };
