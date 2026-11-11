# auth-lab

A live, interactive demo of authentication and authorization methods, running on Cloudflare Workers.

Work in progress. See [CLAUDE.md](CLAUDE.md) for the stack and roadmap.

## Development

```sh
pnpm install
pnpm cf-typegen   # generate worker-configuration.d.ts from wrangler.jsonc
pnpm dev
```

On Windows, the local Workers runtime (`workerd`) requires the
[Microsoft Visual C++ Redistributable (x64)](https://learn.microsoft.com/cpp/windows/latest-supported-vc-redist).
