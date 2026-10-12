from django.urls import path
from .views import CheckoutView, OrderListView, OrderDetailView

app_name = 'orders'

urlpatterns = [
    path('checkout/', CheckoutView.as_view(), name='checkout'),
    path('', OrderListView.as_view(), name='order-list'),
    path('<str:reference>/', OrderDetailView.as_view(), name='order-detail'),
]
