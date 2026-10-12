from decimal import Decimal
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models


class Cart(models.Model):
    """
    Persistent shopping cart belonging to an authenticated customer.
    Enforces a strict one-cart-per-customer relationship at the database level.
    """
    customer = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='cart',
        help_text="Customer owning this persistent shopping cart."
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Timestamp when the cart was initiated."
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        help_text="Timestamp when the cart was last modified."
    )

    class Meta:
        verbose_name = 'Shopping Cart'
        verbose_name_plural = 'Shopping Carts'
        ordering = ['-updated_at']

    def __str__(self):
        return f"Cart of {self.customer.username} ({self.total_items} items)"

    @property
    def total_items(self):
        """
        Calculates the aggregate quantity of all book items in the cart.
        """
        return sum(item.quantity for item in self.items.all())

    @property
    def subtotal(self):
        """
        Calculates total monetary value of all items in cart using Decimal arithmetic.
        """
        total = sum((item.subtotal for item in self.items.all()), Decimal('0.00'))
        return total.quantize(Decimal('0.01'))


class CartItem(models.Model):
    """
    Individual line item in a customer's shopping cart.
    Prevents duplicate entries for the same book within a cart via database constraint.
    """
    cart = models.ForeignKey(
        Cart,
        on_delete=models.CASCADE,
        related_name='items',
        help_text="Cart to which this item belongs."
    )
    book = models.ForeignKey(
        'catalog.Book',
        on_delete=models.CASCADE,
        related_name='cart_items',
        help_text="Referenced book from the catalogue."
    )
    quantity = models.PositiveIntegerField(
        default=1,
        validators=[MinValueValidator(1)],
        help_text="Quantity of volumes selected (minimum 1)."
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Timestamp when this item was added to the cart."
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        help_text="Timestamp when this item quantity was updated."
    )

    class Meta:
        verbose_name = 'Cart Item'
        verbose_name_plural = 'Cart Items'
        ordering = ['created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['cart', 'book'],
                name='unique_cart_book_entry'
            )
        ]

    def __str__(self):
        return f"{self.quantity}x {self.book.title} (Cart #{self.cart_id})"

    @property
    def unit_price(self):
        """
        Effective unit price based on catalogue discount rules:
        Valid discount price if present and lower than regular price; otherwise regular price.
        """
        if (
            self.book.discount_price is not None
            and self.book.discount_price > Decimal('0.00')
            and self.book.discount_price < self.book.price
        ):
            return self.book.discount_price
        return self.book.price

    @property
    def subtotal(self):
        """
        Calculates line subtotal using Decimal arithmetic.
        """
        return (self.unit_price * Decimal(self.quantity)).quantize(Decimal('0.01'))

    def clean(self):
        super().clean()
        if self.quantity < 1:
            raise ValidationError({'quantity': 'Quantity must be at least 1.'})
        if self.book and self.quantity > self.book.stock_quantity:
            raise ValidationError({
                'quantity': f'Requested quantity ({self.quantity}) exceeds available stock ({self.book.stock_quantity}).'
            })
