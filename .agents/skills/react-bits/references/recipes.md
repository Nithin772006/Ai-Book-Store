# React Bits Recipes

## Recipe 1: Spotlight Book Card with Decrypted Badges

Enhance book cards with a gentle spotlight follow effect and animated secret edition badges:

```jsx
import { SpotlightCard } from '@/components/bits/SpotlightCard';
import { ShinyText } from '@/components/bits/ShinyText';

export function PremiumBookCard({ book }) {
  return (
    <SpotlightCard
      spotlightColor="rgba(32, 62, 51, 0.15)"
      className="bg-white border-border-light shadow-card hover:shadow-card-hover transition-all"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-md mb-4">
        <img src={book.cover_image} alt={book.title} className="w-full h-full object-cover" />
        {book.is_featured && (
          <div className="absolute top-2 left-2 px-2 py-1 bg-forest text-white rounded text-xs font-bold">
            <ShinyText text="Featured Title" speed={3} />
          </div>
        )}
      </div>
      <h3 className="font-serif text-lg font-bold text-text-primary">{book.title}</h3>
      <p className="text-sm text-text-secondary">by {book.author}</p>
    </SpotlightCard>
  );
}
```

---

## Recipe 2: Editorial Hero with SplitText Reveal

Make the bookstore hero headline gracefully cascade into view character-by-character:

```jsx
import { SplitText } from '@/components/bits/SplitText';

export function BookstoreHero() {
  return (
    <section className="text-center py-20 bg-canvas">
      <SplitText
        text="Where Human Inquiry Meets Artificial Intelligence"
        className="text-4xl md:text-6xl font-serif font-bold text-forest tracking-tight"
        delay={0.03}
      />
    </section>
  );
}
```
