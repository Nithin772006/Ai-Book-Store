# Magic UI Recipes

## Recipe 1: Hero With Visual Depth

### Stack
- Background: `animated-grid-pattern` or `warp-background`
- Heading Entrance: `blur-fade`
- Interactive CTA: `shimmer-button` or `shiny-button`

### Steps
1. Install components:
```bash
npx shadcn@latest add @magicui/animated-grid-pattern @magicui/blur-fade @magicui/shiny-button
```
2. Wrap hero container in the animated grid pattern with opacity mask.
3. Wrap headline, subheadline, and CTAs in `BlurFade` with incremental `delay={0.15}` for a cascading reveal.
4. Render primary call-to-action button with `ShinyButton`.

---

## Recipe 2: Editorial Marquee Social Proof

### Stack
- `marquee`

### Steps
1. Install component:
```bash
npx shadcn@latest add @magicui/marquee
```
2. Feed collection of customer reviews, publisher badges, or curated book authors.
3. Configure `pauseOnHover={true}` and `repeat={4}`.

---

## Recipe 3: Bento Grid Feature Showcase

### Stack
- `bento-grid` + `bento-card`
- `border-beam`

### Steps
1. Install:
```bash
npx shadcn@latest add @magicui/bento-grid @magicui/border-beam
```
2. Lay out 3-4 feature cards inside `<BentoGrid>`.
3. Add `<BorderBeam size={250} duration={12} delay={9} />` to highlight the primary featured card.
