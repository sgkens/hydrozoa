---
layout: default
title: Technologies
description: Technologies, libraries, and standards used by Hydrozoa.
---

# Technologies and acknowledgements

Hydrozoa combines a Bun/Express service, React control interface, PostgreSQL state, Git process execution, and a Jekyll documentation site.

<div class="tech-grid">
  <article class="tech-card"><img src="https://cdn.simpleicons.org/bun/FBF0DF" alt=""><h3>Bun</h3><p>TypeScript runtime and package execution for the Hydrozoa service.</p></article>
  <article class="tech-card"><img src="https://cdn.simpleicons.org/react/61DAFB" alt=""><h3>React</h3><p>Component model for the authenticated operations dashboard.</p></article>
  <article class="tech-card"><img src="https://cdn.simpleicons.org/vite/646CFF" alt=""><h3>Vite</h3><p>Development middleware and production frontend compilation.</p></article>
  <article class="tech-card"><img src="https://cdn.simpleicons.org/express/EEEEEE" alt=""><h3>Express</h3><p>HTTP routing and middleware for the REST control plane.</p></article>
  <article class="tech-card"><img src="https://cdn.simpleicons.org/postgresql/4169E1" alt=""><h3>PostgreSQL</h3><p>Persistent provider, matrix, log, settings, and DLQ storage.</p></article>
  <article class="tech-card"><img src="https://cdn.simpleicons.org/tailwindcss/06B6D4" alt=""><h3>Tailwind CSS</h3><p>Utility styling and design tokens in the application interface.</p></article>
  <article class="tech-card"><img src="https://cdn.simpleicons.org/jekyll/CC0000" alt=""><h3>Jekyll</h3><p>Static documentation generation with Kramdown and Rouge.</p></article>
  <article class="tech-card"><img src="https://cdn.simpleicons.org/docker/2496ED" alt=""><h3>Docker</h3><p>Reproducible Bun runtime packaging for deployment.</p></article>
  <article class="tech-card"><img src="https://cdn.simpleicons.org/git/F05032" alt=""><h3>Git</h3><p>Bare mirror fetch and push operations between providers.</p></article>
</div>

## Interface libraries

- [Lucide](https://lucide.dev/) supplies interface icon geometry under the ISC License.
- [Simple Icons](https://simpleicons.org/) supplies technology and provider marks under CC0-1.0, with individual brand restrictions still applicable.
- [Motion](https://motion.dev/) provides application interface motion primitives.
- [ApexCharts](https://apexcharts.com/) and React ApexCharts render operational telemetry.

## Security and utility libraries

| Technology | Role |
|---|---|
| `bcryptjs` | Administrative password hashing and comparison. |
| `jsonwebtoken` | Administrative token issuance. |
| Node/Bun `crypto` | AES-256-GCM storage encryption, HMAC verification, and token verification. |
| `pg` | PostgreSQL client and connection pooling. |
| `date-fns` | Date formatting in the application interface. |

## Provider APIs

Hydrozoa integrates with GitHub REST v3, GitLab REST v4, Gitea/Forgejo/Gogs REST v1, and Bitbucket Cloud REST 2.0. Provider names and marks remain the property of their respective owners.

## Reference

| Asset category | Source | License/reference |
|---|---|---|
| UI icons | Lucide | ISC |
| Technology icons | Simple Icons | CC0-1.0 |
| Documentation theme base | Minima | MIT |
| Syntax highlighting | Rouge | MIT |
| Project source | Hydrozoa contributors | MIT |
