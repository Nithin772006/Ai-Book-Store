# Motion Primitives Recipes

## Recipe 1: 3D Tilt Book Card with Dynamic Spotlight

Combine `Tilt` and `Spotlight` to give book cards physical weight and tactile depth:

```tsx
import { Tilt } from '@/components/core/tilt';
import { Spotlight } from '@/components/core/spotlight';

export function InteractiveBookCard({ book }) {
  return (
    <Tilt rotationFactor={6} isReversed={false} className="group relative rounded-xl border p-4 bg-white shadow-card">
      <Spotlight
        className="-top-40 left-0 md:left-60 md:-top-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        fill="#203E33"
      />
      <img src={book.cover_image} alt={book.title} className="rounded-lg shadow-book" />
      <h3 className="font-serif text-lg font-bold mt-3">{book.title}</h3>
      <p className="text-sm text-muted">{book.author}</p>
    </Tilt>
  );
}
```

---

## Recipe 2: Morphing Quick-View Book Modal

Allow a user to click a book card and have it morph smoothly into an expanded modal without page refresh:

```tsx
import {
  MorphingDialog,
  MorphingDialogTrigger,
  MorphingDialogContainer,
  MorphingDialogContent,
  MorphingDialogClose,
  MorphingDialogImage,
  MorphingDialogTitle,
  MorphingDialogSubtitle,
  MorphingDialogDescription,
} from '@/components/core/morphing-dialog';

export function QuickViewBook({ book }) {
  return (
    <MorphingDialog transition={{ type: 'spring', bounce: 0.1, duration: 0.5 }}>
      <MorphingDialogTrigger className="cursor-pointer">
        <MorphingDialogImage src={book.cover_image} alt={book.title} className="rounded-lg" />
        <MorphingDialogTitle>{book.title}</MorphingDialogTitle>
      </MorphingDialogTrigger>

      <MorphingDialogContainer>
        <MorphingDialogContent className="max-w-2xl bg-white p-6 rounded-2xl shadow-2xl">
          <div className="grid grid-cols-2 gap-6">
            <MorphingDialogImage src={book.cover_image} alt={book.title} className="rounded-xl" />
            <div>
              <MorphingDialogTitle className="text-2xl font-serif">{book.title}</MorphingDialogTitle>
              <MorphingDialogSubtitle className="text-muted">by {book.author}</MorphingDialogSubtitle>
              <MorphingDialogDescription className="mt-4 text-sm leading-relaxed">
                {book.description}
              </MorphingDialogDescription>
            </div>
          </div>
          <MorphingDialogClose className="absolute top-4 right-4" />
        </MorphingDialogContent>
      </MorphingDialogContainer>
    </MorphingDialog>
  );
}
```
