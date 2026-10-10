from django.contrib import admin
from .models import Category, Book


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'is_active', 'created_at')
    search_fields = ('name',)
    list_filter = ('is_active',)
    ordering = ('name',)
    prepopulated_fields = {'slug': ('name',)}
    list_editable = ('is_active',)


@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    list_display = (
        'title',
        'author',
        'category',
        'price',
        'stock_quantity',
        'is_featured',
        'is_bestseller',
        'is_new_arrival',
        'is_active',
        'created_at',
    )
    search_fields = ('title', 'author', 'isbn')
    list_filter = (
        'category',
        'is_active',
        'is_featured',
        'is_bestseller',
        'is_new_arrival',
    )
    list_editable = (
        'is_featured',
        'is_bestseller',
        'is_new_arrival',
        'is_active',
    )
    prepopulated_fields = {'slug': ('title',)}
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('-created_at',)
    list_per_page = 25

    fieldsets = (
        ('Basic Information', {
            'fields': (
                'title',
                'slug',
                'author',
                'category',
                'description',
            ),
        }),
        ('Publication Details', {
            'fields': (
                'isbn',
                'publisher',
                'publication_date',
                'language',
                'cover_image',
            ),
        }),
        ('Pricing and Inventory', {
            'fields': (
                'price',
                'discount_price',
                'stock_quantity',
            ),
        }),
        ('Catalogue Settings', {
            'fields': (
                'is_featured',
                'is_bestseller',
                'is_new_arrival',
                'is_active',
            ),
        }),
        ('Timestamps', {
            'classes': ('collapse',),
            'fields': (
                'created_at',
                'updated_at',
            ),
        }),
    )
