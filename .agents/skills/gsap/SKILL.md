---
name: gsap
description: Use this skill when implementing high-performance, professional animations in React using GSAP (GreenSock Animation Platform) and @gsap/react. Covers tweens, timelines, ScrollTrigger, Flip layout animations, responsive matchMedia, and the useGSAP hook with automatic lifecycle cleanup.
metadata:
  short-description: Animate UI with GSAP, ScrollTrigger, and @gsap/react
---

# GSAP (GreenSock Animation Platform)

GSAP is the industry-standard JavaScript animation engine for high-performance, precision web animations. It delivers frame-accurate sequencing, 60fps+ hardware-accelerated transforms, and extensive plugin support (ScrollTrigger, Flip, Draggable).

## When To Apply

Apply this skill when:
- Creating complex sequential entrance animations or choreographed scene timelines
- Building scroll-driven animations with pinning, scrubbing, or velocity parallax (`ScrollTrigger`)
- Morphing layouts or reordering lists without layout thrashing (`Flip`)
- Using physics springs, elastic bounces, or magnetic drag interactions (`Draggable`)
- Animating SVG paths, strokes, morphs, or canvas elements
- Implementing responsive or accessibility-sensitive animations via `gsap.matchMedia()`

## Core Workflow in React

### 1. Prerequisites
Ensure GSAP and the official React hook package are installed:
```bash
npm install gsap @gsap/react
```

### 2. Plugin Registration
Always register plugins once at module or app level before creating animations:
```javascript
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Flip } from 'gsap/Flip';

gsap.registerPlugin(useGSAP, ScrollTrigger, Flip);
```

### 3. The `useGSAP` Hook Pattern
Always use `useGSAP()` instead of raw `useEffect`. It scopes selector queries to a container ref and **automatically cleans up tweens, timelines, and ScrollTriggers on component unmount**:

```jsx
import React, { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

export default function HeroAnimated() {
  const containerRef = useRef(null);

  useGSAP(() => {
    // Selectors are automatically scoped to containerRef
    const tl = gsap.timeline({ defaults: { ease: 'power3.out', duration: 0.8 } });

    tl.from('.hero-kicker', { opacity: 0, y: -20 })
      .from('.hero-title', { opacity: 0, y: 30 }, '-=0.5')
      .from('.hero-card', { opacity: 0, scale: 0.9, stagger: 0.15 }, '-=0.4');
  }, { scope: containerRef });

  return (
    <div ref={containerRef} className="hero-section">
      <span className="hero-kicker">Curated Editions</span>
      <h1 className="hero-title">Ex Libris Archives</h1>
      <div className="hero-card">Card 1</div>
      <div className="hero-card">Card 2</div>
    </div>
  );
}
```

### 4. ScrollTrigger Pattern
```jsx
useGSAP(() => {
  gsap.from('.catalogue-shelf', {
    scrollTrigger: {
      trigger: '.catalogue-shelf',
      start: 'top 80%',
      end: 'bottom 20%',
      toggleActions: 'play none none reverse',
    },
    opacity: 0,
    y: 50,
    duration: 1,
    stagger: 0.2,
    ease: 'power2.out',
  });
}, { scope: containerRef });
```

## References To Load On Demand

- For GSAP 3 API cheatsheet, easing curves, and ScrollTrigger options:
  - Read [cheatsheet.md](./references/cheatsheet.md)
- For UI animation recipes (staggers, scrub parallax, hover physics):
  - Read [recipes.md](./references/recipes.md)

## Reference Links
- Documentation: `https://gsap.com/docs/v3/`
- React Guide: `https://gsap.com/resources/React/`
- ScrollTrigger: `https://gsap.com/docs/v3/Plugins/ScrollTrigger/`
