# DayRally

DayRally is a macOS desktop app for daily tasks, rich notes, and manager check-ins. It is built with Tauri 2, React, TypeScript, and SQLite.

## Features
- Workspace-based SQLite storage
- Today-focused tasks with status, recurrence, timers, tags
- Rich notes with inline images and folders
- Check-ins with reminders
- macOS banner notifications while the app is running

## Requirements
- macOS
- Node.js (for frontend build)
- Rust toolchain (for Tauri)

## Install (from source)
```bash
npm install
npm run tauri:dev
```

## Build release
```bash
npm run build
npm run tauri:build
```

## Homebrew (cask)
If you publish a GitHub release with the DMG, users can install via:
```bash
brew tap manojkumar-kasiviswanathan/dayrally
brew install --cask dayrally
```

## Workspace
On first launch, DayRally asks for a workspace folder. It stores:
- `dayrally.sqlite`
- `attachments/`

## License
MIT. See `LICENSE`.
