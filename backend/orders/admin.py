from django.contrib import admin
from .models import Order, OrderItem


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    can_delete = False
    readonly_fields = [
        'book',
        'book_title',
        'book_author',
        'unit_price',
        'quantity',
        'subtotal',
        'created_at',
    ]
    fields = readonly_fields

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = [
        'reference',
        'customer',
        'customer_name',
        'total_amount',
        'order_status',
        'payment_status',
        'created_at',
    ]
    list_filter = [
        'order_status',
        'payment_status',
        'created_at',
    ]
    search_fields = [
        'reference',
        'customer__username',
        'customer__email',
        'customer_name',
        'customer_email',
        'shipping_address_line1',
        'city',
        'postal_code',
    ]
    readonly_fields = [
        'reference',
        'customer',
        'created_at',
        'updated_at',
        'subtotal',
        'shipping_charge',
        'discount_amount',
        'total_amount',
        'idempotency_key',
    ]
    inlines = [OrderItemInline]

    fieldsets = (
        ('Order Identification', {
            'fields': ('reference', 'customer', 'created_at', 'updated_at', 'idempotency_key')
        }),
        ('Order Status & Payment', {
            'fields': ('order_status', 'payment_status', 'payment_method')
        }),
        ('Customer & Shipping Details', {
            'fields': (
                'customer_name',
                'customer_email',
                'shipping_address_line1',
                'shipping_address_line2',
                'city',
                'state_region',
                'postal_code',
                'country',
            )
        }),
        ('Financial Calculations (Read-Only)', {
            'fields': ('subtotal', 'shipping_charge', 'discount_amount', 'total_amount')
        }),
    )

    def has_add_permission(self, request):
        # Orders should only be created through checkout API
        return False


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = [
        'id',
        'order',
        'book_title',
        'unit_price',
        'quantity',
        'subtotal',
        'created_at',
    ]
    search_fields = [
        'order__reference',
        'book_title',
        'book_author',
    ]
    readonly_fields = [
        'order',
        'book',
        'book_title',
        'book_author',
        'book_cover_image',
        'unit_price',
        'quantity',
        'subtotal',
        'created_at',
    ]

    def has_add_permission(self, request):
        return False
