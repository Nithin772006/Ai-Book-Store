from django.urls import path
from .views import (
    RegisterView,
    LoginView,
    LogoutView,
    UserProfileView,
    CsrfTokenView,
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='auth-register'),
    path('login/', LoginView.as_view(), name='auth-login'),
    path('logout/', LogoutView.as_view(), name='auth-logout'),
    path('me/', UserProfileView.as_view(), name='auth-me'),
    path('csrf/', CsrfTokenView.as_view(), name='auth-csrf'),
]
