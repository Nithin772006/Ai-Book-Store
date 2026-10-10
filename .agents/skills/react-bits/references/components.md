# React Bits Component Reference

## 1. Text Animations

### `SplitText`
Splits string into span characters or words with staggered Framer Motion spring transition.
```jsx
import { motion } from 'framer-motion';

export function SplitText({
  text = '',
  className = '',
  delay = 0.05,
  animationFrom = { opacity: 0, y: 40 },
  animationTo = { opacity: 1, y: 0 },
  easing = [0.25, 0.1, 0.25, 1],
}) {
  const words = text.split(' ');
  return (
    <span className={`inline-block ${className}`}>
      {words.map((word, wIdx) => (
        <span key={wIdx} className="inline-block whitespace-nowrap mr-2">
          {word.split('').map((char, cIdx) => (
            <motion.span
              key={cIdx}
              initial={animationFrom}
              animate={animationTo}
              transition={{ delay: (wIdx * word.length + cIdx) * delay, ease: easing }}
              className="inline-block"
            >
              {char}
            </motion.span>
          ))}
        </span>
      ))}
    </span>
  );
}
```

### `ShinyText`
Creates an elegant moving metallic/reflective gradient across typography.
```jsx
export function ShinyText({ text, disabled = false, speed = 4, className = '' }) {
  return (
    <span
      className={`inline-block bg-clip-text text-transparent bg-gradient-to-r from-neutral-600 via-neutral-100 to-neutral-600 bg-[200%_auto] ${
        disabled ? '' : 'animate-shine'
      } ${className}`}
      style={{ animationDuration: `${speed}s` }}
    >
      {text}
    </span>
  );
}
```

### `DecryptedText`
Reveals text by cycling through random glyphs before settling on final characters.
- Props: `text`, `speed`, `maxIterations`, `sequential`, `revealDirection`

---

## 2. Interactive Cards

### `SpotlightCard`
Draws a radial gradient spotlight following mouse position relative to the card.
```jsx
import { useRef, useState } from 'react';

export function SpotlightCard({ children, className = '', spotlightColor = 'rgba(255, 255, 255, 0.12)' }) {
  const divRef = useRef(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e) => {
    if (!divRef.current) return;
    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setOpacity(1)}
      onMouseLeave={() => setOpacity(0)}
      className={`relative overflow-hidden rounded-xl border p-6 ${className}`}
    >
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300"
        style={{
          opacity,
          background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 40%)`,
        }}
      />
      {children}
    </div>
  );
}
```

### `StarBorder`
Animated gradient beam orbiting the border perimeter continuously.
```jsx
export function StarBorder({ as: Component = 'button', className = '', color = '#C0892B', speed = '6s', children, ...props }) {
  return (
    <Component className={`relative inline-block py-[1px] overflow-hidden rounded-full ${className}`} {...props}>
      <div
        className="absolute w-[300%] h-[50%] opacity-70 bottom-[-11px] right-[-250%] rounded-full animate-star-movement"
        style={{ background: `radial-gradient(circle, ${color}, transparent 10%)`, animationDuration: speed }}
      />
      <div className="relative z-1">{children}</div>
    </Component>
  );
}
```

---

## 3. Background Animations

### `Particles`
Canvas component rendering floating ambient particles with optional connection webs.
- Props: `particleCount`, `particleSpread`, `speed`, `particleColors`, `moveParticlesOnHover`

### `Aurora`
Multi-layered mesh gradient with noise and fluid animation.
- Props: `colorStops`, `speed`, `blendMode`
