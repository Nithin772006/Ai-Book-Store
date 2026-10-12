from django.urls import path
from .views import CartView, CartItemsView, CartItemDetailView

urlpatterns = [
    path('', CartView.as_view(), name='cart-detail'),
    path('items/', CartItemsView.as_view(), name='cart-items'),
    path('items/<int:item_id>/', CartItemDetailView.as_view(), name='cart-item-detail'),
]
