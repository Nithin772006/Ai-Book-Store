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

