# GSAP 3 Cheatsheet

## Basic Methods
- `gsap.to(target, { vars })`: Animates from current state to target values.
- `gsap.from(target, { vars })`: Animates from specified values to current state.
- `gsap.fromTo(target, { fromVars }, { toVars })`: Full control over start and end states.
- `gsap.set(target, { vars })`: Immediately sets properties without animating.

## Common Properties
- Position: `x: 100` (pixels), `xPercent: -50` (% of element width), `y: 50`, `yPercent: 100`
- Scale & Rotation: `scale: 1.1`, `scaleX`, `scaleY`, `rotation: 360`, `rotationX`, `rotationY`
- Opacity & Visibility: `opacity: 0`, `autoAlpha: 0` (toggles opacity AND `visibility: hidden` for accessibility)
- Timing: `duration: 0.8`, `delay: 0.2`, `repeat: -1` (infinite), `yoyo: true`
- Stagger: `stagger: 0.1` or `stagger: { each: 0.1, from: 'center' }`

## Standard Eases
- Smooth natural: `"power2.out"`, `"power3.out"`, `"power4.out"`
- Dramatic entrance: `"expo.out"`
- Snappy UI spring: `"back.out(1.7)"`
- Elastic bounce: `"elastic.out(1, 0.3)"`
- Linear / Tickers: `"none"`

## Timelines (`gsap.timeline()`)
```javascript
const tl = gsap.timeline({ defaults: { duration: 0.6, ease: "power2.out" } });
tl.to(".box1", { x: 100 })
  .to(".box2", { y: 50 }, "-=0.3") // overlaps by 0.3s
  .to(".box3", { scale: 1.2 }, "<"); // starts simultaneously with previous
```

## ScrollTrigger Configuration
- `trigger`: Selector or Element triggering the animation.
- `start`: When trigger reaches viewport (e.g. `"top 80%"`).
- `end`: When animation concludes (e.g. `"bottom 20%"` or `"+=500"`).
- `scrub`: `true` or smooth lag value (e.g. `1` or `0.5`).
- `pin`: `true` locks the trigger in place during scroll.
- `toggleActions`: 4 states `onEnter onLeave onEnterBack onLeaveBack` (e.g. `"play none none reverse"`).

## Responsive `gsap.matchMedia()`
```javascript
const mm = gsap.matchMedia();
mm.add("(min-width: 800px)", () => {
  // Desktop animations
});
mm.add("(max-width: 799px)", () => {
  // Mobile animations
});
```
