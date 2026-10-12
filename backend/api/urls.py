from django.urls import path, include
from .views import health_check
from catalog.views import (
    BookAISummaryView,
    BookRecommendationsView,
    AIReadingAssistantView,
)

urlpatterns = [
    path('health/', health_check, name='health-check'),
    path('auth/', include('accounts.urls')),
    path('cart/', include('cart.urls')),
    path('orders/', include('orders.urls')),
    path('recommendations/', BookRecommendationsView.as_view(), name='book-recommendations'),
    path('ai/books/<str:book_id>/summary/', BookAISummaryView.as_view(), name='book-ai-summary'),
    path('ai/reading-assistant/', AIReadingAssistantView.as_view(), name='ai-reading-assistant'),
    path('', include('catalog.urls')),
]
