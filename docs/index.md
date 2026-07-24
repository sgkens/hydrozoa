---
layout: default
title: Home
description: Operate multi-provider Git repository mirrors through a dashboard or REST API.
---

<section class="hero">
  <div class="hero-copy reveal">
    <span class="eyebrow"><span class="status-dot"></span> Self-hosted mirror control plane</span>
    <h1>Keep every repository <span>in your current.</span></h1>
    <p class="lead">Hydrozoa coordinates code, issue, milestone, release, and metadata synchronization across GitHub, GitLab, Gitea, Forgejo, Gogs, and Bitbucket.</p>
    <div class="hero-actions">
      <a href="{{ "/installation" | relative_url }}" class="btn">Deploy Hydrozoa</a>
      <a href="{{ "/cli" | relative_url }}" class="btn secondary">Use the CLI</a>
    </div>
    <dl class="hero-stats" aria-label="Project capabilities">
      <div><dt>6</dt><dd>Git providers</dd></div>
      <div><dt>20+</dt><dd>REST operations</dd></div>
      <div><dt>24h</dt><dd>Default token TTL</dd></div>
    </dl>
  </div>

  <div class="hero-visual reveal" data-delay="1">
    <div class="terminal-window" aria-label="Hydrozoa terminal demonstration">
      <div class="terminal-bar"><span></span><span></span><span></span><b>hydrozoa — sync</b></div>
      <div class="terminal-body">
        <p><i>$</i> hydrozoa sync --matrix production</p>
        <p class="terminal-muted">discovering source namespaces...</p>
        <p><em>◆</em> github/acme/platform <strong>ready</strong></p>
        <p><em>◆</em> gitlab/backup/platform <strong>connected</strong></p>
        <div class="terminal-progress"><span></span></div>
        <p><em>✓</em> mirror complete <strong>2.41s</strong></p>
        <p class="terminal-cursor"><i>$</i> <span></span></p>
      </div>
    </div>
    <span class="orbit-badge badge-api">REST API</span>
    <span class="orbit-badge badge-dlq">DLQ ready</span>
  </div>
</section>

<section class="provider-strip reveal" aria-label="Supported providers">
  <span>Built for your Git topology</span>
  <div>
    <span class="provider"><img src="https://cdn.simpleicons.org/github/e2e8f0" alt="">GitHub</span>
    <span class="provider"><img src="https://cdn.simpleicons.org/gitlab/FC6D26" alt="">GitLab</span>
    <span class="provider"><img src="https://cdn.simpleicons.org/gitea/609926" alt="">Gitea</span>
    <span class="provider"><img src="https://cdn.simpleicons.org/forgejo/FB923C" alt="">Forgejo</span>
    <span class="provider"><img src="https://cdn.simpleicons.org/bitbucket/2684FF" alt="">Bitbucket</span>
  </div>
</section>

<section class="section-heading reveal">
  <span class="eyebrow">One control plane</span>
  <h2>From source discovery to verified mirrors</h2>
  <p>Configure the graph once. Hydrozoa handles provisioning, scheduled synchronization, visibility, telemetry, and recovery.</p>
</section>

<section class="feature-grid stagger">
  <article class="feature-card">
    <span class="icon-box">{% include icon.html name="git-branch" %}</span>
    <h3>Multipoint matrix</h3>
    <p>Broadcast one source repository to multiple provider targets while retaining per-target status.</p>
    <a href="{{ "/features#mirror-matrix" | relative_url }}">See the workflow →</a>
  </article>
  <article class="feature-card">
    <span class="icon-box">{% include icon.html name="activity" %}</span>
    <h3>Operational telemetry</h3>
    <p>Inspect latency, throughput, translated logs, system resources, and synchronization outcomes.</p>
    <a href="{{ "/features#telemetry" | relative_url }}">Review telemetry →</a>
  </article>
  <article class="feature-card">
    <span class="icon-box">{% include icon.html name="shield" %}</span>
    <h3>Controlled access</h3>
    <p>Authenticate headless clients with JWTs and keep provider credentials encrypted at rest.</p>
    <a href="{{ "/api-reference#authentication" | relative_url }}">Authenticate →</a>
  </article>
</section>

<section class="split-feature reveal">
  <div class="screenshot-frame">
    <img src="{{ "/assets/images/screenshot-dashboard-placeholder.svg" | relative_url }}" alt="Placeholder for the Hydrozoa dashboard screenshot">
    <span>Screenshot placeholder · dashboard</span>
  </div>
  <div class="split-copy">
    <span class="eyebrow">Visual operations</span>
    <h2>See the whole synchronization graph.</h2>
    <p>The dashboard turns provider connections, mirror state, latency, failures, and system health into one operational view.</p>
    <ul class="check-list">
      <li>Per-target progress and last-sync state</li>
      <li>Dead-letter replay from the same workspace</li>
      <li>Human and technical log representations</li>
    </ul>
  </div>
</section>

<section class="split-feature reverse reveal">
  <div class="screenshot-frame">
    <img src="{{ "/assets/images/screenshot-api-placeholder.svg" | relative_url }}" alt="Placeholder for a headless API client screenshot">
    <span>Screenshot placeholder · API client</span>
  </div>
  <div class="split-copy">
    <span class="eyebrow">Headless by design</span>
    <h2>Automate every control-plane action.</h2>
    <p>Provision providers, select repositories, trigger synchronization, inspect telemetry, and replay failures without loading the dashboard.</p>
    <div class="code-mini"><code>curl -H "Authorization: Bearer $HYDROZOA_TOKEN" \<br> /api/v1/system/sync-matrix</code></div>
    <a class="text-link" href="{{ "/api-reference" | relative_url }}">Open the full API reference →</a>
  </div>
</section>

<section class="cta-panel reveal">
  <div><span class="eyebrow">Choose your interface</span><h2>Dashboard when you want it. API when you do not.</h2></div>
  <a class="btn" href="{{ "/installation" | relative_url }}">Start deployment</a>
</section>
