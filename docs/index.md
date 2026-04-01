---
layout: default
title: Home
---

<div class="hero">
  <img src="{{ "/assets/images/logo.svg" | relative_url }}" alt="Hydrozoa Logo" class="hero-logo">
  <h1>Hydrozoa</h1>
  <p class="lead">A self-hosted Git Multipoint Mirror Agent for synchronizing repositories, issues, and metadata across multiple providers with a bioluminescent deep-sea aesthetic.</p>
  <div class="hero-actions">
    <a href="{{ "/installation" | relative_url }}" class="btn">Get Started</a>
    <a href="https://github.com/your-repo/hydrozoa" class="btn secondary">View on GitHub</a>
  </div>
</div>

<div class="glass-card">
  <h2>Overview</h2>
  <p>Hydrozoa is designed to be a lightweight, robust, and visually stunning agent that keeps your Git repositories in sync across different platforms like GitHub and GitLab. Whether you're looking for redundancy, migration, or multi-cloud availability, Hydrozoa provides the tentacles to reach all your nodes.</p>
</div>

<div class="features-grid">
  <div class="glass-card">
    <h3>Multipoint Sync</h3>
    <p>Synchronize a single source to multiple targets simultaneously.</p>
  </div>
  <div class="glass-card">
    <h3>Bioluminescent UI</h3>
    <p>A deep-sea inspired dashboard for real-time telemetry and monitoring.</p>
  </div>
  <div class="glass-card">
    <h3>Self-Hosted</h3>
    <p>Full control over your data and synchronization logic.</p>
  </div>
</div>

<style>
.hero {
  text-align: center;
  padding: 80px 0;
}

.hero-logo {
  width: 120px;
  height: 120px;
  margin-bottom: 24px;
  filter: drop-shadow(0 0 20px rgba(0, 243, 255, 0.5));
}

.lead {
  font-size: 1.25rem;
  max-width: 700px;
  margin: 0 auto 40px;
  color: #94a3b8;
}

.hero-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
}

.btn.secondary {
  background: rgba(255, 255, 255, 0.05);
  color: white !important;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: none;
  
  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
}
</style>
