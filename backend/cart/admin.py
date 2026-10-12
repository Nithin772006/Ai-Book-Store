from django.contrib import admin
from .models import Cart, CartItem


class CartItemInline(admin.TabularInline):
    model = CartItem
    extra = 0
    readonly_fields = ['unit_price', 'subtotal', 'created_at', 'updated_at']
    fields = ['book', 'quantity', 'unit_price', 'subtotal', 'created_at', 'updated_at']


@admin.register(Cart)
class CartAdmin(admin.ModelAdmin):
    list_display = ['id', 'customer', 'total_items_display', 'subtotal_display', 'updated_at', 'created_at']
    search_fields = ['customer__username', 'customer__email']
    readonly_fields = ['created_at', 'updated_at', 'total_items_display', 'subtotal_display']
    inlines = [CartItemInline]

    @admin.display(description='Total Volumes')
    def total_items_display(self, obj):
        return obj.total_items

    @admin.display(description='Cart Subtotal')
    def subtotal_display(self, obj):
        return f"${obj.subtotal}"


@admin.register(CartItem)
class CartItemAdmin(admin.ModelAdmin):
    list_display = ['id', 'cart', 'book', 'quantity', 'unit_price', 'subtotal', 'created_at']
    list_filter = ['created_at']
    search_fields = ['cart__customer__username', 'book__title', 'book__isbn']
    readonly_fields = ['unit_price', 'subtotal', 'created_at', 'updated_at']
