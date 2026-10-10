from django.urls import path, include
from .views import health_check

urlpatterns = [
    path('health/', health_check, name='health-check'),
    path('', include('catalog.urls')),
]
