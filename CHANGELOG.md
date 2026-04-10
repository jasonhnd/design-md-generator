# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2026-04-10

### Added
- **Intelligent Dark Mode Probe**: The dark mode detection script now scans all successfully extracted pages and dynamically selects the page with the highest CSS variable count to ensure dark mode tokens are captured accurately.
- **Dynamic Output Directories**: Output directories now automatically insert a timestamp (e.g., `YYYY_MMDD_HHmm_domain.com`) to prevent accidental data overwrites on subsequent runs.
- **Acknowledgments Section**: Added core conceptual attribution to VoltAgent/awesome-design-md in the internal README.

### Changed
- **Concurrent Extraction Architecture**: Replaced the sequential Page context loop in `extract.ts` with a `Promise.all` concurrent architecture, drastically reducing the total extraction time on multi-page domains. 
- **Default Concurrency Limits**: Increased the default concurrency limits and CLI arguments from `5` tabs up to `10` tabs.
- **Color Clustering Heuristics**: Adjusted Delta-E clustering bounds (`DeltaE < 6`) for severe low-frequency colors and normalized infinite darks/lights (`#ffffff` and `#000000`), reducing token pollution.
- **AI Formatting Tolerance**: Greatly relaxed Regex validation matching in `validate.ts` that enforces header numbering schemas (e.g. `1. Visual Theme`), drastically lowering generation failure rates.
- **License**: Updated license from MIT to Apache 2.0.

### Fixed
- **Timeout Freezes**: Reduced Playwright `interaction-capture` single-element timeouts severely from `2000ms` down to `500ms` (and capped `MAX_ELEMENTS` to 20), solving fatal `networkidle` freezes on excessively complex websites.
