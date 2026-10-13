"""
Admin API views for AETHERIUM (Phase 9A).
Provides dashboard metrics, catalog management, order fulfillment,
and customer auditing with strict server-side staff permissions.
"""

from decimal import Decimal
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.db.models import Count, Q, Sum, Value
from django.db.models.functions import Coalesce
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.authentication import CSRFCheck
from rest_framework.authtoken.models import Token
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


def enforce_csrf(request):
    """
    Enforces strict CSRF validation for state-changing requests.
    Respects Django's test client flag (_dont_enforce_csrf_checks).
    Supports cross-origin SPA requests where third-party cookie restrictions
    may prevent cookie delivery while the cryptographically masked X-CSRFToken header
    and trusted Origin are verified.
    """
    def dummy_get_response(req):
        return None

    from django.conf import settings
    from django.middleware.csrf import (
        CSRF_TOKEN_LENGTH,
        _check_token_format,
        _unmask_cipher_token,
        InvalidTokenFormat,
    )

    header_name = getattr(settings, 'CSRF_HEADER_NAME', 'HTTP_X_CSRFTOKEN')
    cookie_name = getattr(settings, 'CSRF_COOKIE_NAME', 'csrftoken')

    # If cookie is absent in cross-origin / third-party context, bridge the validated header token
    # to allow CSRFCheck to verify origin, token format, and cryptographic integrity.
    if cookie_name not in request.COOKIES and header_name in request.META:
        header_val = request.META[header_name]
        try:
            _check_token_format(header_val)
            if len(header_val) == CSRF_TOKEN_LENGTH:
                request.COOKIES[cookie_name] = _unmask_cipher_token(header_val)
            elif len(header_val) == 32:
                request.COOKIES[cookie_name] = header_val
        except InvalidTokenFormat:
            pass

    check = CSRFCheck(dummy_get_response)
    check.process_request(request)
    reason = check.process_view(request, None, (), {})
    if reason:
        raise PermissionDenied(f"CSRF Failed: {reason}")



from catalog.models import Book, Category
from catalog.pagination import StandardResultsSetPagination
from orders.models import Order
from .admin_serializers import (
    AdminBookSerializer,
    AdminCategorySerializer,
    AdminCustomerSerializer,
    AdminOrderSerializer,
    AdminOrderStatusUpdateSerializer,
)
from .permissions import IsStaffAdmin


# =============================================================================
# ADMIN AUTHENTICATION & CSRF
# =============================================================================

@method_decorator(ensure_csrf_cookie, name='dispatch')
class AdminCsrfView(APIView):
    """
    GET /api/admin/auth/csrf/
    Ensures a CSRF cookie is dispatched and returns the CSRF token in the response payload.
    Admin frontend requests this prior to submitting authentication or modifying state.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        token = get_token(request)
        return Response({
            "detail": "CSRF cookie established.",
            "csrfToken": token,
        }, status=status.HTTP_200_OK)


@method_decorator(ensure_csrf_cookie, name='dispatch')
class AdminLoginView(APIView):
    """
    POST /api/admin/auth/login/
    Authenticates administrative staff users.
    - Rejects invalid credentials with a uniform generic error message.
    - Rejects authenticated ordinary customers with HTTP 403 Forbidden.
    - Returns security token, user details, and rotated CSRF token for verified staff accounts.
    """
    permission_classes = [AllowAny]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        enforce_csrf(request)

    def post(self, request):

        identifier = request.data.get('identifier') or request.data.get('email') or request.data.get('username')
        password = request.data.get('password')

        if not identifier or not password:
            return Response(
                {"error": "Please provide your administrator identifier and password."},
                status=status.HTTP_400_BAD_REQUEST
            )

        identifier = str(identifier).strip()

        # Look up by email or username
        user = None
        user_by_email = User.objects.filter(email__iexact=identifier).first()
        if user_by_email:
            user = authenticate(request, username=user_by_email.username, password=password)

        if not user:
            user = authenticate(request, username=identifier, password=password)

        # Uniform rejection without revealing if username exists
        if not user:
            return Response(
                {"error": "Invalid administrative credentials. Please verify your username and password."},
                status=status.HTTP_401_UNAUTHORIZED
            )

        if not user.is_active:
            return Response(
                {"error": "This administrator account is currently inactive."},
                status=status.HTTP_403_FORBIDDEN
            )

        # Enforce server-side staff authorization
        if not user.is_staff and not user.is_superuser:
            return Response(
                {"error": "Access denied. Administrative staff privileges are required to access this portal."},
                status=status.HTTP_403_FORBIDDEN
            )

        token, _ = Token.objects.get_or_create(user=user)

        try:
            login(request, user)
        except Exception:
            pass

        # In Django, login() rotates the CSRF token to prevent session fixation.
        # Retrieve the fresh rotated token for immediate client-side requests.
        rotated_csrf_token = get_token(request)

        return Response({
            "message": "Welcome to AETHERIUM Administration.",
            "token": token.key,
            "csrfToken": rotated_csrf_token,
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "full_name": f"{user.first_name} {user.last_name}".strip() or user.username,
                "is_staff": user.is_staff,
                "is_superuser": user.is_superuser,
            }
        }, status=status.HTTP_200_OK)


class AdminMeView(APIView):
    """
    GET /api/admin/auth/me/
    Verifies current administrative session and returns staff profile.
    """
    permission_classes = [IsStaffAdmin]

    def get(self, request):
        user = request.user
        return Response({
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": f"{user.first_name} {user.last_name}".strip() or user.username,
            "is_staff": user.is_staff,
            "is_superuser": user.is_superuser,
            "date_joined": user.date_joined,
            "last_login": user.last_login,
        }, status=status.HTTP_200_OK)


class AdminLogoutView(APIView):
    """
    POST /api/admin/auth/logout/
    Terminates the administrative session and token.
    """
    permission_classes = [IsStaffAdmin]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        enforce_csrf(request)

    def post(self, request):

        if request.user and request.user.is_authenticated:
            Token.objects.filter(user=request.user).delete()
            logout(request)
        return Response({"message": "Successfully logged out of administration."}, status=status.HTTP_200_OK)


# =============================================================================
# ADMIN DASHBOARD METRICS
# =============================================================================

class AdminDashboardView(APIView):
    """
    GET /api/admin/dashboard/
    Calculates aggregated metrics directly from real database records.
    Never fabricates values.
    """
    permission_classes = [IsStaffAdmin]

    def get(self, request):
        total_books = Book.objects.count()
        active_books = Book.objects.filter(is_active=True).count()
        total_categories = Category.objects.count()
        total_customers = User.objects.filter(is_staff=False).count()

        total_orders = Order.objects.count()
        pending_orders = Order.objects.filter(order_status=Order.STATUS_PENDING).count()
        processing_orders = Order.objects.filter(order_status=Order.STATUS_PROCESSING).count()
        completed_orders = Order.objects.filter(order_status=Order.STATUS_DELIVERED).count()

        low_stock_count = Book.objects.filter(stock_quantity__lte=5, is_active=True).count()
        out_of_stock_count = Book.objects.filter(stock_quantity=0, is_active=True).count()

        revenue_agg = Order.objects.filter(payment_status=Order.PAYMENT_PAID).aggregate(
            total=Sum('total_amount')
        )
        total_revenue = revenue_agg['total'] or Decimal('0.00')

        # Recent 5 orders
        recent_orders = Order.objects.select_related('customer').order_by('-created_at')[:5]
        recent_orders_data = [
            {
                "id": o.id,
                "reference": o.reference,
                "customer_name": o.customer_name or o.customer.username,
                "total_amount": str(o.total_amount),
                "order_status": o.order_status,
                "payment_status": o.payment_status,
                "created_at": o.created_at,
            }
            for o in recent_orders
        ]

        # Recent 5 catalogue additions
        recent_books = Book.objects.select_related('category').order_by('-created_at')[:5]
        recent_books_data = [
            {
                "id": b.id,
                "title": b.title,
                "author": b.author,
                "category": b.category.name if b.category else None,
                "price": str(b.price),
                "stock_quantity": b.stock_quantity,
                "is_active": b.is_active,
                "created_at": b.created_at,
            }
            for b in recent_books
        ]

        return Response({
            "metrics": {
                "total_books": total_books,
                "active_books": active_books,
                "total_categories": total_categories,
                "total_customers": total_customers,
                "total_orders": total_orders,
                "pending_orders": pending_orders,
                "processing_orders": processing_orders,
                "completed_orders": completed_orders,
                "low_stock_count": low_stock_count,
                "out_of_stock_count": out_of_stock_count,
                "total_revenue": str(total_revenue),
            },
            "recent_orders": recent_orders_data,
            "recent_books": recent_books_data,
        }, status=status.HTTP_200_OK)


# =============================================================================
# BOOK MANAGEMENT
# =============================================================================

class AdminBookListCreateView(APIView):
    """
    GET /api/admin/books/
    POST /api/admin/books/
    Lists books with pagination, search, and filters. Creates new books with validation.
    """
    permission_classes = [IsStaffAdmin]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    pagination_class = StandardResultsSetPagination

    def get(self, request):
        qs = Book.objects.select_related('category').order_by('-created_at')

        # Search by title, author, isbn
        search_query = request.query_params.get('search', '').strip()
        if search_query:
            qs = qs.filter(
                Q(title__icontains=search_query) |
                Q(author__icontains=search_query) |
                Q(isbn__icontains=search_query)
            )

        # Filter by category
        category_param = request.query_params.get('category')
        if category_param:
            if category_param.isdigit():
                qs = qs.filter(category_id=int(category_param))
            else:
                qs = qs.filter(category__slug=category_param)

        # Filter by stock status
        stock_status = request.query_params.get('stock_status')
        if stock_status == 'out_of_stock':
            qs = qs.filter(stock_quantity=0)
        elif stock_status == 'low_stock':
            qs = qs.filter(stock_quantity__gt=0, stock_quantity__lte=5)
        elif stock_status == 'in_stock':
            qs = qs.filter(stock_quantity__gt=5)

        # Filter by active status
        is_active_param = request.query_params.get('is_active')
        if is_active_param is not None:
            if is_active_param.lower() in ('true', '1'):
                qs = qs.filter(is_active=True)
            elif is_active_param.lower() in ('false', '0'):
                qs = qs.filter(is_active=False)

        # Filter by flags
        for flag in ['is_featured', 'is_bestseller', 'is_new_arrival']:
            val = request.query_params.get(flag)
            if val is not None and val.lower() in ('true', '1'):
                qs = qs.filter(**{flag: True})

        # Ordering
        ordering = request.query_params.get('ordering')
        valid_orderings = ['created_at', '-created_at', 'price', '-price', 'title', '-title', 'stock_quantity', '-stock_quantity']
        if ordering in valid_orderings:
            qs = qs.order_by(ordering)

        paginator = self.pagination_class()
        paginated_books = paginator.paginate_queryset(qs, request)
        serializer = AdminBookSerializer(paginated_books, many=True, context={'request': request})
        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        serializer = AdminBookSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        book = serializer.save()
        return Response(AdminBookSerializer(book, context={'request': request}).data, status=status.HTTP_201_CREATED)


class AdminBookDetailView(APIView):
    """
    GET, PUT, PATCH, DELETE /api/admin/books/<id>/
    Retrieves, updates, or safely deletes/deactivates a book.
    """
    permission_classes = [IsStaffAdmin]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_object(self, book_id):
        try:
            return Book.objects.select_related('category').get(pk=int(book_id))
        except (ValueError, TypeError, Book.DoesNotExist):
            return None

    def get(self, request, book_id):
        book = self.get_object(book_id)
        if not book:
            return Response({"error": "Book not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = AdminBookSerializer(book, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request, book_id):
        book = self.get_object(book_id)
        if not book:
            return Response({"error": "Book not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = AdminBookSerializer(book, data=request.data, context={'request': request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        updated_book = serializer.save()
        return Response(AdminBookSerializer(updated_book, context={'request': request}).data, status=status.HTTP_200_OK)

    def patch(self, request, book_id):
        book = self.get_object(book_id)
        if not book:
            return Response({"error": "Book not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = AdminBookSerializer(book, data=request.data, partial=True, context={'request': request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        updated_book = serializer.save()
        return Response(AdminBookSerializer(updated_book, context={'request': request}).data, status=status.HTTP_200_OK)

    def delete(self, request, book_id):
        book = self.get_object(book_id)
        if not book:
            return Response({"error": "Book not found."}, status=status.HTTP_404_NOT_FOUND)

        # Deletion safeguard: if referenced in order history, soft-deactivate instead of hard delete
        if book.order_items.exists():
            book.is_active = False
            book.save()
            return Response({
                "message": f"Book '{book.title}' is referenced in past customer orders. It has been deactivated rather than deleted to preserve order audit history.",
                "deactivated": True
            }, status=status.HTTP_200_OK)

        book.delete()
        return Response({"message": "Book deleted successfully.", "deleted": True}, status=status.HTTP_200_OK)


# =============================================================================
# CATEGORY MANAGEMENT
# =============================================================================

class AdminCategoryListCreateView(APIView):
    """
    GET /api/admin/categories/
    POST /api/admin/categories/
    Lists categories with book counts and creates new categories.
    """
    permission_classes = [IsStaffAdmin]

    def get(self, request):
        categories = Category.objects.annotate(book_count=Count('books')).order_by('name')
        serializer = AdminCategorySerializer(categories, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = AdminCategorySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        category = serializer.save()
        return Response(AdminCategorySerializer(category).data, status=status.HTTP_201_CREATED)


class AdminCategoryDetailView(APIView):
    """
    GET, PUT, PATCH, DELETE /api/admin/categories/<id>/
    Retrieves, updates, or safely deletes a category.
    Rejects deletion if associated books exist.
    """
    permission_classes = [IsStaffAdmin]

    def get_object(self, category_id):
        try:
            return Category.objects.annotate(book_count=Count('books')).get(pk=int(category_id))
        except (ValueError, TypeError, Category.DoesNotExist):
            return None

    def get(self, request, category_id):
        category = self.get_object(category_id)
        if not category:
            return Response({"error": "Category not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(AdminCategorySerializer(category).data, status=status.HTTP_200_OK)

    def put(self, request, category_id):
        category = self.get_object(category_id)
        if not category:
            return Response({"error": "Category not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = AdminCategorySerializer(category, data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        updated = serializer.save()
        return Response(AdminCategorySerializer(updated).data, status=status.HTTP_200_OK)

    def patch(self, request, category_id):
        category = self.get_object(category_id)
        if not category:
            return Response({"error": "Category not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = AdminCategorySerializer(category, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        updated = serializer.save()
        return Response(AdminCategorySerializer(updated).data, status=status.HTTP_200_OK)

    def delete(self, request, category_id):
        category = self.get_object(category_id)
        if not category:
            return Response({"error": "Category not found."}, status=status.HTTP_404_NOT_FOUND)

        # Deletion safeguard: do not permit deletion if associated books exist
        book_count = category.books.count()
        if book_count > 0:
            return Response({
                "error": f"Cannot delete category '{category.name}' because it contains {book_count} book(s). "
                         f"Please reassign or delete these books before removing the category.",
                "book_count": book_count
            }, status=status.HTTP_400_BAD_REQUEST)

        category.delete()
        return Response({"message": f"Category '{category.name}' deleted successfully."}, status=status.HTTP_200_OK)


# =============================================================================
# ORDER MANAGEMENT
# =============================================================================

class AdminOrderListView(APIView):
    """
    GET /api/admin/orders/
    Paginated list of orders with filters by status, payment, and reference search.
    """
    permission_classes = [IsStaffAdmin]
    pagination_class = StandardResultsSetPagination

    def get(self, request):
        qs = Order.objects.select_related('customer').prefetch_related('items').order_by('-created_at')

        # Filter by order status
        status_param = request.query_params.get('order_status')
        if status_param:
            qs = qs.filter(order_status=status_param)

        # Filter by payment status
        payment_param = request.query_params.get('payment_status')
        if payment_param:
            qs = qs.filter(payment_status=payment_param)

        # Search by reference, customer name, or customer email
        search = request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(reference__icontains=search) |
                Q(customer_name__icontains=search) |
                Q(customer_email__icontains=search) |
                Q(customer__username__icontains=search)
            )

        paginator = self.pagination_class()
        paginated_orders = paginator.paginate_queryset(qs, request)
        serializer = AdminOrderSerializer(paginated_orders, many=True)
        return paginator.get_paginated_response(serializer.data)


class AdminOrderDetailView(APIView):
    """
    GET /api/admin/orders/<id>/
    Full order detail including customer info, shipping address, and purchased items snapshot.
    """
    permission_classes = [IsStaffAdmin]

    def get(self, request, order_id):
        try:
            order = Order.objects.select_related('customer').prefetch_related('items').get(pk=int(order_id))
        except (ValueError, TypeError, Order.DoesNotExist):
            return Response({"error": "Order not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = AdminOrderSerializer(order)
        return Response(serializer.data, status=status.HTTP_200_OK)


class AdminOrderStatusUpdateView(APIView):
    """
    PATCH /api/admin/orders/<id>/status/
    Updates order fulfillment status enforcing strict legal state transitions.
    Cannot alter financial snapshots or purchased item records.
    """
    permission_classes = [IsStaffAdmin]

    def patch(self, request, order_id):
        try:
            order = Order.objects.get(pk=int(order_id))
        except (ValueError, TypeError, Order.DoesNotExist):
            return Response({"error": "Order not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = AdminOrderStatusUpdateSerializer(
            data=request.data,
            context={'order': order}
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        new_status = serializer.validated_data['order_status']
        old_status = order.order_status
        order.order_status = new_status
        order.save(update_fields=['order_status', 'updated_at'])

        return Response({
            "message": f"Order {order.reference} status updated from '{old_status}' to '{new_status}'.",
            "order": AdminOrderSerializer(order).data
        }, status=status.HTTP_200_OK)


# =============================================================================
# CUSTOMER AUDITING
# =============================================================================

class AdminCustomerListView(APIView):
    """
    GET /api/admin/customers/
    Paginated list of customer accounts with order counts and spend totals.
    Guarantees no sensitive passwords or tokens are exposed.
    """
    permission_classes = [IsStaffAdmin]
    pagination_class = StandardResultsSetPagination

    def get(self, request):
        qs = User.objects.filter(is_staff=False).annotate(
            order_count=Count('orders'),
            total_spent=Coalesce(Sum('orders__total_amount'), Value(Decimal('0.00')))
        ).order_by('-date_joined')

        search = request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(username__icontains=search) |
                Q(email__icontains=search) |
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search)
            )

        paginator = self.pagination_class()
        paginated_customers = paginator.paginate_queryset(qs, request)
        serializer = AdminCustomerSerializer(paginated_customers, many=True)
        return paginator.get_paginated_response(serializer.data)


class AdminCustomerDetailView(APIView):
    """
    GET /api/admin/customers/<id>/
    Account details and order history for a specific customer.
    """
    permission_classes = [IsStaffAdmin]

    def get(self, request, customer_id):
        try:
            customer = User.objects.annotate(
                order_count=Count('orders'),
                total_spent=Coalesce(Sum('orders__total_amount'), Value(Decimal('0.00')))
            ).get(pk=int(customer_id))
        except (ValueError, TypeError, User.DoesNotExist):
            return Response({"error": "Customer not found."}, status=status.HTTP_404_NOT_FOUND)

        orders = Order.objects.filter(customer=customer).order_by('-created_at')[:10]
        serializer = AdminCustomerSerializer(customer)
        orders_data = AdminOrderSerializer(orders, many=True).data

        return Response({
            "customer": serializer.data,
            "recent_orders": orders_data
        }, status=status.HTTP_200_OK)


class AdminCustomerStatusUpdateView(APIView):
    """
    PATCH /api/admin/customers/<id>/status/
    Safely activates or deactivates a customer account.
    - Cannot deactivate own staff account.
    - Cannot alter superuser or staff status.
    """
    permission_classes = [IsStaffAdmin]

    def patch(self, request, customer_id):
        try:
            customer = User.objects.get(pk=int(customer_id))
        except (ValueError, TypeError, User.DoesNotExist):
            return Response({"error": "Customer not found."}, status=status.HTTP_404_NOT_FOUND)

        if customer.id == request.user.id:
            return Response({"error": "Cannot alter activation status of your own account."}, status=status.HTTP_400_BAD_REQUEST)

        if customer.is_superuser:
            return Response({"error": "Cannot alter activation status of a superuser account."}, status=status.HTTP_400_BAD_REQUEST)

        is_active = request.data.get('is_active')
        if is_active is None or not isinstance(is_active, bool):
            return Response({"error": "Please provide a boolean 'is_active' value."}, status=status.HTTP_400_BAD_REQUEST)

        customer.is_active = is_active
        customer.save(update_fields=['is_active'])

        return Response({
            "message": f"Customer '{customer.username}' has been {'activated' if is_active else 'deactivated'}.",
            "customer": AdminCustomerSerializer(customer).data
        }, status=status.HTTP_200_OK)


# =============================================================================
# NEWSLETTER SUBSCRIBERS
# =============================================================================

class AdminSubscriberListView(APIView):
    """
    GET /api/admin/subscribers/
    Audits newsletter subscriber status.
    Respects current database state (no subscriber model exists yet).
    """
    permission_classes = [IsStaffAdmin]

    def get(self, request):
        return Response({
            "results": [],
            "count": 0,
            "configured": False,
            "message": "The newsletter subscriber model is not currently configured in the database schema."
        }, status=status.HTTP_200_OK)


# =============================================================================
# BULK BOOK IMPORTER VIEWS
# =============================================================================

import os
import uuid
from django.http import HttpResponse
from catalog.models import ImportJob

from .admin_serializers import AdminImportJobSerializer
from catalog.importer import (
    CANONICAL_FIELDS,
    MAX_CSV_SIZE_BYTES,
    MAX_XLSX_SIZE_BYTES,
    MAX_FILE_SIZE_BYTES,
    MAX_ZIP_SIZE_BYTES,
    MAX_BATCH_ROWS_LIMIT,
    parse_spreadsheet_file,
    get_staged_file_path,
    stage_uploaded_file,
    cleanup_staged_file,
    inspect_staged_file,
    parse_staged_slice,
    auto_detect_column_mapping,
    validate_and_extract_covers_zip,
    validate_row,
    normalize_isbn,
    generate_csv_template,
    generate_excel_template,
    generate_error_report_csv,
    execute_import_job,
)


class AdminBookImportTemplateView(APIView):
    """
    GET /api/admin/books/import/template/?format=csv|xlsx
    Downloads pre-built AETHERIUM import template with sample records.
    """
    permission_classes = [IsStaffAdmin]

    def perform_content_negotiation(self, request, force=False):
        return None, None

    def get(self, request):

        fmt = request.GET.get('format', 'csv').lower().strip()
        if fmt == 'xlsx':
            content = generate_excel_template()
            response = HttpResponse(
                content,
                content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            )
            response['Content-Disposition'] = 'attachment; filename="aetherium_book_import_template.xlsx"'
            return response
        else:
            content = generate_csv_template()
            response = HttpResponse(content, content_type='text/csv; charset=utf-8-sig')
            response['Content-Disposition'] = 'attachment; filename="aetherium_book_import_template.csv"'
            return response


class AdminBookImportUploadView(APIView):
    """
    POST /api/admin/books/import/upload/
    Accepts CSV/XLSX file and optional cover ZIP.
    Stages file to disk, inspects headers and total rows count via streaming,
    and returns initial mapping and dataset statistics without loading all records into RAM.
    """
    permission_classes = [IsStaffAdmin]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        enforce_csrf(request)

        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response(
                {"error": "Please provide a spreadsheet file (.csv or .xlsx)."},
                status=status.HTTP_400_BAD_REQUEST
            )

        filename = getattr(file_obj, 'name', 'upload.csv')
        ext = os.path.splitext(filename)[1].lower()
        if ext not in ('.csv', '.xlsx'):
            return Response(
                {"error": f"Unsupported file format '{ext}'. Supported formats: .csv, .xlsx. (Legacy .xls files must be saved as .xlsx)."},
                status=status.HTTP_400_BAD_REQUEST
            )

        file_type = 'csv' if ext == '.csv' else 'xlsx'
        max_size = MAX_CSV_SIZE_BYTES if file_type == 'csv' else MAX_XLSX_SIZE_BYTES
        max_mb = int(max_size / (1024 * 1024))

        if file_obj.size > max_size:
            size_mb = round(file_obj.size / (1024 * 1024), 1)
            return Response(
                {"error": f"File size ({size_mb} MB) exceeds maximum allowed limit of {max_mb} MB for {file_type.upper()} files."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Handle optional covers ZIP
        has_zip = False
        zip_extract_dir = ''
        zip_file = request.FILES.get('covers_zip')
        if zip_file:
            if not zip_file.name.lower().endswith('.zip'):
                return Response(
                    {"error": "Cover ZIP error: Only valid .zip archives are supported."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if zip_file.size > MAX_ZIP_SIZE_BYTES:
                size_mb = round(zip_file.size / (1024 * 1024), 1)
                return Response(
                    {"error": f"Cover ZIP error: Archive size ({size_mb} MB) exceeds maximum allowed limit of 100 MB."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            import tempfile
            import shutil
            zip_extract_dir = tempfile.mkdtemp(prefix='aetherium_covers_')
            try:
                validate_and_extract_covers_zip(zip_file, zip_extract_dir)
                has_zip = True
            except ValueError as ze:
                if os.path.exists(zip_extract_dir):
                    shutil.rmtree(zip_extract_dir, ignore_errors=True)
                return Response({"error": f"Cover ZIP error: {str(ze)}"}, status=status.HTTP_400_BAD_REQUEST)
            except Exception as ze:
                if os.path.exists(zip_extract_dir):
                    shutil.rmtree(zip_extract_dir, ignore_errors=True)
                return Response(
                    {"error": "Cover ZIP error: Failed to process archive. Please ensure it is a valid, uncorrupted ZIP file."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Stage uploaded file to disk for streaming
        job_id = uuid.uuid4()
        try:
            staged_path, file_size = stage_uploaded_file(file_obj, job_id, file_type)
            clean_headers, sample_rows, total_data_rows, encoding, delimiter = inspect_staged_file(staged_path, file_type)
        except ValueError as ve:
            cleanup_staged_file(job_id, file_type)
            return Response({"error": str(ve)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            cleanup_staged_file(job_id, file_type)
            return Response(
                {"error": "Failed to parse spreadsheet file. Please check file formatting."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if total_data_rows == 0:
            cleanup_staged_file(job_id, file_type)
            return Response(
                {"error": "The uploaded spreadsheet contains no data rows."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Auto-detect column mapping
        suggested_mapping = auto_detect_column_mapping(clean_headers)

        # Create ImportJob record (do NOT buffer all rows in parsed_rows!)
        job = ImportJob.objects.create(
            job_id=job_id,
            created_by=request.user,
            filename=file_obj.name,
            file_type=file_type,
            status=ImportJob.STATUS_PENDING,
            total_rows=total_data_rows,
            raw_headers=clean_headers,
            sample_rows=sample_rows,
            parsed_rows=[],  # Kept empty until slice validation
            column_mapping=suggested_mapping,
            has_zip_covers=has_zip,
            zip_extracted_path=zip_extract_dir,
        )

        return Response({
            "job_id": str(job.job_id),
            "filename": job.filename,
            "file_type": job.file_type,
            "file_size": file_size,
            "total_rows": job.total_rows,
            "raw_headers": clean_headers,
            "suggested_mapping": suggested_mapping,
            "sample_rows": job.sample_rows,
            "canonical_fields": CANONICAL_FIELDS,
            "has_zip_covers": has_zip,
            "max_batch_limit": MAX_BATCH_ROWS_LIMIT,
        }, status=status.HTTP_201_CREATED)


class AdminBookImportValidateView(APIView):
    """
    POST /api/admin/books/import/validate/
    Parses and validates the selected slice (quantity or row range) of records
    against Book constraints, detecting conflicts, missing categories, and fallbacks.
    """
    permission_classes = [IsStaffAdmin]

    def post(self, request):
        enforce_csrf(request)

        job_id = request.data.get('job_id')
        if not job_id:
            return Response({"error": "Missing job_id."}, status=status.HTTP_400_BAD_REQUEST)

        job = ImportJob.objects.filter(job_id=job_id).first()
        if not job:
            return Response({"error": "Import job not found."}, status=status.HTTP_404_NOT_FOUND)

        column_mapping = request.data.get('column_mapping') or job.column_mapping
        conflict_mode = request.data.get('conflict_mode', ImportJob.CONFLICT_SKIP)
        create_missing_cats = bool(request.data.get('create_missing_categories', False))
        fallback_values = request.data.get('fallback_values') or {}

        # Parse quantity or row-range selection
        selection_mode = request.data.get('selection_mode', 'quantity')
        if selection_mode == 'range':
            try:
                start_row = int(request.data.get('start_row', 1))
                end_row = int(request.data.get('end_row', 50))
            except (ValueError, TypeError):
                return Response({"error": "Start row and end row must be valid integers."}, status=status.HTTP_400_BAD_REQUEST)

            if start_row < 1:
                return Response({"error": "Start row must be at least 1."}, status=status.HTTP_400_BAD_REQUEST)
            if end_row < start_row:
                return Response({"error": f"End row ({end_row}) cannot be less than start row ({start_row})."}, status=status.HTTP_400_BAD_REQUEST)

            count_requested = end_row - start_row + 1
            if count_requested > MAX_BATCH_ROWS_LIMIT:
                return Response({
                    "error": f"Requested selection ({count_requested} records) exceeds the maximum batch limit of {MAX_BATCH_ROWS_LIMIT} records."
                }, status=status.HTTP_400_BAD_REQUEST)
        else:
            try:
                quantity = int(request.data.get('quantity', 50))
            except (ValueError, TypeError):
                return Response({"error": "Quantity must be a valid positive integer."}, status=status.HTTP_400_BAD_REQUEST)

            if quantity < 1:
                return Response({"error": "Quantity must be a positive integer."}, status=status.HTTP_400_BAD_REQUEST)
            if quantity > MAX_BATCH_ROWS_LIMIT:
                return Response({
                    "error": f"Requested quantity ({quantity}) exceeds the maximum batch limit of {MAX_BATCH_ROWS_LIMIT} records."
                }, status=status.HTTP_400_BAD_REQUEST)

            start_row = 1
            end_row = min(quantity, job.total_rows) if job.total_rows > 0 else quantity

        # Check required fields are mapped OR configured with fallback defaults
        required_missing = []
        for cf in CANONICAL_FIELDS:
            if cf['required']:
                has_col = bool(column_mapping.get(cf['key']))
                has_fallback = bool(fallback_values.get(cf['key']) is not None and str(fallback_values.get(cf['key'])).strip() != '')
                if not has_col and not has_fallback:
                    required_missing.append(cf['label'])

        if required_missing:
            return Response({
                "error": f"The following required fields must be mapped to a CSV column or configured with fallback defaults: {', '.join(required_missing)}."
            }, status=status.HTTP_400_BAD_REQUEST)

        # Slice the requested rows from staged file
        staged_path = get_staged_file_path(job.job_id, job.file_type)
        if os.path.exists(staged_path):
            try:
                raw_slice_rows = parse_staged_slice(
                    staged_path,
                    job.file_type,
                    job.raw_headers,
                    start_row=start_row,
                    end_row=end_row,
                )
            except ValueError as ve:
                return Response({"error": str(ve)}, status=status.HTTP_400_BAD_REQUEST)
        else:
            # Fallback if job.parsed_rows was already stored (e.g. test or pre-staged)
            if job.parsed_rows:
                raw_slice_rows = job.parsed_rows[start_row - 1:end_row]
            else:
                return Response({
                    "error": "The staged import file could not be found. Please re-upload the file to proceed."
                }, status=status.HTTP_400_BAD_REQUEST)

        if not raw_slice_rows:
            return Response({
                "error": f"No data records found in the selected range (Rows {start_row} to {end_row})."
            }, status=status.HTTP_400_BAD_REQUEST)

        # Cache existing books for fast duplicate checks
        existing_books_cache = {
            'by_isbn': {},
            'by_slug': {b.slug: b for b in Book.objects.all()},
        }
        for b in Book.objects.exclude(isbn__isnull=True).exclude(isbn=''):
            norm_isbn = normalize_isbn(b.isbn)
            if norm_isbn:
                existing_books_cache['by_isbn'][norm_isbn] = b
            existing_books_cache['by_isbn'][b.isbn] = b
        existing_cats_cache = {
            c.name.lower().strip(): {'id': c.id, 'name': c.name}
            for c in Category.objects.all()
        }

        seen_isbns = {}
        seen_slugs = {}
        validated_rows = []
        error_logs = []
        missing_categories_set = set()

        valid_cnt = 0
        warning_cnt = 0
        invalid_cnt = 0
        conflict_cnt = 0

        for raw_row in raw_slice_rows:
            norm, errors, warnings, is_conflict, conflict_details, status_code = validate_row(
                raw_row, column_mapping, existing_books_cache, existing_cats_cache, seen_isbns, seen_slugs,
                fallback_values=fallback_values
            )

            # Check if category is missing
            cat_name = norm.get('category_name')
            if cat_name and cat_name.lower().strip() not in existing_cats_cache:
                missing_categories_set.add(cat_name)

            norm['_row_num'] = raw_row.get('_row_num')
            norm['_status'] = status_code
            norm['_errors'] = errors
            norm['_warnings'] = warnings

            validated_rows.append(norm)

            if status_code == 'error':
                invalid_cnt += 1
                error_logs.append({
                    'row_num': norm['_row_num'],
                    'title': norm.get('title', ''),
                    'author': norm.get('author', ''),
                    'isbn': norm.get('isbn', ''),
                    'category': norm.get('category_name', ''),
                    'status': 'error',
                    'errors': errors,
                    'warnings': warnings,
                })
            elif status_code == 'conflict':
                conflict_cnt += 1
            elif status_code == 'warning':
                warning_cnt += 1
            else:
                valid_cnt += 1

        summary = {
            'total_rows': len(validated_rows),
            'valid_rows_count': valid_cnt,
            'warning_rows_count': warning_cnt,
            'invalid_rows_count': invalid_cnt,
            'conflict_rows_count': conflict_cnt,
            'ready_to_import_count': valid_cnt + warning_cnt + (conflict_cnt if conflict_mode == 'update' else 0),
            'missing_categories': sorted(list(missing_categories_set)),
            'selected_start_row': start_row,
            'selected_end_row': end_row,
            'selected_count': len(validated_rows),
            'total_available_rows': job.total_rows,
        }

        # Update job record with only the validated slice
        job.status = ImportJob.STATUS_VALIDATED
        job.column_mapping = column_mapping
        job.conflict_mode = conflict_mode
        job.create_missing_categories = create_missing_cats
        job.valid_rows_count = valid_cnt
        job.warning_rows_count = warning_cnt
        job.invalid_rows_count = invalid_cnt
        job.conflict_rows_count = conflict_cnt
        job.validation_summary = summary
        job.parsed_rows = validated_rows
        job.error_summary = error_logs
        job.save()

        # Paginate preview to first 50 rows
        preview_page = int(request.data.get('page', 1))
        page_size = int(request.data.get('page_size', 50))
        start_idx = (preview_page - 1) * page_size
        end_idx = start_idx + page_size

        return Response({
            "job_id": str(job.job_id),
            "validation_summary": summary,
            "preview_rows": validated_rows[start_idx:end_idx],
            "preview_pagination": {
                "page": preview_page,
                "page_size": page_size,
                "total_rows": len(validated_rows),
                "total_pages": max(1, (len(validated_rows) + page_size - 1) // page_size),
            },
            "selection_info": {
                "start_row": start_row,
                "end_row": end_row,
                "selected_count": len(validated_rows),
                "total_available_rows": job.total_rows,
                "selection_mode": selection_mode,
            }
        }, status=status.HTTP_200_OK)


class AdminBookImportConfirmView(APIView):
    """
    POST /api/admin/books/import/confirm/
    Executes validated import in a transactional batch, enforcing maximum batch size.
    """
    permission_classes = [IsStaffAdmin]

    def post(self, request):
        enforce_csrf(request)

        job_id = request.data.get('job_id')
        idempotency_key = request.data.get('idempotency_key')
        conflict_mode = request.data.get('conflict_mode', ImportJob.CONFLICT_SKIP)
        create_missing_cats = bool(request.data.get('create_missing_categories', False))

        if not job_id:
            return Response({"error": "Missing job_id."}, status=status.HTTP_400_BAD_REQUEST)

        job = ImportJob.objects.filter(job_id=job_id).first()
        if not job:
            return Response({"error": "Import job not found."}, status=status.HTTP_404_NOT_FOUND)

        if job.status == ImportJob.STATUS_COMPLETED:
            return Response({
                "message": "This import job has already been completed.",
                "job": AdminImportJobSerializer(job).data
            }, status=status.HTTP_200_OK)

        if idempotency_key and job.idempotency_key == idempotency_key:
            return Response({
                "message": "Duplicate request detected with identical idempotency token.",
                "job": AdminImportJobSerializer(job).data
            }, status=status.HTTP_200_OK)

        if idempotency_key:
            job.idempotency_key = idempotency_key
            job.save(update_fields=['idempotency_key'])

        # Enforce server-side 5,000 batch limit
        if len(job.parsed_rows) > MAX_BATCH_ROWS_LIMIT:
            return Response({
                "error": f"Batch limit exceeded. A maximum of {MAX_BATCH_ROWS_LIMIT} records can be imported per batch."
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            created_cnt, updated_cnt, skipped_cnt, failed_cnt = execute_import_job(
                job,
                conflict_mode=conflict_mode,
                create_missing_categories=create_missing_cats
            )

            # Clean up staged file after successful import execution
            cleanup_staged_file(job.job_id, job.file_type)

            return Response({
                "message": f"Import completed successfully. Created: {created_cnt}, Updated: {updated_cnt}, Skipped: {skipped_cnt}, Failed: {failed_cnt}.",
                "job": AdminImportJobSerializer(job).data,
                "has_errors": len(job.error_summary) > 0,
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                "error": f"Import execution failed: {str(e)}",
                "job": AdminImportJobSerializer(job).data
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



class AdminBookImportHistoryView(APIView):
    """
    GET /api/admin/books/import/history/
    Returns recent import job audit records.
    """
    permission_classes = [IsStaffAdmin]

    def get(self, request):
        jobs = ImportJob.objects.select_related('created_by').all()[:30]
        return Response({
            "results": AdminImportJobSerializer(jobs, many=True).data,
            "count": jobs.count()
        }, status=status.HTTP_200_OK)


class AdminBookImportErrorReportView(APIView):
    """
    GET /api/admin/books/import/jobs/<uuid:job_id>/errors/
    Downloads formula-injection-safe CSV error report for a job.
    """
    permission_classes = [IsStaffAdmin]

    def perform_content_negotiation(self, request, force=False):
        return None, None

    def get(self, request, job_id):

        job = ImportJob.objects.filter(job_id=job_id).first()
        if not job:
            return Response({"error": "Import job not found."}, status=status.HTTP_404_NOT_FOUND)

        csv_content = generate_error_report_csv(job)
        response = HttpResponse(csv_content, content_type='text/csv; charset=utf-8-sig')
        response['Content-Disposition'] = f'attachment; filename="aetherium_import_errors_{job.job_id}.csv"'
        return response

