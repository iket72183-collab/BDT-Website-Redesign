# BDT Connect — Design System

> Vibe: **luxury hotel × fintech**. Matte black, brushed rose-gold, warm whites.
> Nothing pure-white. Nothing fluorescent. Nothing rushed.

This document is the source of truth for visual decisions across `apps/web`
(marketing) and the future tenant-side UI in `apps/mobile`. Future AI sessions
working on this codebase should read this file before adding components.

---

## 1. Source-of-truth files

| Concern          | File                                       |
| ---------------- | ------------------------------------------ |
| Raw tokens (JS)  | `styles/tokens.js`                         |
| Raw tokens (CSS) | `styles/tokens.css` (`--bdt-*` variables)  |
| Tailwind theme   | `tailwind.config.ts` (imports tokens.js)   |
| Base styles      | `app/globals.css`                          |
| UI primitives    | `components/ui/{Button,Card,Badge,Input}`  |

**Rule:** if you need a new color/size/shadow, add it to `tokens.js` first, mirror in `tokens.css`, then use it via Tailwind. Never hardcode hex values in components.

---

## 2. Color

### Surfaces (`bg-bg-*`)

| Token         | Hex       | Use                                  |
| ------------- | --------- | ------------------------------------ |
| `bg-base`     | `#0A0A0A` | Page background                      |
| `bg-surface`  | `#111111` | Standard card base                   |
| `bg-raised`   | `#161616` | Modal / elevated card                |
| `bg-inset`    | `#080808` | Input wells, blurred price plates    |

### Metals (`text-metal-*`, `bg-metal-*`)

| Token             | Hex          | Use                                              |
| ----------------- | ------------ | ------------------------------------------------ |
| `metal-rose`      | `#C9A882`    | Primary brand color, icon accents, eyebrow text  |
| `metal-champagne` | `#D4AF7A`    | Lighter metal — gradient stop only               |
| `metal-border`    | `#8B7355`    | Static borders / dividers / thin frames          |
| `metal-deep`      | `#6B5640`    | Pressed/active states                            |
| `metal-glow`      | `#C9A882` 25%| Box-shadow glow color                            |

### Text (`text-ink-*`)

| Token            | Hex       | Use                                       |
| ---------------- | --------- | ----------------------------------------- |
| `ink-primary`    | `#F5F0E8` | Body + headings (warm white, never `#FFF`)|
| `ink-muted`      | `#A89880` | Secondary copy, captions                  |
| `ink-subtle`     | `#6B5F4F` | Tertiary / disabled                       |
| `ink-onMetal`    | `#0A0A0A` | Text sitting on a metallic CTA            |

### Status

Used only for inline feedback. Desaturated to stay brand-coherent. Always pair with a soft tint background (`-Soft` variants) — never use the solid color as a surface.

---

## 3. Typography

Two families. Two roles. No third font.

| Family           | Variable             | Use                                       |
| ---------------- | -------------------- | ----------------------------------------- |
| Playfair Display | `font-display`       | Headings, the logo wordmark               |
| Inter            | `font-body` (default)| All body, UI labels, buttons              |

**Size scale** (Tailwind utilities):

| Class                | Use                                      |
| -------------------- | ---------------------------------------- |
| `text-display-2xl`   | Hero H1                                  |
| `text-display-xl`    | Section H2                               |
| `text-display-lg`    | Big numbers (price plates)               |
| `text-display-md`    | Card titles                              |
| `text-body-lg`       | Lead paragraph                           |
| `text-body-md`       | Default body copy                        |
| `text-body-sm`       | Footer / dense lists                     |
| `text-caption`       | Small meta — *combine with `uppercase tracking-label`* |
| `text-label`         | Eyebrow / button text (pre-tracked)      |

**All-caps tracking rule:** any time text is `uppercase`, it MUST have at least `tracking-label` (`0.18em`) — never set caps without tracking, never use tracking on lowercase. Use `tracking-wide` (`0.15em`) for buttons that aren't full-caps.

---

## 4. Effects (the "luxury" toolkit)

These four effects do most of the work. Don't invent new ones — compose these.

### a. Metallic shimmer fill (`.text-metal-shimmer` + `animate-shimmer`)
A 6-stop gold gradient with `background-size: 200% 100%` that slides infinitely. Used on:
- Primary CTAs (`<Button variant="primary">`)
- Hero headline "Every Business."
- The `BDT` mark in the Logo plaque

**Don't use it on body text** — only on display type and CTAs, never paragraphs.

### b. Flat metal fill (`.text-metal` / `bg-metal-flat`)
A static top-to-bottom rose-gold gradient. Use for:
- Smaller wordmarks (nav logo)
- Decorative bars under links
- Secondary heading accents

### c. Gold glow (`shadow-glow`, `shadow-glow-strong`)
A soft rose-gold box-shadow. Used on:
- Button hover (`shadow-glow` baseline, `shadow-glow-strong` on primary)
- Featured pricing card (always-on glow)
- Focus ring on inputs

### d. Frosted glass (`.glass`)
Semi-transparent dark surface + `backdrop-filter: blur(14px)`. Used on:
- Every `<Card>`
- The featured problem/solution column
- Any future modal / popover

Combine with `.metal-frame` for the etched-gold inset border on premium surfaces.

---

## 5. Motion

| Token                | Value    | Use                              |
| -------------------- | -------- | -------------------------------- |
| `duration-fast`      | 160ms    | Color changes, small hovers      |
| `duration-base`      | 240ms    | Default — buttons, cards         |
| `duration-slow`      | 420ms    | Card lift, modal entrance        |
| `animate-shimmer`    | 3.2s     | Metallic fill animation          |
| `animate-glow-pulse` | 3.6s     | Subtle attention on rare CTAs    |
| `animate-fade-up`    | 600ms    | Section/element entrance         |

**Easing:** always `var(--bdt-ease-base)` (custom `cubic-bezier(0.22, 1, 0.36, 1)`) — sharp ease-out that feels weighted and intentional. Never linear (except shimmer), never default `ease`.

`prefers-reduced-motion: reduce` is handled globally in `globals.css` — shimmer pauses, transitions collapse. Don't override it.

---

## 6. Spacing & layout

- 8pt base scale (matches Tailwind's default).
- Section vertical rhythm: `py-24 sm:py-32`. Don't go tighter.
- Container max-width: `max-w-7xl` for hero/sections, `max-w-3xl` for centered prose.
- Horizontal padding: `px-6 sm:px-10`. Always.

---

## 7. Component rules

### Button
| Variant   | When to use                                          |
| --------- | ---------------------------------------------------- |
| `primary` | The single most important action on a screen.        |
| `ghost`   | Secondary CTA. Pairs with primary in hero / pricing. |
| `text`    | Tertiary nav, footer-style links.                    |

Only **one** `primary` button per visible viewport. If you find yourself wanting two, demote one to `ghost`.

### Card
Always frosted glass. `hover` only when the card is interactive (clicks through). `framed` for premium tier / featured surfaces. Use `<CardEyebrow>` + `<CardTitle>` + `<CardBody>` for consistent internal rhythm.

### Badge
Always uppercase + tracked. Default `tone="metal"` for brand-aligned chips; `muted` for neutral; status tones reserved for status.

### Input
Dark surface, gold focus ring. Label is always above, uppercase tracked. Hint sits below; turns danger-red when `invalid`.

---

## 8. Anti-patterns (do not ship these)

- ❌ Pure white text (`#FFF`) or pure white surfaces.
- ❌ Saturated brand-foreign colors (no Material blue, no Bootstrap green).
- ❌ Shimmer animation on body paragraphs or large blocks of text.
- ❌ Multiple `primary` buttons on the same screen.
- ❌ Sharp shadows with `rgba(0,0,0,0.X)` over 0.6 — looks cheap on black.
- ❌ Rounded-full on rectangular CTAs — keep buttons `rounded-lg`.
- ❌ Sans-serif headings — display type is always Playfair.
- ❌ Hardcoded hex values inside components — go through tokens.

---

## 9. Logo / brand asset

Place the official plaque image at:

```
apps/web/public/brand/bdt-connect-plaque.png      (full-color rendered plaque)
apps/web/public/brand/bdt-connect-mark.svg        (wordmark only, for nav)
apps/web/public/brand/bdt-connect-favicon.svg
```

Until those files exist, `components/landing/Logo.tsx` renders a CSS approximation that's safe to ship. The plaque variant is the brand mark; the mark variant is the navbar wordmark.

When the official assets drop in, swap the inner JSX of `Logo` to use `next/image` — keep the component API identical so consumers don't change.

---

## 10. Adding new surfaces (checklist)

Before merging a new component or page:

- [ ] Uses only token-backed colors (search the file for `#` — should find none)
- [ ] Display type is `font-display`, body is `font-body`
- [ ] All caps text has `tracking-label` (or at least `tracking-wide`)
- [ ] Hover states use `shadow-glow` (not generic Tailwind shadows)
- [ ] Cards use `.glass`
- [ ] Reduced-motion users still get a usable experience
- [ ] Mobile breakpoint tested at 375px width

If any of those fail, the design system isn't doing its job — fix the component, or extend the tokens.

---

## 11. In-app UI (React Native / Expo)

> Landing page = "luxury showroom." App UI = "luxury daily driver." Same brand,
> different constraints: thumb-reachable, fast, no time to admire shimmer.

### Tokens

The web tokens have an RN twin at `apps/mobile/src/styles/appTokens.ts`. Same palette, RN-native units:

- spacing/radius as `number` (RN rejects `"1rem"` / `"8px"`)
- typography sizes as `number` (pt)
- shadows split into iOS `shadow*` + Android `elevation` blocks
- font family strings are the literal Expo-Google-Fonts module names (`PlayfairDisplay_700Bold`, `Inter_500Medium`, …)

When the palette changes, update **both** `apps/web/styles/tokens.js` AND `apps/mobile/src/styles/appTokens.ts` — there is no automated link between them.

### Component library

Lives at `apps/mobile/src/components/ui/`. Mirror of the web set with RN names:

| Web              | RN                  | Notes                                                       |
| ---------------- | ------------------- | ----------------------------------------------------------- |
| `Button`         | `RNButton`          | Variants: primary, ghost, danger, text                      |
| `Card`           | `RNCard`            | `variant: standard \| metric \| flat`; `framed` adds inset gold |
| `Input`          | `RNInput`           | Floating label, gold focus ring + glow                      |
| —                | `RNAvatar`          | Initials-only; `gold` adds glowing ring                     |
| `Badge`          | `RNBadge`           | Status tones: confirmed, pending, cancelled, paid, refunded |
| —                | `RNBottomSheet`     | Slide-up modal w/ backdrop fade                             |
| —                | `RNStatCard`        | Label + big rose-gold value + colored trend                 |
| —                | `RNListItem`        | Row w/ leading/title/subtitle/trailing                      |
| —                | `RNEmptyState`      | Icon + headline + body + CTA — always elegant copy          |
| —                | `RNSectionHeader`   | Uppercase + gold + tracked, optional action link            |
| —                | `RNSkeleton`        | Dark shimmer placeholder (`#1A1A1A → #252525 → #1A1A1A`)    |
| —                | `RNStaggeredList`   | Wraps children to fade+slide-up 50ms apart                  |

Icons are `Feather` from `@expo/vector-icons` via the `Icon` wrapper — never substitute filled / Material glyphs.

### Navigation

File-based via Expo Router. Single source of truth is `apps/mobile/src/navigation/AppNavigator.tsx`, which exports:

- `OWNER_TABS` — typed array of `{ name, label, icon }`
- `tabBarOptions` — gold-active, blur background, hairline top edge
- `ownerTabProps(name)` — props for one `<Tabs.Screen>`

Each role's `_layout.tsx` (`(owner)`, `(staff)`, `(client)`) imports from this module — keeps route names / icons / labels in one place.

Owner has 5 tabs: **Home · Bookings · Schedule · Clients · Settings**. Payments lives as a stack-only screen (`href: null`) reachable from Home and Settings.

### Motion rules (mobile-specific)

- Transitions: 240ms with `Easing.bezier(0.22, 1, 0.36, 1)` — never default ease, never bouncy.
- Press: scale to **0.97** + (for primary/danger) a light haptic. Implemented inside `RNButton` and `RNListItem`.
- List entrance: wrap with `RNStaggeredList` (50ms step).
- Loading: render `RNSkeleton` in the rough shape of the final UI — never pop blank → full.
- Haptics: `Light` on press, `Medium` on confirm-booking / new-booking FAB, **`Success`** on payment success (caller's responsibility). All via `expo-haptics`.

### Tab bar rules

- Background: blur on iOS (`BlurView` intensity 28), opaque dark on Android.
- Icons: Feather, thin-line only, 22px.
- Active = rose gold, inactive = `ink-subtle`. No filled glyph swap on selection — color is the only state cue.
- Labels are always shown, uppercase, 10pt, tracked 1.4.

---

## 12. In-app anti-patterns

Everything in §8 still applies, plus:

- ❌ Filled / Material / chunky-stroke icons on the tab bar.
- ❌ React Native's default `<Switch>` (looks iOS-system, breaks the brand). Use the toggle pattern in `SettingsScreen`.
- ❌ `Easing.bounce` / `Easing.elastic` anywhere.
- ❌ Loading spinners for primary loads — use `RNSkeleton` instead.
- ❌ Pure-black backgrounds for cards — they should sit on `bg.base` as glass surfaces, never become indistinguishable from the page.
- ❌ Tab bars with more than 5 items.
- ❌ Toast / snackbar over the FAB — use bottom-sheet confirmations instead.

---

## 13. Tenant branding × design system

The schema lets each tenant store a `branding.primaryColor`. **This is a real
conflict surface with the design system** — if we let tenants pick anything,
some will pick neon green and the app will look like a settings menu rolled
in glitter.

**Rules:**

1. **Constrained palette only.** Tenant primary must come from a curated set of brand-coherent metals/jewel-tones. See `ALLOWED_TENANT_PRIMARIES` in `apps/mobile/src/screens/SettingsScreen.tsx` for the starter list. Free-form hex pickers should NOT be exposed.
2. **Narrow surface area.** Tenant primary appears ONLY on:
   - Client-facing primary CTAs (replacing the rose-gold gradient with a single-color metallic of their color)
   - The brand strip in `AppHeader brand={...}`
   - The logo / wordmark itself
   Everything else — bg, text, status, system chrome — stays locked to base tokens.
3. **Owner/staff UI is locked.** The internal app (owner/staff tabs) renders in pure BDT Connect tokens. Tenant branding only flows through the `(client)` route group.
4. **No tenant typography override.** Playfair Display + Inter are non-negotiable.
5. **Logo must clear contrast.** When tenants upload a logo, validate against the dark background — block submissions whose dominant color is below a luminance threshold (mostly-black logos disappear).

If a tenant requests deeper customization (their own font, their own bg color), kick to a "Studio+" plan that includes brand consultation — don't extend the system to please one customer.

---

## 14. Cross-platform token sync

**Open decision:** the two tokens files (`apps/web/styles/tokens.js` and `apps/mobile/src/styles/appTokens.ts`) are manually kept in sync. When the system stabilizes, extract a `packages/design-tokens/` workspace package that exports the raw values, with web and mobile each consuming + adapting. Not worth doing yet — premature for a 2-target codebase.
