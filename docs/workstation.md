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
