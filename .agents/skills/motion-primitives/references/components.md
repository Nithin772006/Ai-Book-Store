# Motion Primitives Component Reference

## 1. Text Effects

### `text-effect`
Character, word, or line staggered reveals with customizable presets.
- Presets: `fade`, `blur`, `scale`, `slide`
- Segment levels: `words`, `characters`, `lines`
```tsx
<TextEffect per="word" preset="blur">
  Curated Literature for Curious Minds
</TextEffect>
```

### `text-morph`
Smooth shape-shifting character morphing between strings using shared layout IDs and svg paths.
```tsx
<TextMorph>{isSearching ? "Searching catalogue..." : "Search"}</TextMorph>
```

### `text-shimmer` / `text-shimmer-wave`
Subtle metallic or glowing shimmer passing across typography.
```tsx
<TextShimmer duration={1.8} spread={2}>
  Phase 3 Catalogue Live
</TextShimmer>
```

### `text-scramble`
Cyberpunk or editorial matrix letter-scramble decode reveal.
```tsx
<TextScramble trigger={isHovered}>
  Alexandria Archives
</TextScramble>
```

---

## 2. Interactive Primitives

### `tilt`
3D perspective tilt that responds dynamically to mouse coordinates.
- Props: `rotationFactor={15}`, `isReversed={false}`
```tsx
<Tilt rotationFactor={8} className="book-card-tilt">
  <BookCard book={book} />
</Tilt>
```

### `spotlight`
Dynamic radial flashlight/spotlight highlight following cursor over a card.
```tsx
<div className="relative overflow-hidden rounded-xl">
  <Spotlight fill="#203E33" />
  <CardContent />
</div>
```

### `glow-effect`
Conic or radial rotating neon / warm glow gradient behind borders.
```tsx
<GlowEffect colors={['#BD4F34', '#C0892B', '#203E33']} mode="rotate" blur="medium" />
```

### `magnetic`
Snaps buttons or icons magnetically toward cursor position.
- Props: `springOptions={{ bounce: 0.1 }}`
```tsx
<Magnetic>
  <button className="browse-btn">Explore</button>
</Magnetic>
```

---

## 3. Structural & Layout Primitives

### `morphing-dialog`
Expanding dialog that smoothly transforms from an inline card into an expansive modal dialog with shared layout geometry.
- Components: `MorphingDialog`, `MorphingDialogTrigger`, `MorphingDialogContainer`, `MorphingDialogContent`, `MorphingDialogClose`

### `infinite-slider`
Hardware-accelerated continuous infinite ticker for book covers, publisher logos, or quotes.
- Props: `duration={30}`, `direction="horizontal"`, `reverse={false}`
```tsx
<InfiniteSlider duration={25} gap={24}>
  {covers.map(img => <img src={img} key={img} />)}
</InfiniteSlider>
```

### `progressive-blur`
Gradient backdrop blur that transitions smoothly from 0px blur to 20px blur (avoids harsh blur seams).
- Direction: `top`, `bottom`, `left`, `right`
```tsx
<ProgressiveBlur direction="bottom" blurLayers={6} />
```

### `animated-background`
Shared layout pill/slider indicator that smoothly animates behind tabs, category chips, or navbar items.
```tsx
<AnimatedBackground
  defaultValue={activeTab}
  className="rounded-full bg-forest-subtle"
  transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
>
  {tabs.map(tab => (
    <button data-id={tab.id} key={tab.id}>{tab.label}</button>
  ))}
</AnimatedBackground>
```
