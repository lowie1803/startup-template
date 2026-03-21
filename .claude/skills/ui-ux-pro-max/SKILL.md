---
name: ui-ux-pro-max
description: "UI/UX design intelligence. 67 styles, 161 palettes, 57 font pairings, 25 charts, 99 UX guidelines. Actions: plan, build, create, design, implement, review, fix, improve, optimize, enhance, refactor, check UI/UX code. Projects: website, landing page, dashboard, admin panel, e-commerce, SaaS, portfolio, blog. Elements: button, modal, navbar, sidebar, card, table, form, chart. Styles: glassmorphism, claymorphism, minimalism, brutalism, neumorphism, bento grid, dark mode, responsive, skeuomorphism, flat design. Topics: color palette, accessibility, animation, layout, typography, font pairing, spacing, hover, shadow, gradient."
---

# UI/UX Pro Max - Design Intelligence

Comprehensive design guide for web applications. Contains 67 styles, 161 color palettes, 57 font pairings, 99 UX guidelines, and 25 chart types. Searchable database with priority-based recommendations.

## When to Apply

Use this skill when the task involves **UI structure, visual design decisions, interaction patterns, or user experience quality control**.

### Must Use

- Designing new pages (Landing Page, Dashboard, Admin, SaaS)
- Creating or refactoring UI components (buttons, modals, forms, tables, charts)
- Choosing color schemes, font systems, spacing, or layout systems
- Reviewing UI code for UX, accessibility, or visual consistency
- Implementing navigation, animation, or responsive behavior
- Product-level design decisions (style, information hierarchy, brand expression)

### Skip

- Pure backend logic, API/database design
- Non-visual performance optimization
- Infrastructure or DevOps work

## Rule Categories by Priority

| Priority | Category | Impact | Domain | Key Checks | Anti-Patterns |
|----------|----------|--------|--------|------------|---------------|
| 1 | Accessibility | CRITICAL | `ux` | Contrast 4.5:1, Alt text, Keyboard nav, Aria-labels | Removing focus rings, Icon-only buttons without labels |
| 2 | Touch & Interaction | CRITICAL | `ux` | Min size 44x44px, 8px+ spacing, Loading feedback | Reliance on hover only, Instant state changes (0ms) |
| 3 | Performance | HIGH | `ux` | WebP/AVIF, Lazy loading, Reserve space (CLS < 0.1) | Layout thrashing, Cumulative Layout Shift |
| 4 | Style Selection | HIGH | `style`, `product` | Match product type, Consistency, SVG icons (no emoji) | Mixing flat & skeuomorphic randomly, Emoji as icons |
| 5 | Layout & Responsive | HIGH | `ux` | Mobile-first breakpoints, Viewport meta, No horizontal scroll | Horizontal scroll, Fixed px container widths, Disable zoom |
| 6 | Typography & Color | MEDIUM | `typography`, `color` | Base 16px, Line-height 1.5, Semantic color tokens | Text < 12px body, Gray-on-gray, Raw hex in components |
| 7 | Animation | MEDIUM | `ux` | Duration 150-300ms, Motion conveys meaning, Spatial continuity | Decorative-only animation, Animating width/height, No reduced-motion |
| 8 | Forms & Feedback | MEDIUM | `ux` | Visible labels, Error near field, Helper text, Progressive disclosure | Placeholder-only label, Errors only at top, Overwhelm upfront |
| 9 | Navigation Patterns | HIGH | `ux` | Predictable back, Clear hierarchy, Deep linking | Overloaded nav, Broken back behavior, No deep links |
| 10 | Charts & Data | LOW | `chart` | Legends, Tooltips, Accessible colors | Relying on color alone to convey meaning |

## Quick Reference

### 1. Accessibility (CRITICAL)

- `color-contrast` - Minimum 4.5:1 ratio for normal text (large text 3:1)
- `focus-states` - Visible focus rings on interactive elements (2-4px)
- `alt-text` - Descriptive alt text for meaningful images
- `aria-labels` - aria-label for icon-only buttons
- `keyboard-nav` - Tab order matches visual order; full keyboard support
- `form-labels` - Use label with for attribute
- `skip-links` - Skip to main content for keyboard users
- `heading-hierarchy` - Sequential h1-h6, no level skip
- `color-not-only` - Don't convey info by color alone (add icon/text)
- `reduced-motion` - Respect prefers-reduced-motion
- `screen-reader` - Meaningful labels; logical reading order
- `escape-routes` - Provide cancel/back in modals and multi-step flows

### 2. Touch & Interaction (CRITICAL)

- `click-target-size` - Min 44x44px interactive area
- `click-spacing` - Minimum 8px gap between interactive targets
- `hover-vs-click` - Use click for primary interactions; don't rely on hover alone
- `loading-buttons` - Disable button during async operations; show spinner
- `error-feedback` - Clear error messages near problem
- `cursor-pointer` - Add cursor-pointer to clickable elements
- `press-feedback` - Visual feedback on press/click (opacity, elevation, color shift)
- `focus-visible` - Use :focus-visible for keyboard-only focus rings

### 3. Performance (HIGH)

- `image-optimization` - Use WebP/AVIF, responsive images (srcset/sizes), lazy load
- `image-dimension` - Declare width/height or use aspect-ratio to prevent layout shift
- `font-loading` - Use font-display: swap/optional to avoid invisible text
- `critical-css` - Prioritize above-the-fold CSS
- `lazy-loading` - Lazy load non-hero components via dynamic import / route-level splitting
- `bundle-splitting` - Split code by route/feature (React.lazy / Suspense)
- `reduce-reflows` - Avoid frequent layout reads/writes; batch DOM operations
- `content-jumping` - Reserve space for async content (CLS < 0.1)
- `virtualize-lists` - Virtualize lists with 50+ items
- `debounce-throttle` - Use debounce/throttle for high-frequency events (scroll, resize, input)

### 4. Style Selection (HIGH)

- `style-match` - Match style to product type (use `--design-system` for recommendations)
- `consistency` - Use same style across all pages
- `no-emoji-icons` - Use SVG icons (Phosphor, Heroicons, Lucide), not emojis
- `color-palette-from-product` - Choose palette from product/industry (search `--domain color`)
- `effects-match-style` - Shadows, blur, radius aligned with chosen style
- `state-clarity` - Make hover/active/disabled states visually distinct
- `elevation-consistent` - Use a consistent shadow scale for cards, sheets, modals
- `dark-mode-pairing` - Design light/dark variants together
- `icon-style-consistent` - Use one icon set/visual language across the product

### 5. Layout & Responsive (HIGH)

- `viewport-meta` - width=device-width initial-scale=1 (never disable zoom)
- `mobile-first` - Design mobile-first, then scale up
- `breakpoint-consistency` - Use systematic breakpoints (375 / 768 / 1024 / 1440)
- `readable-font-size` - Minimum 16px body text on mobile
- `line-length-control` - Mobile 35-60 chars per line; desktop 60-75 chars
- `horizontal-scroll` - No horizontal scroll on mobile
- `spacing-scale` - Use 4px/8px incremental spacing system
- `container-width` - Consistent max-width on desktop (max-w-6xl / 7xl)
- `z-index-management` - Define layered z-index scale
- `viewport-units` - Prefer min-h-dvh over 100vh on mobile

### 6. Typography & Color (MEDIUM)

- `line-height` - Use 1.5-1.75 for body text
- `font-pairing` - Match heading/body font personalities
- `font-scale` - Consistent type scale (12 14 16 18 24 32)
- `contrast-readability` - Darker text on light backgrounds
- `weight-hierarchy` - Bold headings (600-700), Regular body (400), Medium labels (500)
- `color-semantic` - Define semantic color tokens (primary, secondary, error, surface)
- `color-dark-mode` - Dark mode uses desaturated/lighter tonal variants
- `color-accessible-pairs` - Foreground/background pairs must meet 4.5:1 (AA)
- `number-tabular` - Use tabular/monospaced figures for data columns, prices, timers
- `whitespace-balance` - Use whitespace to group related items and separate sections

### 7. Animation (MEDIUM)

- `duration-timing` - 150-300ms for micro-interactions; complex transitions <=400ms
- `transform-performance` - Use transform/opacity only; avoid animating width/height/top/left
- `loading-states` - Show skeleton or progress indicator when loading exceeds 300ms
- `easing` - Use ease-out for entering, ease-in for exiting; avoid linear
- `motion-meaning` - Every animation must express cause-effect, not decoration
- `state-transition` - State changes should animate smoothly, not snap
- `spring-physics` - Prefer spring/physics-based curves for natural feel
- `exit-faster-than-enter` - Exit animations shorter (~60-70% of enter duration)
- `stagger-sequence` - Stagger list/grid item entrance by 30-50ms per item
- `reduced-motion` - Respect prefers-reduced-motion; reduce/disable animations when set
- `layout-shift-avoid` - Animations must not cause layout reflow or CLS

### 8. Forms & Feedback (MEDIUM)

- `input-labels` - Visible label per input (not placeholder-only)
- `error-placement` - Show error below the related field
- `submit-feedback` - Loading then success/error state on submit
- `required-indicators` - Mark required fields
- `empty-states` - Helpful message and action when no content
- `toast-dismiss` - Auto-dismiss toasts in 3-5s
- `confirmation-dialogs` - Confirm before destructive actions
- `inline-validation` - Validate on blur (not keystroke)
- `progressive-disclosure` - Reveal complex options progressively
- `focus-management` - After submit error, auto-focus the first invalid field
- `error-clarity` - Error messages must state cause + how to fix
- `destructive-emphasis` - Destructive actions use danger color and are visually separated

### 9. Navigation Patterns (HIGH)

- `nav-hierarchy` - Primary nav vs secondary nav clearly separated
- `nav-state-active` - Current location visually highlighted
- `nav-label-icon` - Navigation items have both icon and text label
- `back-behavior` - Back navigation predictable and consistent; preserve scroll/state
- `deep-linking` - All key screens reachable via URL
- `breadcrumb-web` - Use breadcrumbs for 3+ level deep hierarchies
- `search-accessible` - Search easily reachable; provide recent/suggested queries
- `state-preservation` - Navigating back restores previous scroll, filter, input state
- `adaptive-navigation` - Large screens prefer sidebar; small screens use top/bottom nav
- `navigation-consistency` - Navigation placement same across all pages
- `modal-escape` - Modals offer clear close affordance
- `focus-on-route-change` - After page transition, move focus to main content for screen readers

### 10. Charts & Data (LOW)

- `chart-type` - Match chart type to data (trend->line, comparison->bar, proportion->pie)
- `color-guidance` - Accessible palettes; avoid red/green only for colorblind users
- `data-table` - Provide table alternative for accessibility
- `legend-visible` - Always show legend near the chart
- `tooltip-on-interact` - Tooltips on hover showing exact values
- `responsive-chart` - Charts reflow or simplify on small screens
- `empty-data-state` - Meaningful empty state when no data
- `loading-chart` - Skeleton placeholder while chart data loads

---

# Prerequisites

Check if Python is installed:

```bash
python3 --version || python --version
```

If Python is not installed:

**Ubuntu/Debian:**
```bash
sudo apt update && sudo apt install python3
```

**macOS:**
```bash
brew install python3
```

---

## How to Use This Skill

Use this skill when the user requests any of the following:

| Scenario | Trigger Examples | Start From |
|----------|-----------------|------------|
| **New project / page** | "Build a landing page", "Build a dashboard" | Step 1 -> Step 2 (design system) |
| **New component** | "Create a pricing card", "Add a modal" | Step 3 (domain search: style, ux) |
| **Choose style / color / font** | "What style fits a fintech app?" | Step 2 (design system) |
| **Review existing UI** | "Review this page for UX issues" | Quick Reference checklist above |
| **Fix a UI bug** | "Button hover is broken", "Layout shifts on load" | Quick Reference -> relevant section |
| **Improve / optimize** | "Make this faster", "Improve mobile experience" | Step 3 (domain search: ux, react) |
| **Implement dark mode** | "Add dark mode support" | Step 3 (domain: style "dark mode") |
| **Add charts / data viz** | "Add an analytics dashboard chart" | Step 3 (domain: chart) |

Follow this workflow:

### Step 1: Analyze User Requirements

Extract key information from user request:
- **Product type**: SaaS, e-commerce, portfolio, dashboard, landing page, blog, admin panel, etc.
- **Target audience**: Consider demographics, usage context
- **Style keywords**: playful, vibrant, minimal, dark mode, content-first, immersive, etc.
- **Stack**: React + Vite + Tailwind CSS (this project's tech stack)

### Step 2: Generate Design System (REQUIRED)

**Always start with `--design-system`** to get comprehensive recommendations with reasoning:

```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<product_type> <industry> <keywords>" --design-system [-p "Project Name"]
```

This command:
1. Searches domains in parallel (product, style, color, landing, typography)
2. Applies reasoning rules from `ui-reasoning.csv` to select best matches
3. Returns complete design system: pattern, style, colors, typography, effects
4. Includes anti-patterns to avoid

**Example:**
```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "SaaS dashboard analytics modern" --design-system -p "My App"
```

### Step 2b: Persist Design System (Master + Overrides Pattern)

To save the design system for **hierarchical retrieval across sessions**, add `--persist`:

```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system --persist -p "Project Name"
```

This creates:
- `design-system/MASTER.md` — Global Source of Truth with all design rules
- `design-system/pages/` — Folder for page-specific overrides

**With page-specific override:**
```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system --persist -p "Project Name" --page "dashboard"
```

**How hierarchical retrieval works:**
1. When building a specific page, first check `design-system/pages/<page-name>.md`
2. If the page file exists, its rules **override** the Master file
3. If not, use `design-system/MASTER.md` exclusively

### Step 3: Supplement with Detailed Searches (as needed)

After getting the design system, use domain searches to get additional details:

```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<keyword>" --domain <domain> [-n <max_results>]
```

**When to use detailed searches:**

| Need | Domain | Example |
|------|--------|---------|
| Product type patterns | `product` | `--domain product "entertainment social"` |
| More style options | `style` | `--domain style "glassmorphism dark"` |
| Color palettes | `color` | `--domain color "entertainment vibrant"` |
| Font pairings | `typography` | `--domain typography "playful modern"` |
| Chart recommendations | `chart` | `--domain chart "real-time dashboard"` |
| UX best practices | `ux` | `--domain ux "animation accessibility"` |
| Landing structure | `landing` | `--domain landing "hero social-proof"` |
| React performance | `react` | `--domain react "rerender memo list"` |
| Interface / a11y | `web` | `--domain web "accessibilityLabel touch"` |

---

## Search Reference

### Available Domains

| Domain | Use For | Example Keywords |
|--------|---------|------------------|
| `product` | Product type recommendations | SaaS, e-commerce, portfolio, healthcare, beauty, service |
| `style` | UI styles, colors, effects | glassmorphism, minimalism, dark mode, brutalism |
| `typography` | Font pairings, Google Fonts | elegant, playful, professional, modern |
| `color` | Color palettes by product type | saas, ecommerce, healthcare, beauty, fintech, service |
| `landing` | Page structure, CTA strategies | hero, hero-centric, testimonial, pricing, social-proof |
| `chart` | Chart types, library recommendations | trend, comparison, timeline, funnel, pie |
| `ux` | Best practices, anti-patterns | animation, accessibility, z-index, loading |
| `react` | React performance | waterfall, bundle, suspense, memo, rerender, cache |
| `web` | Interface guidelines, a11y | accessibilityLabel, touch targets, dynamic type |

---

## Example Workflow

**User request:** "Build a SaaS analytics dashboard"

### Step 1: Analyze Requirements
- Product type: SaaS (analytics dashboard)
- Target audience: Business users, data analysts
- Style keywords: modern, clean, data-dense, professional
- Stack: React + Vite + Tailwind CSS

### Step 2: Generate Design System (REQUIRED)

```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "SaaS analytics dashboard professional" --design-system -p "Analytics"
```

### Step 3: Supplement with Detailed Searches

```bash
# Get chart recommendations for analytics
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "dashboard analytics trend" --domain chart

# Get UX best practices for data-heavy interfaces
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "data density loading" --domain ux

# Get React performance tips
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "rerender memo virtualize" --domain react
```

**Then:** Synthesize design system + detailed searches and implement the design.

---

## Output Formats

```bash
# ASCII box (default) - best for terminal display
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "fintech crypto" --design-system

# Markdown - best for documentation
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "fintech crypto" --design-system -f markdown
```

---

## Tips for Better Results

### Query Strategy

- Use **multi-dimensional keywords** — combine product + industry + tone: `"SaaS analytics modern clean"` not just `"app"`
- Try different keywords for the same need: `"playful neon"` -> `"vibrant dark"` -> `"content-first minimal"`
- Use `--design-system` first for full recommendations, then `--domain` to deep-dive

### Common Sticking Points

| Problem | What to Do |
|---------|------------|
| Can't decide on style/color | Re-run `--design-system` with different keywords |
| Dark mode contrast issues | Quick Reference section 6: `color-dark-mode` + `color-accessible-pairs` |
| Animations feel unnatural | Quick Reference section 7: `spring-physics` + `easing` + `exit-faster-than-enter` |
| Form UX is poor | Quick Reference section 8: `inline-validation` + `error-clarity` + `focus-management` |
| Navigation feels confusing | Quick Reference section 9: `nav-hierarchy` + `adaptive-navigation` |
| Layout breaks on small screens | Quick Reference section 5: `mobile-first` + `breakpoint-consistency` |
| Performance / jank | Quick Reference section 3: `virtualize-lists` + `debounce-throttle` |

### Pre-Delivery Checklist

- Run `--domain ux "animation accessibility z-index loading"` as a UX validation pass
- Run through Quick Reference sections 1-3 (CRITICAL + HIGH) as final review
- Test on 375px (mobile) and 1440px+ (desktop)
- Verify behavior with **prefers-reduced-motion** enabled
- Check dark mode contrast independently
- Confirm all click targets >= 44x44px
- Test keyboard navigation through all interactive elements
- Verify responsive breakpoints (375 / 768 / 1024 / 1440)
- Check focus indicators are visible on all interactive elements

---

## Common Rules for Professional UI

These are frequently overlooked issues that make UI look unprofessional:

### Icons & Visual Elements

- Default icon library: **Phosphor (`@phosphor-icons/react`)**. The `icons.csv` lists common recommendations, not the complete set.
- When recommended icons don't fit: prefer Phosphor's full set first, then **Heroicons (`@heroicons/react`)** as fallback. Maintain consistent style (stroke width, corner radius).

| Rule | Standard | Avoid | Why It Matters |
|------|----------|-------|----------------|
| **No Emoji as Icons** | Use vector icons (Phosphor, Heroicons, Lucide) | Using emojis for navigation, settings, controls | Emojis are inconsistent across platforms and can't use design tokens |
| **Vector-Only Assets** | Use SVG icons that scale cleanly and support theming | Raster PNG icons that blur or pixelate | Ensures scalability and dark/light mode adaptability |
| **Consistent Icon Sizing** | Define icon sizes as design tokens (icon-sm, icon-md=24px, icon-lg) | Mixing arbitrary values randomly | Maintains rhythm and visual hierarchy |
| **Stroke Consistency** | Consistent stroke width within the same visual layer | Mixing thick and thin strokes | Inconsistent strokes reduce perceived polish |
| **Icon Contrast** | WCAG contrast: 4.5:1 small, 3:1 larger UI glyphs | Low-contrast icons blending into background | Ensures accessibility in both themes |

### Interaction (Web)

| Rule | Do | Don't |
|------|----|----- |
| **Click feedback** | Provide hover/active states with clear visual change | No visual response on interaction |
| **Animation timing** | Keep micro-interactions around 150-300ms with appropriate easing | Instant transitions or slow animations (>500ms) |
| **Accessibility focus** | Ensure focus order matches visual order; use :focus-visible | Unlabeled controls or confusing focus traversal |
| **Disabled state clarity** | Use disabled attribute, reduced opacity, no pointer events | Controls that look clickable but do nothing |
| **Click target minimum** | Keep interactive areas >= 44x44px | Tiny click targets without adequate padding |
| **Keyboard navigation** | All interactive elements reachable and operable via keyboard | Mouse-only interactions |

### Light/Dark Mode Contrast

| Rule | Do | Don't |
|------|----|----- |
| **Surface readability** | Keep cards/surfaces clearly separated from background | Overly transparent surfaces that blur hierarchy |
| **Text contrast (light)** | Maintain body text contrast >= 4.5:1 against light surfaces | Low-contrast gray body text |
| **Text contrast (dark)** | Maintain primary text >= 4.5:1 and secondary >= 3:1 on dark | Dark mode text blending into background |
| **Border visibility** | Ensure separators visible in both themes | Borders disappearing in one mode |
| **Token-driven theming** | Use semantic color tokens mapped per theme | Hardcoded hex values per page |

### Layout & Spacing

| Rule | Do | Don't |
|------|----|----- |
| **Consistent content width** | Predictable max-width per breakpoint (max-w-6xl, max-w-7xl) | Mixing arbitrary widths between pages |
| **8px spacing rhythm** | Consistent 4/8px spacing system for padding/gaps | Random spacing increments with no rhythm |
| **Readable text measure** | Keep text 60-75 chars per line on desktop; 35-60 on mobile | Edge-to-edge paragraphs on wide screens |
| **Responsive gutters** | Increase horizontal padding on larger viewports | Same narrow gutter on all screen sizes |
| **Scroll and fixed coexistence** | Add content insets for fixed headers/footers | Scroll content hidden behind sticky elements |
