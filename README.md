<h1 align="center">Claude Auto-Resume</h1>

<p align="center">Hit your Claude Code limit? Set a timer. When it ends, that chat sends <code>continue</code>, or the prompt you left in its box, for you.</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=ashraful.claude-auto-resume"><img src="https://badgen.net/vs-marketplace/v/ashraful.claude-auto-resume?label=Marketplace&color=D97757" alt="Marketplace version"></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=ashraful.claude-auto-resume"><img src="https://badgen.net/vs-marketplace/i/ashraful.claude-auto-resume?label=Installs&color=D97757" alt="Installs"></a>
</p>

<p align="center"><img src="images/demo.gif" alt="Setting a timer on a chat, then the chat sending continue by itself when the timer ends"></p>

## Install

1. Install it from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=ashraful.claude-auto-resume), or open **Extensions** (`Ctrl+Shift+X`), search **Claude Auto-Resume** and click **Install**.
   Prefer a file? Download the `.vsix` from [Releases](https://github.com/Srabon444/claude-auto-resume/releases/latest), then **Extensions** → `⋯` → **Install from VSIX…**.
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
3. Choose **Start timer** and type how long is left until your limit resets (see **Time format**).
4. Choose what to send when it ends (see **What to send**).
5. Leave VS Code open. The countdown shows in the status bar. When it ends, the chat sends it.

### Time format

| You type | It means |
|---|---|
| `5h 3m` | 5 hours 3 minutes |
| `5:03` | 5 hours 3 minutes (hours:minutes) |
| `90m` | 90 minutes |
| `1.5h` | 1 hour 30 minutes |
| `45` | 45 minutes (a plain number is minutes) |

The box shows when the timer will end before you press Enter.

### What to send

After the time, the menu asks what the chat should send when the timer ends:

| Choice | What happens |
|---|---|
| **Send "continue"** | Types `continue` and presses Enter |
| **Send what's in the chat box** | Presses Enter on your prompt and attachments, exactly as you left them |

For the second choice, write your prompt and attach your files in the chat box first, then start the timer. Keep that chat tab open and leave the box as it is. If the box is empty when the timer ends (a window reload can clear it), nothing is sent.

**Another chat?** Open it and repeat. Every chat has its own timer. **Change** or **Stop** a timer from the same menu.

## Settings

| Setting | Default | |
|---|---|---|
| `claudeAutoResume.message` | `continue` | Text typed for the **Send "continue"** choice |

## Good to know

- Works for chats in editor tabs, not the sidebar chat.
- Sends only while the VS Code window is focused. Otherwise it waits for you.
- With the chat box choice, text you are typing in that box when the timer ends is sent as it is.
- Two chats with the same title (for example two new "Claude Code" chats) can be mixed up after a reload, so the timer skips them.

## License

MIT. This is an independent extension and is not affiliated with or endorsed by Anthropic.
