import hashlib
from decimal import Decimal
from django.db import models
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.utils.text import slugify


def generate_unique_slug(model_instance, base_text, slug_field_name="slug", max_length=255):
    """
    Generates a unique slug for a model instance by appending an incremental
    counter if a collision occurs.
    """
    base_slug = slugify(base_text)[:max_length - 12] or "item"
    slug = base_slug
    counter = 1
    model_class = model_instance.__class__

    # Look for existing records with the same slug, excluding the current instance if already persisted
    while model_class.objects.filter(**{slug_field_name: slug}).exclude(pk=model_instance.pk).exists():
        slug = f"{base_slug}-{counter}"
        counter += 1

    return slug


class Category(models.Model):
    name = models.CharField(
        max_length=100,
        unique=True,
        help_text="Unique name of the book category (e.g., Fiction, Science, Technology)."
    )
    slug = models.SlugField(
        max_length=120,
        unique=True,
        help_text="URL-friendly identifier generated automatically or manually."
    )
    description = models.TextField(
        blank=True,
        help_text="Optional description outlining the genres or themes in this category."
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Designates whether this category is actively visible in the catalogue."
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Timestamp when the category was created."
    )

    class Meta:
        verbose_name = "Category"
        verbose_name_plural = "Categories"
        ordering = ['name']

    def __str__(self):
        return self.name

    def clean(self):
        super().clean()
        if self.name:
            self.name = self.name.strip()

    def save(self, *args, **kwargs):
        if self.name:
            self.name = self.name.strip()
        if not self.slug or not self.slug.strip():
            self.slug = generate_unique_slug(self, self.name, 'slug', max_length=120)
        else:
            self.slug = slugify(self.slug)[:120]
        self.clean()
        super().save(*args, **kwargs)


class Book(models.Model):
    # Basic Information
    title = models.CharField(
        max_length=255,
        help_text="Full title of the book."
    )
    slug = models.SlugField(
        max_length=280,
        unique=True,
        help_text="URL-friendly identifier generated automatically or manually."
    )
    author = models.CharField(
        max_length=255,
        help_text="Name of the author(s) or creator."
    )
    description = models.TextField(
        help_text="Detailed synopsis, summary, or overview of the book."
    )
    isbn = models.CharField(
        max_length=20,
        null=True,
        blank=True,
        unique=True,
        help_text="Optional 10 or 13-digit International Standard Book Number. Must be unique if provided."
    )
    publisher = models.CharField(
        max_length=255,
        blank=True,
        help_text="Publishing company or imprint."
    )
    publication_date = models.DateField(
        null=True,
        blank=True,
        help_text="Date when the book was officially published."
    )
    language = models.CharField(
        max_length=50,
        default="English",
        help_text="Language of the book edition."
    )

    # Pricing & Inventory
    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Base selling price in currency units."
    )
    discount_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Optional promotional or sale price. Must be non-negative and less than or equal to the regular price."
    )
    stock_quantity = models.PositiveIntegerField(
        default=0,
        help_text="Current available quantity in warehouse inventory."
    )

    # Catalogue Relationships & Display Settings
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name="books",
        help_text="Category to which this book belongs. Deletion is protected if books exist."
    )
    cover_image = models.ImageField(
        upload_to="books/covers/",
        null=True,
        blank=True,
        help_text="Uploaded cover image file."
    )
    is_featured = models.BooleanField(
        default=False,
        help_text="Feature this title prominently on home and landing pages."
    )
    is_bestseller = models.BooleanField(
        default=False,
        help_text="Highlight as a top-selling title."
    )
    is_new_arrival = models.BooleanField(
        default=False,
        help_text="Mark as a recent addition to the catalogue."
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Designates whether this book is actively listed for sale."
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Timestamp when the record was created."
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        help_text="Timestamp when the record was last updated."
    )

    class Meta:
        verbose_name = "Book"
        verbose_name_plural = "Books"
        ordering = ['-created_at']
        constraints = [
            models.CheckConstraint(
                condition=models.Q(price__gte=Decimal('0.00')),
                name='check_book_price_non_negative',
            ),
            models.CheckConstraint(
                condition=models.Q(discount_price__isnull=True) | models.Q(discount_price__gte=Decimal('0.00')),
                name='check_book_discount_price_non_negative',
            ),
            models.CheckConstraint(
                condition=models.Q(discount_price__isnull=True) | models.Q(discount_price__lte=models.F('price')),
                name='check_book_discount_lte_price',
            ),
        ]

    def __str__(self):
        return f"{self.title} by {self.author}"

    def clean(self):
        super().clean()

        # Validate non-negative regular price
        if self.price is not None and self.price < Decimal('0.00'):
            raise ValidationError({'price': 'Price cannot be negative.'})

        # Validate discount price
        if self.discount_price is not None:
            if self.discount_price < Decimal('0.00'):
                raise ValidationError({'discount_price': 'Discount price cannot be negative.'})
            if self.price is not None and self.discount_price > self.price:
                raise ValidationError({'discount_price': 'Discount price cannot exceed the regular price.'})

        # Normalize and validate ISBN
        if self.isbn:
            normalized_isbn = self.isbn.strip()
            if not normalized_isbn:
                self.isbn = None
            else:
                self.isbn = normalized_isbn
                existing_isbn = Book.objects.filter(isbn__iexact=self.isbn).exclude(pk=self.pk)
                if existing_isbn.exists():
                    raise ValidationError({'isbn': f'A book with ISBN "{self.isbn}" already exists.'})
        else:
            self.isbn = None

    def save(self, *args, **kwargs):
        # Normalize fields
        if self.title:
            self.title = self.title.strip()
        if self.author:
            self.author = self.author.strip()

        # Handle automatic unique slug generation
        if not self.slug or not self.slug.strip():
            self.slug = generate_unique_slug(self, self.title, 'slug', max_length=280)
        else:
            self.slug = slugify(self.slug)[:280]

        # Normalize empty ISBN to None so SQL UNIQUE constraint permits multiple books without ISBN
        if self.isbn:
            self.isbn = self.isbn.strip() or None
        else:
            self.isbn = None

        self.clean()
        super().save(*args, **kwargs)

    def get_source_fingerprint(self):
        """
        Computes a SHA-256 fingerprint of the book's core metadata:
        title, author, category, publisher, and catalogue description.
        If any of these change, the fingerprint invalidates, triggering a fresh summary.
        """
        cat_name = self.category.name if self.category_id else ""
        content = f"{self.title}|{self.author}|{cat_name}|{self.publisher or ''}|{self.description or ''}"
        return hashlib.sha256(content.strip().encode('utf-8')).hexdigest()


class BookSummary(models.Model):
    """
    AI-generated summary cache for a book (Phase 7).
    Preserves catalogue description without modification.
    Stores generation metadata and fingerprint to avoid redundant Groq LLM calls.
    """
    book = models.OneToOneField(
        Book,
        on_delete=models.CASCADE,
        related_name="ai_summary_cache",
        help_text="The book this AI summary was generated for."
    )
    summary_text = models.TextField(
        help_text="AI-generated summary based on catalogue metadata."
    )
    source_fingerprint = models.CharField(
        max_length=64,
        db_index=True,
        help_text="SHA-256 fingerprint of source metadata at the time of generation."
    )
    model_name = models.CharField(
        max_length=100,
        default="llama-3.3-70b-versatile",
        help_text="The Groq model used to generate this summary."
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Timestamp when the summary was generated."
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        help_text="Timestamp when the summary was last updated."
    )

    class Meta:
        verbose_name = "Book AI Summary"
        verbose_name_plural = "Book AI Summaries"
        ordering = ['-updated_at']

    def __str__(self):
        return f"AI Summary for {self.book.title} ({self.model_name})"

    def is_valid_for(self, book_instance):
        """Checks whether the cached summary is still valid for current book metadata."""
        return self.source_fingerprint == book_instance.get_source_fingerprint()
