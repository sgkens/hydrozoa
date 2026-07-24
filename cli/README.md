# Hydrozoa CLI

Zero-dependency command-line client for the Hydrozoa REST API.

```bash
bunx @skgens/hydrozoa login \
  --url https://hydrozoa.example.com \
  --email admin@example.com \
  --password "$HYDROZOA_PASSWORD"

bunx @skgens/hydrozoa status
bunx @skgens/hydrozoa sync --matrix production
```

The CLI reads `HYDROZOA_URL` and `HYDROZOA_TOKEN` for non-interactive CI use.
After `login`, configuration is stored with user-only permissions at
`~/.config/hydrozoa/config.json`. Set `HYDROZOA_CONFIG` to use another path.

Use `--json` with operational commands for machine-readable output.
