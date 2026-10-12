"""
Security permissions for AETHERIUM Administration API (Phase 9A).
Enforces server-side authorization: requires authenticated Django staff accounts.
"""

from rest_framework.permissions import BasePermission


class IsStaffAdmin(BasePermission):
    """
    Allows access strictly to authenticated users with is_staff=True.
    - Unauthenticated requests trigger HTTP 401 Unauthorized.
    - Authenticated ordinary customers without staff privileges trigger HTTP 403 Forbidden.
    """
    message = "Administrative access denied. Staff privileges are required."

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.is_staff
        )
