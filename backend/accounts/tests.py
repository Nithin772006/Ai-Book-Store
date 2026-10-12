from django.contrib.auth.models import User
from django.contrib.auth.hashers import is_password_usable
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework.authtoken.models import Token


class AuthEndpointsTestCase(APITestCase):
    """
    Test suite for Phase 4 user authentication and customer account management.
    """

    def setUp(self):
        self.register_url = reverse('auth-register')
        self.login_url = reverse('auth-login')
        self.logout_url = reverse('auth-logout')
        self.me_url = reverse('auth-me')
        self.csrf_url = reverse('auth-csrf')
        self.health_url = reverse('health-check')
        self.books_url = reverse('book-list')
        self.categories_url = reverse('category-list')

        # Create an existing test user
        self.existing_password = 'ExLibrisStrongPass!2026'
        self.existing_user = User.objects.create_user(
            username='claudia_reader',
            email='claudia@exlibris-books.com',
            password=self.existing_password,
            first_name='Claudia',
            last_name='Borges'
        )

    def test_successful_registration(self):
        """Test customer can register with valid credentials and receive token + public profile."""
        payload = {
            'name': 'Ada Lovelace',
            'email': 'ada.lovelace@analytical-engine.org',
            'username': 'ada_lovelace',
            'password': 'AdaStrongPassword!2026',
            'password_confirm': 'AdaStrongPassword!2026',
        }
        response = self.client.post(self.register_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('token', response.data)
        self.assertIn('user', response.data)
        self.assertEqual(response.data['user']['email'], 'ada.lovelace@analytical-engine.org')
        self.assertEqual(response.data['user']['full_name'], 'Ada Lovelace')
        self.assertEqual(response.data['user']['initials'], 'AL')

        # Verify user was created in database
        user = User.objects.filter(email='ada.lovelace@analytical-engine.org').first()
        self.assertIsNotNone(user)
        self.assertEqual(user.first_name, 'Ada')
        self.assertEqual(user.last_name, 'Lovelace')

    def test_registration_password_is_securely_hashed(self):
        """Verify that password is never stored or returned as plaintext."""
        payload = {
            'name': 'Alan Turing',
            'email': 'alan.turing@bletchley.ac.uk',
            'password': 'TuringMachinePass!2026',
            'password_confirm': 'TuringMachinePass!2026',
        }
        response = self.client.post(self.register_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        user = User.objects.get(email='alan.turing@bletchley.ac.uk')
        # Ensure password is not stored plaintext
        self.assertNotEqual(user.password, 'TuringMachinePass!2026')
        self.assertTrue(user.check_password('TuringMachinePass!2026'))
        self.assertTrue(user.password.startswith('pbkdf2_') or is_password_usable(user.password))
        # Ensure password or hash is never returned in API response
        self.assertNotIn('password', response.data['user'])
        self.assertNotIn('password_hash', response.data['user'])

    def test_registration_invalid_data(self):
        """Test registration validation errors for mismatched and short passwords."""
        # Mismatched passwords
        payload_mismatch = {
            'email': 'mismatch@example.com',
            'password': 'FirstValidPassword!2026',
            'password_confirm': 'DifferentPassword!2026',
        }
        res_mismatch = self.client.post(self.register_url, payload_mismatch, format='json')
        self.assertEqual(res_mismatch.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password_confirm', res_mismatch.data)

        # Invalid email format
        payload_invalid_email = {
            'email': 'not-an-email',
            'password': 'ValidPassword!2026',
            'password_confirm': 'ValidPassword!2026',
        }
        res_email = self.client.post(self.register_url, payload_invalid_email, format='json')
        self.assertEqual(res_email.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', res_email.data)

        # Password failing Django validators (e.g. too short)
        payload_short_pass = {
            'email': 'short@example.com',
            'password': '123',
            'password_confirm': '123',
        }
        res_short = self.client.post(self.register_url, payload_short_pass, format='json')
        self.assertEqual(res_short.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password', res_short.data)

    def test_registration_duplicate_account_rejection(self):
        """Test rejection when registering with an existing email or username."""
        # Duplicate email (case-insensitive)
        payload_dup_email = {
            'email': 'CLAUDIA@exlibris-books.com',
            'username': 'unique_user_99',
            'password': 'AnotherPass!2026',
            'password_confirm': 'AnotherPass!2026',
        }
        res_dup_email = self.client.post(self.register_url, payload_dup_email, format='json')
        self.assertEqual(res_dup_email.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', res_dup_email.data)

        # Duplicate username
        payload_dup_user = {
            'email': 'unique_email_88@example.com',
            'username': 'claudia_reader',
            'password': 'AnotherPass!2026',
            'password_confirm': 'AnotherPass!2026',
        }
        res_dup_user = self.client.post(self.register_url, payload_dup_user, format='json')
        self.assertEqual(res_dup_user.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('username', res_dup_user.data)

    def test_successful_login_with_email_and_username(self):
        """Test customer can log in using either their registered email or username."""
        # Login using email
        res_email = self.client.post(self.login_url, {
            'identifier': 'claudia@exlibris-books.com',
            'password': self.existing_password,
        }, format='json')
        self.assertEqual(res_email.status_code, status.HTTP_200_OK)
        self.assertIn('token', res_email.data)
        self.assertEqual(res_email.data['user']['email'], 'claudia@exlibris-books.com')

        # Login using username
        res_user = self.client.post(self.login_url, {
            'identifier': 'claudia_reader',
            'password': self.existing_password,
        }, format='json')
        self.assertEqual(res_user.status_code, status.HTTP_200_OK)
        self.assertIn('token', res_user.data)

    def test_invalid_login_credentials(self):
        """Test invalid credentials return generic user-friendly error."""
        response = self.client.post(self.login_url, {
            'identifier': 'claudia@exlibris-books.com',
            'password': 'WrongPassword!2026',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        # Verify no sensitive stack trace or token is returned
        self.assertNotIn('token', response.data)

        # Nonexistent account
        response_nonexistent = self.client.post(self.login_url, {
            'identifier': 'does_not_exist@example.com',
            'password': 'AnyPassword!2026',
        }, format='json')
        self.assertEqual(response_nonexistent.status_code, status.HTTP_400_BAD_REQUEST)

    def test_authenticated_profile_access(self):
        """Test GET /api/auth/me/ returns only authenticated user's profile."""
        token, _ = Token.objects.get_or_create(user=self.existing_user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

        response = self.client.get(self.me_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['email'], self.existing_user.email)
        self.assertEqual(response.data['username'], self.existing_user.username)
        self.assertEqual(response.data['full_name'], 'Claudia Borges')

    def test_anonymous_profile_access_rejected(self):
        """Test anonymous request to /api/auth/me/ receives HTTP 401 Unauthorized."""
        response = self.client.get(self.me_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_invalidates_token(self):
        """Test POST /api/auth/logout/ deletes token and rejects subsequent access."""
        token, _ = Token.objects.get_or_create(user=self.existing_user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

        logout_res = self.client.post(self.logout_url)
        self.assertEqual(logout_res.status_code, status.HTTP_200_OK)

        # Verify token is deleted from DB
        self.assertFalse(Token.objects.filter(key=token.key).exists())

        # Verify subsequent requests with old token fail with 401
        subsequent_res = self.client.get(self.me_url)
        self.assertEqual(subsequent_res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_csrf_endpoint(self):
        """Test GET /api/auth/csrf/ issues CSRF token successfully."""
        response = self.client.get(self.csrf_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('csrfToken', response.data)

    def test_existing_catalogue_endpoints_remain_public(self):
        """Verify that existing catalogue endpoints remain public and functional without auth."""
        res_books = self.client.get(self.books_url)
        self.assertEqual(res_books.status_code, status.HTTP_200_OK)

        res_cats = self.client.get(self.categories_url)
        self.assertEqual(res_cats.status_code, status.HTTP_200_OK)

    def test_existing_health_endpoint_remains_functional(self):
        """Verify that /api/health/ remains fully accessible."""
        res_health = self.client.get(self.health_url)
        self.assertEqual(res_health.status_code, status.HTTP_200_OK)
        self.assertEqual(res_health.data['status'], 'success')
