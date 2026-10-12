from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from catalog.models import Book
from .models import Cart, CartItem
from .serializers import (
    AddToCartSerializer,
    CartSerializer,
    UpdateCartItemSerializer,
)


class CartView(APIView):
    """
    GET /api/cart/
    Retrieve the current customer's persistent shopping cart.

    DELETE /api/cart/
    Clear all items from the current customer's cart.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        cart, _ = Cart.objects.get_or_create(customer=request.user)
        serializer = CartSerializer(cart, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    def delete(self, request):
        cart, _ = Cart.objects.get_or_create(customer=request.user)
        cart.items.all().delete()
        cart.save()
        serializer = CartSerializer(cart, context={'request': request})
        return Response(
            {
                'message': 'Shopping cart cleared successfully.',
                'cart': serializer.data,
            },
            status=status.HTTP_200_OK
        )


class CartItemsView(APIView):
    """
    POST /api/cart/items/
    Add a book to the current customer's cart or increment its existing quantity.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = AddToCartSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        book_id = serializer.validated_data['book_id']
        quantity = serializer.validated_data.get('quantity', 1)

        with transaction.atomic():
            cart, _ = Cart.objects.get_or_create(customer=request.user)
            book = Book.objects.select_for_update().get(pk=book_id)

            if not book.is_active:
                return Response(
                    {'detail': 'This volume is inactive in the catalogue.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if book.stock_quantity < 1:
                return Response(
                    {'detail': 'This volume is currently out of stock.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Check if book already exists in customer's cart
            existing_item = CartItem.objects.filter(cart=cart, book=book).first()

            if existing_item:
                target_quantity = existing_item.quantity + quantity
                if target_quantity > book.stock_quantity:
                    return Response(
                        {
                            'quantity': [
                                f"Cannot add {quantity} more. Current cart quantity ({existing_item.quantity}) "
                                f"plus requested quantity exceeds available stock ({book.stock_quantity})."
                            ]
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )
                existing_item.quantity = target_quantity
                existing_item.save()
            else:
                if quantity > book.stock_quantity:
                    return Response(
                        {
                            'quantity': [
                                f"Requested quantity ({quantity}) exceeds available stock ({book.stock_quantity})."
                            ]
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )
                CartItem.objects.create(
                    cart=cart,
                    book=book,
                    quantity=quantity
                )

            cart.save()

        # Re-fetch cart with updated items
        cart_data = CartSerializer(cart, context={'request': request}).data
        return Response(
            {
                'message': f'"{book.title}" added to your reading bag.',
                'cart': cart_data,
            },
            status=status.HTTP_200_OK
        )


class CartItemDetailView(APIView):
    """
    PATCH /api/cart/items/<item_id>/
    Update quantity of a specific cart item owned by the customer.

    DELETE /api/cart/items/<item_id>/
    Remove a specific cart item owned by the customer.
    """
    permission_classes = [IsAuthenticated]

    def patch(self, request, item_id):
        serializer = UpdateCartItemSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        new_quantity = serializer.validated_data['quantity']

        with transaction.atomic():
            # Scoped strictly to the authenticated user's cart
            item = get_object_or_404(
                CartItem.objects.select_related('cart', 'book'),
                pk=item_id,
                cart__customer=request.user
            )

            book = item.book
            if not book.is_active:
                return Response(
                    {'detail': 'This volume is no longer active in the catalogue.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if new_quantity > book.stock_quantity:
                return Response(
                    {
                        'quantity': [
                            f"Requested quantity ({new_quantity}) exceeds available stock ({book.stock_quantity})."
                        ]
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            item.quantity = new_quantity
            item.save()
            item.cart.save()

        cart_data = CartSerializer(item.cart, context={'request': request}).data
        return Response(
            {
                'message': 'Cart item updated successfully.',
                'cart': cart_data,
            },
            status=status.HTTP_200_OK
        )

    def delete(self, request, item_id):
        # Scoped strictly to the authenticated user's cart
        item = get_object_or_404(
            CartItem.objects.select_related('cart', 'book'),
            pk=item_id,
            cart__customer=request.user
        )

        cart = item.cart
        book_title = item.book.title
        item.delete()
        cart.save()

        cart_data = CartSerializer(cart, context={'request': request}).data
        return Response(
            {
                'message': f'"{book_title}" removed from reading bag.',
                'cart': cart_data,
            },
            status=status.HTTP_200_OK
        )
