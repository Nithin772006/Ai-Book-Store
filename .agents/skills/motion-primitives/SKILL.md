---
name: motion-primitives
description: Use this skill when building fluid, physics-driven animated React components using Motion Primitives (by @ibelick). Covers morphing dialogs, text effects, progressive blurs, interactive tilts, magnetic elements, and smooth layout transitions using Framer Motion / Motion.
metadata:
  short-description: Animate UI with Motion Primitives and Framer Motion
---

# Motion Primitives

Motion Primitives is a collection of open-source UI components and micro-interactions built with **Motion** (`framer-motion`), **React**, and **Tailwind CSS**. It emphasizes fluid physics, spring physics, and Apple-grade micro-interactions.

## When To Apply

Apply this skill when users want to:
- Build morphing cards/dialogs (`morphing-dialog` that smoothly expands from a card to a full modal)
- Implement cinematic text reveal effects (`text-effect`, `text-morph`, `text-shimmer`, `text-scramble`, `text-roll`)
- Add interactive card physics (`tilt`, `spotlight`, `glow-effect`, `magnetic`)
- Create smooth content sliders and tickers (`infinite-slider`, `carousel`)
- Add progressive glassmorphism blurs (`progressive-blur`)
- Create dynamic toolbars, tabs, or segmented controls (`animated-background`, `toolbar-expandable`, `transition-panel`)

## Core Workflow

### 1. Prerequisites
Ensure required dependencies are installed:
```bash
npm install framer-motion clsx tailwind-merge lucide-react
```
Ensure the `cn` helper exists (`src/lib/utils.js` or `@/lib/utils`):
```javascript
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function cn(...inputs) { return twMerge(clsx(inputs)); }
```

### 2. Component Installation
Add components either via the Motion Primitives CLI or by copy-pasting the component source:
```bash
npx motion-primitives add <component-name>
```
Examples:
```bash
npx motion-primitives add morphing-dialog
npx motion-primitives add text-effect
npx motion-primitives add tilt
npx motion-primitives add infinite-slider
npx motion-primitives add progressive-blur
```

### 3. Usage Pattern
All primitives are designed to be composable:
```tsx
import { MorphingDialog, MorphingDialogTrigger, MorphingDialogContent } from '@/components/core/morphing-dialog';
import { TextEffect } from '@/components/core/text-effect';
import { Tilt } from '@/components/core/tilt';
```

## References To Load On Demand

- For complete component signatures and props:
  - Read [components.md](./references/components.md)
- For interactive recipes and patterns:
  - Read [recipes.md](./references/recipes.md)

## Reference Links
- Documentation & Demos: `https://motion-primitives.com`
- GitHub Repository: `https://github.com/ibelick/motion-primitives`
