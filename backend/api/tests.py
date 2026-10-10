from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status

class HealthCheckApiTests(APITestCase):
    def test_health_check_endpoint_success(self):
        """
        Verify that GET /api/health/ returns HTTP 200 and expected payload:
        - status: success
        - message: Online Bookstore API is running!
        - project: AI Online Bookstore
        - version: 1.0.0
        """
        response = self.client.get('/api/health/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), {
            "status": "success",
            "message": "Online Bookstore API is running!",
            "project": "AI Online Bookstore",
            "version": "1.0.0"
        })

    def test_health_check_cors_headers(self):
        """
        Verify CORS headers when requested by authorized frontend origin.
        """
        response = self.client.get(
            '/api/health/',
            HTTP_ORIGIN='http://localhost:5173'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.headers.get('Access-Control-Allow-Origin'), 'http://localhost:5173')
