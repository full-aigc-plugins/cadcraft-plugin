# CADCraft–Dreamina comparison and improvement backlog

[简体中文](CADCraft-Dreamina-Analysis.zh-CN.md) · Analysis of local source snapshots on 2026-10-09. This is a gap analysis, not a claim that proposed work is implemented.

## Scope and evidence

Compared the CADCraft skills/plugin development packages (`0.1.0-dev.0`) with local `dreamina-skills` and `dreamina-canvas-plugin` source. The Dreamina references are its bilingual README, `dreamina-canvas-use` routing skill, setup/first-use/error-recovery references, pinned skill verification, architecture, and `docs/verification/round-safety-2026-10-08.md`. CADCraft facts come from this plugin's manifests, `scripts/`, tests, and the upstream CADCraft `0.3.0` CLI/MCP source. Static source and local tests are separate from host, desktop, and external CAD acceptance.

| Reference snapshot | Source pointers |
| --- | --- |
| Dreamina skills `42f0e38` | [`dreamina-canvas-use/SKILL.md`](https://github.com/full-aigc-skills/dreamina-skills/blob/42f0e38ab114d271e2f999483ef83a6ebbddc4f3/skills/dreamina-canvas-use/SKILL.md), `dreamina-canvas-cli-setup/references/first-use.md` and `error-recovery.md` |
| Dreamina Canvas plugin `3d21ce5` | [`README.md`](https://github.com/full-aigc-plugins/dreamina-canvas-plugin/blob/3d21ce5e7ddb164a626f18701f9f4ed8ba279f2b/README.md), `scripts/approval_guard.py`, `scripts/operation_ledger.py`, `scripts/verify_dreamina_canvas_skills.py`, `docs/verification/round-safety-2026-10-08.md` |
| CADCraft upstream `59631c8` | [`apps/cadcraft-cli/src/main.rs`](https://github.com/storytold/cadcraft/blob/59631c8d4f9ffe6c08c5c2065ea17504e53bf821/apps/cadcraft-cli/src/main.rs), `crates/mcp/src/backend.rs`, `crates/mcp/src/tools.rs` |

| Dreamina practice | Cadcraft current state | Transfer decision |
| --- | --- | --- |
| Route a broad request to a single execution skill, then disclose detail on demand | `cadcraft-use` routes to CLI or MCP; no dedicated first-use/reference material in the skill package before this documentation update | **Adopt:** preserve role split; use the new workflow/first-use guides as the deep link, and add a setup skill only if real host cases justify it |
| Discover live capabilities instead of hard-coding a product catalog | CADCraft exposes `cadcraft-cli commands` and MCP `list_commands`; existing skills already instruct discovery | **Keep and test:** compare documented examples with the installed version; do not make a static full command catalog |
| Pin independently maintained skills and verify provenance | `skills.lock.json` stores source commit/version and SHA-256 per `SKILL.md`; package validator and sync check exist | **Keep:** add a release/consumer install gate before claiming publication |
| First-use instructions identify binary, host, credentials, and acceptance separately | CLI discovery/doctor exists; host-loading steps and troubleshooting were sparse | **Adopt:** bilingual first-use and README now separate package, runtime, and host readiness; host proof remains open |
| Error tables name uncertain outcomes and recovery actions | Skills warn about remote timeout; upstream `Remote::call` can replay a request after a transport error | **Adopt further:** add executable uncertain-result tests and a durable, identity-aware recovery contract before any automatic retry |
| Evidence tables distinguish local regression from paid/live/host canaries | CADCraft has local package tests and optional native MCP integration; CI skips native cases | **Adopt:** maintain explicit source/local/native/host/desktop/external-format gates and revision-bound results |
| Approval, budget, submitId ledger, byte/hash receipt for asynchronous paid generation | CADCraft has no paid generation, submitId, quote, or asset download API in this package | **Do not copy literally:** use explicit overwrite intent, source backups, saved-file verification, and operation identity if remote writes become automated |

Dreamina's controller, uploader, and harness are useful examples of *enforced contracts plus tests*, but their credit approval and media upload semantics are not CAD drawing features. A CADCraft operation ledger would need its own specification for command identity, observed drawing revision, file destination, and recovery, rather than copying `submitId`.

## Current optimization backlog

These are proposed changes, ordered by risk and user value. “Documented” below means guidance exists; it does not mean the runtime enforces it.

| Priority | Owner | Gap | Observable acceptance gate |
| --- | --- | --- | --- |
| P0 | Plugin/runtime integration | Remote control backend may replay a mutating request; plugin has no deduplication or durable uncertain-result record | Reproduce disconnect after side effect; prove one of: no duplicate execution with a stable command ID, or fail-closed recovery that checks state before any resend; test restart and partial replies |
| P0 | Plugin/file delivery | Save/convert path policy is guidance only; no plugin-side atomic write, backup, or post-save integrity check | Test existing destination, failed write, process interruption, and reopen/geometry comparison; never report a stale file as new output |
| P0 | Host acceptance | Default `mcp.json` depends on host PATH; no actual Codex/Claude host installation proof | Install the packaged candidate on each claimed host, discover all 3 skills and MCP tools, draw/save/reopen a DXF, record host/CLI/package revisions |
| P1 | Skills | CLI/MCP guidance has no scenario-level test corpus or progressive troubleshooting references inside each installed skill | Test routing, `isError`, embedded `error`, unknown remote outcome, overwrite decision, and external-format evidence with granular skill installs |
| P1 | Package/release | Validators check a fixed shape and hashes, but full schema/host installation and published artifact checks are not CI gates | Validate official schemas, isolated distribution, lock provenance, version synchronization, and actual consumer installation for each release candidate |
| P1 | CAD interoperability | Current native test proves CADCraft DXF round-trip, not another CAD application's interpretation | Open representative DXF/DWG/PDF samples in target tools; compare entities, units, layers, dimensions, and renders with recorded fixtures |
| P2 | Desktop/platforms | Bridge test uses a TCP acceptor; no real UI or Windows gate | On each claimed platform, connect a running CADCraft app, inspect UI, screenshot, edit, save, and reopen; bind evidence to current source |

The first two P0 items require code and behavior tests in the upstream CLI and/or a new plugin controller. The current documentation does not silently implement them. Skills cannot guarantee deduplication, atomic saves, or rollback by instruction alone.

## Verification gates

| Layer | Current evidence | Remaining limit |
| --- | --- | --- |
| Skill structure | `cadcraft-skills/scripts/validate_skills.py` | Does not evaluate task behavior or host loading |
| Plugin package | `scripts/validate_package.py`; lock/hash and manifest checks | Not an installed-host result or full runtime acceptance |
| Native MCP | Optional tests with `CADCRAFT_NATIVE_TEST_CLI`: handshake, circle, render, DXF save/reopen | Local CADCraft round-trip only |
| Desktop bridge | Optional loopback TCP acceptor and UI-tool discovery | No real visible CADCraft desktop interaction |
| CI | Python package/unittest jobs in two repos | Plugin CI has no native CLI; no host or cross-platform matrix |
| Release/consumer | No configured Git remotes for these local development repos | No push, tag, marketplace entry, or clean consumer installation verified |

Next delivery work should take the P0 behavior contracts through specification, failing regression tests, implementation, and runtime verification before making stronger README claims. The bilingual documents added here are an entry point and an evidence boundary, not a release-readiness certificate.
