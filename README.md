# Break Neko

Break Neko is a macOS desktop break reminder that brings a cat to guard
your screen when it is time to stand up, drink water, focus, or finish a task.

The repository is organized around the Electron macOS desktop app. The earlier
browser extension source has been removed from the active codebase; Git history
keeps that work available for reference.

## Features

- Stand-up, hydration, Pomodoro, and lightweight task reminders.
- Three reminder styles: system notification, transparent cat overlay, and
  fullscreen cat break.
- Custom cat image or video support.
- Codex pet import with an animated desktop pet library.
- Optional local MCP/HTTP pet control for Cursor, hooks, and LAN devices.
- Menu bar controls for starting, pausing, summoning the cat, and quiet time.
- Local settings storage. Custom cat media stays on your device.

## Development

Install dependencies:

```bash
npm install
```

Run the desktop app:

```bash
npm run dev
```

Run syntax checks:

```bash
npm run check
```

Run unit tests:

```bash
npm test
```

Package the macOS app:

```bash
npm run build:mac
```

## Project Structure

- `src/main/` contains the Electron main process, settings normalization, IPC,
  tray/menu logic, reminder orchestration, and timer service.
- `src/renderer/` contains the settings window.
- `src/break/` contains the reminder overlay/fullscreen break window.
- `src/pet/` contains the optional draggable desktop pet.
- `src/shared.js` contains shared settings helpers used by the desktop app and
  legacy settings migration.
- `assets/` contains app icons and cat media.

For a deeper map of the runtime modules, window responsibilities, data flow, and
maintenance notes, see [docs/architecture.md](docs/architecture.md).

For pet MCP setup, Cursor config, LAN/mDNS mode, and hook examples, see
[docs/pet-mcp.md](docs/pet-mcp.md).

## Contact

Questions, bug reports, and feature requests are welcome via GitHub Issues.

## Contributions

Thank you for the interest and support!

At the moment, Break Neko is developed and maintained by a single developer,
and I don’t currently have enough time to properly review and test external
implementation PRs.

Because of this, I’m currently not accepting feature implementation pull requests.

Bug reports, feedback, and feature suggestions through GitHub issues are still very welcome and appreciated.

## License

The source code is licensed under the MIT License. See [LICENSE](LICENSE).

Cat videos, icons, logos, images, and other visual or brand assets are not
covered by the MIT License. All rights are reserved. See
[ASSETS_LICENSE.md](ASSETS_LICENSE.md).
