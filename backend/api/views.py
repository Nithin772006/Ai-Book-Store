from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status

@api_view(['GET'])
def health_check(request):
    """
    Health check endpoint for Phase 1 verification.
    Returns status, confirmation message, project name, and version.
    """
    return Response(
        {
            "status": "success",
            "message": "Online Bookstore API is running!",
            "project": "AI Online Bookstore",
            "version": "1.0.0",
        },
        status=status.HTTP_200_OK,
    )
