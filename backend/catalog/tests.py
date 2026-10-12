from decimal import Decimal
from django.test import TestCase
from django.core.exceptions import ValidationError
from django.contrib import admin
from catalog.models import Category, Book
from catalog.admin import CategoryAdmin, BookAdmin


class CategoryModelTests(TestCase):
    def test_category_creation_and_str(self):
        """Verify Category can be created and __str__ returns the name."""
        category = Category.objects.create(
            name="Technology",
            description="Books about computer science and modern tech."
        )
        self.assertEqual(str(category), "Technology")
        self.assertTrue(category.is_active)
        self.assertEqual(category.slug, "technology")

    def test_category_automatic_slug_generation(self):
        """Verify category generates a slug when one is not supplied."""
        category = Category.objects.create(name="Artificial Intelligence")
        self.assertEqual(category.slug, "artificial-intelligence")

    def test_category_duplicate_slug_handling(self):
        """Verify collisions in slug generation append an incremented suffix."""
        cat1 = Category.objects.create(name="Data Science", slug="data-science")
        cat2 = Category(name="Data Science Duplicate")
        cat2.save()
        # Should generate a distinct slug
        self.assertNotEqual(cat1.slug, cat2.slug)
        self.assertTrue(cat2.slug.startswith("data-science"))


class BookModelTests(TestCase):
    def setUp(self):
        self.category = Category.objects.create(
            name="Computer Science",
            description="CS and programming books"
        )

    def test_book_creation_and_relationship(self):
        """Verify Book creation and reverse relationship from Category."""
        book = Book.objects.create(
            title="Clean Code",
            author="Robert C. Martin",
            description="A Handbook of Agile Software Craftsmanship",
            category=self.category,
            price=Decimal("34.99"),
            stock_quantity=15,
        )
        self.assertEqual(str(book), "Clean Code by Robert C. Martin")
        self.assertEqual(book.category, self.category)
        self.assertIn(book, self.category.books.all())
        self.assertEqual(book.slug, "clean-code")
        self.assertTrue(book.is_active)

    def test_book_automatic_slug_generation(self):
        """Verify slug is automatically generated from title if omitted."""
        book = Book.objects.create(
            title="Design Patterns: Elements of Reusable Object-Oriented Software",
            author="Erich Gamma et al.",
            description="Gang of Four design patterns guide.",
            category=self.category,
            price=Decimal("49.99"),
        )
        self.assertTrue(book.slug.startswith("design-patterns"))

    def test_book_duplicate_slug_handling(self):
        """Verify duplicate titles generate unique slugs with incremental suffixes."""
        book1 = Book.objects.create(
            title="Python Crash Course",
            author="Eric Matthes",
            description="First edition",
            category=self.category,
            price=Decimal("29.99"),
        )
        book2 = Book.objects.create(
            title="Python Crash Course",
            author="Eric Matthes",
            description="Second edition with same title",
            category=self.category,
            price=Decimal("32.99"),
        )
        self.assertEqual(book1.slug, "python-crash-course")
        self.assertEqual(book2.slug, "python-crash-course-1")
        self.assertNotEqual(book1.slug, book2.slug)

    def test_optional_isbn_behavior(self):
        """Verify multiple books can be created without ISBNs without conflict."""
        book1 = Book.objects.create(
            title="Book Without ISBN 1",
            author="Author One",
            description="Desc 1",
            category=self.category,
            price=Decimal("19.99"),
            isbn=None,
        )
        book2 = Book.objects.create(
            title="Book Without ISBN 2",
            author="Author Two",
            description="Desc 2",
            category=self.category,
            price=Decimal("24.99"),
            isbn="",
        )
        self.assertIsNone(book1.isbn)
        self.assertIsNone(book2.isbn)

    def test_duplicate_isbn_prevention(self):
        """Verify attempting to save duplicate non-empty ISBN raises ValidationError."""
        Book.objects.create(
            title="Original Book",
            author="Author A",
            description="Desc A",
            category=self.category,
            price=Decimal("15.00"),
            isbn="978-0132350884",
        )
        duplicate_book = Book(
            title="Duplicate ISBN Book",
            author="Author B",
            description="Desc B",
            category=self.category,
            price=Decimal("20.00"),
            isbn="978-0132350884",
        )
        with self.assertRaises(ValidationError) as ctx:
            duplicate_book.full_clean()
        self.assertIn("isbn", ctx.exception.message_dict)

    def test_non_negative_price_validation(self):
        """Verify negative price is rejected by model validation."""
        book = Book(
            title="Invalid Price Book",
            author="Test Author",
            description="Test Desc",
            category=self.category,
            price=Decimal("-10.00"),
        )
        with self.assertRaises(ValidationError) as ctx:
            book.full_clean()
        self.assertIn("price", ctx.exception.message_dict)

    def test_discount_price_validation_negative(self):
        """Verify negative discount price is rejected."""
        book = Book(
            title="Invalid Discount Book",
            author="Test Author",
            description="Test Desc",
            category=self.category,
            price=Decimal("25.00"),
            discount_price=Decimal("-5.00"),
        )
        with self.assertRaises(ValidationError) as ctx:
            book.full_clean()
        self.assertIn("discount_price", ctx.exception.message_dict)

    def test_discount_price_exceeding_regular_price_validation(self):
        """Verify discount price higher than regular price is rejected."""
        book = Book(
            title="High Discount Book",
            author="Test Author",
            description="Test Desc",
            category=self.category,
            price=Decimal("25.00"),
            discount_price=Decimal("30.00"),
        )
        with self.assertRaises(ValidationError) as ctx:
            book.full_clean()
        self.assertIn("discount_price", ctx.exception.message_dict)

    def test_valid_discount_price_succeeds(self):
        """Verify discount price lower than regular price is accepted."""
        book = Book.objects.create(
            title="Discounted Tech Book",
            author="Test Author",
            description="Test Desc",
            category=self.category,
            price=Decimal("40.00"),
            discount_price=Decimal("29.99"),
        )
        self.assertEqual(book.discount_price, Decimal("29.99"))
        self.assertLess(book.discount_price, book.price)


class AdminRegistrationTests(TestCase):
    def test_category_admin_registered(self):
        """Verify Category is registered with CategoryAdmin in admin site."""
        self.assertIn(Category, admin.site._registry)
        model_admin = admin.site._registry[Category]
        self.assertIsInstance(model_admin, CategoryAdmin)
        self.assertIn("name", model_admin.search_fields)
        self.assertIn("is_active", model_admin.list_filter)

    def test_book_admin_registered(self):
        """Verify Book is registered with BookAdmin in admin site."""
        self.assertIn(Book, admin.site._registry)
        model_admin = admin.site._registry[Book]
        self.assertIsInstance(model_admin, BookAdmin)
        self.assertIn("title", model_admin.search_fields)
        self.assertIn("isbn", model_admin.search_fields)
        self.assertIn("category", model_admin.list_filter)
        self.assertIn("is_active", model_admin.list_editable)


from rest_framework.test import APITestCase
from rest_framework import status


class CatalogApiTests(APITestCase):
    def setUp(self):
        # Create active category
        self.active_category = Category.objects.create(
            name="Computer Science",
            slug="computer-science",
            description="Books on software engineering and algorithms.",
            is_active=True,
        )
        # Create second active category
        self.fiction_category = Category.objects.create(
            name="Fiction",
            slug="fiction",
            description="Classic and contemporary literary fiction.",
            is_active=True,
        )
        # Create inactive category
        self.inactive_category = Category.objects.create(
            name="Deprecated Archive",
            slug="deprecated-archive",
            description="Archived books.",
            is_active=False,
        )

        # Active books in active category
        self.book1 = Book.objects.create(
            title="Design Patterns in Python",
            author="Author One",
            description="A comprehensive guide to OOP design patterns.",
            isbn="978-1111111111",
            category=self.active_category,
            price=Decimal("45.00"),
            discount_price=Decimal("39.99"),
            stock_quantity=10,
            is_featured=True,
            is_bestseller=False,
            is_new_arrival=True,
            is_active=True,
        )
        self.book2 = Book.objects.create(
            title="Clean Architecture Fundamentals",
            author="Author Two",
            description="Software architecture and domain-driven design.",
            isbn="978-2222222222",
            category=self.active_category,
            price=Decimal("55.00"),
            discount_price=None,
            stock_quantity=0,  # Out of stock
            is_featured=False,
            is_bestseller=True,
            is_new_arrival=False,
            is_active=True,
        )
        self.book3 = Book.objects.create(
            title="The Great Gatsby",
            author="F. Scott Fitzgerald",
            description="A story of the Jazz Age.",
            isbn="978-3333333333",
            category=self.fiction_category,
            price=Decimal("15.00"),
            discount_price=Decimal("12.50"),
            stock_quantity=25,
            is_featured=True,
            is_bestseller=True,
            is_new_arrival=False,
            is_active=True,
        )
        # Inactive book in active category
        self.inactive_book = Book.objects.create(
            title="Hidden Draft Book",
            author="Ghost Writer",
            description="Unpublished book draft.",
            category=self.active_category,
            price=Decimal("20.00"),
            stock_quantity=5,
            is_active=False,
        )
        # Book in inactive category
        self.book_in_inactive_cat = Book.objects.create(
            title="Archived Relic",
            author="Ancient Writer",
            description="Old document.",
            category=self.inactive_category,
            price=Decimal("10.00"),
            stock_quantity=5,
            is_active=True,
        )

    def test_active_books_in_list(self):
        """Verify active books are returned in /api/books/."""
        response = self.client.get('/api/books/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', [])
        book_ids = [b['id'] for b in results]
        self.assertIn(self.book1.id, book_ids)
        self.assertIn(self.book2.id, book_ids)
        self.assertIn(self.book3.id, book_ids)

    def test_inactive_books_excluded(self):
        """Verify inactive books are excluded from /api/books/."""
        response = self.client.get('/api/books/')
        results = response.data.get('results', [])
        book_ids = [b['id'] for b in results]
        self.assertNotIn(self.inactive_book.id, book_ids)

    def test_books_in_inactive_category_excluded(self):
        """Verify books in inactive categories are excluded from public catalogue."""
        response = self.client.get('/api/books/')
        results = response.data.get('results', [])
        book_ids = [b['id'] for b in results]
        self.assertNotIn(self.book_in_inactive_cat.id, book_ids)

    def test_active_categories_in_list(self):
        """Verify active categories appear in /api/categories/."""
        response = self.client.get('/api/categories/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        cat_slugs = [c['slug'] for c in response.data]
        self.assertIn('computer-science', cat_slugs)
        self.assertIn('fiction', cat_slugs)

    def test_inactive_categories_excluded(self):
        """Verify inactive categories are excluded from /api/categories/."""
        response = self.client.get('/api/categories/')
        cat_slugs = [c['slug'] for c in response.data]
        self.assertNotIn('deprecated-archive', cat_slugs)

    def test_retrieve_valid_book(self):
        """Verify retrieving a valid book returns full fields and 200 OK."""
        response = self.client.get(f'/api/books/{self.book1.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        self.assertEqual(data['id'], self.book1.id)
        self.assertEqual(data['title'], "Design Patterns in Python")
        self.assertEqual(data['author'], "Author One")
        self.assertEqual(data['category_name'], "Computer Science")
        self.assertEqual(data['price'], "45.00")
        self.assertEqual(data['discount_price'], "39.99")
        self.assertTrue(data['is_featured'])
        self.assertTrue(data['is_new_arrival'])

    def test_retrieve_inactive_book_returns_404(self):
        """Verify retrieving an inactive book returns 404 Not Found."""
        response = self.client.get(f'/api/books/{self.inactive_book.id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_retrieve_nonexistent_book_returns_404(self):
        """Verify nonexistent or non-numeric book ID returns 404."""
        response1 = self.client.get('/api/books/999999/')
        self.assertEqual(response1.status_code, status.HTTP_404_NOT_FOUND)
        response2 = self.client.get('/api/books/invalid-id/')
        self.assertEqual(response2.status_code, status.HTTP_404_NOT_FOUND)

    def test_search_query_param(self):
        """Verify search matching by title, author, description, and isbn."""
        # Search by title keyword
        res1 = self.client.get('/api/books/?search=patterns')
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        titles1 = [b['title'] for b in res1.data['results']]
        self.assertIn("Design Patterns in Python", titles1)
        self.assertNotIn("The Great Gatsby", titles1)

        # Search by author
        res2 = self.client.get('/api/books/?search=fitzgerald')
        titles2 = [b['title'] for b in res2.data['results']]
        self.assertEqual(titles2, ["The Great Gatsby"])

        # Search by ISBN
        res3 = self.client.get('/api/books/?search=978-2222222222')
        titles3 = [b['title'] for b in res3.data['results']]
        self.assertEqual(titles3, ["Clean Architecture Fundamentals"])

    def test_category_filter(self):
        """Verify filtering by category slug."""
        response = self.client.get('/api/books/?category=fiction')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data['results']
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['title'], "The Great Gatsby")

    def test_featured_filter(self):
        """Verify ?featured=true filter."""
        response = self.client.get('/api/books/?featured=true')
        results = response.data['results']
        titles = [b['title'] for b in results]
        self.assertIn("Design Patterns in Python", titles)
        self.assertIn("The Great Gatsby", titles)
        self.assertNotIn("Clean Architecture Fundamentals", titles)

    def test_bestseller_filter(self):
        """Verify ?bestseller=true filter."""
        response = self.client.get('/api/books/?bestseller=true')
        results = response.data['results']
        titles = [b['title'] for b in results]
        self.assertIn("Clean Architecture Fundamentals", titles)
        self.assertIn("The Great Gatsby", titles)
        self.assertNotIn("Design Patterns in Python", titles)

    def test_new_arrival_filter(self):
        """Verify ?new_arrival=true filter."""
        response = self.client.get('/api/books/?new_arrival=true')
        results = response.data['results']
        titles = [b['title'] for b in results]
        self.assertIn("Design Patterns in Python", titles)
        self.assertNotIn("Clean Architecture Fundamentals", titles)

    def test_in_stock_filter(self):
        """Verify ?in_stock=true and ?in_stock=false filter."""
        # In stock
        res_in = self.client.get('/api/books/?in_stock=true')
        titles_in = [b['title'] for b in res_in.data['results']]
        self.assertIn("Design Patterns in Python", titles_in)
        self.assertNotIn("Clean Architecture Fundamentals", titles_in)

        # Out of stock
        res_out = self.client.get('/api/books/?in_stock=false')
        titles_out = [b['title'] for b in res_out.data['results']]
        self.assertIn("Clean Architecture Fundamentals", titles_out)
        self.assertNotIn("Design Patterns in Python", titles_out)

    def test_invalid_filter_param_safe(self):
        """Verify invalid filter values do not cause server errors."""
        response = self.client.get('/api/books/?featured=invalid_xyz&in_stock=not_a_bool')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_sorting_and_ordering(self):
        """Verify sorting by price and title."""
        # Price ascending (15.00, 45.00, 55.00)
        res_asc = self.client.get('/api/books/?ordering=price')
        prices_asc = [float(b['price']) for b in res_asc.data['results']]
        self.assertEqual(prices_asc, sorted(prices_asc))

        # Price descending (55.00, 45.00, 15.00)
        res_desc = self.client.get('/api/books/?ordering=-price')
        prices_desc = [float(b['price']) for b in res_desc.data['results']]
        self.assertEqual(prices_desc, sorted(prices_desc, reverse=True))

        # Invalid ordering falls back safely
        res_invalid = self.client.get('/api/books/?ordering=nonexistent_field')
        self.assertEqual(res_invalid.status_code, status.HTTP_200_OK)

    def test_pagination_structure(self):
        """Verify standard pagination response format (count, next, previous, results)."""
        response = self.client.get('/api/books/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('count', response.data)
        self.assertIn('next', response.data)
        self.assertIn('previous', response.data)
        self.assertIn('results', response.data)
        self.assertEqual(response.data['count'], 3)
        self.assertIsInstance(response.data['results'], list)

    def test_category_books_endpoint(self):
        """Verify GET /api/categories/<slug>/books/ returns books for that category."""
        response = self.client.get('/api/categories/computer-science/books/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        titles = [b['title'] for b in response.data['results']]
        self.assertIn("Design Patterns in Python", titles)
        self.assertIn("Clean Architecture Fundamentals", titles)
        self.assertNotIn("The Great Gatsby", titles)

    def test_category_books_404_for_invalid_or_inactive(self):
        """Verify 404 for category-books endpoint when category does not exist or is inactive."""
        res_missing = self.client.get('/api/categories/nonexistent-cat/books/')
        self.assertEqual(res_missing.status_code, status.HTTP_404_NOT_FOUND)

        res_inactive = self.client.get('/api/categories/deprecated-archive/books/')
        self.assertEqual(res_inactive.status_code, status.HTTP_404_NOT_FOUND)

    def test_read_only_protection_cannot_modify(self):
        """Verify public endpoints reject write operations (POST, PUT, DELETE)."""
        res_post_book = self.client.post('/api/books/', {'title': 'Malicious Book'})
        self.assertEqual(res_post_book.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

        res_put_book = self.client.put(f'/api/books/{self.book1.id}/', {'title': 'Changed'})
        self.assertEqual(res_put_book.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

        res_del_book = self.client.delete(f'/api/books/{self.book1.id}/')
        self.assertEqual(res_del_book.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

        res_post_cat = self.client.post('/api/categories/', {'name': 'New Cat'})
        self.assertEqual(res_post_cat.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_health_check_still_intact(self):
        """Verify /api/health/ endpoint is preserved from Phase 1."""
        response = self.client.get('/api/health/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data.get('status'), 'success')
        self.assertEqual(response.data.get('message'), 'Online Bookstore API is running!')


from unittest.mock import patch, MagicMock
import groq
from django.test import override_settings
from catalog.models import BookSummary


class BookAISummaryTests(TestCase):
    """
    Phase 7 automated backend tests for AETHERIUM Groq AI Book Summaries.
    Mocks all Groq API provider calls to avoid quota consumption and ensure reproducibility.
    """

    def setUp(self):
        self.category = Category.objects.create(
            name="Classic Literature",
            slug="classic-literature",
            description="Timeless literary classics.",
            is_active=True
        )
        self.book = Book.objects.create(
            title="The Name of the Rose",
            author="Umberto Eco",
            category=self.category,
            publisher="Harcourt",
            description="A historical murder mystery set in a 14th-century Italian monastery.",
            price=Decimal("18.50"),
            stock_quantity=10,
            is_active=True
        )
        self.endpoint_url = f"/api/ai/books/{self.book.id}/summary/"

    def _create_mock_completion(self, content_text="A gripping medieval monastic mystery blending semiotics and suspense."):
        mock_choice = MagicMock()
        mock_choice.message.content = content_text
        mock_completion = MagicMock()
        mock_completion.choices = [mock_choice]
        return mock_completion

    @override_settings(GROQ_API_KEY="gsk_valid_mock_key_12345", GROQ_MODEL="llama-3.3-70b-versatile")
    @patch("catalog.services.groq_service.groq.Groq")
    def test_successful_summary_generation_mocked(self, mock_groq_class):
        """Verify successful summary generation with mocked Groq SDK."""
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = self._create_mock_completion()
        mock_groq_class.return_value = mock_client

        response = self.client.post(self.endpoint_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["book_id"], self.book.id)
        self.assertEqual(response.data["title"], self.book.title)
        self.assertIn("gripping medieval monastic mystery", response.data["summary"])
        self.assertFalse(response.data["cached"])
        self.assertEqual(response.data["model"], "llama-3.3-70b-versatile")

        # Database cache entry created
        summary_record = BookSummary.objects.filter(book=self.book).first()
        self.assertIsNotNone(summary_record)
        self.assertEqual(summary_record.summary_text, response.data["summary"])
        self.assertEqual(summary_record.source_fingerprint, self.book.get_source_fingerprint())

    @override_settings(GROQ_API_KEY="gsk_valid_mock_key_12345")
    @patch("catalog.services.groq_service.groq.Groq")
    def test_correct_use_of_database_record(self, mock_groq_class):
        """Verify the prompt sent to Groq uses the database record's actual metadata."""
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = self._create_mock_completion()
        mock_groq_class.return_value = mock_client

        self.client.post(self.endpoint_url)

        self.assertTrue(mock_client.chat.completions.create.called)
        call_kwargs = mock_client.chat.completions.create.call_args[1]
        messages = call_kwargs["messages"]
        user_msg = next(m["content"] for m in messages if m["role"] == "user")

        self.assertIn(self.book.title, user_msg)
        self.assertIn(self.book.author, user_msg)
        self.assertIn(self.category.name, user_msg)
        self.assertIn(self.book.publisher, user_msg)
        self.assertIn(self.book.description, user_msg)

    def test_unknown_or_invalid_book_returns_404(self):
        """Verify unknown or non-numeric book IDs return 404."""
        res_nonexistent = self.client.post("/api/ai/books/999999/summary/")
        self.assertEqual(res_nonexistent.status_code, status.HTTP_404_NOT_FOUND)

        res_invalid = self.client.post("/api/ai/books/abc-xyz/summary/")
        self.assertEqual(res_invalid.status_code, status.HTTP_404_NOT_FOUND)

    def test_inactive_book_returns_404(self):
        """Verify inactive books cannot have summaries generated."""
        self.book.is_active = False
        self.book.save()

        response = self.client.post(self.endpoint_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    @override_settings(GROQ_API_KEY="")
    def test_missing_api_key_configuration(self):
        """Verify 503 response without server crash when GROQ_API_KEY is not configured."""
        response = self.client.post(self.endpoint_url)
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.data.get("code"), "configuration_error")
        self.assertFalse(BookSummary.objects.filter(book=self.book).exists())

    @override_settings(GROQ_API_KEY="gsk_invalid_test_key")
    @patch("catalog.services.groq_service.groq.Groq")
    def test_provider_authentication_error(self, mock_groq_class):
        """Verify graceful 503 error handling when Groq rejects credentials."""
        mock_client = MagicMock()
        mock_response = MagicMock(status_code=401)
        mock_client.chat.completions.create.side_effect = groq.AuthenticationError(
            message="Invalid API Key",
            response=mock_response,
            body={"error": {"message": "Invalid API Key"}}
        )
        mock_groq_class.return_value = mock_client

        response = self.client.post(self.endpoint_url)
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.data.get("code"), "authentication_error")
        self.assertFalse(BookSummary.objects.filter(book=self.book).exists())

    @override_settings(GROQ_API_KEY="gsk_your_groq_api_key_here")
    def test_placeholder_api_key_configuration(self):
        """Verify 503 configuration_error when key is an obvious placeholder."""
        response = self.client.post(self.endpoint_url)
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.data.get("code"), "configuration_error")
        self.assertIn("placeholder", response.data.get("error", "").lower())
        self.assertFalse(BookSummary.objects.filter(book=self.book).exists())

    @override_settings(GROQ_API_KEY="gsk_valid_mock_key")
    @patch("catalog.services.groq_service.groq.Groq")
    def test_provider_permission_denied_error(self, mock_groq_class):
        """Verify 503 permission_denied response when Groq rejects access with HTTP 403."""
        mock_client = MagicMock()
        mock_response = MagicMock(status_code=403)
        mock_client.chat.completions.create.side_effect = groq.PermissionDeniedError(
            message="Access denied",
            response=mock_response,
            body={"error": {"message": "Access denied"}}
        )
        mock_groq_class.return_value = mock_client

        response = self.client.post(self.endpoint_url)
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.data.get("code"), "permission_denied")
        self.assertFalse(BookSummary.objects.filter(book=self.book).exists())

    @override_settings(GROQ_API_KEY="gsk_valid_mock_key")
    @patch("catalog.services.groq_service.groq.Groq")
    def test_provider_model_not_found_error(self, mock_groq_class):
        """Verify 503 model_not_found response when requested model does not exist or is unavailable."""
        mock_client = MagicMock()
        mock_response = MagicMock(status_code=404)
        mock_client.chat.completions.create.side_effect = groq.NotFoundError(
            message="The model does not exist",
            response=mock_response,
            body={"error": {"message": "Model not found"}}
        )
        mock_groq_class.return_value = mock_client

        response = self.client.post(self.endpoint_url)
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.data.get("code"), "model_not_found")
        self.assertFalse(BookSummary.objects.filter(book=self.book).exists())

    @override_settings(GROQ_API_KEY="gsk_valid_mock_key")
    @patch("catalog.services.groq_service.groq.Groq")
    def test_provider_connection_error(self, mock_groq_class):
        """Verify 502 provider_error response when network connection to Groq fails."""
        mock_client = MagicMock()
        mock_client.chat.completions.create.side_effect = groq.APIConnectionError(
            request=MagicMock()
        )
        mock_groq_class.return_value = mock_client

        response = self.client.post(self.endpoint_url)
        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertEqual(response.data.get("code"), "provider_error")
        self.assertFalse(BookSummary.objects.filter(book=self.book).exists())

    @override_settings(GROQ_API_KEY="gsk_valid_mock_key")
    @patch("catalog.services.groq_service.groq.Groq")
    def test_provider_rate_limit_error(self, mock_groq_class):
        """Verify 429 response when Groq rate limits the request."""
        mock_client = MagicMock()
        mock_response = MagicMock(status_code=429)
        mock_client.chat.completions.create.side_effect = groq.RateLimitError(
            message="Rate limit exceeded",
            response=mock_response,
            body={"error": {"message": "Rate limit exceeded"}}
        )
        mock_groq_class.return_value = mock_client

        response = self.client.post(self.endpoint_url)
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(response.data.get("code"), "rate_limited")

    @override_settings(GROQ_API_KEY="gsk_valid_mock_key")
    @patch("catalog.services.groq_service.groq.Groq")
    def test_provider_timeout_error(self, mock_groq_class):
        """Verify 504 response when Groq request times out."""
        mock_client = MagicMock()
        mock_client.chat.completions.create.side_effect = groq.APITimeoutError(
            request=MagicMock()
        )
        mock_groq_class.return_value = mock_client

        response = self.client.post(self.endpoint_url)
        self.assertEqual(response.status_code, status.HTTP_504_GATEWAY_TIMEOUT)
        self.assertEqual(response.data.get("code"), "timeout")

    @override_settings(GROQ_API_KEY="gsk_valid_mock_key")
    @patch("catalog.services.groq_service.groq.Groq")
    def test_empty_provider_response(self, mock_groq_class):
        """Verify 502 error and no caching when provider returns empty content."""
        mock_client = MagicMock()
        mock_choice = MagicMock()
        mock_choice.message.content = "   "
        mock_completion = MagicMock()
        mock_completion.choices = [mock_choice]
        mock_client.chat.completions.create.return_value = mock_completion
        mock_groq_class.return_value = mock_client

        response = self.client.post(self.endpoint_url)
        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertFalse(BookSummary.objects.filter(book=self.book).exists())

    @override_settings(GROQ_API_KEY="gsk_valid_mock_key")
    @patch("catalog.services.groq_service.groq.Groq")
    def test_cache_reuse(self, mock_groq_class):
        """Verify cached summary is returned without re-invoking Groq SDK."""
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = self._create_mock_completion("Initial generated summary.")
        mock_groq_class.return_value = mock_client

        # Initial call - generates and caches
        res1 = self.client.post(self.endpoint_url)
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        self.assertFalse(res1.data["cached"])
        self.assertEqual(mock_client.chat.completions.create.call_count, 1)

        # Second call - retrieves from cache, SDK call count remains 1
        res2 = self.client.post(self.endpoint_url)
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertTrue(res2.data["cached"])
        self.assertEqual(res2.data["summary"], "Initial generated summary.")
        self.assertEqual(mock_client.chat.completions.create.call_count, 1)

    @override_settings(GROQ_API_KEY="gsk_valid_mock_key")
    @patch("catalog.services.groq_service.groq.Groq")
    def test_cache_invalidation_when_metadata_changes(self, mock_groq_class):
        """Verify cache is invalidated and regenerated when book description changes."""
        mock_client = MagicMock()
        mock_client.chat.completions.create.side_effect = [
            self._create_mock_completion("First summary."),
            self._create_mock_completion("Second updated summary."),
        ]
        mock_groq_class.return_value = mock_client

        # Initial generation
        res1 = self.client.post(self.endpoint_url)
        self.assertEqual(res1.data["summary"], "First summary.")

        # Update book description
        self.book.description = "Updated description with new critical historical research."
        self.book.save()

        # Call again - cache should be bypassed due to fingerprint mismatch
        res2 = self.client.post(self.endpoint_url)
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertFalse(res2.data["cached"])
        self.assertEqual(res2.data["summary"], "Second updated summary.")
        self.assertEqual(mock_client.chat.completions.create.call_count, 2)

    @override_settings(GROQ_API_KEY="gsk_super_secret_test_token_987654321")
    def test_no_api_key_leakage(self):
        """Verify secret API key never leaks into response body."""
        secret_token = "gsk_super_secret_test_token_987654321"
        response = self.client.post(self.endpoint_url)
        content_str = response.content.decode("utf-8")
        self.assertNotIn(secret_token, content_str)


from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from orders.models import Order, OrderItem
User = get_user_model()


class BookRecommendationTests(APITestCase):
    """
    Phase 8 automated tests for AETHERIUM Book Recommendations:
    - Related books similarity scoring.
    - Exclusion of current and inactive books.
    - Anonymous and authenticated fallback behaviors.
    - User history isolation (no cross-user leakage).
    """

    def setUp(self):
        self.cat_mystery = Category.objects.create(name="Mystery", slug="mystery", is_active=True)
        self.cat_philosophy = Category.objects.create(name="Philosophy", slug="philosophy", is_active=True)

        self.book1 = Book.objects.create(
            title="The Name of the Rose",
            author="Umberto Eco",
            category=self.cat_mystery,
            publisher="Harcourt",
            price=Decimal("20.00"),
            stock_quantity=10,
            is_active=True
        )
        self.book2 = Book.objects.create(
            title="Foucault's Pendulum",
            author="Umberto Eco",
            category=self.cat_mystery,
            publisher="Harcourt",
            price=Decimal("22.00"),
            stock_quantity=5,
            is_active=True
        )
        self.book3 = Book.objects.create(
            title="The Hound of the Baskervilles",
            author="Arthur Conan Doyle",
            category=self.cat_mystery,
            publisher="Penguin",
            price=Decimal("12.00"),
            stock_quantity=8,
            is_active=True
        )
        self.book4 = Book.objects.create(
            title="Meditations",
            author="Marcus Aurelius",
            category=self.cat_philosophy,
            publisher="Penguin",
            price=Decimal("15.00"),
            stock_quantity=12,
            is_active=True,
            is_featured=True
        )
        self.inactive_book = Book.objects.create(
            title="Forbidden Manuscript",
            author="Unknown",
            category=self.cat_mystery,
            price=Decimal("99.00"),
            stock_quantity=1,
            is_active=False
        )

        self.user_a = User.objects.create_user(username="reader_a", email="a@aetherium.test", password="pass")
        self.user_b = User.objects.create_user(username="reader_b", email="b@aetherium.test", password="pass")

    def test_related_books_scoring_and_exclusion(self):
        """Verify related books prioritize same author/category and exclude self/inactive."""
        url = f"/api/books/{self.book1.id}/related/"
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [b["id"] for b in response.data]

        # Current book must NOT be included
        self.assertNotIn(self.book1.id, ids)
        # Inactive book must NOT be included
        self.assertNotIn(self.inactive_book.id, ids)
        # Same author + category (Foucault's Pendulum) should rank highest
        self.assertEqual(ids[0], self.book2.id)
        # No duplicates
        self.assertEqual(len(ids), len(set(ids)))

    def test_related_books_invalid_id(self):
        """Verify 404 for invalid book id."""
        res = self.client.get("/api/books/999999/related/")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_anonymous_recommendations_fallback(self):
        """Verify anonymous user gets curated highlights without error."""
        response = self.client.get("/api/recommendations/?limit=4")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["personalized"])
        self.assertGreater(response.data["count"], 0)
        ids = [b["id"] for b in response.data["results"]]
        self.assertNotIn(self.inactive_book.id, ids)

    def test_authenticated_user_recommendations_with_history(self):
        """Verify customer with orders gets recommendations reflecting purchased categories."""
        order = Order.objects.create(
            customer=self.user_a,
            customer_name="Reader A",
            customer_email="a@aetherium.test",
            subtotal=Decimal("20.00"),
            total_amount=Decimal("20.00"),
            shipping_address_line1="123 Archive St",
            city="Oxford",
            state_region="OX",
            postal_code="OX1",
            country="UK"
        )
        OrderItem.objects.create(
            order=order,
            book=self.book1,
            book_title=self.book1.title,
            unit_price=self.book1.price,
            quantity=1,
            subtotal=self.book1.price
        )

        self.client.force_authenticate(user=self.user_a)
        response = self.client.get("/api/recommendations/?limit=4")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["personalized"])
        ids = [b["id"] for b in response.data["results"]]

        # Should exclude already purchased book1 if candidates exist
        self.assertNotIn(self.book1.id, ids)
        # Should include book2 (same author/category as purchased)
        self.assertIn(self.book2.id, ids)

    def test_user_history_isolation(self):
        """Verify User B does NOT inherit User A's recommendation preferences."""
        # User A bought Mystery
        order = Order.objects.create(
            customer=self.user_a,
            customer_name="Reader A",
            customer_email="a@aetherium.test",
            subtotal=Decimal("20.00"),
            total_amount=Decimal("20.00"),
            shipping_address_line1="123 Archive St",
            city="Oxford",
            state_region="OX",
            postal_code="OX1",
            country="UK"
        )
        OrderItem.objects.create(
            order=order,
            book=self.book1,
            book_title=self.book1.title,
            unit_price=self.book1.price,
            quantity=1,
            subtotal=self.book1.price
        )

        # User B has no orders
        self.client.force_authenticate(user=self.user_b)
        response = self.client.get("/api/recommendations/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["personalized"])


class AIReadingAssistantTests(APITestCase):
    """
    Phase 8 automated tests for AETHERIUM AI Reading Assistant:
    - Literary question handling with mocked Groq SDK.
    - Grounded book discovery with validated candidate IDs.
    - Selected book context questions.
    - Input validation & bounding (message length, empty input).
    - Error handling (missing key, rate limits, timeouts, provider error).
    - Secret key leakage prevention.
    """

    def setUp(self):
        self.category = Category.objects.create(name="Philosophy", slug="philosophy", is_active=True)
        self.book = Book.objects.create(
            title="Critique of Pure Reason",
            author="Immanuel Kant",
            category=self.category,
            publisher="Cambridge",
            description="A seminal treatise exploring transcendental idealism and epistemology.",
            price=Decimal("28.00"),
            stock_quantity=6,
            is_active=True
        )
        self.endpoint_url = "/api/ai/reading-assistant/"

    def _create_mock_completion(self, reply_text="Epistemology is the philosophical investigation into knowledge."):
        mock_choice = MagicMock()
        mock_choice.message.content = reply_text
        mock_completion = MagicMock()
        mock_completion.choices = [mock_choice]
        return mock_completion

    @override_settings(GROQ_API_KEY="gsk_valid_mock_key")
    @patch("catalog.services.assistant_service.get_groq_client")
    def test_general_literary_inquiry(self, mock_get_client):
        """Verify successful response for general literary queries."""
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = self._create_mock_completion("Transcendental idealism argues that space and time are human intuitions.")
        mock_get_client.return_value = mock_client

        payload = {"message": "What is transcendental idealism?"}
        response = self.client.post(self.endpoint_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("Transcendental idealism", response.data["reply"])
        self.assertIsNone(response.data["book"])

    @override_settings(GROQ_API_KEY="gsk_valid_mock_key")
    @patch("catalog.services.assistant_service.get_groq_client")
    def test_selected_book_context_inquiry(self, mock_get_client):
        """Verify selected book metadata is passed to Groq and included in response."""
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = self._create_mock_completion("Kant addresses how synthetic a priori judgments are possible.")
        mock_get_client.return_value = mock_client

        payload = {
            "message": "What core problem does this volume address?",
            "book_id": self.book.id
        }
        response = self.client.post(self.endpoint_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(response.data["book"])
        self.assertEqual(response.data["book"]["id"], self.book.id)

        # Verify book metadata was in system prompt context
        call_kwargs = mock_client.chat.completions.create.call_args[1]
        all_messages_text = " ".join(m["content"] for m in call_kwargs["messages"])
        self.assertIn("Critique of Pure Reason", all_messages_text)
        self.assertIn("Immanuel Kant", all_messages_text)

    @override_settings(GROQ_API_KEY="gsk_valid_mock_key")
    @patch("catalog.services.assistant_service.get_groq_client")
    def test_catalogue_grounded_book_discovery(self, mock_get_client):
        """Verify returned [BOOK_ID:<id>] tags are validated against real database candidates."""
        mock_client = MagicMock()
        # Mock reply referencing valid candidate book and a hallucinated ID (99999)
        mock_reply = (
            f"I recommend exploring [BOOK_ID:{self.book.id}] \"Critique of Pure Reason\" "
            f"as well as a non-existent title [BOOK_ID:99999]."
        )
        mock_client.chat.completions.create.return_value = self._create_mock_completion(mock_reply)
        mock_get_client.return_value = mock_client

        payload = {"message": "Suggest a foundational philosophy text."}
        response = self.client.post(self.endpoint_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Verified books should contain ONLY the real candidate book
        recommended = response.data["recommended_books"]
        rec_ids = [b["id"] for b in recommended]
        self.assertIn(self.book.id, rec_ids)
        self.assertNotIn(99999, rec_ids)
        # Reply text should be cleaned of raw [BOOK_ID:...] tags
        self.assertNotIn("[BOOK_ID:", response.data["reply"])

    def test_empty_message_validation(self):
        """Verify 400 error for empty or whitespace-only messages."""
        res_empty = self.client.post(self.endpoint_url, {"message": ""}, format="json")
        self.assertEqual(res_empty.status_code, status.HTTP_400_BAD_REQUEST)

        res_spaces = self.client.post(self.endpoint_url, {"message": "   "}, format="json")
        self.assertEqual(res_spaces.status_code, status.HTTP_400_BAD_REQUEST)

    def test_oversized_message_validation(self):
        """Verify 400 error when message exceeds 1,000 characters."""
        long_message = "a" * 1001
        res = self.client.post(self.endpoint_url, {"message": long_message}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    @override_settings(GROQ_API_KEY="")
    def test_missing_api_key_configuration(self):
        """Verify 503 error when GROQ_API_KEY is not configured."""
        res = self.client.post(self.endpoint_url, {"message": "Hello"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(res.data.get("code"), "configuration_error")

    @override_settings(GROQ_API_KEY="gsk_your_groq_api_key_here")
    def test_placeholder_api_key_configuration(self):
        """Verify 503 configuration_error when key is an obvious placeholder."""
        res = self.client.post(self.endpoint_url, {"message": "Hello"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(res.data.get("code"), "configuration_error")
        self.assertIn("placeholder", res.data.get("error", "").lower())

    @override_settings(GROQ_API_KEY="gsk_valid_mock_key")
    @patch("catalog.services.assistant_service.get_groq_client")
    def test_provider_authentication_error(self, mock_get_client):
        """Verify 503 authentication_error when provider rejects credentials."""
        mock_client = MagicMock()
        mock_response = MagicMock(status_code=401)
        mock_client.chat.completions.create.side_effect = groq.AuthenticationError(
            message="Invalid API Key",
            response=mock_response,
            body={"error": {"message": "Invalid API Key"}}
        )
        mock_get_client.return_value = mock_client

        res = self.client.post(self.endpoint_url, {"message": "Hello"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(res.data.get("code"), "authentication_error")

    @override_settings(GROQ_API_KEY="gsk_valid_mock_key")
    @patch("catalog.services.assistant_service.get_groq_client")
    def test_provider_permission_denied_error(self, mock_get_client):
        """Verify 503 permission_denied when provider denies access."""
        mock_client = MagicMock()
        mock_response = MagicMock(status_code=403)
        mock_client.chat.completions.create.side_effect = groq.PermissionDeniedError(
            message="Access Denied",
            response=mock_response,
            body={"error": {"message": "Access Denied"}}
        )
        mock_get_client.return_value = mock_client

        res = self.client.post(self.endpoint_url, {"message": "Hello"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(res.data.get("code"), "permission_denied")

    @override_settings(GROQ_API_KEY="gsk_valid_mock_key")
    @patch("catalog.services.assistant_service.get_groq_client")
    def test_provider_model_not_found_error(self, mock_get_client):
        """Verify 503 model_not_found when model does not exist or account lacks access."""
        mock_client = MagicMock()
        mock_response = MagicMock(status_code=404)
        mock_client.chat.completions.create.side_effect = groq.NotFoundError(
            message="Model not found",
            response=mock_response,
            body={"error": {"message": "Model not found"}}
        )
        mock_get_client.return_value = mock_client

        res = self.client.post(self.endpoint_url, {"message": "Hello"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(res.data.get("code"), "model_not_found")

    @override_settings(GROQ_API_KEY="gsk_valid_mock_key")
    @patch("catalog.services.assistant_service.get_groq_client")
    def test_provider_connection_error(self, mock_get_client):
        """Verify 502 provider_error when connection to Groq fails."""
        mock_client = MagicMock()
        mock_client.chat.completions.create.side_effect = groq.APIConnectionError(
            request=MagicMock()
        )
        mock_get_client.return_value = mock_client

        res = self.client.post(self.endpoint_url, {"message": "Hello"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertEqual(res.data.get("code"), "provider_error")

    @override_settings(GROQ_API_KEY="gsk_valid_mock_key")
    @patch("catalog.services.assistant_service.get_groq_client")
    def test_provider_timeout_error(self, mock_get_client):
        """Verify 504 gateway timeout when provider times out."""
        mock_client = MagicMock()
        mock_client.chat.completions.create.side_effect = groq.APITimeoutError(request=MagicMock())
        mock_get_client.return_value = mock_client

        res = self.client.post(self.endpoint_url, {"message": "Hello"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_504_GATEWAY_TIMEOUT)
        self.assertEqual(res.data.get("code"), "timeout")

    @override_settings(GROQ_API_KEY="gsk_valid_mock_key")
    @patch("catalog.services.assistant_service.get_groq_client")
    def test_provider_rate_limit_error(self, mock_get_client):
        """Verify 429 when provider rate limits."""
        mock_client = MagicMock()
        mock_response = MagicMock(status_code=429)
        mock_client.chat.completions.create.side_effect = groq.RateLimitError(
            message="Rate limit exceeded",
            response=mock_response,
            body={"error": {"message": "Rate limit exceeded"}}
        )
        mock_get_client.return_value = mock_client

        res = self.client.post(self.endpoint_url, {"message": "Hello"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(res.data.get("code"), "rate_limited")

    @override_settings(GROQ_API_KEY="gsk_super_secret_assistant_key_xyz999")
    def test_no_api_key_leakage(self):
        """Verify secret API key never leaks in response bodies."""
        secret = "gsk_super_secret_assistant_key_xyz999"
        res = self.client.post(self.endpoint_url, {"message": "Hello"}, format="json")
        content_str = res.content.decode("utf-8")
        self.assertNotIn(secret, content_str)

