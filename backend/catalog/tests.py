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
