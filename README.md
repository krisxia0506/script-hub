# Script Hub

A tiny personal script distribution service built with **Cloudflare Workers + Static Assets**.

```sh
curl -fsSL https://script-hub.xiajiayi0506.workers.dev/hello | sh
curl -fsSL https://script-hub.xiajiayi0506.workers.dev/hello@1.0.0 | sh
```

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

Production is available at <https://script-hub.xiajiayi0506.workers.dev>. The homepage constructs curl commands from the current origin.

## Add a custom domain

In Cloudflare Dashboard, open **Workers & Pages → script-hub → Settings → Domains & Routes → Add → Custom Domain**.

To manage it in source after choosing a real hostname, add this to `wrangler.jsonc`:

```jsonc
"routes": [
  { "pattern": "get.example.com", "custom_domain": true }
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
| `/missing` | unknown alias | 404 |

Static assets are asset-first: `/` and `/scripts/...` are served directly, while missing short paths such as `/hello` fall through to the Worker and are resolved through the `ASSETS` binding.

## Safety

`curl | sh` executes remote code. Keep pinned versions immutable, prefer pinned URLs for reproducible environments, review unfamiliar scripts before execution, and never put secrets in public scripts.
