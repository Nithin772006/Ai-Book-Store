import uuid
from decimal import Decimal
from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator


def generate_order_reference():
    """Generate a clean, unique, non-guessable order reference."""
    return f"EXL-{uuid.uuid4().hex[:10].upper()}"


class Order(models.Model):
    """
    Historical record of an order placed by a customer.
    Stores immutable financial snapshots, customer info, and shipping address.
    """
    STATUS_PENDING = 'pending'
    STATUS_CONFIRMED = 'confirmed'
    STATUS_PROCESSING = 'processing'
    STATUS_SHIPPED = 'shipped'
    STATUS_DELIVERED = 'delivered'
    STATUS_CANCELLED = 'cancelled'

    ORDER_STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_CONFIRMED, 'Confirmed'),
        (STATUS_PROCESSING, 'Processing'),
        (STATUS_SHIPPED, 'Shipped'),
        (STATUS_DELIVERED, 'Delivered'),
        (STATUS_CANCELLED, 'Cancelled'),
    ]

    PAYMENT_UNPAID = 'unpaid'
    PAYMENT_PAID = 'paid'
    PAYMENT_FAILED = 'failed'
    PAYMENT_REFUNDED = 'refunded'

    PAYMENT_STATUS_CHOICES = [
        (PAYMENT_UNPAID, 'Unpaid'),
        (PAYMENT_PAID, 'Paid (Demo)'),
        (PAYMENT_FAILED, 'Failed'),
        (PAYMENT_REFUNDED, 'Refunded'),
    ]

    reference = models.CharField(
        max_length=32,
        unique=True,
        default=generate_order_reference,
        editable=False,
        db_index=True,
        help_text="Public non-guessable reference for customer lookups."
    )
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='orders',
        help_text="Authenticated customer who placed the order."
    )

    # Status tracking
    order_status = models.CharField(
        max_length=20,
        choices=ORDER_STATUS_CHOICES,
        default=STATUS_CONFIRMED,
        db_index=True
    )
    payment_status = models.CharField(
        max_length=20,
        choices=PAYMENT_STATUS_CHOICES,
        default=PAYMENT_PAID,
        db_index=True
    )
    payment_method = models.CharField(
        max_length=50,
        default='demo_payment',
        help_text="Simulated payment provider descriptor."
    )

    # Customer and recipient snapshot
    customer_name = models.CharField(max_length=255)
    customer_email = models.EmailField(max_length=255)

    # Shipping Address
    shipping_address_line1 = models.CharField(max_length=255)
    shipping_address_line2 = models.CharField(max_length=255, blank=True, default='')
    city = models.CharField(max_length=100)
    state_region = models.CharField(max_length=100)
    postal_code = models.CharField(max_length=20)
    country = models.CharField(max_length=100)

    # Financial details (all calculated server-side with Decimal precision)
    subtotal = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))]
    )
    shipping_charge = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))]
    )
    discount_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))]
    )
    total_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))]
    )

    idempotency_key = models.CharField(
        max_length=128,
        blank=True,
        null=True,
        db_index=True,
        help_text="Client submission token to prevent duplicate order submissions."
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['customer', '-created_at']),
        ]

    def __str__(self):
        return f"Order {self.reference} ({self.customer.username}) - ${self.total_amount}"

    @property
    def total_items(self):
        return sum(item.quantity for item in self.items.all())


class OrderItem(models.Model):
    """
    Immutable snapshot of a purchased book within an order.
    Retains original title, author, and purchase-time unit price even if
    the catalogue entry is modified or deleted later.
    """
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='items'
    )
    book = models.ForeignKey(
        'catalog.Book',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='order_items'
    )
    book_title = models.CharField(max_length=255)
    book_author = models.CharField(max_length=255, blank=True, default='')
    book_cover_image = models.CharField(max_length=500, blank=True, default='')

    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))]
    )
    quantity = models.PositiveIntegerField(
        validators=[MinValueValidator(1)]
    )
    subtotal = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))]
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f"{self.quantity}x {self.book_title} (${self.unit_price})"
