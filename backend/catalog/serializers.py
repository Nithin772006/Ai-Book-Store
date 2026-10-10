from rest_framework import serializers
from .models import Category, Book


class CategorySerializer(serializers.ModelSerializer):
    """
    Public serializer for Category records.
    Provides category metadata and an optional active books count.
    """
    books_count = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = Category
        fields = [
            'id',
            'name',
            'slug',
            'description',
            'is_active',
            'books_count',
        ]
        read_only_fields = fields


class BookSerializer(serializers.ModelSerializer):
    """
    Public serializer for Book records.
    Exposes full catalogue details including human-readable category name,
    category slug, and absolute cover image URL.
    """
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_slug = serializers.CharField(source='category.slug', read_only=True)
    cover_image = serializers.SerializerMethodField()

    class Meta:
        model = Book
        fields = [
            'id',
            'title',
            'slug',
            'author',
            'description',
            'isbn',
            'publisher',
            'publication_date',
            'language',
            'price',
            'discount_price',
            'stock_quantity',
            'category',
            'category_name',
            'category_slug',
            'cover_image',
            'is_featured',
            'is_bestseller',
            'is_new_arrival',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields

    def get_cover_image(self, obj):
        """
        Return absolute URL for cover image when request context is present,
        or relative URL if request is unavailable, or None if no image uploaded.
        """
        if not obj.cover_image:
            return None

        request = self.context.get('request')
        if request is not None:
            return request.build_absolute_uri(obj.cover_image.url)
        return obj.cover_image.url
