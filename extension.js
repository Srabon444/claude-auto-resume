const vscode = require('vscode');
const { execFile } = require('child_process');
const { parseDuration, formatRemaining, normLabel, escapeSendKeys } = require('./core');

const PANEL = 'claudeVSCodePanel';
const STORE = 'timers';
const RETRY_MS = 15000;
const MAX_FAILS = 10;
const GRACE_MS = 60000; // wait for tabs to restore after a reload before calling a chat "closed"
const EDITOR_CLASS = /^(code|code - insiders|code-oss|vscodium|cursor|windsurf)$/i;
const WAYLAND = process.platform === 'linux' && process.env.XDG_SESSION_TYPE === 'wayland';
const INSTALL_MSG = WAYLAND ? 'ydotool is not installed. Run: sudo apt install ydotool (see README for the uinput permission)' : 'xdotool is not installed. Run: sudo apt install xdotool';
const GROUP_CMDS = [
  'workbench.action.focusFirstEditorGroup',
  'workbench.action.focusSecondEditorGroup',
  'workbench.action.focusThirdEditorGroup',
  'workbench.action.focusFourthEditorGroup',
  'workbench.action.focusFifthEditorGroup',
  'workbench.action.focusSixthEditorGroup',
  'workbench.action.focusSeventhEditorGroup',
  'workbench.action.focusEighthEditorGroup',
];

const startedAt = Date.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const exec = (cmd) => vscode.commands.executeCommand(cmd);
const warn = (msg) => vscode.window.showWarningMessage(`Claude Auto-Resume: ${msg}`);
const info = (msg) => vscode.window.showInformationMessage(`Claude Auto-Resume: ${msg}`);

let ctx;
let status;
let timers = []; // { id, label, col, idx, due, tab?, fails?, retryAt? } (tab/fails/retryAt are memory only)
let busy = false;
const notified = new Set();

//* every open Claude chat that lives in an editor tab (the sidebar chat has no tab)
function claudeTabs() {
  return vscode.window.tabGroups.all.flatMap((group) =>
    group.tabs
      .map((tab, idx) => ({ tab, group, col: group.viewColumn, idx, label: tab.label }))
      .filter((x) => x.tab.input instanceof vscode.TabInputWebview && x.tab.input.viewType.endsWith(PANEL)),
  );
}

//! never guess: a live Tab reference, else a unique title. Ambiguous (e.g. two "Claude Code") = null
function resolve(entry, tabs) {
  let t = entry.tab && tabs.find((x) => x.tab === entry.tab);
  if (!t) {
    const same = tabs.filter((x) => normLabel(x.label) === normLabel(entry.label));
    t = same.length === 1 ? same[0] : undefined;
  }
  if (!t) return undefined;
  if (entry.tab !== t.tab || entry.col !== t.col || entry.idx !== t.idx || entry.label !== t.label) {
    Object.assign(entry, { tab: t.tab, col: t.col, idx: t.idx, label: t.label });
    save();
  }
  return t;
}

function save() {
  ctx.workspaceState.update(STORE, timers.map(({ id, label, col, idx, due }) => ({ id, label, col, idx, due })));
}

function drop(entry) {
  timers = timers.filter((t) => t !== entry);
  for (const k of [...notified]) if (k.startsWith(`${entry.id}:`)) notified.delete(k);
  save();
}

function once(entry, kind, fn) {
  const key = `${entry.id}:${kind}`;
  if (notified.has(key)) return;
  notified.add(key);
  fn();
}

function run(cmd, args, env) {
  return new Promise((ok, fail) =>
    execFile(cmd, args, { timeout: 10000, env: env && { ...process.env, ...env } }, (err, stdout) => (err ? fail(err) : ok(String(stdout)))),
  );
}

//! X11 only: the focused X window must be VS Code so keys never land in another app (fails closed)
//? Wayland has no way to ask for the focused window, so there window.state.focused is the only guard
async function assertEditorFocused() {
  if (process.platform !== 'linux' || WAYLAND) return;
  let out;
  try {
    out = await run('xdotool', ['getactivewindow', 'getwindowclassname']);
  } catch (e) {
    throw new Error(e.code === 'ENOENT' ? INSTALL_MSG : 'FOCUS_UNCONFIRMED');
  }
  if (!EDITOR_CLASS.test(out.trim())) throw new Error('FOCUS_UNCONFIRMED');
}

//* types the text, calls beforeEnter (focus re-check), then presses Enter
async function send(text, beforeEnter) {
  if (WAYLAND) {
    //* ydotool writes to /dev/uinput, so keys reach whatever window has focus
    const yd = (args) => run('ydotool', args).catch((e) => { throw new Error(e.code === 'ENOENT' ? INSTALL_MSG : `ydotool failed: ${e.message}`); });
    await yd(['type', text]);
    await beforeEnter();
    //? ydotool 0.1.x `key` takes names not codes (28:1 types "2"), so Enter is sent as a newline
    await yd(['type', '\n']);
  } else if (process.platform === 'linux') {
    await run('xdotool', ['type', '--clearmodifiers', '--delay', '25', '--', text]);
    await beforeEnter();
    await run('xdotool', ['key', '--clearmodifiers', 'Return']);
  } else if (process.platform === 'darwin') {
    const script = ['-e', 'on run argv', '-e', 'tell application "System Events" to keystroke (item 1 of argv)', '-e', 'end run', '--', text];
    await run('osascript', script);
    await beforeEnter();
    await run('osascript', ['-e', 'tell application "System Events" to key code 36']);
  } else {
    //! text goes through an env var, never into the script string
    const call = (keys) => run('powershell', ['-NoProfile', '-Command', 'Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait($env:ARS_KEYS)'], { ARS_KEYS: keys });
    await call(escapeSendKeys(text));
    await beforeEnter();
    await call('{ENTER}');
  }
}

//* bring the chat's tab to front inside its group: focus the group, then step through its tabs
async function activate(entry) {
  let t = resolve(entry, claudeTabs());
  const focusGroup = t && GROUP_CMDS[t.col - 1];
  if (!focusGroup) return undefined;
  await exec(focusGroup);
  for (let i = 0; i <= t.group.tabs.length; i++) {
    t = resolve(entry, claudeTabs());
    if (!t) return undefined;
    if (t.group.activeTab === t.tab) return t;
    await exec('workbench.action.nextEditorInGroup');
    await sleep(120);
  }
  return undefined;
}

//* true only while the timer still exists, the window is focused and the chat's tab is the active tab
function ready(entry) {
  if (!vscode.window.state.focused || !timers.includes(entry)) return false;
  const t = resolve(entry, claudeTabs());
  const g = vscode.window.tabGroups.activeTabGroup;
  return !!t && g.viewColumn === t.col && g.activeTab === t.tab;
}

//* 'done' = sent or dropped, 'wait' = not yet possible (no penalty), 'fail' = counted retry
async function fire(entry) {
  if (!vscode.window.state.focused) {
    once(entry, 'focus', () => info(`"${entry.label}" timer ended. Will send when VS Code is focused.`));
    return 'wait';
  }
  if (!resolve(entry, claudeTabs())) {
    if (Date.now() < Math.max(entry.due, startedAt) + GRACE_MS) return 'wait';
    warn(`chat "${entry.label}" is closed or its title is ambiguous, timer removed.`);
    return 'done';
  }
  await assertEditorFocused();
  const t = await activate(entry);
  if (!t) return 'fail';
  await exec('claude-vscode.focus');
  await sleep(500);
  if (!ready(entry)) return 'fail';
  const message = (vscode.workspace.getConfiguration('claudeAutoResume').get('message') || '').replace(/[\r\n]+/g, ' ').trim() || 'continue';
  await send(message, async () => {
    if (!ready(entry)) throw new Error('ABORTED');
    await assertEditorFocused();
  });
  info(`sent to "${entry.label}".`);
  return 'done';
}

async function tick() {
  render();
  if (busy) return;
  busy = true;
  try {
    for (const entry of timers.filter((e) => e.due <= Date.now() && (e.retryAt || 0) <= Date.now())) {
      let result;
      try {
        result = await fire(entry);
      } catch (e) {
        result = 'fail';
        if (e.message === 'FOCUS_UNCONFIRMED') {
          once(entry, 'x11', () => warn('cannot confirm VS Code is the focused window via xdotool. On Wayland, VS Code must run under XWayland (code --ozone-platform=x11). Retrying.'));
        } else if (e.message !== 'ABORTED') {
          warn(e.message);
        }
      }
      if (result === 'done') {
        drop(entry);
      } else if (result === 'fail') {
        entry.fails = (entry.fails || 0) + 1;
        entry.retryAt = Date.now() + RETRY_MS;
        if (entry.fails >= MAX_FAILS) {
          warn(`gave up on "${entry.label}" after ${MAX_FAILS} tries.`);
          drop(entry);
        }
      }
    }
  } finally {
    busy = false;
  }
}

function render() {
  const now = Date.now();
  const tabs = claudeTabs();
  const cur = vscode.window.tabGroups.activeTabGroup;
  const mine = timers.find((e) => {
    const r = resolve(e, tabs);
    return r && cur.viewColumn === r.col && cur.activeTab === r.tab;
  });
  if (mine) status.text = mine.due <= now ? '$(watch) waiting' : `$(clock) ${formatRemaining(mine.due - now)}`;
  else status.text = timers.length ? `$(clock) ${timers.length} timer${timers.length > 1 ? 's' : ''}` : '$(clock) Auto-resume';
  status.tooltip = timers.length
    ? timers.map((e) => `${e.label}: ${e.due <= now ? 'due' : formatRemaining(e.due - now)}`).join('\n')
    : 'Claude Auto-Resume: click to schedule';
}

async function menu() {
  const tabs = claudeTabs();
  if (!tabs.length) return void info('no Claude chat tab is open.');
  const cur = vscode.window.tabGroups.activeTabGroup;
  tabs.sort((a, b) => Number(cur.activeTab === b.tab) - Number(cur.activeTab === a.tab));
  const items = [];
  for (const t of tabs) {
    const entry = timers.find((e) => resolve(e, tabs) === t);
    const here = cur.activeTab === t.tab ? ' (this chat)' : '';
    items.push({
      label: `$(play) ${entry ? 'Change' : 'Start'} timer`,
      description: `${t.label}${here}${entry ? ` · ${formatRemaining(entry.due - Date.now())} left` : ''}`,
      t,
      entry,
    });
    if (entry) items.push({ label: '$(debug-stop) Stop timer', description: t.label, t, entry, stop: true });
  }
  const pick = await vscode.window.showQuickPick(items, { placeHolder: 'Claude Auto-Resume' });
  if (!pick) return;
  if (pick.stop) return void drop(pick.entry);
  const text = await vscode.window.showInputBox({
    prompt: `Time until your limit resets, for "${pick.t.label}"`,
    placeHolder: '5h 3m   |   90m   |   5:03',
    validateInput: (v) => (parseDuration(v) ? undefined : 'Use e.g. 5h 3m, 90m or 5:03'),
  });
  const ms = text && parseDuration(text);
  if (!ms) return;
  if (pick.entry) drop(pick.entry);
  timers.push({ id: String(Date.now()), label: pick.t.label, col: pick.t.col, idx: pick.t.idx, tab: pick.t.tab, due: Date.now() + ms });
  save();
  render();
}

function activate_(context) {
  ctx = context;
  timers = (context.workspaceState.get(STORE) || []).filter((e) => e && typeof e.due === 'number');
  status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  status.command = 'claudeAutoResume.menu';
  status.show();
  const interval = setInterval(() => tick().catch(() => {}), 1000);
  context.subscriptions.push(
    status,
    { dispose: () => clearInterval(interval) },
    vscode.commands.registerCommand('claudeAutoResume.menu', menu),
  );
  render();
}

module.exports = { activate: activate_, deactivate() {} };
