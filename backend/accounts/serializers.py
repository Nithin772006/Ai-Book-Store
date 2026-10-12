import re
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers


class UserSerializer(serializers.ModelSerializer):
    """
    Public customer profile representation.
    Guarantees no sensitive credentials or password hashes are ever leaked.
    """
    full_name = serializers.SerializerMethodField()
    initials = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'full_name',
            'initials',
            'date_joined',
            'is_staff',
        ]
        read_only_fields = fields

    def get_full_name(self, obj):
        name = f"{obj.first_name} {obj.last_name}".strip()
        return name if name else obj.username

    def get_initials(self, obj):
        name = f"{obj.first_name} {obj.last_name}".strip()
        if name:
            parts = name.split()
            if len(parts) >= 2:
                return (parts[0][0] + parts[-1][0]).upper()
            return parts[0][0].upper()
        if obj.username:
            return obj.username[0].upper()
        return "EL"


class RegisterSerializer(serializers.Serializer):
    """
    Customer account registration serializer with rigorous validation,
    case-insensitive uniqueness checks, and Django password validation.
    """
    name = serializers.CharField(
        max_length=150,
        required=False,
        allow_blank=True,
        trim_whitespace=True
    )
    email = serializers.EmailField(
        required=True,
        max_length=254,
        error_messages={
            'required': 'Email address is required.',
            'invalid': 'Please enter a valid email address.'
        }
    )
    username = serializers.CharField(
        max_length=150,
        required=False,
        allow_blank=True,
        trim_whitespace=True
    )
    password = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'},
        error_messages={'required': 'Password is required.'}
    )
    password_confirm = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'},
        error_messages={'required': 'Password confirmation is required.'}
    )

    def validate_email(self, value):
        normalized_email = value.strip().lower()
        if User.objects.filter(email__iexact=normalized_email).exists():
            raise serializers.ValidationError('An account with this email address already exists.')
        return normalized_email

    def validate_username(self, value):
        if not value:
            return value
        cleaned = value.strip()
        if len(cleaned) < 3:
            raise serializers.ValidationError('Username must contain at least 3 characters.')
        if not re.match(r'^[\w.@+-]+$', cleaned):
            raise serializers.ValidationError('Username may contain only letters, numbers, and @/./+/-/_ characters.')
        if User.objects.filter(username__iexact=cleaned).exists():
            raise serializers.ValidationError('This username is already taken. Please choose another.')
        return cleaned

    def validate(self, attrs):
        password = attrs.get('password')
        password_confirm = attrs.get('password_confirm')

        if password != password_confirm:
            raise serializers.ValidationError({'password_confirm': 'Passwords do not match.'})

        # Run Django's configured password validators (length, common, numeric, etc.)
        errors = []
        try:
            validate_password(password)
        except Exception as exc:
            if hasattr(exc, 'messages'):
                errors.extend(exc.messages)
            else:
                errors.append(str(exc))

        if errors:
            raise serializers.ValidationError({'password': errors})

        return attrs

    def create(self, validated_data):
        email = validated_data['email']
        password = validated_data['password']
        name = validated_data.get('name', '').strip()
        username = validated_data.get('username', '').strip()

        # Split full name into first and last name
        first_name = ''
        last_name = ''
        if name:
            parts = name.split(' ', 1)
            first_name = parts[0]
            if len(parts) > 1:
                last_name = parts[1]

        # Auto-derive unique username if not provided
        if not username:
            base_user = email.split('@')[0]
            base_user = re.sub(r'[^\w.@+-]', '', base_user) or 'reader'
            candidate = base_user[:30]
            counter = 1
            while User.objects.filter(username__iexact=candidate).exists():
                candidate = f"{base_user[:25]}_{counter}"
                counter += 1
            username = candidate

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name
        )
        return user


class LoginSerializer(serializers.Serializer):
    """
    Customer authentication serializer supporting either email or username login.
    """
    identifier = serializers.CharField(
        required=True,
        trim_whitespace=True,
        error_messages={'required': 'Please provide your email address or username.'}
    )
    password = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'},
        error_messages={'required': 'Password is required.'}
    )

    def validate(self, attrs):
        identifier = attrs.get('identifier', '').strip()
        password = attrs.get('password')
        request = self.context.get('request')

        user = None

        # Try looking up by email first (case-insensitive)
        user_by_email = User.objects.filter(email__iexact=identifier).first()
        if user_by_email:
            user = authenticate(request, username=user_by_email.username, password=password)

        # If not authenticated via email, try as username directly
        if not user:
            user = authenticate(request, username=identifier, password=password)

        if not user:
            raise serializers.ValidationError(
                'Invalid credentials. Please verify your email address / username and password.'
            )

        if not user.is_active:
            raise serializers.ValidationError(
                'This account is currently inactive. Please contact bookstore administration.'
            )

        attrs['user'] = user
        return attrs
