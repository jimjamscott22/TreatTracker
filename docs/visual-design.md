# Visual design

## Direction

Treat-Tracker should feel calm, tactile, and practical: closer to a well-designed field notebook than a clinical dashboard or cartoon pet game. Friendly details are welcome, but tracking information stays legible and restrained.

## Design principles

- **Glanceable:** today's status is understandable in seconds.
- **Tactile:** favorite treats look obviously tappable.
- **Calm:** budget states use neutral language and color.
- **Personal:** the active pet is always visible.
- **Accessible:** typography and contrast work before decoration.

## Visual concept

Use warm paper-like surfaces with an ink-forward hierarchy and one pet-specific accent. Rounded cards and compact stamped labels can evoke a treat jar and notebook without relying on paw-print decoration.

Avoid:

- Excessive gradients
- Glassmorphism behind important text
- Generic purple/blue SaaS styling
- Cartoon mascots that compete with the user's pet
- Red/green moral scoring of treat consumption
- Confetti or streak mechanics tied to giving more treats

## Color tokens

Initial light theme:

| Token | Value | Use |
|---|---|---|
| `canvas` | `#F7F3EA` | Main background |
| `surface` | `#FFFDF8` | Cards and sheets |
| `ink` | `#25241F` | Primary text |
| `mutedInk` | `#69665D` | Secondary text |
| `line` | `#D8D1C3` | Dividers and borders |
| `accent` | `#C75D3A` | Primary actions |
| `accentSoft` | `#F2D8C9` | Selected states |
| `positive` | `#39745B` | Confirmed/saved states |
| `focus` | `#1D64A8` | Focus indication |

These are starting values, not proof of contrast compliance. Verify every text/background pairing with automated and manual checks. Provide a true dark theme before release if the application follows the system appearance setting.

Pet profiles may select from a curated accessible accent palette. Accent must not be the only indication of the active pet.

## Typography

Use the platform system font initially for excellent Dynamic Type behavior and lower bundle complexity.

- Large title: Today and pet context
- Title 2: Section headings
- Headline: Totals and card labels
- Body: Event details
- Caption: Date ranges and calculation notes

Use tabular numerals for counts, quantities, times, and chart axes. Do not shrink critical totals to fit; allow reflow.

## Spacing and shape

Use a 4-point base grid:

- `4`: icon/text optical correction
- `8`: compact internal gap
- `12`: list item gap
- `16`: standard card padding
- `24`: section separation
- `32`: major screen rhythm

Suggested radii:

- Small controls: 10
- Cards: 16
- Bottom sheets: 24 at top corners
- Favorite quick-add buttons: 18

Interactive controls remain at least 44 points tall.

## Key components

### Pet switcher

- Circular photo or initial
- Pet name in prominent text
- Species label or icon as redundant context
- Chevron and accessible “Switch pet” label

### Summary card

- Primary event count
- Known calorie estimate as secondary
- Optional budget progress bar
- Explicit unknown-calorie note
- No traffic-light status

### Quick-add tile

- Treat name
- Default quantity
- Optional simple category glyph
- Favorite marker
- Pressed state with scale or tone change, disabled when reduced motion applies

### Event row

- Time
- Treat snapshot name
- Quantity and unit
- Known calorie estimate or “Not entered”
- Overflow/detail affordance

### Trend card

- Plain-language headline
- Exact date range
- Compact chart
- Accessible textual summary
- Info affordance for calculation details

## Iconography

Use one coherent outline icon set already supported in Expo. Pair ambiguous icons with labels. A paw icon may identify the product, but should not appear as repeated decoration.

## Motion

- Quick-add acknowledgment: subtle press and count transition.
- Entry insertion: short fade/slide that respects reduced motion.
- Tab and range changes: standard platform transitions.
- No celebratory animation for increased treat counts.

## Content style

Preferred:

- “Add treat”
- “Recorded for Miso”
- “Known calories”
- “No treats recorded today”
- “Compared with Aug 16–22”

Avoid:

- “Good job!”
- “Cheat treat”
- “Danger”
- “Your pet has had too much”
- “Healthy/unhealthy” labels without an authoritative, product-approved basis

## App icon concept

A simple top-down treat jar lid or single biscuit tally mark, using the warm canvas and terracotta accent. It should remain identifiable at small sizes and avoid resembling a veterinary or calorie-counting medical app.

## Design validation checklist

- Test smallest supported iPhone width.
- Test largest accessibility text sizes.
- Test light and dark appearances if both are offered.
- Verify safe areas and home indicator clearance.
- Verify keyboard avoidance on every form.
- Verify all meaningful states without color.
- Verify VoiceOver reading order and action labels.
- Verify charts have equivalent text.
