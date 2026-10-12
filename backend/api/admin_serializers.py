"""
Serializers for AETHERIUM Administration API (Phase 9A).
Provides strict server-side validation, file upload validation, and legal state transitions.
"""

from decimal import Decimal
from django.contrib.auth.models import User
from django.utils.text import slugify
from rest_framework import serializers

from catalog.models import Book, Category, generate_unique_slug
from orders.models import Order, OrderItem


ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
MAX_IMAGE_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


class AdminCategorySerializer(serializers.ModelSerializer):
    """
    Serializer for category management with aggregated book counts.
    """
    book_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Category
        fields = [
            'id',
            'name',
            'slug',
            'description',
            'is_active',
            'created_at',
            'book_count',
        ]
        read_only_fields = ['id', 'created_at', 'book_count']

    def validate_name(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("Category name cannot be blank.")
        qs = Category.objects.filter(name__iexact=cleaned)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("A category with this name already exists.")
        return cleaned


class AdminBookSerializer(serializers.ModelSerializer):
    """
    Serializer for book catalog management with rigorous field validation
    and cover image security checks.
    """
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_slug = serializers.CharField(source='category.slug', read_only=True)
    slug = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Book
        fields = [
            'id',
            'title',
            'slug',
            'author',
            'description',
            'isbn',
            'publisher',
            'publication_date',
            'language',
            'price',
            'discount_price',
            'stock_quantity',
            'category',
            'category_name',
            'category_slug',
            'cover_image',
            'is_featured',
            'is_bestseller',
            'is_new_arrival',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'category_name', 'category_slug']

    def validate_title(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("Book title cannot be blank.")
        return cleaned

    def validate_author(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("Author name cannot be blank.")
        return cleaned

    def validate_price(self, value):
        if value < Decimal('0.00'):
            raise serializers.ValidationError("Price must be a non-negative amount.")
        return value

    def validate_stock_quantity(self, value):
        if value < 0:
            raise serializers.ValidationError("Stock quantity cannot be negative.")
        return value

    def validate_cover_image(self, file_obj):
        if not file_obj:
            return file_obj

        # Check file size (5MB maximum)
        if hasattr(file_obj, 'size') and file_obj.size > MAX_IMAGE_FILE_SIZE_BYTES:
            raise serializers.ValidationError("Cover image size exceeds the 5 MB limit.")

        # Check content type if available
        if hasattr(file_obj, 'content_type') and file_obj.content_type not in ALLOWED_IMAGE_MIME_TYPES:
            raise serializers.ValidationError(
                f"Unsupported image format ({file_obj.content_type}). Allowed formats: JPEG, PNG, WebP."
            )

        return file_obj

    def validate(self, attrs):
        price = attrs.get('price', getattr(self.instance, 'price', None))
        discount_price = attrs.get('discount_price', getattr(self.instance, 'discount_price', None))

        if discount_price is not None and price is not None:
            if discount_price > price:
                raise serializers.ValidationError({
                    'discount_price': "Discount price cannot exceed the base price."
                })
            if discount_price < Decimal('0.00'):
                raise serializers.ValidationError({
                    'discount_price': "Discount price must be non-negative."
                })

        return attrs

    def create(self, validated_data):
        title = validated_data.get('title', '')
        slug = validated_data.get('slug', '').strip()
        if not slug:
            # Auto-derive unique slug from title
            dummy = Book(title=title)
            validated_data['slug'] = generate_unique_slug(dummy, title, 'slug', max_length=280)
        return super().create(validated_data)


class AdminOrderItemSerializer(serializers.ModelSerializer):
    """
    Immutable purchase snapshot item representation.
    """
    class Meta:
        model = OrderItem
        fields = [
            'id',
            'book',
            'book_title',
            'book_author',
            'book_cover_image',
            'unit_price',
            'quantity',
            'subtotal',
            'created_at',
        ]
        read_only_fields = fields


class AdminOrderSerializer(serializers.ModelSerializer):
    """
    Comprehensive admin order representation including full items snapshot,
    customer details, and fulfillment tracking.
    """
    items = AdminOrderItemSerializer(many=True, read_only=True)
    customer_username = serializers.CharField(source='customer.username', read_only=True)
    total_items = serializers.IntegerField(read_only=True)

    class Meta:
        model = Order
        fields = [
            'id',
            'reference',
            'customer',
            'customer_username',
            'customer_name',
            'customer_email',
            'order_status',
            'payment_status',
            'payment_method',
            'shipping_address_line1',
            'shipping_address_line2',
            'city',
            'state_region',
            'postal_code',
            'country',
            'subtotal',
            'shipping_charge',
            'discount_amount',
            'total_amount',
            'total_items',
            'items',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'reference',
            'customer',
            'customer_username',
            'subtotal',
            'shipping_charge',
            'discount_amount',
            'total_amount',
            'total_items',
            'items',
            'created_at',
            'updated_at',
        ]


LEGAL_ORDER_TRANSITIONS = {
    Order.STATUS_PENDING: [Order.STATUS_CONFIRMED, Order.STATUS_CANCELLED],
    Order.STATUS_CONFIRMED: [Order.STATUS_PROCESSING, Order.STATUS_CANCELLED],
    Order.STATUS_PROCESSING: [Order.STATUS_SHIPPED, Order.STATUS_CANCELLED],
    Order.STATUS_SHIPPED: [Order.STATUS_DELIVERED, Order.STATUS_CANCELLED],
    Order.STATUS_DELIVERED: [],   # Terminal state
    Order.STATUS_CANCELLED: [],   # Terminal state
}


class AdminOrderStatusUpdateSerializer(serializers.Serializer):
    """
    Validates legal fulfillment status transitions for orders.
    Enforces terminal state immutability.
    """
    order_status = serializers.ChoiceField(choices=Order.ORDER_STATUS_CHOICES)
    notes = serializers.CharField(required=False, allow_blank=True, max_length=500)

    def validate_order_status(self, target_status):
        order = self.context.get('order')
        if not order:
            return target_status

        current_status = order.order_status
        if current_status == target_status:
            return target_status

        allowed = LEGAL_ORDER_TRANSITIONS.get(current_status, [])
        if target_status not in allowed:
            raise serializers.ValidationError(
                f"Cannot transition order from '{current_status}' to '{target_status}'. "
                f"Permitted transitions from '{current_status}': {allowed if allowed else 'None (terminal state)'}."
            )

        return target_status


class AdminCustomerSerializer(serializers.ModelSerializer):
    """
    Customer account overview serializer for administrative audit.
    Never exposes passwords, password hashes, or token credentials.
    """
    full_name = serializers.SerializerMethodField()
    order_count = serializers.IntegerField(read_only=True, default=0)
    total_spent = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True, default=Decimal('0.00'))

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'full_name',
            'is_active',
            'is_staff',
            'is_superuser',
            'date_joined',
            'last_login',
            'order_count',
            'total_spent',
        ]
        read_only_fields = [
            'id',
            'username',
            'email',
            'is_staff',
            'is_superuser',
            'date_joined',
            'last_login',
            'order_count',
            'total_spent',
        ]

    def get_full_name(self, obj):
        name = f"{obj.first_name} {obj.last_name}".strip()
        return name if name else obj.username
