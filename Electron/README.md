# Electron Client (eTicketing)

This folder contains the desktop wrapper for eTicketing.
The Electron app loads the web client and points it to your backend server.

## Responsibilities

- Start a desktop window for the chat system
- Read server URL from `.env`
- Package distributable Windows build

## Environment

Create `Electron/.env` from `Electron/.env.example`:

```bash
copy .env.example .env
```

Then set your value in `Electron/.env`:

```env
SERVER_URL=http://127.0.0.1:5000
```

For distributed builds, also verify:
- `Electron/dist/win-unpacked/.env`

## Install And Run

```bash
cd Electron
npm install
npm start
```

## Build Portable App

```bash
npm run build
```

Output:
- `Electron/dist/win-unpacked/`

## Packaging Notes

From `package.json`:
- Product name: `eTicketing`
- Target: Windows portable
- Extra files: `.env`, `error.html`

## Deployment Tips

- Update `SERVER_URL` whenever server IP/port changes.
- Rebuild and redistribute `win-unpacked` to employee machines after client changes.
- Keep backend running before launching desktop clients.
