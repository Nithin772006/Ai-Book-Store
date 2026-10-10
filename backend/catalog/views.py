from django.db.models import Count, Q
from django.http import Http404
from rest_framework import viewsets, permissions, filters
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Category, Book
from .serializers import CategorySerializer, BookSerializer
from .pagination import StandardResultsSetPagination
from .filters import BookFilterBackend


class BookViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Public read-only viewset for Book catalogue.
    Endpoints:
      - GET /api/books/          : List active books with search, filters, sorting, and pagination
      - GET /api/books/<id>/     : Retrieve single active book
    """
    serializer_class = BookSerializer
    pagination_class = StandardResultsSetPagination
    permission_classes = [permissions.AllowAny]
    lookup_field = 'id'

    filter_backends = [BookFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['title', 'author', 'description', 'isbn']
    ordering_fields = ['price', 'title', 'created_at']
    ordering = ['-created_at']

    def get_queryset(self):
        """
        Only return active books whose category is also active.
        Use select_related on category to avoid N+1 query overhead.
        """
        return Book.objects.filter(
            is_active=True,
            category__is_active=True
        ).select_related('category')

    def get_object(self):
        """
        Safely retrieve book by ID, handling non-numeric ID with a 404 response.
        """
        lookup_val = self.kwargs.get(self.lookup_field)
        if lookup_val is not None and not str(lookup_val).isdigit():
            raise Http404("Book not found")
        return super().get_object()


class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Public read-only viewset for Category catalogue.
    Endpoints:
      - GET /api/categories/             : List active categories with active books count
      - GET /api/categories/<slug>/      : Retrieve single active category by slug
      - GET /api/categories/<slug>/books/: List active books in this category (paginated)
    """
    serializer_class = CategorySerializer
    pagination_class = None  # Return all active categories for easy menu/chip rendering
    permission_classes = [permissions.AllowAny]
    lookup_field = 'slug'

    def get_queryset(self):
        """
        Only return active categories, annotated with their active book count.
        """
        return Category.objects.filter(is_active=True).annotate(
            books_count=Count('books', filter=Q(books__is_active=True))
        ).order_by('name')

    @action(detail=True, methods=['get'], url_path='books')
    def books(self, request, slug=None):
        """
        Retrieve paginated list of active books within the specified category.
        Supports search, filtering (?in_stock=true), and sorting (?ordering=price).
        Returns 404 if category does not exist or is inactive.
        """
        category = self.get_object()  # Raises 404 if category is inactive or missing

        queryset = Book.objects.filter(
            category=category,
            is_active=True
        ).select_related('category')

        # Apply standard catalogue filters (search, ordering, stock, etc.)
        filter_backend = BookFilterBackend()
        queryset = filter_backend.filter_queryset(request, queryset, self)

        search_filter = filters.SearchFilter()
        search_filter.search_fields = ['title', 'author', 'description', 'isbn']
        queryset = search_filter.filter_queryset(request, queryset, self)

        ordering_filter = filters.OrderingFilter()
        ordering_filter.ordering_fields = ['price', 'title', 'created_at']
        ordering_filter.ordering = ['-created_at']
        queryset = ordering_filter.filter_queryset(request, queryset, self)

        # Apply pagination
        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        if page is not None:
            serializer = BookSerializer(page, many=True, context={'request': request})
            return paginator.get_paginated_response(serializer.data)

        serializer = BookSerializer(queryset, many=True, context={'request': request})
        return Response(serializer.data)
