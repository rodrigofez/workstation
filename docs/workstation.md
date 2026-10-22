# Workstation (fork Mac app)

This fork builds as its own Mac app, **Workstation** (`com.rodrigofez.workstation`), so it can sit next to the official T3 Code app.

## Install or rebuild

After an upstream sync, run:

```bash
scripts/workstation/install-mac.sh
```

It builds an unsigned app for this Mac's architecture, ad-hoc signs it so macOS will launch it, and replaces `/Applications/Workstation.app`. Quit Workstation first; the script refuses to run while it is open.

## How it differs from the official app

- **Shared T3 home.** Workstation uses `~/.t3` (or `T3CODE_HOME`), so local projects and threads are the same as in the official app. Only one app can own the T3 home at a time: the second one to start is refused by the server's state-directory lock instead of running side by side.
- **Separate Electron profile.** Chromium data lives in `~/Library/Application Support/workstation`, not `t3code-v2`, so the two apps never share a single-instance lock or browser profile. The saved remote-environment list lives in the T3 home, but its tokens are encrypted with each app's own Keychain item. Workstation can't read tokens the official app saved, and re-pairing an environment in one app replaces the token the other app saved for it.
- **No updates.** The build writes no update feed, so Workstation never checks or downloads official releases, and the official updater never touches it.

## Spaces

A space is a named set of projects with an emoji and a color, like Zen Browser's spaces. Its color tints the sidebar; each space's editor sets the hue and how strong the tint is (0 turns it off). One is active at a time, and it scopes the sidebar, the command palette (a footer toggle searches all spaces), thread next/previous/jump, and new threads. Switch from the icons in the sidebar footer, with a two-finger swipe over the sidebar (one space per swipe), or with `⌘⌥←`/`⌘⌥→` and `⌃1`–`⌃9`.

- **Sorting.** New projects, including ones created from iOS, the CLI or an agent, land in **Unassigned**. Its sidebar lists them with one-click space icons on each row. Settings → Spaces lists every project with a space picker, and manages spaces themselves (rename, emoji, color, reorder, delete). Deleting a space only moves its projects back to Unassigned.
- **Moving.** Right-click a thread → **Move project to space** moves the thread's whole project, including its copies on other environments. A thread without a project moves on its own.
- **Shortcuts** are rebound in Settings → Spaces, not Settings → Keybindings: the keybinding list is validated by the server, which the fork leaves stock.
- **Local only.** Spaces live in this app's (or this browser's) local storage. The server, the official apps and other devices never see them.
