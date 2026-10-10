from rest_framework import filters


def parse_boolean(value):
    """
    Safely parse a query parameter string into a boolean.
    Returns True for truthy strings, False for falsy strings, or None if invalid/omitted.
    """
    if value is None:
        return None
    normalized = str(value).strip().lower()
    if normalized in ('true', '1', 'yes', 't'):
        return True
    if normalized in ('false', '0', 'no', 'f'):
        return False
    return None


class BookFilterBackend(filters.BaseFilterBackend):
    """
    Custom filter backend for catalogue books.
    Supports safe query parameters:
      - ?category=<slug>
      - ?featured=true/false
      - ?bestseller=true/false
      - ?new_arrival=true/false
      - ?in_stock=true/false
    Invalid or unparseable filter inputs are ignored gracefully without throwing errors.
    """

    def filter_queryset(self, request, queryset, view):
        params = request.query_params

        # Filter by category slug
        category_slug = params.get('category')
        if category_slug:
            category_slug = category_slug.strip()
            if category_slug:
                queryset = queryset.filter(category__slug=category_slug)

        # Filter by featured
        featured = parse_boolean(params.get('featured'))
        if featured is not None:
            queryset = queryset.filter(is_featured=featured)

        # Filter by bestseller
        bestseller = parse_boolean(params.get('bestseller'))
        if bestseller is not None:
            queryset = queryset.filter(is_bestseller=bestseller)

        # Filter by new arrival
        new_arrival = parse_boolean(params.get('new_arrival'))
        if new_arrival is not None:
            queryset = queryset.filter(is_new_arrival=new_arrival)

        # Filter by in-stock status
        in_stock = parse_boolean(params.get('in_stock'))
        if in_stock is True:
            queryset = queryset.filter(stock_quantity__gt=0)
        elif in_stock is False:
            queryset = queryset.filter(stock_quantity=0)

        return queryset
