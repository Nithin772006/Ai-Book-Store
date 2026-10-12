from decimal import Decimal
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from cart.models import Cart
from .models import Order, OrderItem
from .serializers import (
    OrderSerializer,
    OrderSummarySerializer,
    CheckoutRequestSerializer,
)


class CheckoutView(APIView):
    """
    POST /api/orders/checkout/
    Process checkout for the authenticated customer:
    - Validates shipping data and cart contents.
    - Re-validates inventory and locks books atomically.
    - Calculates authoritatively server-side Decimal prices and totals.
    - Deducts inventory.
    - Snapshots purchased items into Order & OrderItem models.
    - Clears customer's cart.
    - Simulates confirmed demo payment.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = CheckoutRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # Idempotency check: if an order with this idempotency key already exists for this customer
        idempotency_key = serializer.validated_data.get('idempotency_key')
        if idempotency_key:
            existing_order = Order.objects.filter(
                customer=request.user,
                idempotency_key=idempotency_key
            ).first()
            if existing_order:
                order_data = OrderSerializer(existing_order, context={'request': request}).data
                return Response(
                    {
                        'message': 'Order retrieved successfully (idempotent request).',
                        'order': order_data
                    },
                    status=status.HTTP_200_OK
                )

        # Retrieve customer's cart
        cart = Cart.objects.filter(customer=request.user).first()
        if not cart or not cart.items.exists():
            return Response(
                {'detail': 'Your shopping bag is empty. Please add items before checking out.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            cart_items = list(cart.items.select_related('book').all())
            if not cart_items:
                return Response(
                    {'detail': 'Your shopping bag is empty.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 1. Re-validate purchasability and stock for all items
            for item in cart_items:
                book = item.book
                if not book or not book.is_active:
                    title = book.title if book else 'Unknown volume'
                    return Response(
                        {'detail': f'The volume "{title}" is no longer active in the catalogue.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                if item.quantity > book.stock_quantity:
                    return Response(
                        {
                            'detail': (
                                f'Insufficient stock for "{book.title}". '
                                f'Requested: {item.quantity}, Available: {book.stock_quantity}.'
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )

            # 2. Authoritative monetary calculation (ignoring any client pricing)
            subtotal = Decimal('0.00')
            order_items_data = []

            for item in cart_items:
                book = item.book
                # Establish effective catalogue price with discount rules
                if book.discount_price and book.discount_price > Decimal('0.00') and book.discount_price < book.price:
                    unit_price = Decimal(str(book.discount_price))
                else:
                    unit_price = Decimal(str(book.price))

                unit_price = unit_price.quantize(Decimal('0.01'))
                line_subtotal = (unit_price * item.quantity).quantize(Decimal('0.01'))
                subtotal += line_subtotal

                cover_url = ''
                if book.cover_image:
                    try:
                        cover_url = request.build_absolute_uri(book.cover_image.url)
                    except Exception:
                        cover_url = book.cover_image.url

                order_items_data.append({
                    'book': book,
                    'book_title': book.title,
                    'book_author': book.author,
                    'book_cover_image': cover_url,
                    'unit_price': unit_price,
                    'quantity': item.quantity,
                    'subtotal': line_subtotal,
                })

            subtotal = subtotal.quantize(Decimal('0.01'))
            shipping_charge = Decimal('0.00').quantize(Decimal('0.01')) # Complimentary demo shipping
            discount_amount = Decimal('0.00').quantize(Decimal('0.01'))
            total_amount = (subtotal + shipping_charge - discount_amount).quantize(Decimal('0.01'))

            # 3. Deduct inventory safely
            for item in cart_items:
                item.book.stock_quantity -= item.quantity
                item.book.save(update_fields=['stock_quantity', 'updated_at'])

            # 4. Create Order
            order = Order.objects.create(
                customer=request.user,
                order_status=Order.STATUS_CONFIRMED,
                payment_status=Order.PAYMENT_PAID,
                payment_method=serializer.validated_data.get('payment_method', 'demo_card'),
                customer_name=serializer.validated_data['customer_name'],
                customer_email=serializer.validated_data['customer_email'],
                shipping_address_line1=serializer.validated_data['shipping_address_line1'],
                shipping_address_line2=serializer.validated_data.get('shipping_address_line2', ''),
                city=serializer.validated_data['city'],
                state_region=serializer.validated_data['state_region'],
                postal_code=serializer.validated_data['postal_code'],
                country=serializer.validated_data['country'],
                subtotal=subtotal,
                shipping_charge=shipping_charge,
                discount_amount=discount_amount,
                total_amount=total_amount,
                idempotency_key=idempotency_key or None,
            )

            # 5. Create immutable OrderItem snapshots
            for item_data in order_items_data:
                OrderItem.objects.create(
                    order=order,
                    **item_data
                )

            # 6. Clear customer's cart
            cart.items.all().delete()
            cart.save()

        order_data = OrderSerializer(order, context={'request': request}).data
        return Response(
            {
                'message': 'Order confirmed successfully. Thank you for your acquisition.',
                'order': order_data
            },
            status=status.HTTP_201_CREATED
        )


class OrderListView(APIView):
    """
    GET /api/orders/
    List all historical orders belonging strictly to the authenticated customer.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        orders = Order.objects.filter(customer=request.user).order_by('-created_at')
        serializer = OrderSummarySerializer(orders, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class OrderDetailView(APIView):
    """
    GET /api/orders/<reference>/
    Retrieve full details and purchased book snapshots of a specific order.
    Enforces customer ownership (returns 404 for other customers' orders).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, reference):
        order = get_object_or_404(
            Order.objects.prefetch_related('items'),
            reference=reference,
            customer=request.user
        )
        serializer = OrderSerializer(order, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)
