# Magic UI Component Reference

## Purpose

Use this document to choose the right Magic UI component and avoid integration mistakes before implementation.

## Install Contract

- Initialize shadcn once per project:
```bash
npx shadcn@latest init
```
- Add components via registry:
```bash
npx shadcn@latest add @magicui/<component-slug>
```
- Default import path:
```tsx
import { ComponentName } from "@/components/ui/<component-slug>"
```

If the project does not use `@/` aliases, adapt import paths to local conventions (e.g. `./components/ui/...`).

## Families

### Layout And Social Proof
- `marquee`: Infinite horizontal or vertical ticker with pause-on-hover.
- `avatar-circles`: Overlapping dynamic avatar cluster.
- `bento-grid`: Bento-style asymmetric modular feature grid.

Use for logo rails, testimonial movement, and feature grids.

### Hero And Visual Anchors
- `globe`: Interactive WebGL 3D globe with point connections (requires `cobe`).
- `warp-background`: Hyperspace perspective warp grid.
- `animated-grid-pattern`: Smoothly pulsed grid coordinates.
- `retro-grid`: Synthwave retro perspective grid floor.

Use one primary visual anchor per hero to keep hierarchy clear.

### Text Motion
- `blur-fade`: Smooth blur-to-clear entrance animation with stagger.
- `text-animate`: Flexible character, word, or line reveal animations.
- `word-rotate`: Rotating word cycler for headlines.
- `sparkles-text`: Decorative glowing stars surrounding key text.
- `typing-animation`: Terminal-like typewriter effect.

### Buttons And CTA Emphasis
- `shiny-button`: Shimmering gradient swipe on hover/idle.
- `shimmer-button`: Moving border gleam effect.
- `rainbow-button`: Smooth rotating conic-gradient rainbow border.
- `border-beam`: Moving light beam traveling along a card's border.
- `ripple-button`: Material-style expanding water ripples.

### Ambient Effects
- `particles`: Canvas floating particles with mouse interaction.
- `flickering-grid`: Retro randomized matrix flickering squares.
- `dot-pattern`: Subtle geometric dot matrix background.
- `grid-pattern`: Clean minimalist architectural wireframe grid.

## Integration Notes
- Requires `clsx`, `tailwind-merge` (`cn` helper).
- Components relying on Framer Motion utilize `motion/react` or `framer-motion`.
- Ensure CSS keyframes are defined if customizing without Tailwind plugin.
