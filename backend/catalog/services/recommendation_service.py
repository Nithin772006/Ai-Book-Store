"""
AETHERIUM Book Recommendation Engine (Phase 8).
Provides deterministic, transparent, catalogue-grounded recommendation algorithms:
- Related books for a specific volume (content similarity: category, author, publisher).
- Personalized recommendations for authenticated customers (order history signals).
- Curated fallback recommendations for anonymous visitors or readers with new folios.
"""

from collections import Counter
from django.db.models import Q
from catalog.models import Book


def get_related_books(book, limit=4):
    """
    Computes related books for a given Book instance.
    Guarantees:
    - Excludes the current book.
    - Excludes inactive books and books with inactive categories.
    - Prioritizes books with matching category, author, and publisher.
    - Falls back to featured/bestseller titles in the same category or general catalogue.
    - Never returns duplicates.
    """
    if not book or not book.id:
        return []

    limit = max(1, min(int(limit), 12))

    base_qs = Book.objects.filter(
        is_active=True,
        category__is_active=True
    ).exclude(pk=book.pk).select_related('category')

    # 1. Primary candidate set: Same category or same author
    candidates = list(
        base_qs.filter(
            Q(category=book.category) | Q(author__iexact=book.author)
        ).distinct()[: limit * 3]
    )

    # 2. Score candidates deterministically
    def score_book(candidate):
        score = 0
        if candidate.category_id == book.category_id:
            score += 10
        if candidate.author and candidate.author.strip().lower() == book.author.strip().lower():
            score += 8
        if candidate.publisher and book.publisher and candidate.publisher.strip().lower() == book.publisher.strip().lower():
            score += 3
        if candidate.is_featured:
            score += 2
        if candidate.is_bestseller:
            score += 2
        if candidate.is_new_arrival:
            score += 1
        return score

    scored = sorted(candidates, key=lambda c: (score_book(c), c.created_at), reverse=True)
    results = scored[:limit]

    # 3. Fallback if not enough candidates found in category/author
    if len(results) < limit:
        existing_ids = {b.id for b in results}
        existing_ids.add(book.id)
        fillers = list(
            base_qs.exclude(pk__in=existing_ids)
            .order_by('-is_featured', '-is_bestseller', '-created_at')[: (limit - len(results))]
        )
        results.extend(fillers)

    return results


def get_personalized_recommendations(user=None, limit=8):
    """
    Generates personalized recommendations based on customer signals.
    - If user is authenticated and has purchase history, analyzes purchased categories & authors.
    - If user is anonymous or has no orders, returns curated catalogue highlights (bestsellers, featured, new arrivals).
    - Always excludes inactive books.
    - Returns tuple: (recommended_books_list, is_personalized_bool).
    """
    limit = max(1, min(int(limit), 20))

    base_qs = Book.objects.filter(
        is_active=True,
        category__is_active=True
    ).select_related('category')

    # Anonymous user or unauthenticated
    if not user or not user.is_authenticated:
        fallback_books = list(
            base_qs.order_by('-is_featured', '-is_bestseller', '-created_at')[:limit]
        )
        return fallback_books, False

    # Check order history for customer
    try:
        from orders.models import OrderItem
        order_items = list(
            OrderItem.objects.filter(
                order__customer=user,
                book__isnull=False
            ).select_related('book__category').order_by('-created_at')[:30]
        )
    except Exception:
        order_items = []

    # If no order history, return curated highlights
    if not order_items:
        fallback_books = list(
            base_qs.order_by('-is_featured', '-is_bestseller', '-created_at')[:limit]
        )
        return fallback_books, False

    # Extract purchased books, categories, and authors
    purchased_book_ids = {item.book_id for item in order_items if item.book_id}
    category_counts = Counter()
    author_counts = Counter()

    for item in order_items:
        if item.book:
            if item.book.category_id:
                category_counts[item.book.category_id] += 1
            if item.book.author:
                author_counts[item.book.author.strip().lower()] += 1

    top_category_ids = [cat_id for cat_id, _ in category_counts.most_common(3)]
    top_authors = [auth for auth, _ in author_counts.most_common(3)]

    # Fetch candidates matching user's reading taste (excluding already purchased volumes)
    candidate_qs = base_qs.exclude(pk__in=purchased_book_ids).filter(
        Q(category_id__in=top_category_ids) | Q(author__in=top_authors)
    )

    candidates = list(candidate_qs[: limit * 3])

    def score_personal_candidate(b):
        score = 0
        if b.category_id in top_category_ids:
            score += category_counts[b.category_id] * 5
        if b.author and b.author.strip().lower() in top_authors:
            score += author_counts[b.author.strip().lower()] * 6
        if b.is_featured:
            score += 2
        if b.is_bestseller:
            score += 2
        if b.is_new_arrival:
            score += 1
        return score

    scored = sorted(candidates, key=lambda c: (score_personal_candidate(c), c.created_at), reverse=True)
    results = scored[:limit]

    # If user has purchased nearly everything in their preferred genres, fill with general gems
    if len(results) < limit:
        existing_ids = {b.id for b in results} | purchased_book_ids
        fillers = list(
            base_qs.exclude(pk__in=existing_ids)
            .order_by('-is_featured', '-is_bestseller', '-created_at')[: (limit - len(results))]
        )
        results.extend(fillers)

    return results, True
