<p align="center"><img src="images/icon.png" width="96" alt="Claude Auto-Resume"></p>

<h1 align="center">Claude Auto-Resume</h1>

<p align="center">Hit your Claude Code limit? Set a timer. When it ends, <code>continue</code> is sent in that chat for you.</p>

## Install

1. Open **Extensions** (`Ctrl+Shift+X`), search **Claude Auto-Resume**, click **Install**.
   Or download the latest `.vsix` from [Releases](https://github.com/Srabon444/claude-auto-resume/releases/latest), then **Extensions** → `⋯` → **Install from VSIX…**.
2. The **Claude Code** extension must be installed too.
3. Set up key sending once (needed to press Enter in the chat):

| System | What to do |
|---|---|
| Windows | Nothing |
| macOS | Allow VS Code in **System Settings → Privacy & Security → Accessibility** |
| Linux (X11) | `sudo apt install xdotool` |
| Linux (Wayland, Ubuntu default) | See below |

<details>
<summary><b>Linux Wayland setup</b></summary>

```bash
sudo apt install ydotool
```

```bash
echo 'KERNEL=="uinput", SUBSYSTEM=="misc", TAG+="uaccess", OPTIONS+="static_node=uinput"' \
  | sudo tee /etc/udev/rules.d/80-uinput.rules
```

```bash
sudo udevadm control --reload-rules && sudo udevadm trigger --name-match=uinput
```

</details>

## Use

1. Open a Claude Code chat in an **editor tab**.
2. Click the **clock icon** at the top right of the chat tab (or **Auto-resume** in the status bar).
3. Choose **Start timer** and type how long is left until your limit resets (see below).
4. Leave VS Code open. The countdown shows in the status bar. When it ends, the chat gets `continue` + Enter.

### Time format

| You type | It means |
|---|---|
| `5h 3m` | 5 hours 3 minutes |
| `5:03` | 5 hours 3 minutes (hours:minutes) |
| `90m` | 90 minutes |
| `1.5h` | 1 hour 30 minutes |
| `45` | 45 minutes (a plain number is minutes) |

The box shows when the timer will end before you press Enter.

**Another chat?** Open it and repeat. Every chat has its own timer. **Change** or **Stop** a timer from the same menu.

## Settings

| Setting | Default | |
|---|---|---|
| `claudeAutoResume.message` | `continue` | Text sent when the timer ends |

## Good to know

- Works for chats in editor tabs, not the sidebar chat.
- Sends only while the VS Code window is focused. Otherwise it waits for you.
- Two chats with the same title (for example two new "Claude Code" chats) can be mixed up after a reload, so the timer skips them.

## License

MIT. This is an independent extension and is not affiliated with or endorsed by Anthropic.
