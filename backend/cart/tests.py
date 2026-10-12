from decimal import Decimal
from django.contrib.auth.models import User
from django.db import IntegrityError
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework.authtoken.models import Token

from catalog.models import Category, Book
from .models import Cart, CartItem


class CartApiTestCase(APITestCase):
    """
    Comprehensive test suite for Phase 5 persistent shopping cart functionality.
    """

    def setUp(self):
        # Create Category
        self.category = Category.objects.create(
            name="Computer Science & Systems",
            slug="cs-systems",
            description="Foundational architectures and systems."
        )

        # Create Book A (regular price, stock = 10)
        self.book_a = Book.objects.create(
            title="Design Patterns: Elements of Reusable Object-Oriented Software",
            slug="design-patterns-gang-of-four",
            author="Erich Gamma, Richard Helm, Ralph Johnson, John Vlissides",
            description="Classic catalog of software engineering design patterns.",
            price=Decimal("54.99"),
            discount_price=None,
            stock_quantity=10,
            category=self.category,
            is_active=True
        )

        # Create Book B (on sale, regular = 40.00, discount = 30.00, stock = 5)
        self.book_b = Book.objects.create(
            title="The Mythical Man-Month",
            slug="mythical-man-month",
            author="Frederick P. Brooks Jr.",
            description="Essays on software engineering and human project dynamics.",
            price=Decimal("40.00"),
            discount_price=Decimal("30.00"),
            stock_quantity=5,
            category=self.category,
            is_active=True
        )

        # Create Book C (Inactive, stock = 10)
        self.book_inactive = Book.objects.create(
            title="Archived Out-of-Print Treatise",
            slug="archived-treatise",
            author="Unknown Scholar",
            description="Inactive book archive.",
            price=Decimal("25.00"),
            stock_quantity=10,
            category=self.category,
            is_active=False
        )

        # Create Book D (Out of Stock, stock = 0)
        self.book_zero_stock = Book.objects.create(
            title="Exhausted Print Run",
            slug="exhausted-print-run",
            author="Rare Manuscripts Guild",
            description="Volume with zero warehouse inventory.",
            price=Decimal("50.00"),
            stock_quantity=0,
            category=self.category,
            is_active=True
        )

        # Customer 1
        self.user1 = User.objects.create_user(
            username='reader_ada',
            email='ada@exlibris.test',
            password='StrongPass!2026'
        )
        self.token1, _ = Token.objects.get_or_create(user=self.user1)

        # Customer 2
        self.user2 = User.objects.create_user(
            username='reader_charles',
            email='charles@exlibris.test',
            password='StrongPass!2026'
        )
        self.token2, _ = Token.objects.get_or_create(user=self.user2)

        # URLs
        self.cart_url = reverse('cart-detail')
        self.cart_items_url = reverse('cart-items')

    def test_unauthenticated_requests_are_rejected(self):
        """Verify anonymous requests to cart endpoints return 401 Unauthorized."""
        res_get = self.client.get(self.cart_url)
        self.assertEqual(res_get.status_code, status.HTTP_401_UNAUTHORIZED)

        res_post = self.client.post(self.cart_items_url, {'book_id': self.book_a.id, 'quantity': 1})
        self.assertEqual(res_post.status_code, status.HTTP_401_UNAUTHORIZED)

        res_delete = self.client.delete(self.cart_url)
        self.assertEqual(res_delete.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_authenticated_customer_retrieves_empty_cart(self):
        """Verify authenticated customer receives a valid structured empty cart."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        response = self.client.get(self.cart_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['items'], [])
        self.assertEqual(response.data['item_count'], 0)
        self.assertEqual(response.data['subtotal'], "0.00")
        self.assertIn('id', response.data)

    def test_add_available_book_to_cart(self):
        """Verify adding an available book creates a line item with correct prices."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        response = self.client.post(self.cart_items_url, {
            'book_id': self.book_a.id,
            'quantity': 2
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        cart = response.data['cart']
        self.assertEqual(cart['item_count'], 2)
        self.assertEqual(len(cart['items']), 1)

        item = cart['items'][0]
        self.assertEqual(item['book']['id'], self.book_a.id)
        self.assertEqual(item['quantity'], 2)
        self.assertEqual(item['unit_price'], "54.99")
        # 2 * 54.99 = 109.98
        self.assertEqual(item['subtotal'], "109.98")
        self.assertEqual(cart['subtotal'], "109.98")

    def test_add_same_book_twice_increments_quantity(self):
        """Verify adding the same book twice increments quantity rather than creating duplicate."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')

        # Add 2 copies
        self.client.post(self.cart_items_url, {'book_id': self.book_a.id, 'quantity': 2})

        # Add 3 more copies
        res = self.client.post(self.cart_items_url, {'book_id': self.book_a.id, 'quantity': 3})
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        cart = res.data['cart']
        self.assertEqual(cart['item_count'], 5)
        self.assertEqual(len(cart['items']), 1)
        self.assertEqual(cart['items'][0]['quantity'], 5)
        # 5 * 54.99 = 274.95
        self.assertEqual(cart['items'][0]['subtotal'], "274.95")
        self.assertEqual(cart['subtotal'], "274.95")

    def test_discount_price_calculation(self):
        """Verify that items on sale use effective discount price for line subtotal."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')

        # Add book with discount (price=40.00, discount=30.00, quantity=3)
        res = self.client.post(self.cart_items_url, {'book_id': self.book_b.id, 'quantity': 3})
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        item = res.data['cart']['items'][0]
        self.assertEqual(item['unit_price'], "30.00")
        # 3 * 30.00 = 90.00
        self.assertEqual(item['subtotal'], "90.00")
        self.assertEqual(res.data['cart']['subtotal'], "90.00")

    def test_update_item_quantity(self):
        """Verify customer can update the quantity of a cart line item."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')

        # Add 1 copy of book A
        add_res = self.client.post(self.cart_items_url, {'book_id': self.book_a.id, 'quantity': 1})
        item_id = add_res.data['cart']['items'][0]['id']

        # Update to 4 copies
        update_url = reverse('cart-item-detail', kwargs={'item_id': item_id})
        patch_res = self.client.patch(update_url, {'quantity': 4})
        self.assertEqual(patch_res.status_code, status.HTTP_200_OK)

        cart = patch_res.data['cart']
        self.assertEqual(cart['item_count'], 4)
        self.assertEqual(cart['items'][0]['quantity'], 4)
        # 4 * 54.99 = 219.96
        self.assertEqual(cart['subtotal'], "219.96")

    def test_remove_item_from_cart(self):
        """Verify customer can remove an item from their cart."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')

        # Add Book A and Book B
        self.client.post(self.cart_items_url, {'book_id': self.book_a.id, 'quantity': 1})
        res2 = self.client.post(self.cart_items_url, {'book_id': self.book_b.id, 'quantity': 1})
        self.assertEqual(len(res2.data['cart']['items']), 2)

        item_a_id = res2.data['cart']['items'][0]['id']
        delete_url = reverse('cart-item-detail', kwargs={'item_id': item_a_id})

        del_res = self.client.delete(delete_url)
        self.assertEqual(del_res.status_code, status.HTTP_200_OK)

        cart = del_res.data['cart']
        self.assertEqual(len(cart['items']), 1)
        self.assertEqual(cart['items'][0]['book']['id'], self.book_b.id)
        self.assertEqual(cart['item_count'], 1)

    def test_clear_entire_cart(self):
        """Verify DELETE /api/cart/ empties all items in current customer's cart."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')

        self.client.post(self.cart_items_url, {'book_id': self.book_a.id, 'quantity': 2})
        self.client.post(self.cart_items_url, {'book_id': self.book_b.id, 'quantity': 1})

        clear_res = self.client.delete(self.cart_url)
        self.assertEqual(clear_res.status_code, status.HTTP_200_OK)
        self.assertEqual(clear_res.data['cart']['items'], [])
        self.assertEqual(clear_res.data['cart']['item_count'], 0)
        self.assertEqual(clear_res.data['cart']['subtotal'], "0.00")

    def test_reject_quantity_below_one(self):
        """Verify adding or updating quantity < 1 is rejected."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')

        res_zero = self.client.post(self.cart_items_url, {'book_id': self.book_a.id, 'quantity': 0})
        self.assertEqual(res_zero.status_code, status.HTTP_400_BAD_REQUEST)

        res_neg = self.client.post(self.cart_items_url, {'book_id': self.book_a.id, 'quantity': -2})
        self.assertEqual(res_neg.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reject_quantity_above_available_stock(self):
        """Verify adding or updating quantity exceeding stock is rejected with useful error."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')

        # Book A has stock = 10
        res = self.client.post(self.cart_items_url, {'book_id': self.book_a.id, 'quantity': 11})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('quantity', res.data)

        # Add 8 copies (valid)
        add_res = self.client.post(self.cart_items_url, {'book_id': self.book_a.id, 'quantity': 8})
        self.assertEqual(add_res.status_code, status.HTTP_200_OK)

        # Try to add 3 more (8 + 3 = 11 > 10)
        add_more_res = self.client.post(self.cart_items_url, {'book_id': self.book_a.id, 'quantity': 3})
        self.assertEqual(add_more_res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reject_inactive_and_out_of_stock_books(self):
        """Verify inactive or zero-stock books are rejected."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')

        # Inactive book
        res_inactive = self.client.post(self.cart_items_url, {'book_id': self.book_inactive.id, 'quantity': 1})
        self.assertEqual(res_inactive.status_code, status.HTTP_400_BAD_REQUEST)

        # Zero stock book
        res_out = self.client.post(self.cart_items_url, {'book_id': self.book_zero_stock.id, 'quantity': 1})
        self.assertEqual(res_out.status_code, status.HTTP_400_BAD_REQUEST)

        # Nonexistent book ID
        res_nonexistent = self.client.post(self.cart_items_url, {'book_id': 999999, 'quantity': 1})
        self.assertEqual(res_nonexistent.status_code, status.HTTP_400_BAD_REQUEST)

    def test_customer_isolation_cannot_access_or_modify_other_carts(self):
        """Verify Customer A cannot view, update, or remove items from Customer B's cart."""
        # Customer 1 adds Book A
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        res1 = self.client.post(self.cart_items_url, {'book_id': self.book_a.id, 'quantity': 2})
        user1_item_id = res1.data['cart']['items'][0]['id']

        # Customer 2 authenticates
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token2.key}')

        # Customer 2 cart should be empty, NOT showing Customer 1's items
        res2_cart = self.client.get(self.cart_url)
        self.assertEqual(res2_cart.data['items'], [])
        self.assertEqual(res2_cart.data['item_count'], 0)

        # Customer 2 attempts to patch Customer 1's item
        patch_url = reverse('cart-item-detail', kwargs={'item_id': user1_item_id})
        res2_patch = self.client.patch(patch_url, {'quantity': 1})
        self.assertEqual(res2_patch.status_code, status.HTTP_404_NOT_FOUND)

        # Customer 2 attempts to delete Customer 1's item
        res2_delete = self.client.delete(patch_url)
        self.assertEqual(res2_delete.status_code, status.HTTP_404_NOT_FOUND)

        # Verify Customer 1's item is untouched
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token1.key}')
        check_user1 = self.client.get(self.cart_url)
        self.assertEqual(check_user1.data['items'][0]['quantity'], 2)

    def test_database_uniqueness_constraint_prevents_duplicate_cart_items(self):
        """Verify database constraint enforces unique (cart, book) pairs."""
        cart1, _ = Cart.objects.get_or_create(customer=self.user1)
        CartItem.objects.create(cart=cart1, book=self.book_a, quantity=1)

        with self.assertRaises(IntegrityError):
            CartItem.objects.create(cart=cart1, book=self.book_a, quantity=2)
