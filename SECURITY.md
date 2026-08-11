# Security

## Reporting

If you find a vulnerability in this repository, contact the owner privately.
Do not open a public issue with exploit details.

## Secrets policy

- Never commit API keys, tokens, private keys, or `.env` files.
- Rotate any credential that was ever pasted into chat, logs, or a public gist.
- Production deploys should inject secrets via the host environment, not the repo.

## Runtime notes

- Core game loop is client-side Three.js; no privileged server combat authority.
- Auth / database packages may be present from the app template; treat them as optional.
- User settings (bindings, audio) use `localStorage` — no PII is required to play.
