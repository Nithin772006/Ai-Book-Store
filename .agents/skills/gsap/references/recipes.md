# GSAP Recipes in React

## Recipe 1: Staggered Book Grid Entrance on Viewport Enter

```jsx
import React, { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(useGSAP, ScrollTrigger);

export function AnimatedBookGrid({ books }) {
  const gridRef = useRef(null);

  useGSAP(() => {
    gsap.from('.book-card', {
      scrollTrigger: {
        trigger: gridRef.current,
        start: 'top 85%',
        toggleActions: 'play none none reverse',
      },
      y: 40,
      opacity: 0,
      duration: 0.7,
      stagger: {
        amount: 0.5,
        grid: 'auto',
        from: 'start',
      },
      ease: 'power3.out',
    });
  }, { scope: gridRef, dependencies: [books] });

  return (
    <div ref={gridRef} className="book-grid">
      {books.map(b => (
        <div key={b.id} className="book-card">...</div>
      ))}
    </div>
  );
}
```

---

## Recipe 2: Magnetic Floating Book Spine Hover Effect

```jsx
import React, { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

export function InteractiveCover({ src, alt }) {
  const cardRef = useRef(null);

  const { contextSafe } = useGSAP({ scope: cardRef });

  const handleMouseMove = contextSafe((e) => {
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;

    gsap.to('.cover-inner', {
      rotationY: x * 0.08,
      rotationX: -y * 0.08,
      transformPerspective: 900,
      ease: 'power1.out',
      duration: 0.3,
    });
  });

  const handleMouseLeave = contextSafe(() => {
    gsap.to('.cover-inner', {
      rotationY: 0,
      rotationX: 0,
      ease: 'power2.out',
      duration: 0.6,
    });
  });

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="perspective-card"
    >
      <div className="cover-inner">
        <img src={src} alt={alt} />
      </div>
    </div>
  );
}
```
