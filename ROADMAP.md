# 🪼 Hydrozoa Roadmap

## **Milestone: Foundation & Core Implementation**
**Goal:** Achieve full end-to-end synchronization for all primary entities with production-grade stability.

### **Features**
- [x] **Real-Time Sync Engine**: Mirror code using `git --mirror`.
- [x] **Entity Sync (Phase 1)**: Basic Issue, Milestone, and Release mirroring for GitHub <-> GitLab.
- [x] **Entity Sync (Phase 2)**: 
    - [x] Deduplication logic (check if issue/milestone exists before creating).
    - [x] Support for Gitea, Forgejo, and Bitbucket entities.
- [x] **Granular Selection**: UI/Backend support for selecting specific entities per repository.
- [x] **Styled Console**: Professional ANSI output with ASCII header.
- [x] **Real Analytics**: Database-driven metrics for sync performance.
- [x] **Health Checks**: `/health` endpoint for monitoring.
- [x] **Pagination Support**: Handle large repository collections in UI and Backend.
- [x] **Improved Automation**:
    - [x] HMAC verification for incoming webhooks (GitHub, GitLab, Gitea, Forgejo, Bitbucket).
    - [x] Automatic sync on webhook trigger.
- [x] **UI Refinements**:
    - [x] Provisioning summary modal after source selection.
    - [x] Edit sync entities from the Sync Matrix tab.
    - [x] Real latency monitoring for providers.

### **Bug Fixes**
- [x] Fix `DATABASE_URL` parsing with special characters.
- [x] Fix `TypeError` on empty/error API responses.
- [x] Fix frontend session logout on provider 401/403.
- [x] Fix syntax error in background worker loop.

---

## **Future Considerations**
- [ ] Bidirectional sync conflict resolution UI.
- [ ] OIDC / OAuth2 integration for admin login.
- [ ] Worker node distribution (scaling).
