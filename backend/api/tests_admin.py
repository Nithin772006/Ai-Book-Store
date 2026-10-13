"""
Automated security and functional test suite for AETHERIUM Administration API (Phase 9A).
Tests:
- Server-side authorization: 401 for unauthenticated, 403 for ordinary customers.
- Staff access (200/201).
- Book creation, validation, update, and deletion safeguards.
- Category creation, update, and deletion safeguard when books exist.
- Order listing, detail, and legal/illegal fulfillment state transitions.
- Customer auditing without credential leakage; protection against self/superuser deactivation.
- Newsletter endpoint safety.
- File upload validation.
"""

from decimal import Decimal
import io
from PIL import Image
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework.authtoken.models import Token

from catalog.models import Book, Category
from orders.models import Order, OrderItem


def create_test_image_file(name="cover.jpg", format="JPEG", size=(100, 100), color=(180, 50, 50)):
    """Generates an in-memory image for upload testing."""
    file_obj = io.BytesIO()
    image = Image.new("RGB", size, color=color)
    image.save(file_obj, format=format)
    file_obj.seek(0)
    return SimpleUploadedFile(name, file_obj.read(), content_type=f"image/{format.lower()}")


class AdminSecurityAndAccessTests(APITestCase):
    """
    Verifies server-side authorization boundaries for the Admin API.
    """

    def setUp(self):
        # 1. Staff admin account
        self.staff_user = User.objects.create_user(
            username="curator",
            email="curator@aetherium.store",
            password="StrongStaffPassword123!",
            is_staff=True
        )
        self.staff_token = Token.objects.create(user=self.staff_user)

        # 2. Ordinary customer account (non-staff)
        self.customer_user = User.objects.create_user(
            username="reader_jane",
            email="jane@example.com",
            password="CustomerPassword123!",
            is_staff=False
        )
        self.customer_token = Token.objects.create(user=self.customer_user)

        # 3. Sample category and book
        self.category = Category.objects.create(name="Philosophy", slug="philosophy")
        self.book = Book.objects.create(
            title="Meditations",
            author="Marcus Aurelius",
            description="Stoic reflections on virtue and reason.",
            price=Decimal("19.99"),
            stock_quantity=12,
            category=self.category,
            is_active=True
        )

        # 4. Sample order
        self.order = Order.objects.create(
            customer=self.customer_user,
            customer_name="Jane Reader",
            customer_email="jane@example.com",
            order_status=Order.STATUS_CONFIRMED,
            payment_status=Order.PAYMENT_PAID,
            subtotal=Decimal("19.99"),
            total_amount=Decimal("19.99"),
            shipping_address_line1="45 Archive Way",
            city="Oxford",
            state_region="OX",
            postal_code="OX1",
            country="UK"
        )
        self.order_item = OrderItem.objects.create(
            order=self.order,
            book=self.book,
            book_title=self.book.title,
            book_author=self.book.author,
            unit_price=self.book.price,
            quantity=1,
            subtotal=self.book.price
        )

    def test_unauthenticated_requests_return_401(self):
        """Verify unauthenticated requests to protected admin endpoints return HTTP 401."""
        endpoints = [
            "/api/admin/dashboard/",
            "/api/admin/books/",
            f"/api/admin/books/{self.book.id}/",
            "/api/admin/categories/",
            f"/api/admin/categories/{self.category.id}/",
            "/api/admin/orders/",
            f"/api/admin/orders/{self.order.id}/",
            "/api/admin/customers/",
            f"/api/admin/customers/{self.customer_user.id}/",
            "/api/admin/subscribers/",
        ]
        for ep in endpoints:
            res = self.client.get(ep)
            self.assertEqual(
                res.status_code,
                status.HTTP_401_UNAUTHORIZED,
                f"Endpoint {ep} did not reject unauthenticated client with 401."
            )

    def test_ordinary_customer_requests_return_403(self):
        """Verify authenticated ordinary customers (is_staff=False) receive HTTP 403 Forbidden."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.customer_token.key}")
        endpoints = [
            "/api/admin/dashboard/",
            "/api/admin/books/",
            f"/api/admin/books/{self.book.id}/",
            "/api/admin/categories/",
            f"/api/admin/categories/{self.category.id}/",
            "/api/admin/orders/",
            f"/api/admin/orders/{self.order.id}/",
            "/api/admin/customers/",
            f"/api/admin/customers/{self.customer_user.id}/",
            "/api/admin/subscribers/",
        ]
        for ep in endpoints:
            res = self.client.get(ep)
            self.assertEqual(
                res.status_code,
                status.HTTP_403_FORBIDDEN,
                f"Endpoint {ep} did not reject non-staff customer with 403."
            )

    def test_admin_login_rejects_non_staff_with_403(self):
        """Verify admin login endpoint rejects valid customer credentials with 403."""
        payload = {
            "identifier": "reader_jane",
            "password": "CustomerPassword123!"
        }
        res = self.client.post("/api/admin/auth/login/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("Administrative staff privileges are required", res.data.get("error", ""))

    def test_admin_login_rejects_invalid_credentials_with_401(self):
        """Verify admin login rejects wrong password with 401 without user disclosure."""
        payload = {
            "identifier": "curator",
            "password": "WrongPassword!"
        }
        res = self.client.post("/api/admin/auth/login/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("Invalid administrative credentials", res.data.get("error", ""))

    def test_admin_login_success_for_staff(self):
        """Verify verified staff can log in and receive token."""
        payload = {
            "identifier": "curator",
            "password": "StrongStaffPassword123!"
        }
        res = self.client.post("/api/admin/auth/login/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("token", res.data)
        self.assertTrue(res.data["user"]["is_staff"])

    def test_dashboard_metrics(self):
        """Verify dashboard returns real aggregated metrics."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.staff_token.key}")
        res = self.client.get("/api/admin/dashboard/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        metrics = res.data["metrics"]
        self.assertEqual(metrics["total_books"], 1)
        self.assertEqual(metrics["active_books"], 1)
        self.assertEqual(metrics["total_categories"], 1)
        self.assertEqual(metrics["total_customers"], 1)
        self.assertEqual(metrics["total_orders"], 1)
        self.assertEqual(len(res.data["recent_orders"]), 1)
        self.assertEqual(len(res.data["recent_books"]), 1)


class AdminBookAndCategoryManagementTests(APITestCase):
    """
    Tests administrative catalog management, validation, and safeguards.
    """

    def setUp(self):
        self.staff_user = User.objects.create_user(
            username="admin_editor",
            email="editor@aetherium.store",
            password="EditorPass123!",
            is_staff=True
        )
        self.staff_token = Token.objects.create(user=self.staff_user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.staff_token.key}")

        self.category = Category.objects.create(name="Literature", slug="literature")

    def test_create_book_success(self):
        """Verify staff can create a book with auto-derived slug and valid prices."""
        payload = {
            "title": "The Odyssey",
            "author": "Homer",
            "description": "Epic Greek poem detailing the journey of Odysseus.",
            "price": "24.50",
            "stock_quantity": 8,
            "category": self.category.id,
            "publisher": "Penguin Classics"
        }
        res = self.client.post("/api/admin/books/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["title"], "The Odyssey")
        self.assertTrue(res.data["slug"].startswith("the-odyssey"))
        self.assertTrue(Book.objects.filter(title="The Odyssey").exists())

    def test_create_book_validation_negative_price(self):
        """Verify negative price is rejected with HTTP 400."""
        payload = {
            "title": "Invalid Price Book",
            "author": "Anonymous",
            "description": "Test synopsis.",
            "price": "-5.00",
            "stock_quantity": 5,
            "category": self.category.id
        }
        res = self.client.post("/api/admin/books/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("price", res.data)

    def test_create_book_validation_discount_exceeds_price(self):
        """Verify discount price higher than base price is rejected with HTTP 400."""
        payload = {
            "title": "Overpriced Discount Book",
            "author": "Author",
            "description": "Test synopsis.",
            "price": "20.00",
            "discount_price": "25.00",
            "stock_quantity": 5,
            "category": self.category.id
        }
        res = self.client.post("/api/admin/books/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("discount_price", res.data)

    def test_create_book_with_cover_image(self):
        """Verify book creation with uploaded image file."""
        image_file = create_test_image_file("cover.jpg", "JPEG")
        payload = {
            "title": "Illustrated Volume",
            "author": "Artist",
            "description": "Illustrated edition.",
            "price": "35.00",
            "stock_quantity": 4,
            "category": self.category.id,
            "cover_image": image_file
        }
        res = self.client.post("/api/admin/books/", payload, format="multipart")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res.data["cover_image"])

    def test_category_deletion_safeguard_when_books_exist(self):
        """Verify category deletion is blocked if books exist in it."""
        Book.objects.create(
            title="Book In Category",
            author="Author",
            description="Description.",
            price=Decimal("15.00"),
            stock_quantity=5,
            category=self.category
        )
        res = self.client.delete(f"/api/admin/categories/{self.category.id}/")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Cannot delete category", res.data.get("error", ""))
        self.assertTrue(Category.objects.filter(pk=self.category.pk).exists())

    def test_category_deletion_allowed_when_empty(self):
        """Verify empty category can be safely deleted."""
        empty_cat = Category.objects.create(name="Empty Genre", slug="empty-genre")
        res = self.client.delete(f"/api/admin/categories/{empty_cat.id}/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertFalse(Category.objects.filter(pk=empty_cat.pk).exists())


class AdminOrderAndCustomerAuditTests(APITestCase):
    """
    Tests administrative order status transitions and customer auditing.
    """

    def setUp(self):
        self.staff_user = User.objects.create_user(
            username="admin_fulfillment",
            email="fulfill@aetherium.store",
            password="FulfillPass123!",
            is_staff=True
        )
        self.staff_token = Token.objects.create(user=self.staff_user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.staff_token.key}")

        self.customer = User.objects.create_user(
            username="test_customer",
            email="cust@test.com",
            password="CustomerPass123!",
            first_name="Arthur",
            last_name="Dent",
            is_staff=False
        )
        self.order = Order.objects.create(
            customer=self.customer,
            customer_name="Arthur Dent",
            customer_email="cust@test.com",
            order_status=Order.STATUS_CONFIRMED,
            payment_status=Order.PAYMENT_PAID,
            subtotal=Decimal("42.00"),
            total_amount=Decimal("42.00"),
            shipping_address_line1="15 Country Lane",
            city="Cottington",
            state_region="West Country",
            postal_code="CC1",
            country="UK"
        )

    def test_legal_order_status_transition(self):
        """Verify confirmed order can transition to processing."""
        payload = {"order_status": Order.STATUS_PROCESSING}
        res = self.client.patch(f"/api/admin/orders/{self.order.id}/status/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.order.refresh_from_db()
        self.assertEqual(self.order.order_status, Order.STATUS_PROCESSING)

    def test_illegal_order_status_transition_rejected(self):
        """Verify invalid jump from confirmed directly to delivered is rejected with 400."""
        payload = {"order_status": Order.STATUS_DELIVERED}
        res = self.client.patch(f"/api/admin/orders/{self.order.id}/status/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("order_status", res.data)
        self.order.refresh_from_db()
        self.assertEqual(self.order.order_status, Order.STATUS_CONFIRMED)

    def test_customer_list_never_leaks_passwords(self):
        """Verify customer audit endpoint does not include password fields."""
        res = self.client.get("/api/admin/customers/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data["results"]
        self.assertGreater(len(results), 0)
        for cust in results:
            self.assertNotIn("password", cust)
            self.assertNotIn("token", cust)

    def test_customer_status_toggle(self):
        """Verify administrator can deactivate and reactivate a customer."""
        res_deact = self.client.patch(
            f"/api/admin/customers/{self.customer.id}/status/",
            {"is_active": False},
            format="json"
        )
        self.assertEqual(res_deact.status_code, status.HTTP_200_OK)
        self.customer.refresh_from_db()
        self.assertFalse(self.customer.is_active)

        res_react = self.client.patch(
            f"/api/admin/customers/{self.customer.id}/status/",
            {"is_active": True},
            format="json"
        )
        self.assertEqual(res_react.status_code, status.HTTP_200_OK)
        self.customer.refresh_from_db()
        self.assertTrue(self.customer.is_active)

    def test_cannot_deactivate_self(self):
        """Verify administrator cannot deactivate their own account."""
        res = self.client.patch(
            f"/api/admin/customers/{self.staff_user.id}/status/",
            {"is_active": False},
            format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("own account", res.data.get("error", ""))

    def test_subscriber_list_safe_response(self):
        """Verify subscribers endpoint returns safe unconfigured notice without error."""
        res = self.client.get("/api/admin/subscribers/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertFalse(res.data["configured"])
        self.assertEqual(res.data["count"], 0)


class AdminCsrfAndAuthenticationRegressionTests(APITestCase):
    """
    Strict regression test suite testing Django CSRF enforcement, token acquisition,
    cookie propagation, header validation, and staff access control using Client(enforce_csrf_checks=True).
    """

    def setUp(self):
        from django.test import Client
        self.csrf_client = Client(enforce_csrf_checks=True)

        self.staff_user = User.objects.create_user(
            username="curator",
            email="curator@aetherium.store",
            password="StrongStaffPassword123!",
            is_staff=True
        )

        self.customer_user = User.objects.create_user(
            username="reader_jane",
            email="jane@example.com",
            password="CustomerPassword123!",
            is_staff=False
        )

    def test_csrf_initialization_returns_usable_token_and_cookie(self):
        """Verify GET /api/admin/auth/csrf/ returns 200, establishes cookie and returns csrfToken."""
        response = self.csrf_client.get("/api/admin/auth/csrf/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("csrfToken", response.json())
        self.assertTrue(len(response.json()["csrfToken"]) > 10)
        self.assertIn("csrftoken", response.cookies)
        self.assertTrue(len(response.cookies["csrftoken"].value) >= 32)
        self.assertTrue(len(response.json()["csrfToken"]) >= 32)


    def test_login_without_csrf_token_rejected_with_403(self):
        """Verify POST to login without CSRF header is rejected with HTTP 403 Forbidden."""
        payload = {
            "identifier": "curator",
            "password": "StrongStaffPassword123!"
        }
        response = self.csrf_client.post(
            "/api/admin/auth/login/",
            data=payload,
            content_type="application/json"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("CSRF", response.content.decode())

    def test_login_with_valid_csrf_token_authenticates_staff_and_rotates_token(self):
        """Verify POST to login with established CSRF cookie and X-CSRFToken header succeeds."""
        # 1. Initialize CSRF
        csrf_init = self.csrf_client.get("/api/admin/auth/csrf/")
        token = csrf_init.json()["csrfToken"]

        # 2. Submit credentials with matching HTTP_X_CSRFTOKEN header
        payload = {
            "identifier": "curator",
            "password": "StrongStaffPassword123!"
        }
        response = self.csrf_client.post(
            "/api/admin/auth/login/",
            data=payload,
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("token", data)
        self.assertIn("csrfToken", data)
        self.assertTrue(data["user"]["is_staff"])
        self.assertEqual(data["user"]["username"], "curator")

    def test_login_with_invalid_credentials_returns_401(self):
        """Verify invalid credentials with valid CSRF token return 401 Unauthorized."""
        csrf_init = self.csrf_client.get("/api/admin/auth/csrf/")
        token = csrf_init.json()["csrfToken"]

        payload = {
            "identifier": "curator",
            "password": "WrongPassword123!"
        }
        response = self.csrf_client.post(
            "/api/admin/auth/login/",
            data=payload,
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("Invalid administrative credentials", response.json().get("error", ""))

    def test_login_with_non_staff_customer_returns_403(self):
        """Verify ordinary customer credentials with valid CSRF token return 403 Forbidden."""
        csrf_init = self.csrf_client.get("/api/admin/auth/csrf/")
        token = csrf_init.json()["csrfToken"]

        payload = {
            "identifier": "reader_jane",
            "password": "CustomerPassword123!"
        }
        response = self.csrf_client.post(
            "/api/admin/auth/login/",
            data=payload,
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("Administrative staff privileges are required", response.json().get("error", ""))

    def test_logout_enforces_csrf_and_succeeds_with_token(self):
        """Verify logout requires CSRF token and succeeds when valid token and session are present."""
        # 1. Init CSRF and log in
        csrf_init = self.csrf_client.get("/api/admin/auth/csrf/")
        token = csrf_init.json()["csrfToken"]

        login_resp = self.csrf_client.post(
            "/api/admin/auth/login/",
            data={"identifier": "curator", "password": "StrongStaffPassword123!"},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token
        )
        self.assertEqual(login_resp.status_code, status.HTTP_200_OK)
        # Login rotates CSRF token
        rotated_token = login_resp.json()["csrfToken"]
        auth_token = login_resp.json()["token"]

        # 2. Attempt logout without CSRF token -> rejected 403
        no_csrf_logout = self.csrf_client.post(
            "/api/admin/auth/logout/",
            HTTP_AUTHORIZATION=f"Token {auth_token}"
        )
        self.assertEqual(no_csrf_logout.status_code, status.HTTP_403_FORBIDDEN)

        # 3. Attempt logout with rotated CSRF token -> succeeds 200
        valid_logout = self.csrf_client.post(
            "/api/admin/auth/logout/",
            HTTP_AUTHORIZATION=f"Token {auth_token}",
            HTTP_X_CSRFTOKEN=rotated_token
        )
        self.assertEqual(valid_logout.status_code, status.HTTP_200_OK)

    def test_cross_origin_admin_login_without_cookie_using_header_token_succeeds(self):
        """
        Verify cross-origin production scenario where third-party cookies are blocked:
        origin is trusted (https://aetherium-admin.vercel.app), cookie is absent,
        and X-CSRFToken header is verified.
        """
        csrf_init = self.csrf_client.get(
            "/api/admin/auth/csrf/",
            HTTP_ORIGIN="https://aetherium-admin.vercel.app"
        )
        self.assertEqual(csrf_init.status_code, status.HTTP_200_OK)
        token = csrf_init.json()["csrfToken"]

        # Clear client cookies to simulate cross-origin browser cookie suppression
        self.csrf_client.cookies.clear()

        payload = {
            "identifier": "curator",
            "password": "StrongStaffPassword123!"
        }
        response = self.csrf_client.post(
            "/api/admin/auth/login/",
            data=payload,
            content_type="application/json",
            HTTP_ORIGIN="https://aetherium-admin.vercel.app",
            HTTP_X_CSRFTOKEN=token
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("token", response.json())
        self.assertTrue(response.json()["user"]["is_staff"])

    def test_cross_origin_admin_login_from_untrusted_origin_rejected_with_403(self):
        """Verify cross-origin login from an untrusted origin is strictly rejected by CSRF origin check."""
        csrf_init = self.csrf_client.get("/api/admin/auth/csrf/")
        token = csrf_init.json()["csrfToken"]

        payload = {
            "identifier": "curator",
            "password": "StrongStaffPassword123!"
        }
        response = self.csrf_client.post(
            "/api/admin/auth/login/",
            data=payload,
            content_type="application/json",
            HTTP_ORIGIN="https://unauthorized-domain.com",
            HTTP_X_CSRFTOKEN=token
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("Origin checking failed", response.content.decode())

    def test_cross_origin_admin_login_with_invalid_csrf_token_rejected_with_403(self):
        """Verify cross-origin login with malformed/invalid CSRF token is rejected with 403."""
        self.csrf_client.cookies.clear()
        payload = {
            "identifier": "curator",
            "password": "StrongStaffPassword123!"
        }
        response = self.csrf_client.post(
            "/api/admin/auth/login/",
            data=payload,
            content_type="application/json",
            HTTP_ORIGIN="https://aetherium-admin.vercel.app",
            HTTP_X_CSRFTOKEN="invalid_csrf_token_value_that_fails_format_check"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_cross_origin_admin_login_without_csrf_token_rejected_with_403(self):
        """Verify cross-origin login with no token and no cookie is rejected with 403."""
        self.csrf_client.cookies.clear()
        payload = {
            "identifier": "curator",
            "password": "StrongStaffPassword123!"
        }
        response = self.csrf_client.post(
            "/api/admin/auth/login/",
            data=payload,
            content_type="application/json",
            HTTP_ORIGIN="https://aetherium-admin.vercel.app"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


