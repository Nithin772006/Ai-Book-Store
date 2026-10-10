---
name: react-bits
description: Use this skill when implementing animated, interactive React components from React Bits (by @DavidHDev). Covers text animations (SplitText, BlurText, ShinyText, TrueFocus, DecryptedText), background effects (Aurora, Waves, Particles, Squares), statement cards (SpotlightCard, TiltedCard, StarBorder), and cursor physics.
metadata:
  short-description: Animate React UIs with React Bits interactive components
---

# React Bits

React Bits is a curated collection of animated, interactive, and customizable React components created by **David Haz (@DavidHDev)**. It specializes in "statement pieces" — eye-catching text animations, interactive backgrounds, and physics-driven cards.

## When To Apply

Apply this skill when users want to:
- Add headline text animations (`SplitText`, `BlurText`, `ShinyText`, `TrueFocus`, `DecryptedText`, `VariableProximity`)
- Create ambient background visual effects (`Aurora`, `Waves`, `Particles`, `Squares`, `Hyperspeed`)
- Build interactive product cards (`SpotlightCard`, `TiltedCard`, `StarBorder`, `PixelCard`)
- Implement playful cursor or click interactions (`ClickSpark`, `SplashCursor`, `MagnetLines`)
- Convert static editorial cards or hero headers into dynamic interactive showcases

## Core Architecture & Variants

React Bits components are distributed as modular, standalone source components. Components generally come in standard CSS and Tailwind variants, powered by **Framer Motion**, **React Spring**, or **Canvas/WebGL API**.

### Prerequisites
Install common dependencies used across React Bits components:
```bash
npm install framer-motion clsx tailwind-merge
```
For 3D or canvas components:
```bash
npm install three @react-three/fiber
```

## Component Families

### 1. Text Animations
- `SplitText`: Splits sentences into letters/words with staggered spring entrance.
- `BlurText`: Elegant cinematic blur-to-focus entrance.
- `ShinyText`: Smooth metallic light gleam passing across typography.
- `TrueFocus`: Interactive floating focus rectangle snapping between words on hover.
- `DecryptedText`: Cipher-scramble character decode effect on hover or view.

### 2. Background Animations
- `Aurora`: Fluid gradient aurora effect with soft organic movement.
- `Particles`: Floating ambient nodes with optional mouse connection lines.
- `Waves`: Mathematical sine-wave ripple canvas.
- `Squares`: Responsive matrix grid with randomized opacity flickers.

### 3. Component & Card Effects
- `SpotlightCard`: Clean card surface featuring a radial spotlight tracking mouse coordinates.
- `TiltedCard`: 3D perspective pitch/yaw card tilt with depth parallax.
- `StarBorder`: Continuous neon/gold light streak orbiting card boundaries.

## References To Load On Demand

- For detailed component APIs, props, and copy-paste implementations:
  - Read [components.md](./references/components.md)
- For UI layout recipes:
  - Read [recipes.md](./references/recipes.md)

## Reference Links
- Documentation & Demos: `https://reactbits.dev`
- GitHub Repository: `https://github.com/DavidHDev/react-bits`
