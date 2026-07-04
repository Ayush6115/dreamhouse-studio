# Support

## Documentation

Start with the [README](README.md) for installation and everyday usage, and the [docs/](docs/) directory for how each system works internally:

- [Architecture overview](docs/architecture.md)
- [Developer guide](docs/developer-guide.md)

## Questions and discussion

- **Usage questions** — open a GitHub Discussion (or an issue with the question template if Discussions are not enabled).
- **Bug reports** — open an issue with the bug template. Attaching an exported `.dreamhouse.json` that reproduces the problem shortens turnaround dramatically.
- **Feature requests** — open an issue with the feature template. Describe the design problem you are trying to solve, not only the proposed control.

## Common issues

**3D view shows plain colored models instead of realistic furniture.**
The CC0 asset pack has not been downloaded. Run `npm run fetch-assets`.

**GLB export reports a timeout.**
Very texture-heavy scenes can exceed the export safety timeout on slow machines. Switch the 3D quality toggle to *Fast* and retry, or reduce the number of distinct textured items.

**Exports look low-resolution.**
Open the Export menu and raise the quality setting (up to Ultra, 5×). SVG exports are vector and are always resolution-independent.

**My projects disappeared.**
Projects live in the browser's localStorage for the exact origin (host + port) you used. Serving the app from a different port creates a separate storage bucket. Use Save (`Ctrl+S`) to keep portable `.dreamhouse.json` backups.
