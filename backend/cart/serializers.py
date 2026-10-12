from decimal import Decimal
from rest_framework import serializers
from catalog.models import Book
from .models import Cart, CartItem


class CartBookSerializer(serializers.ModelSerializer):
    """
    Concise book presentation within a shopping cart line item.
    """
    price = serializers.DecimalField(max_digits=10, decimal_places=2, coerce_to_string=True)
    discount_price = serializers.DecimalField(
        max_digits=10, decimal_places=2, allow_null=True, coerce_to_string=True
    )
    has_discount = serializers.SerializerMethodField()
    cover_image = serializers.SerializerMethodField()

    class Meta:
        model = Book
        fields = [
            'id',
            'title',
            'slug',
            'author',
            'price',
            'discount_price',
            'has_discount',
            'stock_quantity',
            'cover_image',
            'is_active',
        ]
        read_only_fields = fields

    def get_has_discount(self, obj):
        return bool(
            obj.discount_price is not None
            and obj.discount_price > Decimal('0.00')
            and obj.discount_price < obj.price
        )

    def get_cover_image(self, obj):
        if not obj.cover_image:
            return None
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.cover_image.url)
        return obj.cover_image.url


class CartItemSerializer(serializers.ModelSerializer):
    """
    Line item representation including real-time subtotal and catalogue book details.
    """
    book = CartBookSerializer(read_only=True)
    unit_price = serializers.SerializerMethodField()
    subtotal = serializers.SerializerMethodField()

    class Meta:
        model = CartItem
        fields = [
            'id',
            'book',
            'quantity',
            'unit_price',
            'subtotal',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'book', 'unit_price', 'subtotal', 'created_at', 'updated_at']

    def get_unit_price(self, obj):
        return f"{obj.unit_price:.2f}"

    def get_subtotal(self, obj):
        return f"{obj.subtotal:.2f}"


class CartSerializer(serializers.ModelSerializer):
    """
    Authoritative customer shopping cart response payload.
    Recalculates all line totals and aggregate subtotals server-side.
    """
    items = CartItemSerializer(many=True, read_only=True)
    item_count = serializers.SerializerMethodField()
    subtotal = serializers.SerializerMethodField()

    class Meta:
        model = Cart
        fields = [
            'id',
            'items',
            'item_count',
            'subtotal',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields

    def get_item_count(self, obj):
        return obj.total_items

    def get_subtotal(self, obj):
        return f"{obj.subtotal:.2f}"


class AddToCartSerializer(serializers.Serializer):
    """
    Input validation for adding a book to the customer's cart.
    """
    book_id = serializers.IntegerField(
        required=True,
        error_messages={'required': 'book_id is required.'}
    )
    quantity = serializers.IntegerField(
        required=False,
        default=1,
        min_value=1,
        error_messages={'min_value': 'Quantity must be at least 1.'}
    )

    def validate_book_id(self, value):
        try:
            book = Book.objects.get(pk=value)
        except Book.DoesNotExist:
            raise serializers.ValidationError('Book not found in catalogue.')

        if not book.is_active:
            raise serializers.ValidationError('This volume is currently inactive in the catalogue.')

        if book.stock_quantity < 1:
            raise serializers.ValidationError('This volume is currently out of stock.')

        return value


class UpdateCartItemSerializer(serializers.Serializer):
    """
    Input validation for modifying an existing cart item's quantity.
    """
    quantity = serializers.IntegerField(
        required=True,
        min_value=1,
        error_messages={
            'required': 'Quantity is required.',
            'min_value': 'Quantity must be at least 1.'
        }
    )
