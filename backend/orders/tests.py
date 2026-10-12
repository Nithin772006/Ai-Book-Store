from decimal import Decimal
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from catalog.models import Category, Book
from cart.models import Cart, CartItem
from orders.models import Order, OrderItem

User = get_user_model()


class OrderCheckoutTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='reader_checkout',
            email='checkout@exlibris.com',
            password='TestPassword123!',
            first_name='Arthur',
            last_name='Conan'
        )
        self.other_user = User.objects.create_user(
            username='reader_other',
            email='other@exlibris.com',
            password='TestPassword123!',
            first_name='Agatha',
            last_name='Christie'
        )

        self.category = Category.objects.create(
            name='Literary Mystery',
            slug='literary-mystery'
        )

        self.book1 = Book.objects.create(
            title='The Hound of the Baskervilles',
            slug='the-hound-of-the-baskervilles',
            author='Arthur Conan Doyle',
            category=self.category,
            price=Decimal('25.00'),
            discount_price=Decimal('20.00'), # $20 effective price
            stock_quantity=10,
            is_active=True
        )

        self.book2 = Book.objects.create(
            title='Murder on the Orient Express',
            slug='murder-on-the-orient-express',
            author='Agatha Christie',
            category=self.category,
            price=Decimal('18.50'),
            stock_quantity=5,
            is_active=True
        )

        self.checkout_url = reverse('orders:checkout')
        self.order_list_url = reverse('orders:order-list')

        self.valid_shipping_data = {
            'customer_name': 'Arthur Conan',
            'customer_email': 'checkout@exlibris.com',
            'shipping_address_line1': '221B Baker Street',
            'shipping_address_line2': 'Flat 2',
            'city': 'London',
            'state_region': 'Greater London',
            'postal_code': 'NW1 6XE',
            'country': 'United Kingdom',
            'payment_method': 'demo_card',
        }

    def test_unauthenticated_checkout_rejected(self):
        response = self.client.post(self.checkout_url, self.valid_shipping_data)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_checkout_rejection_for_empty_cart(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(self.checkout_url, self.valid_shipping_data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('empty', response.data['detail'].lower())

    def test_shipping_required_field_validation(self):
        self.client.force_authenticate(user=self.user)
        cart = Cart.objects.create(customer=self.user)
        CartItem.objects.create(cart=cart, book=self.book1, quantity=1)

        invalid_data = self.valid_shipping_data.copy()
        invalid_data['customer_name'] = ''
        invalid_data['shipping_address_line1'] = ''

        response = self.client.post(self.checkout_url, invalid_data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('customer_name', response.data)
        self.assertIn('shipping_address_line1', response.data)

    def test_successful_checkout_and_inventory_deduction(self):
        self.client.force_authenticate(user=self.user)
        cart = Cart.objects.create(customer=self.user)
        CartItem.objects.create(cart=cart, book=self.book1, quantity=2) # 2 * $20.00 = $40.00
        CartItem.objects.create(cart=cart, book=self.book2, quantity=1) # 1 * $18.50 = $18.50

        initial_stock_1 = self.book1.stock_quantity
        initial_stock_2 = self.book2.stock_quantity

        response = self.client.post(self.checkout_url, self.valid_shipping_data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        order_data = response.data['order']
        self.assertTrue(order_data['reference'].startswith('EXL-'))
        self.assertEqual(order_data['order_status'], Order.STATUS_CONFIRMED)
        self.assertEqual(order_data['payment_status'], Order.PAYMENT_PAID)
        self.assertEqual(order_data['subtotal'], '58.50')
        self.assertEqual(order_data['total_amount'], '58.50')
        self.assertEqual(order_data['item_count'], 3)
        self.assertEqual(len(order_data['items']), 2)

        # Inventory deduction verified
        self.book1.refresh_from_db()
        self.book2.refresh_from_db()
        self.assertEqual(self.book1.stock_quantity, initial_stock_1 - 2)
        self.assertEqual(self.book2.stock_quantity, initial_stock_2 - 1)

        # Cart cleared verified
        cart.refresh_from_db()
        self.assertEqual(cart.items.count(), 0)

    def test_insufficient_stock_rejection_preserves_inventory(self):
        self.client.force_authenticate(user=self.user)
        cart = Cart.objects.create(customer=self.user)
        # Attempt to checkout with quantity exceeding stock
        CartItem.objects.create(cart=cart, book=self.book2, quantity=10) # Available is only 5

        initial_stock_2 = self.book2.stock_quantity
        response = self.client.post(self.checkout_url, self.valid_shipping_data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('insufficient stock', response.data['detail'].lower())

        # Inventory unchanged
        self.book2.refresh_from_db()
        self.assertEqual(self.book2.stock_quantity, initial_stock_2)

        # Cart remains intact
        cart.refresh_from_db()
        self.assertEqual(cart.items.count(), 1)

    def test_inactive_book_rejection(self):
        self.client.force_authenticate(user=self.user)
        cart = Cart.objects.create(customer=self.user)
        self.book1.is_active = False
        self.book1.save()

        CartItem.objects.create(cart=cart, book=self.book1, quantity=1)

        response = self.client.post(self.checkout_url, self.valid_shipping_data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('no longer active', response.data['detail'].lower())

    def test_purchase_time_price_snapshot_immutability(self):
        self.client.force_authenticate(user=self.user)
        cart = Cart.objects.create(customer=self.user)
        CartItem.objects.create(cart=cart, book=self.book1, quantity=1)

        response = self.client.post(self.checkout_url, self.valid_shipping_data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        reference = response.data['order']['reference']

        # Now catalogue price changes significantly
        self.book1.price = Decimal('99.99')
        self.book1.discount_price = Decimal('89.99')
        self.book1.save()

        # Retrieve order details from API
        detail_url = reverse('orders:order-detail', kwargs={'reference': reference})
        detail_res = self.client.get(detail_url)
        self.assertEqual(detail_res.status_code, status.HTTP_200_OK)

        # Historical purchase price remains unaffected at $20.00
        item = detail_res.data['items'][0]
        self.assertEqual(item['unit_price'], '20.00')
        self.assertEqual(detail_res.data['total_amount'], '20.00')

    def test_idempotency_prevents_duplicate_orders(self):
        self.client.force_authenticate(user=self.user)
        cart = Cart.objects.create(customer=self.user)
        CartItem.objects.create(cart=cart, book=self.book1, quantity=1)

        data = self.valid_shipping_data.copy()
        data['idempotency_key'] = 'idemp_key_12345'

        # First checkout attempt
        res1 = self.client.post(self.checkout_url, data)
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)
        ref1 = res1.data['order']['reference']

        # Second submission with the same idempotency key
        res2 = self.client.post(self.checkout_url, data)
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(res2.data['order']['reference'], ref1)

        # Only one order was created in DB
        self.assertEqual(Order.objects.filter(customer=self.user).count(), 1)

    def test_customer_order_isolation_and_permissions(self):
        # Create an order for user A
        self.client.force_authenticate(user=self.user)
        cart = Cart.objects.create(customer=self.user)
        CartItem.objects.create(cart=cart, book=self.book1, quantity=1)
        res_a = self.client.post(self.checkout_url, self.valid_shipping_data)
        ref_a = res_a.data['order']['reference']

        # Log in as user B
        self.client.force_authenticate(user=self.other_user)

        # User B order list should be empty
        list_res = self.client.get(self.order_list_url)
        self.assertEqual(list_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_res.data), 0)

        # User B attempting to view User A's order detail must return 404
        detail_url_a = reverse('orders:order-detail', kwargs={'reference': ref_a})
        detail_res = self.client.get(detail_url_a)
        self.assertEqual(detail_res.status_code, status.HTTP_404_NOT_FOUND)
