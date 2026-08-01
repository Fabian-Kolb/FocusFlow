# FocusFlow E2E Testing Infrastructure & Specification (TEST_INFRA.md)

## 1. Overview & Dual Track Principles
The FocusFlow E2E Test Infrastructure provides an opaque-box (black-box), requirement-driven test runner and specification suite created under **Dual Track** principles in Project Pattern development. 

This test runner verifies all user-facing requirements defined in `focusflow_prototype.html` and `PROJECT.md` independently of internal implementation details.

---

## 2. 4-Tier Test Methodology

```
+-----------------------------------------------------------------------+
|                       E2E TEST SUITE MATRIX                           |
+-----------------------------------------------------------------------+
| Tier 1: Feature Coverage            (50 Tests) - Happy Path Specs    |
| Tier 2: Boundary & Corner Cases     (50 Tests) - Edge Cases & Bounds |
| Tier 3: Cross-Feature Interactions  (10 Tests) - Integration Flow    |
| Tier 4: Real-World Scenarios        ( 5 Tests) - End-to-End Journeys|
+-----------------------------------------------------------------------+
| TOTAL EXECUTED                      : 115 Tests                       |
+-----------------------------------------------------------------------+
```

### Tier 1: Feature Coverage (≥5 Tests per Feature Area)
Validates core functional requirements and visible UI contracts for every primary application area:
- **Navigation & Icons**: Font links, standard route targets, Material Symbols Outlined rendering, topbar active view titles, active route highlighting.
- **Responsive Sidebar / BottomNav**: Desktop `<aside>` (`hidden md:flex`), mobile `<nav>` (`fixed bottom-0`), viewport mode navigation switching.
- **ProjectDetail View**: Project headers, status tags, back navigation, phase lists, task items, checkbox line-through styling.
- **Calendar View**: Header layout, `calendar_today` icons, timeline event structures, responsive card containers.
- **AI Coach View**: Header layout, `smart_toy` / `auto_awesome` icons, modular container structure, marquee wrappers, Dashboard CTA banner.
- **Weekly Review View**: Title header, `analytics` icons, Focus Score widgets, metric bars, screen transition wrappers.
- **Interactive Modals (4 Modals)**: Project, Phase, Task, and Material upload modal structures, input fields, priority dropdowns, drag-and-drop dropzones, file selectors, and Ctrl+V paste handlers.

### Tier 2: Boundary & Corner Cases (≥5 Tests per Feature Area)
Tests system resilience, validation limits, extreme screen dimensions, keyboard shortcuts, and empty states:
- **Viewport Breakpoints**: Mobile boundary (`767px`), Desktop boundary (`768px`), ultra-mobile narrow layouts (`320px`).
- **Keyboard Shortcuts**: ESC key modal dismissal, Ctrl+V clipboard text paste handler in Material modal.
- **Data Edge Cases**: 0-task phases, empty project list, ultra-long titles (250+ characters), special character inputs (`&`, `"`, `'`), progress boundary metrics (0% and 100%).
- **Interactive Bounds**: Marquee animation pause on hover, backdrop click modal closure, drag-and-drop hover state style toggles.

### Tier 3: Cross-Feature Interactions
Tests multi-screen state preservation and inter-component workflows:
- Sequential navigation across all 7 screens without state degradation.
- Dashboard project card click opening ProjectDetail view.
- Opening modals from sub-screens and returning to exact screen context.
- Live metric sync (task completion updates reflecting on Dashboard and Weekly Review).
- Dynamic viewport resizing while modals are actively open.

### Tier 4: Real-World Scenarios
Validates complete user journeys from start to finish:
- **Scenario 1**: End-to-End Project Onboarding & Planning Journey (Create Project -> Add Phase -> Add Task -> Upload Document).
- **Scenario 2**: Daily Focus & Execution Workflow (Dashboard Must-Win -> AI Coach -> Calendar -> Weekly Review).
- **Scenario 3**: Mobile On-The-Go Execution (375px viewport -> Bottom bar navigation -> Quick modal addition).
- **Scenario 4**: Weekly Review & Planning Retrospective (Review Analytics -> Focus Score analysis -> Next Week Planning).
- **Scenario 5**: Multi-Modal Ingestion & Keyboard Interaction Journey (Material Modal -> Paste Link -> ESC close).

---

## 3. Architecture & File Layout

```
Reminder/
├── TEST_INFRA.md                       # Infrastructure documentation & methodology
├── TEST_READY.md                       # Published test readiness summary report
├── package.json                        # Configured with "test": "node scripts/run-e2e-tests.js"
├── scripts/
│   └── run-e2e-tests.js                # Master E2E runner executable
└── tests/
    ├── e2e_framework.js                # Test runner engine & assertion library
    ├── test_context.js                 # JSDOM & component loader context
    ├── tier1_feature_coverage.test.js  # Tier 1 test specs (50 tests)
    ├── tier2_boundary_corner.test.js   # Tier 2 test specs (50 tests)
    ├── tier3_cross_feature.test.js     # Tier 3 test specs (10 tests)
    └── tier4_real_world.test.js        # Tier 4 test specs (5 tests)
```

---

## 4. Execution & Verification

### Running the Test Suite
To execute the complete E2E test suite:

```bash
npm test
```

Or run directly via Node.js:

```bash
node scripts/run-e2e-tests.js
```

### Output Summary Format
The test runner formats colorized ANSI output displaying per-test status, a per-tier result matrix, a per-feature result matrix, execution timing, and return codes (exit code `0` on 100% pass, exit code `1` on failure).
