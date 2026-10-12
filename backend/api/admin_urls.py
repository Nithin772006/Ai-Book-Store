"""
URL routing for AETHERIUM Administration API (Phase 9A).
All endpoints (except login) require authenticated Django staff credentials.
"""

from django.urls import path
from .admin_views import (
    AdminCsrfView,
    AdminLoginView,
    AdminMeView,
    AdminLogoutView,
    AdminDashboardView,
    AdminBookListCreateView,
    AdminBookDetailView,
    AdminCategoryListCreateView,
    AdminCategoryDetailView,
    AdminOrderListView,
    AdminOrderDetailView,
    AdminOrderStatusUpdateView,
    AdminCustomerListView,
    AdminCustomerDetailView,
    AdminCustomerStatusUpdateView,
    AdminSubscriberListView,
)

urlpatterns = [
    # Auth & CSRF
    path('auth/csrf/', AdminCsrfView.as_view(), name='admin-auth-csrf'),
    path('auth/login/', AdminLoginView.as_view(), name='admin-auth-login'),
    path('auth/me/', AdminMeView.as_view(), name='admin-auth-me'),
    path('auth/logout/', AdminLogoutView.as_view(), name='admin-auth-logout'),

    # Dashboard
    path('dashboard/', AdminDashboardView.as_view(), name='admin-dashboard'),

    # Books
    path('books/', AdminBookListCreateView.as_view(), name='admin-book-list-create'),
    path('books/<int:book_id>/', AdminBookDetailView.as_view(), name='admin-book-detail'),

    # Categories
    path('categories/', AdminCategoryListCreateView.as_view(), name='admin-category-list-create'),
    path('categories/<int:category_id>/', AdminCategoryDetailView.as_view(), name='admin-category-detail'),

    # Orders
    path('orders/', AdminOrderListView.as_view(), name='admin-order-list'),
    path('orders/<int:order_id>/', AdminOrderDetailView.as_view(), name='admin-order-detail'),
    path('orders/<int:order_id>/status/', AdminOrderStatusUpdateView.as_view(), name='admin-order-status-update'),

    # Customers
    path('customers/', AdminCustomerListView.as_view(), name='admin-customer-list'),
    path('customers/<int:customer_id>/', AdminCustomerDetailView.as_view(), name='admin-customer-detail'),
    path('customers/<int:customer_id>/status/', AdminCustomerStatusUpdateView.as_view(), name='admin-customer-status-update'),

    # Newsletter
    path('subscribers/', AdminSubscriberListView.as_view(), name='admin-subscriber-list'),
]
