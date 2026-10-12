import logging
from django.db.models import Count, Q
from django.http import Http404
from rest_framework import viewsets, permissions, filters, status
from rest_framework.views import APIView
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.decorators import action
from rest_framework.response import Response

import groq
from .models import Category, Book, BookSummary
from .serializers import CategorySerializer, BookSerializer
from .pagination import StandardResultsSetPagination
from .filters import BookFilterBackend
from .services.groq_service import (
    generate_book_summary,
    GroqConfigurationError,
    GroqServiceError,
)
from .services.recommendation_service import (
    get_related_books,
    get_personalized_recommendations,
)
from .services.assistant_service import (
    process_reading_assistant_chat,
)

logger = logging.getLogger(__name__)


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

    @action(detail=True, methods=['get'], url_path='related')
    def related(self, request, id=None):
        """
        GET /api/books/<id>/related/?limit=4
        Retrieves related books for the volume based on category, author, and publisher similarity.
        """
        book = self.get_object()
        limit_param = request.query_params.get('limit', 4)
        try:
            limit = int(limit_param)
        except (ValueError, TypeError):
            limit = 4
        related_books = get_related_books(book, limit=limit)
        serializer = self.get_serializer(related_books, many=True)
        return Response(serializer.data)


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


class BookAISummaryView(APIView):
    """
    POST /api/ai/books/<book_id>/summary/
    
    Generates or retrieves a cached AI synopsis for a specific book in AETHERIUM.
    - Grounded exclusively in the book's database record.
    - Caches responses using a SHA-256 fingerprint of book metadata.
    - Regenerates automatically if the book's metadata changes.
    - Enforces rate limiting and secure error reporting.
    """
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'ai_summary'

    def post(self, request, book_id, *args, **kwargs):
        # Validate book identifier and ensure active status
        try:
            numeric_id = int(book_id)
        except (ValueError, TypeError):
            return Response(
                {"error": "Invalid book identifier.", "code": "invalid_id"},
                status=status.HTTP_404_NOT_FOUND
            )

        try:
            book = Book.objects.select_related('category').get(pk=numeric_id, is_active=True)
        except Book.DoesNotExist:
            return Response(
                {"error": "Book not found or is currently inactive.", "code": "not_found"},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check existing cached summary
        current_fingerprint = book.get_source_fingerprint()
        cached_summary = BookSummary.objects.filter(book=book).first()

        if cached_summary and cached_summary.source_fingerprint == current_fingerprint and cached_summary.summary_text:
            return Response({
                "book_id": book.id,
                "title": book.title,
                "summary": cached_summary.summary_text,
                "cached": True,
                "model": cached_summary.model_name,
            }, status=status.HTTP_200_OK)

        # Generate summary via Groq service
        try:
            summary_text, model_name = generate_book_summary(book)
        except GroqConfigurationError as exc:
            return Response({
                "error": str(exc) or "The AI summary service is currently unconfigured on the server.",
                "code": "configuration_error"
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except groq.AuthenticationError:
            return Response({
                "error": "AI service provider credentials could not be authenticated. Please verify your GROQ_API_KEY.",
                "code": "authentication_error"
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except groq.PermissionDeniedError:
            return Response({
                "error": "Access to the AI service was denied. Please check your provider account permissions.",
                "code": "permission_denied"
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except groq.NotFoundError:
            return Response({
                "error": "The configured Groq model is not available for this account. Please verify GROQ_MODEL in backend/.env.",
                "code": "model_not_found"
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except groq.RateLimitError:
            return Response({
                "error": "The AI summary service is currently experiencing high demand. Please try again in a few moments.",
                "code": "rate_limited"
            }, status=status.HTTP_429_TOO_MANY_REQUESTS)
        except groq.APITimeoutError:
            return Response({
                "error": "The AI summary request timed out. Please retry in a moment.",
                "code": "timeout"
            }, status=status.HTTP_504_GATEWAY_TIMEOUT)
        except (groq.APIConnectionError, groq.GroqError, GroqServiceError) as exc:
            logger.warning("Groq provider failure during summary generation: %s", type(exc).__name__)
            return Response({
                "error": "Unable to communicate with the AI summary service. Please try again later.",
                "code": "provider_error"
            }, status=status.HTTP_502_BAD_GATEWAY)
        except Exception:
            logger.exception("Unexpected error occurred while generating AI summary for book %s", book.id)
            return Response({
                "error": "An internal error occurred while generating the summary.",
                "code": "internal_error"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Store generated summary in cache (never caches error states)
        BookSummary.objects.update_or_create(
            book=book,
            defaults={
                'summary_text': summary_text,
                'source_fingerprint': current_fingerprint,
                'model_name': model_name,
            }
        )

        return Response({
            "book_id": book.id,
            "title": book.title,
            "summary": summary_text,
            "cached": False,
            "model": model_name,
        }, status=status.HTTP_200_OK)


class BookRecommendationsView(APIView):
    """
    GET /api/recommendations/?limit=8
    
    Returns personalized recommendations if the reader is authenticated and has
    purchase history, or curated catalogue highlights (bestsellers, featured, new arrivals)
    for anonymous visitors or new readers.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, *args, **kwargs):
        limit_param = request.query_params.get('limit', 8)
        try:
            limit = int(limit_param)
        except (ValueError, TypeError):
            limit = 8

        limit = max(1, min(limit, 24))

        recommended_books, is_personalized = get_personalized_recommendations(
            user=request.user,
            limit=limit
        )

        serializer = BookSerializer(recommended_books, many=True, context={'request': request})
        return Response({
            "results": serializer.data,
            "count": len(serializer.data),
            "personalized": is_personalized,
        }, status=status.HTTP_200_OK)


class AIReadingAssistantView(APIView):
    """
    POST /api/ai/reading-assistant/
    
    Interactive literary reading assistant for AETHERIUM powered by Groq.
    - Answering questions about specific books.
    - Recommending books grounded strictly in actual catalogue records.
    - Explaining literary terminology and themes.
    - Handling bounded multi-turn conversation history.
    """
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'ai_assistant'

    def post(self, request, *args, **kwargs):
        message = request.data.get('message', '')
        book_id = request.data.get('book_id', None)
        history = request.data.get('history', [])

        if not message or not isinstance(message, str) or not message.strip():
            return Response(
                {"error": "Please provide a valid question or message for the assistant.", "code": "empty_message"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if len(message) > 1000:
            return Response(
                {"error": "Message is too long. Please keep queries under 1,000 characters.", "code": "message_too_long"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            result = process_reading_assistant_chat(
                message=message,
                book_id=book_id,
                history=history,
                request=request
            )
            return Response(result, status=status.HTTP_200_OK)
        except ValueError as err:
            return Response(
                {"error": str(err), "code": "validation_error"},
                status=status.HTTP_400_BAD_REQUEST
            )
        except GroqConfigurationError as exc:
            return Response({
                "error": str(exc) or "The AI Reading Assistant is currently unconfigured on the server.",
                "code": "configuration_error"
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except groq.AuthenticationError:
            return Response({
                "error": "AI service provider credentials could not be authenticated. Please verify your GROQ_API_KEY.",
                "code": "authentication_error"
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except groq.PermissionDeniedError:
            return Response({
                "error": "Access to the Reading Assistant was denied. Please check your provider account permissions.",
                "code": "permission_denied"
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except groq.NotFoundError:
            return Response({
                "error": "The configured Groq model is not available for this account. Please verify GROQ_MODEL in backend/.env.",
                "code": "model_not_found"
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except groq.RateLimitError:
            return Response({
                "error": "The Reading Assistant is experiencing high demand. Please try again in a few moments.",
                "code": "rate_limited"
            }, status=status.HTTP_429_TOO_MANY_REQUESTS)
        except groq.APITimeoutError:
            return Response({
                "error": "The Reading Assistant request timed out. Please retry in a moment.",
                "code": "timeout"
            }, status=status.HTTP_504_GATEWAY_TIMEOUT)
        except (groq.APIConnectionError, groq.GroqError, GroqServiceError) as exc:
            logger.warning("Groq provider failure in Reading Assistant: %s", type(exc).__name__)
            return Response({
                "error": "Unable to communicate with the Reading Assistant service. Please try again later.",
                "code": "provider_error"
            }, status=status.HTTP_502_BAD_GATEWAY)
        except Exception:
            logger.exception("Unexpected error in Reading Assistant")
            return Response({
                "error": "An internal error occurred while processing your request.",
                "code": "internal_error"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
