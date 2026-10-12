from django.contrib.auth import login, logout
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import LoginSerializer, RegisterSerializer, UserSerializer


class RegisterView(APIView):
    """
    POST /api/auth/register/
    Registers a new customer account, returns a security token, and establishes
    a session for the customer.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = serializer.save()
        token, _ = Token.objects.get_or_create(user=user)

        # Also establish Django session for cookie-based authentication workflows
        try:
            login(request, user)
        except Exception:
            pass

        return Response(
            {
                'message': 'Account created successfully. Welcome to AETHERIUM.',
                'user': UserSerializer(user).data,
                'token': token.key,
            },
            status=status.HTTP_201_CREATED
        )


class LoginView(APIView):
    """
    POST /api/auth/login/
    Authenticates customer using either email or username with password,
    returning a security token and establishing the session cookie.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)

        # Allow flexible field naming: identifier, email, or username
        if 'identifier' not in data:
            if 'email' in data:
                data['identifier'] = data['email']
            elif 'username' in data:
                data['identifier'] = data['username']

        serializer = LoginSerializer(data=data, context={'request': request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = serializer.validated_data['user']
        token, _ = Token.objects.get_or_create(user=user)

        try:
            login(request, user)
        except Exception:
            pass

        return Response(
            {
                'message': 'Authenticated successfully. Welcome back to AETHERIUM.',
                'user': UserSerializer(user).data,
                'token': token.key,
            },
            status=status.HTTP_200_OK
        )


class LogoutView(APIView):
    """
    POST /api/auth/logout/
    Terminates the customer's authenticated session and revokes the active token.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        if request.user and request.user.is_authenticated:
            # Revoke DRF token
            Token.objects.filter(user=request.user).delete()
            # Flush Django session cookie
            logout(request)

        return Response(
            {'message': 'Successfully logged out of AETHERIUM.'},
            status=status.HTTP_200_OK
        )


class UserProfileView(APIView):
    """
    GET /api/auth/me/
    Returns the public profile of the currently authenticated customer.
    Anonymous requests receive an HTTP 401 Unauthorized response.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)


@method_decorator(ensure_csrf_cookie, name='dispatch')
class CsrfTokenView(APIView):
    """
    GET /api/auth/csrf/
    Ensures a CSRF cookie is dispatched to browser clients for cookie-based state.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        token = get_token(request)
        return Response(
            {
                'detail': 'CSRF cookie established.',
                'csrfToken': token,
            },
            status=status.HTTP_200_OK
        )
