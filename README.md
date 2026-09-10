# Script Hub

A tiny personal script distribution service built with **Cloudflare Workers + Static Assets**.

```sh
curl -fsSL https://get.xiajiayi.com/hello | sh
curl -fsSL https://get.xiajiayi.com/hello@1.0.0 | sh
```

Configure Fenno for the default Codex environment:

```sh
curl -fsSL https://get.xiajiayi.com/setup-fenno-codex \
  | sh
```

The script prompts for the Fenno API Key in Chinese when no token is configured, hides the input, writes the Fenno provider and nine-model catalog, and can be run repeatedly. It preserves an existing Fenno token and backs up an existing configuration before changing it. If `CODEX_HOME` is omitted, the script uses Codex's default `~/.codex` directory and tells you to run `codex`. If it is explicitly supplied, the launch hint includes the same `CODEX_HOME` value. At the end, it asks whether to close all Codex processes and does so only when the user enters `y` or `Y`.

Calculate end-to-end output TPS for every model in local Codex sessions:

```sh
curl -fsSL https://get.xiajiayi.com/codex-model-tps \
  | sh -s -- --codex-home "$CODEX_HOME" --hours 24
```

The TPS calculator uses POSIX `sh`, `awk`, and standard Unix tools without Python or `jq`. It scans both `sessions` and `archived_sessions`; run it with `--help` to see time ranges, exact model filters, turn-level grouping, and sample details.

### Windows compatibility

This installer is a POSIX `sh` script. It supports macOS and Linux. On Windows, run it inside WSL and start Codex inside the same WSL environment; its `$HOME/.codex` is separate from the native Windows Codex configuration.

Native PowerShell cannot run the documented `curl | env ... sh` pipeline because it does not provide the required POSIX commands. Git Bash has most of the script's dependencies, but its path conversion when launching native Windows Codex has not been validated, so it is not currently listed as a supported installation method. A separate PowerShell installer would be required for first-class native Windows support.

## Features

- Short latest aliases such as `/hello`
- Immutable version aliases such as `/hello@1.0.0`
- Static source files under `/scripts/...`
- 60-second cache for latest aliases and one-year immutable cache for pinned versions
- GET/HEAD-only policy, Node tests, Wrangler dry-run, and GitHub Actions

## Run and deploy

Requires Node.js 20 or newer.

```sh
npm install
npm run check
npx wrangler login
npm run deploy
```

Production is available at <https://get.xiajiayi.com>. The homepage constructs curl commands from the current origin.

## Add a custom domain

In Cloudflare Dashboard, open **Workers & Pages → script-hub → Settings → Domains & Routes → Add → Custom Domain**.

To manage it in source after choosing a real hostname, add this to `wrangler.jsonc`:

```jsonc
"routes": [
  { "pattern": "get.xiajiayi.com", "custom_domain": true }
]
```

## Add a script

For a script named `docker-clean` at version `1.0.0`:

1. Add the immutable file at `public/scripts/docker-clean/1.0.0.sh`.
2. Copy the reviewed content to the mutable latest path `public/scripts/docker-clean.sh`.
3. Register both paths in `src/catalog.js`.
4. Add latest and pinned cases to `test/router.test.js`.
5. Run `npm run check`, then `npm run deploy`.

## URL rules

| URL | Meaning | Cache policy |
|---|---|---|
| `/hello` | latest version | 60 seconds |
| `/hello@1.0.0` | pinned version | 1 year, immutable |
| `/scripts/hello.sh` | direct static asset | Cloudflare static-asset behavior |
| `/setup-fenno-codex` | latest Fenno Codex setup | 60 seconds |
| `/setup-fenno-codex@1.0.2` | pinned Fenno Codex setup | 1 year, immutable |
| `/codex-model-tps` | latest Codex model TPS calculator | 60 seconds |
| `/codex-model-tps@1.0.0` | pinned Codex model TPS calculator | 1 year, immutable |
| `/missing` | unknown alias | 404 |

Static assets are asset-first: `/` and `/scripts/...` are served directly, while missing short paths such as `/hello` fall through to the Worker and are resolved through the `ASSETS` binding.

## Safety

`curl | sh` executes remote code. Keep pinned versions immutable, prefer pinned URLs for reproducible environments, review unfamiliar scripts before execution, and never put secrets in public scripts.
