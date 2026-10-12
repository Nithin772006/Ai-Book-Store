from rest_framework import serializers
from .models import Order, OrderItem


class OrderItemSerializer(serializers.ModelSerializer):
    unit_price = serializers.DecimalField(max_digits=10, decimal_places=2, coerce_to_string=True)
    subtotal = serializers.DecimalField(max_digits=10, decimal_places=2, coerce_to_string=True)
    book_id = serializers.IntegerField(source='book.id', read_only=True, allow_null=True)

    class Meta:
        model = OrderItem
        fields = [
            'id',
            'book_id',
            'book_title',
            'book_author',
            'book_cover_image',
            'unit_price',
            'quantity',
            'subtotal',
            'created_at',
        ]
        read_only_fields = fields


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    item_count = serializers.IntegerField(source='total_items', read_only=True)
    subtotal = serializers.DecimalField(max_digits=10, decimal_places=2, coerce_to_string=True)
    shipping_charge = serializers.DecimalField(max_digits=10, decimal_places=2, coerce_to_string=True)
    discount_amount = serializers.DecimalField(max_digits=10, decimal_places=2, coerce_to_string=True)
    total_amount = serializers.DecimalField(max_digits=10, decimal_places=2, coerce_to_string=True)

    class Meta:
        model = Order
        fields = [
            'id',
            'reference',
            'order_status',
            'payment_status',
            'payment_method',
            'customer_name',
            'customer_email',
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
            'items',
            'item_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields


class OrderSummarySerializer(serializers.ModelSerializer):
    item_count = serializers.IntegerField(source='total_items', read_only=True)
    total_amount = serializers.DecimalField(max_digits=10, decimal_places=2, coerce_to_string=True)

    class Meta:
        model = Order
        fields = [
            'id',
            'reference',
            'order_status',
            'payment_status',
            'item_count',
            'total_amount',
            'created_at',
        ]
        read_only_fields = fields


class CheckoutRequestSerializer(serializers.Serializer):
    customer_name = serializers.CharField(max_length=255, required=True, trim_whitespace=True)
    customer_email = serializers.EmailField(max_length=255, required=True)
    shipping_address_line1 = serializers.CharField(max_length=255, required=True, trim_whitespace=True)
    shipping_address_line2 = serializers.CharField(max_length=255, required=False, allow_blank=True, default='')
    city = serializers.CharField(max_length=100, required=True, trim_whitespace=True)
    state_region = serializers.CharField(max_length=100, required=True, trim_whitespace=True)
    postal_code = serializers.CharField(max_length=20, required=True, trim_whitespace=True)
    country = serializers.CharField(max_length=100, required=True, trim_whitespace=True)
    payment_method = serializers.CharField(max_length=50, required=False, default='demo_card')
    idempotency_key = serializers.CharField(max_length=128, required=False, allow_blank=True, default='')

    def validate_customer_name(self, value):
        if len(value.strip()) < 2:
            raise serializers.ValidationError("Please provide your full name.")
        return value.strip()

    def validate_shipping_address_line1(self, value):
        if not value.strip():
            raise serializers.ValidationError("Shipping address line 1 cannot be blank.")
        return value.strip()
