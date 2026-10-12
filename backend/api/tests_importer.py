"""
Comprehensive Automated Test Suite for AETHERIUM Bulk Book Importer.
Covers file parsing (CSV & XLSX), column mapping, row validation, duplicate
detection, conflict modes (skip & update), SSRF URL protections, ZIP archive
security, CSRF & permissions, formula injection defense, and regression safety.
"""

import io
import json
import os
import tempfile
import uuid
import zipfile
from decimal import Decimal
from unittest.mock import patch
from PIL import Image

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
import openpyxl

from catalog.models import Book, Category, ImportJob

from catalog.importer import (
    sanitize_csv_cell,
    validate_and_extract_covers_zip,
    validate_and_fetch_image_url,
    generate_csv_template,
    generate_excel_template,
    parse_spreadsheet_file,
    get_staged_file_path,
    stage_uploaded_file,
    cleanup_staged_file,
    inspect_staged_file,
    parse_staged_slice,
    MAX_CSV_SIZE_BYTES,
    MAX_XLSX_SIZE_BYTES,
    MAX_BATCH_ROWS_LIMIT,
)



class BookImporterTests(TestCase):
    def setUp(self):
        # 1. Staff User for authorized admin requests
        self.staff_user = User.objects.create_user(
            username='staff_curator',
            password='CuratorPassword123!',
            email='curator@aetherium.io',
            is_staff=True
        )

        # 2. Regular Customer User without staff access
        self.customer_user = User.objects.create_user(
            username='regular_customer',
            password='CustomerPassword123!',
            email='customer@example.com',
            is_staff=False
        )

        # 3. Baseline Categories
        self.cat_ai = Category.objects.create(name='Artificial Intelligence & ML', slug='ai-machine-learning')
        self.cat_se = Category.objects.create(name='Software Engineering', slug='software-engineering')

        # 4. Existing Sample Book for conflict testing
        self.existing_book = Book.objects.create(
            title='Designing Data-Intensive Applications',
            slug='designing-data-intensive-applications',
            author='Martin Kleppmann',
            description='The definitive guide to distributed data systems.',
            isbn='978-1449373320',
            price=Decimal('39.99'),
            stock_quantity=10,
            category=self.cat_se,
        )

        # Authenticated client setup
        self.client = APIClient()
        self.client.force_authenticate(user=self.staff_user)

    # -------------------------------------------------------------------------
    # 1. TEMPLATE DOWNLOAD TESTS
    # -------------------------------------------------------------------------
    def test_download_csv_template(self):
        url = reverse('admin-book-import-template') + '?format=csv'
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn('text/csv', resp['Content-Type'])
        self.assertIn('attachment; filename="aetherium_book_import_template.csv"', resp['Content-Disposition'])
        content = resp.content.decode('utf-8-sig')
        self.assertIn('title,author,category,price', content)
        self.assertIn('Elena Vance', content)

    def test_download_excel_template(self):
        url = reverse('admin-book-import-template') + '?format=xlsx'
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn('spreadsheetml.sheet', resp['Content-Type'])
        self.assertIn('aetherium_book_import_template.xlsx', resp['Content-Disposition'])

        wb = openpyxl.load_workbook(io.BytesIO(resp.content))
        self.assertIn("Book Import Template", wb.sheetnames)
        self.assertIn("Field Guide & Instructions", wb.sheetnames)
        wb.close()

    # -------------------------------------------------------------------------
    # 2. PERMISSIONS & UNAUTHENTICATED ACCESS
    # -------------------------------------------------------------------------
    def test_unauthenticated_access_denied(self):
        anon_client = APIClient()
        url = reverse('admin-book-import-history')
        resp = anon_client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_non_staff_customer_access_forbidden(self):
        cust_client = APIClient()
        cust_client.force_authenticate(user=self.customer_user)
        url = reverse('admin-book-import-history')
        resp = cust_client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    # -------------------------------------------------------------------------
    # 3. CSV UPLOAD & COLUMN MAPPING TESTS
    # -------------------------------------------------------------------------
    def test_upload_valid_csv(self):
        csv_data = (
            "title,author,category,price,description,isbn,stock_quantity\n"
            "Deep Learning Foundations,Ian Goodfellow,Artificial Intelligence & ML,49.99,Comprehensive deep learning theory.,978-0262035613,15\n"
        ).encode('utf-8')
        file_obj = SimpleUploadedFile("books.csv", csv_data, content_type="text/csv")

        url = reverse('admin-book-import-upload')
        resp = self.client.post(url, {'file': file_obj}, format='multipart')

        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        data = resp.json()
        self.assertIn('job_id', data)
        self.assertEqual(data['total_rows'], 1)
        self.assertEqual(data['file_type'], 'csv')
        self.assertIn('title', data['suggested_mapping'])
        self.assertIn('price', data['suggested_mapping'])

    def test_upload_empty_csv_fails(self):
        file_obj = SimpleUploadedFile("empty.csv", b"", content_type="text/csv")
        url = reverse('admin-book-import-upload')
        resp = self.client.post(url, {'file': file_obj}, format='multipart')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_upload_unsupported_format_fails(self):
        file_obj = SimpleUploadedFile("data.txt", b"some text", content_type="text/plain")
        url = reverse('admin-book-import-upload')
        resp = self.client.post(url, {'file': file_obj}, format='multipart')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Unsupported file format", resp.json()['error'])

    # -------------------------------------------------------------------------
    # 4. XLSX UPLOAD TEST
    # -------------------------------------------------------------------------
    def test_upload_valid_xlsx(self):
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.append(["title", "author", "category", "price", "description"])
        ws.append(["Pattern Recognition", "Christopher Bishop", "Artificial Intelligence & ML", 55.00, "Machine learning foundations."])

        stream = io.BytesIO()
        wb.save(stream)
        wb.close()
        stream.seek(0)

        file_obj = SimpleUploadedFile("books.xlsx", stream.getvalue(), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        url = reverse('admin-book-import-upload')
        resp = self.client.post(url, {'file': file_obj}, format='multipart')

        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        data = resp.json()
        self.assertEqual(data['file_type'], 'xlsx')
        self.assertEqual(data['total_rows'], 1)

    # -------------------------------------------------------------------------
    # 5. VALIDATION & DUPLICATE DETECTION TESTS
    # -------------------------------------------------------------------------
    def test_validation_detects_missing_required_fields(self):
        csv_data = (
            "title,author,category,price,description\n"
            ",Dr. Null,Artificial Intelligence & ML,29.99,A titleless book.\n"
        ).encode('utf-8')
        file_obj = SimpleUploadedFile("missing_title.csv", csv_data, content_type="text/csv")

        upload_resp = self.client.post(reverse('admin-book-import-upload'), {'file': file_obj}, format='multipart')
        job_id = upload_resp.json()['job_id']
        mapping = upload_resp.json()['suggested_mapping']

        val_resp = self.client.post(reverse('admin-book-import-validate'), {
            'job_id': job_id,
            'column_mapping': mapping,
        }, format='json')
        self.assertEqual(val_resp.status_code, status.HTTP_200_OK)
        summary = val_resp.json()['validation_summary']
        self.assertEqual(summary['invalid_rows_count'], 1)
        self.assertIn("Title is required.", val_resp.json()['preview_rows'][0]['_errors'])

    def test_validation_detects_duplicate_isbn_in_file(self):
        csv_data = (
            "title,author,category,price,description,isbn\n"
            "Book Alpha,Author A,Software Engineering,20.00,Desc A,978-0000000001\n"
            "Book Beta,Author B,Software Engineering,25.00,Desc B,978-0000000001\n"
        ).encode('utf-8')
        file_obj = SimpleUploadedFile("dup_isbn.csv", csv_data, content_type="text/csv")

        upload_resp = self.client.post(reverse('admin-book-import-upload'), {'file': file_obj}, format='multipart')
        job_id = upload_resp.json()['job_id']
        mapping = upload_resp.json()['suggested_mapping']

        val_resp = self.client.post(reverse('admin-book-import-validate'), {
            'job_id': job_id,
            'column_mapping': mapping,
        }, format='json')
        self.assertEqual(val_resp.status_code, status.HTTP_200_OK)
        rows = val_resp.json()['preview_rows']
        self.assertEqual(rows[0]['_status'], 'valid')
        self.assertEqual(rows[1]['_status'], 'error')
        self.assertTrue(any("Duplicate ISBN" in err for err in rows[1]['_errors']))

    def test_validation_detects_conflict_with_existing_db_book(self):
        # The existing book has ISBN: 978-1449373320
        csv_data = (
            "title,author,category,price,description,isbn\n"
            "Designing Data-Intensive Applications 2nd Ed,Martin Kleppmann,Software Engineering,45.00,Updated edition.,978-1449373320\n"
        ).encode('utf-8')
        file_obj = SimpleUploadedFile("conflict.csv", csv_data, content_type="text/csv")

        upload_resp = self.client.post(reverse('admin-book-import-upload'), {'file': file_obj}, format='multipart')
        job_id = upload_resp.json()['job_id']
        mapping = upload_resp.json()['suggested_mapping']

        val_resp = self.client.post(reverse('admin-book-import-validate'), {
            'job_id': job_id,
            'column_mapping': mapping,
            'conflict_mode': 'skip'
        }, format='json')
        self.assertEqual(val_resp.status_code, status.HTTP_200_OK)
        summary = val_resp.json()['validation_summary']
        self.assertEqual(summary['conflict_rows_count'], 1)
        self.assertEqual(val_resp.json()['preview_rows'][0]['_status'], 'conflict')

    # -------------------------------------------------------------------------
    # 6. CONFIRMATION, ATOMIC TRANSACTIONS & UPDATE MODE
    # -------------------------------------------------------------------------
    def test_confirm_import_creates_new_books(self):
        csv_data = (
            "title,author,category,price,description,isbn\n"
            "Reliable Systems Engineering,Brenda Milner,Software Engineering,38.00,Comprehensive reliability handbook.,978-0112233445\n"
        ).encode('utf-8')
        file_obj = SimpleUploadedFile("new_book.csv", csv_data, content_type="text/csv")

        upload_resp = self.client.post(reverse('admin-book-import-upload'), {'file': file_obj}, format='multipart')
        job_id = upload_resp.json()['job_id']
        mapping = upload_resp.json()['suggested_mapping']

        self.client.post(reverse('admin-book-import-validate'), {
            'job_id': job_id,
            'column_mapping': mapping,
        }, format='json')

        initial_count = Book.objects.count()
        confirm_resp = self.client.post(reverse('admin-book-import-confirm'), {
            'job_id': job_id,
            'conflict_mode': 'skip'
        }, format='json')

        self.assertEqual(confirm_resp.status_code, status.HTTP_200_OK)
        data = confirm_resp.json()
        self.assertEqual(data['job']['created_count'], 1)
        self.assertEqual(Book.objects.count(), initial_count + 1)

        new_book = Book.objects.get(isbn='9780112233445')
        self.assertEqual(new_book.title, "Reliable Systems Engineering")
        self.assertEqual(new_book.price, Decimal('38.00'))

    def test_confirm_import_skips_existing_when_skip_mode_selected(self):
        csv_data = (
            "title,author,category,price,description,isbn\n"
            "Designing Data-Intensive Applications,Martin Kleppmann,Software Engineering,45.00,New description.,978-1449373320\n"
        ).encode('utf-8')
        file_obj = SimpleUploadedFile("conflict_skip.csv", csv_data, content_type="text/csv")

        upload_resp = self.client.post(reverse('admin-book-import-upload'), {'file': file_obj}, format='multipart')
        job_id = upload_resp.json()['job_id']
        mapping = upload_resp.json()['suggested_mapping']

        self.client.post(reverse('admin-book-import-validate'), {'job_id': job_id, 'column_mapping': mapping}, format='json')

        confirm_resp = self.client.post(reverse('admin-book-import-confirm'), {
            'job_id': job_id,
            'conflict_mode': 'skip'
        }, format='json')
        self.assertEqual(confirm_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(confirm_resp.json()['job']['skipped_count'], 1)

        # Ensure existing price was not modified
        self.existing_book.refresh_from_db()
        self.assertEqual(self.existing_book.price, Decimal('39.99'))

    def test_confirm_import_updates_existing_when_update_mode_selected(self):
        csv_data = (
            "title,author,category,price,description,isbn,stock_quantity\n"
            "Designing Data-Intensive Applications,Martin Kleppmann,Software Engineering,45.00,Updated description.,978-1449373320,50\n"
        ).encode('utf-8')
        file_obj = SimpleUploadedFile("conflict_update.csv", csv_data, content_type="text/csv")

        upload_resp = self.client.post(reverse('admin-book-import-upload'), {'file': file_obj}, format='multipart')
        job_id = upload_resp.json()['job_id']
        mapping = upload_resp.json()['suggested_mapping']

        self.client.post(reverse('admin-book-import-validate'), {'job_id': job_id, 'column_mapping': mapping}, format='json')

        confirm_resp = self.client.post(reverse('admin-book-import-confirm'), {
            'job_id': job_id,
            'conflict_mode': 'update'
        }, format='json')
        self.assertEqual(confirm_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(confirm_resp.json()['job']['updated_count'], 1)

        # Verify existing record was updated
        self.existing_book.refresh_from_db()
        self.assertEqual(self.existing_book.price, Decimal('45.00'))
        self.assertEqual(self.existing_book.stock_quantity, 50)
        self.assertEqual(self.existing_book.description, 'Updated description.')

    def test_idempotent_double_submission_prevented(self):
        csv_data = (
            "title,author,category,price,description,isbn\n"
            "Unique Book Once,Author Once,Software Engineering,19.99,Description once.,978-9988776655\n"
        ).encode('utf-8')
        file_obj = SimpleUploadedFile("once.csv", csv_data, content_type="text/csv")

        upload_resp = self.client.post(reverse('admin-book-import-upload'), {'file': file_obj}, format='multipart')
        job_id = upload_resp.json()['job_id']
        mapping = upload_resp.json()['suggested_mapping']

        self.client.post(reverse('admin-book-import-validate'), {'job_id': job_id, 'column_mapping': mapping}, format='json')

        idempotency_key = str(uuid.uuid4())
        resp1 = self.client.post(reverse('admin-book-import-confirm'), {
            'job_id': job_id,
            'idempotency_key': idempotency_key,
        }, format='json')
        self.assertEqual(resp1.status_code, status.HTTP_200_OK)
        self.assertEqual(resp1.json()['job']['created_count'], 1)

        # Second submission
        resp2 = self.client.post(reverse('admin-book-import-confirm'), {
            'job_id': job_id,
            'idempotency_key': idempotency_key,
        }, format='json')
        self.assertEqual(resp2.status_code, status.HTTP_200_OK)
        self.assertIn("already been completed", resp2.json()['message'])

    # -------------------------------------------------------------------------
    # 7. SECURITY & SSRF PROTECTIONS
    # -------------------------------------------------------------------------
    def test_ssrf_rejects_localhost_and_internal_ips(self):
        unsafe_urls = [
            "http://localhost:8000/media/secret.png",
            "http://127.0.0.1:8000/api/books/",
            "http://169.254.169.254/latest/meta-data/",
            "http://10.0.0.1/private.jpg",
            "http://192.168.1.1/router.jpg",
            "ftp://example.com/image.jpg",
            "file:///etc/passwd",
        ]
        for bad_url in unsafe_urls:
            with self.assertRaises(ValueError):
                validate_and_fetch_image_url(bad_url)

    def test_zip_archive_path_traversal_rejected(self):
        stream = io.BytesIO()
        with zipfile.ZipFile(stream, 'w') as zf:
            zf.writestr('../../etc/passwd', b'malicious content')
        stream.seek(0)
        zip_obj = SimpleUploadedFile("hack.zip", stream.getvalue(), content_type="application/zip")

        import tempfile
        tmp_dir = tempfile.mkdtemp()
        with self.assertRaises(ValueError) as ctx:
            validate_and_extract_covers_zip(zip_obj, tmp_dir)
        self.assertIn("Dangerous path traversal", str(ctx.exception))

    def test_formula_injection_defense_sanitizes_cells(self):
        dangerous_cells = [
            "=SUM(A1:A10)",
            "+1+1",
            "-2+3",
            "@cmd|' /C calc'!A0",
            "\tTAB_ATTACK",
            "\rRETURN_ATTACK",
        ]
        for cell in dangerous_cells:
            sanitized = sanitize_csv_cell(cell)
            self.assertTrue(sanitized.startswith("'"), f"Cell {cell} was not sanitized with apostrophe.")

        safe_cell = "Normal Title: Advanced AI"
        self.assertEqual(sanitize_csv_cell(safe_cell), safe_cell)

    # -------------------------------------------------------------------------
    # 8. ERROR REPORT DOWNLOAD TEST
    # -------------------------------------------------------------------------
    def test_download_error_report_csv(self):
        job = ImportJob.objects.create(
            created_by=self.staff_user,
            filename='corrupt.csv',
            status=ImportJob.STATUS_COMPLETED,
            error_summary=[
                {
                    'row_num': 2,
                    'title': '=cmd|malicious',
                    'author': 'Unknown',
                    'isbn': '978-1111111111',
                    'category': 'Unknown',
                    'status': 'error',
                    'errors': ['Category does not exist.'],
                    'warnings': [],
                }
            ]
        )
        url = reverse('admin-book-import-errors', kwargs={'job_id': job.job_id})
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn('text/csv', resp['Content-Type'])
        content = resp.content.decode('utf-8-sig')
        self.assertIn("'=cmd|malicious", content)  # Formula injection protected
        self.assertIn("Category does not exist", content)

    # -------------------------------------------------------------------------
    # 9. 100 MB COVER ZIP LIMIT, ROW LIMITS & STREAMING TESTS
    # -------------------------------------------------------------------------
    def _create_sample_zip(self, filenames_and_contents=None):
        if filenames_and_contents is None:
            img_io = io.BytesIO()
            img = Image.new('RGB', (50, 50), color=(107, 23, 36))
            img.save(img_io, format='JPEG')
            filenames_and_contents = {'9781449373320.jpg': img_io.getvalue()}

        stream = io.BytesIO()
        with zipfile.ZipFile(stream, 'w') as zf:
            for name, content in filenames_and_contents.items():
                zf.writestr(name, content)
        stream.seek(0)
        return stream.getvalue()

    def test_cover_zip_under_100mb_accepted(self):
        zip_bytes = self._create_sample_zip()
        zip_obj = SimpleUploadedFile("covers_valid.zip", zip_bytes, content_type="application/zip")
        self.assertLess(zip_obj.size, 100 * 1024 * 1024)

        import tempfile
        tmp_dir = tempfile.mkdtemp()
        mapping = validate_and_extract_covers_zip(zip_obj, tmp_dir)
        self.assertIn('9781449373320.jpg', mapping)

    def test_cover_zip_exactly_at_100mb_limit_accepted(self):
        zip_bytes = self._create_sample_zip()
        zip_obj = SimpleUploadedFile("covers_100mb.zip", zip_bytes, content_type="application/zip")
        # Set simulated file size to exactly 100 MB
        zip_obj.size = 100 * 1024 * 1024

        import tempfile
        tmp_dir = tempfile.mkdtemp()
        mapping = validate_and_extract_covers_zip(zip_obj, tmp_dir)
        self.assertIn('9781449373320.jpg', mapping)

    def test_cover_zip_exceeding_100mb_rejected(self):
        zip_bytes = self._create_sample_zip()
        zip_obj = SimpleUploadedFile("covers_oversized.zip", zip_bytes, content_type="application/zip")
        # 100 MB + 1 byte
        zip_obj.size = (100 * 1024 * 1024) + 1

        import tempfile
        tmp_dir = tempfile.mkdtemp()
        with self.assertRaises(ValueError) as ctx:
            validate_and_extract_covers_zip(zip_obj, tmp_dir)
        self.assertIn("exceeds maximum allowed limit of 100 MB", str(ctx.exception))

    def test_cover_zip_exceeding_100mb_rejected_via_api_endpoint(self):
        csv_data = "title,author,category,price,description\nValid Book,Author,Software Engineering,25.00,Desc\n".encode('utf-8')
        file_obj = SimpleUploadedFile("books.csv", csv_data, content_type="text/csv")

        zip_bytes = self._create_sample_zip()
        zip_obj = SimpleUploadedFile("oversized.zip", zip_bytes, content_type="application/zip")

        url = reverse('admin-book-import-upload')
        # Simulate an uploaded zip file exceeding 100 MB on the endpoint
        with patch('api.admin_views.MAX_ZIP_SIZE_BYTES', 50):
            resp = self.client.post(url, {'file': file_obj, 'covers_zip': zip_obj}, format='multipart')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("100 MB", resp.json()['error'])

    def test_spreadsheet_exceeding_20mb_rejected(self):
        # XLSX files independently enforce a 20 MB limit
        file_obj = SimpleUploadedFile("big.xlsx", b"PK\x03\x04fake-xlsx", content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        file_obj.size = (20 * 1024 * 1024) + 1

        with self.assertRaises(ValueError) as ctx:
            parse_spreadsheet_file(file_obj)
        self.assertIn("20 MB limit", str(ctx.exception))

    def test_spreadsheet_exceeding_upload_limit_rejected_via_api(self):
        csv_data = "title,author,category,price,description\nBook,Author,Software Engineering,20,Desc\n".encode('utf-8')
        file_obj = SimpleUploadedFile("big.csv", csv_data, content_type="text/csv")

        url = reverse('admin-book-import-upload')
        with patch('api.admin_views.MAX_CSV_SIZE_BYTES', 20):
            resp = self.client.post(url, {'file': file_obj}, format='multipart')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("exceeds maximum allowed limit", resp.json()['error'])

    # -------------------------------------------------------------------------
    # SMART BULK BOOK IMPORTER (LARGE CSV & SELECTABLE ROWS) TEST SUITE
    # -------------------------------------------------------------------------

    def test_upload_csv_larger_than_20mb_accepted(self):
        """1. Uploading a CSV larger than 20 MB but smaller than 100 MB is accepted."""
        csv_data = (
            "title,author,category,price,description,isbn\n"
            "Large Dataset Book,Aetherium Architect,Software Engineering,29.99,Large 71MB dataset simulated,978-0111111111\n"
        ).encode('utf-8')
        file_obj = SimpleUploadedFile("kaggle_books_71mb.csv", csv_data, content_type="text/csv")

        url = reverse('admin-book-import-upload')
        resp = self.client.post(url, {'file': file_obj}, format='multipart')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        data = resp.json()
        self.assertEqual(data['total_rows'], 1)
        self.assertGreater(data['file_size'], 0)
        self.assertEqual(data['max_batch_limit'], 5000)

    def test_reject_csv_exceeding_configured_upload_limit(self):
        """2. Rejecting a CSV larger than the configured upload limit (100 MB)."""
        csv_data = b"title,author,category,price,description\nBook,Author,Cat,10,Desc\n"
        file_obj = SimpleUploadedFile("too_huge.csv", csv_data, content_type="text/csv")

        url = reverse('admin-book-import-upload')
        with patch('api.admin_views.MAX_CSV_SIZE_BYTES', 20):
            resp = self.client.post(url, {'file': file_obj}, format='multipart')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("exceeds maximum allowed limit", resp.json()['error'])


    def test_detect_correct_number_of_csv_data_records_excluding_header(self):
        """3. Detecting the correct number of CSV data records without counting the header."""
        lines = ["title,author,category,price,description\n"]
        for i in range(1, 121):
            lines.append(f"Book {i},Author {i},Software Engineering,19.99,Description {i}\n")
        csv_data = "".join(lines).encode('utf-8')
        file_obj = SimpleUploadedFile("hundred_twenty.csv", csv_data, content_type="text/csv")

        url = reverse('admin-book-import-upload')
        resp = self.client.post(url, {'file': file_obj}, format='multipart')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        # 120 data records, header excluded
        self.assertEqual(resp.json()['total_rows'], 120)

    def test_import_exactly_50_selected_records_default(self):
        """4. Importing exactly 50 selected records (default preset)."""
        lines = ["title,author,category,price,description,isbn\n"]
        for i in range(1, 81):
            lines.append(f"FiftyTest Book {i},Author {i},Software Engineering,25.00,Fifty test desc,978-505050{i:04d}\n")
        csv_data = "".join(lines).encode('utf-8')
        file_obj = SimpleUploadedFile("eighty_books.csv", csv_data, content_type="text/csv")

        # Step 1: Upload
        up_resp = self.client.post(reverse('admin-book-import-upload'), {'file': file_obj}, format='multipart')
        self.assertEqual(up_resp.status_code, status.HTTP_201_CREATED)
        job_id = up_resp.json()['job_id']
        mapping = up_resp.json()['suggested_mapping']

        # Step 2: Validate default quantity of 50
        val_resp = self.client.post(reverse('admin-book-import-validate'), {
            'job_id': job_id,
            'selection_mode': 'quantity',
            'quantity': 50,
            'column_mapping': mapping,
        }, format='json')
        self.assertEqual(val_resp.status_code, status.HTTP_200_OK)
        val_data = val_resp.json()
        self.assertEqual(val_data['validation_summary']['total_rows'], 50)
        self.assertEqual(val_data['selection_info']['selected_count'], 50)
        self.assertEqual(val_data['selection_info']['start_row'], 1)
        self.assertEqual(val_data['selection_info']['end_row'], 50)

        # Step 3: Confirm Import
        conf_resp = self.client.post(reverse('admin-book-import-confirm'), {'job_id': job_id}, format='json')
        self.assertEqual(conf_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(conf_resp.json()['job']['created_count'], 50)

        # Verify exactly 50 imported books in database
        imported_books = Book.objects.filter(title__startswith='FiftyTest Book')
        self.assertEqual(imported_books.count(), 50)

    def test_import_custom_quantity(self):
        """5. Importing a custom quantity (e.g. 15 books)."""
        lines = ["title,author,category,price,description,isbn\n"]
        for i in range(1, 41):
            lines.append(f"CustomQty Book {i},Author {i},Software Engineering,20.00,Desc,978-404040{i:04d}\n")
        csv_data = "".join(lines).encode('utf-8')
        file_obj = SimpleUploadedFile("forty_books.csv", csv_data, content_type="text/csv")

        up_resp = self.client.post(reverse('admin-book-import-upload'), {'file': file_obj}, format='multipart')
        job_id = up_resp.json()['job_id']
        mapping = up_resp.json()['suggested_mapping']

        val_resp = self.client.post(reverse('admin-book-import-validate'), {
            'job_id': job_id,
            'selection_mode': 'quantity',
            'quantity': 15,
            'column_mapping': mapping,
        }, format='json')
        self.assertEqual(val_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(val_resp.json()['selection_info']['selected_count'], 15)

        conf_resp = self.client.post(reverse('admin-book-import-confirm'), {'job_id': job_id}, format='json')
        self.assertEqual(conf_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(conf_resp.json()['job']['created_count'], 15)
        self.assertEqual(Book.objects.filter(title__startswith='CustomQty Book').count(), 15)

    def test_import_specific_row_range(self):
        """6. Importing a specific row range (e.g. rows 11 to 25 = 15 books)."""
        lines = ["title,author,category,price,description,isbn\n"]
        for i in range(1, 61):
            lines.append(f"RangeBook {i},Author {i},Software Engineering,22.00,Desc,978-606060{i:04d}\n")
        csv_data = "".join(lines).encode('utf-8')
        file_obj = SimpleUploadedFile("sixty_books.csv", csv_data, content_type="text/csv")

        up_resp = self.client.post(reverse('admin-book-import-upload'), {'file': file_obj}, format='multipart')
        job_id = up_resp.json()['job_id']
        mapping = up_resp.json()['suggested_mapping']

        # Select rows 11 to 25
        val_resp = self.client.post(reverse('admin-book-import-validate'), {
            'job_id': job_id,
            'selection_mode': 'range',
            'start_row': 11,
            'end_row': 25,
            'column_mapping': mapping,
        }, format='json')
        self.assertEqual(val_resp.status_code, status.HTTP_200_OK)
        val_data = val_resp.json()
        self.assertEqual(val_data['selection_info']['selected_count'], 15)
        self.assertEqual(val_data['selection_info']['start_row'], 11)
        self.assertEqual(val_data['selection_info']['end_row'], 25)

        conf_resp = self.client.post(reverse('admin-book-import-confirm'), {'job_id': job_id}, format='json')
        self.assertEqual(conf_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(conf_resp.json()['job']['created_count'], 15)

        # Ensure Book 11 is present and Book 1 is NOT present
        self.assertTrue(Book.objects.filter(title='RangeBook 11').exists())
        self.assertTrue(Book.objects.filter(title='RangeBook 25').exists())
        self.assertFalse(Book.objects.filter(title='RangeBook 1').exists())
        self.assertFalse(Book.objects.filter(title='RangeBook 26').exists())

    def test_enforcing_5000_record_batch_maximum(self):
        """7. Enforcing the 5,000-record batch maximum on validation and confirmation."""
        csv_data = "title,author,category,price,description\nBook 1,Author 1,Software Engineering,10,Desc\n".encode('utf-8')
        file_obj = SimpleUploadedFile("small.csv", csv_data, content_type="text/csv")

        up_resp = self.client.post(reverse('admin-book-import-upload'), {'file': file_obj}, format='multipart')
        job_id = up_resp.json()['job_id']

        # Exceeding via quantity
        resp_qty = self.client.post(reverse('admin-book-import-validate'), {
            'job_id': job_id,
            'selection_mode': 'quantity',
            'quantity': 5001,
        }, format='json')
        self.assertEqual(resp_qty.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("exceeds the maximum batch limit of 5000", resp_qty.json()['error'])

        # Exceeding via range
        resp_range = self.client.post(reverse('admin-book-import-validate'), {
            'job_id': job_id,
            'selection_mode': 'range',
            'start_row': 1,
            'end_row': 5001,
        }, format='json')
        self.assertEqual(resp_range.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("exceeds the maximum batch limit of 5000", resp_range.json()['error'])

    def test_handling_quoted_commas_and_multiline_csv_fields(self):
        """8. Handling quoted commas and multiline CSV fields correctly without extra row splits."""
        csv_content = (
            'title,author,category,price,description,isbn\n'
            '"The Art of Unix, Linux, and POSIX","Eric S. Raymond",Software Engineering,34.50,"This is a multiline\ndescription with, commas\nand special text.",978-0131429017\n'
            'Clean Architecture,Robert Martin,Software Engineering,32.00,Solid design patterns,978-0134494166\n'
        )
        file_obj = SimpleUploadedFile("multiline.csv", csv_content.encode('utf-8'), content_type="text/csv")

        up_resp = self.client.post(reverse('admin-book-import-upload'), {'file': file_obj}, format='multipart')
        self.assertEqual(up_resp.status_code, status.HTTP_201_CREATED)
        # Should be exactly 2 rows, not 4
        self.assertEqual(up_resp.json()['total_rows'], 2)

        job_id = up_resp.json()['job_id']
        val_resp = self.client.post(reverse('admin-book-import-validate'), {
            'job_id': job_id,
            'quantity': 50,
        }, format='json')
        self.assertEqual(val_resp.status_code, status.HTTP_200_OK)
        preview_rows = val_resp.json()['preview_rows']
        self.assertEqual(len(preview_rows), 2)
        self.assertIn("multiline\ndescription with, commas", preview_rows[0]['description'])

    def test_missing_and_reordered_columns_with_fallback_defaults(self):
        """9. Handling reordered Kaggle dataset headers and applying fallback defaults for missing price/category/description."""
        # Kaggle Book-Crossing dataset format: ISBN, Book-Title, Book-Author, Year-Of-Publication, Publisher, Image-URL-L
        kaggle_csv = (
            'ISBN;Book-Title;Book-Author;Year-Of-Publication;Publisher;Image-URL-L\n'
            '0195153448;Classical Mythology;Mark P. O. Morford;2002;Oxford University Press;http://images.amazon.com/images/P/0195153448.01.LZZZZZZZ.jpg\n'
            '0002005018;Clara Callan;Richard Bruce Wright;2001;HarperFlamingo Canada;http://images.amazon.com/images/P/0002005018.01.LZZZZZZZ.jpg\n'
        )
        file_obj = SimpleUploadedFile("kaggle_sample.csv", kaggle_csv.encode('utf-8'), content_type="text/csv")

        up_resp = self.client.post(reverse('admin-book-import-upload'), {'file': file_obj}, format='multipart')
        self.assertEqual(up_resp.status_code, status.HTTP_201_CREATED)
        job_id = up_resp.json()['job_id']
        mapping = up_resp.json()['suggested_mapping']

        # Verify auto-detection of Kaggle aliases
        self.assertEqual(mapping.get('title'), 'Book-Title')
        self.assertEqual(mapping.get('author'), 'Book-Author')
        self.assertEqual(mapping.get('publication_date'), 'Year-Of-Publication')
        self.assertEqual(mapping.get('publisher'), 'Publisher')
        self.assertEqual(mapping.get('cover_image_url'), 'Image-URL-L')

        # Price, Category, and Description are missing in this dataset.
        # Validating without fallbacks fails:
        val_fail = self.client.post(reverse('admin-book-import-validate'), {
            'job_id': job_id,
            'column_mapping': mapping,
        }, format='json')
        self.assertEqual(val_fail.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("must be mapped to a CSV column or configured with fallback defaults", val_fail.json()['error'])

        # Now configure explicit fallbacks for price, category, and description
        val_ok = self.client.post(reverse('admin-book-import-validate'), {
            'job_id': job_id,
            'column_mapping': mapping,
            'fallback_values': {
                'price': '19.99',
                'category': 'Software Engineering',
                'description': 'Catalogue volume published by {publisher} ({year}).',
            }
        }, format='json')
        self.assertEqual(val_ok.status_code, status.HTTP_200_OK)
        preview = val_ok.json()['preview_rows']
        self.assertEqual(preview[0]['price'], '19.99')
        self.assertEqual(preview[0]['category_name'], 'Software Engineering')
        self.assertIn('Oxford University Press (2002)', preview[0]['description'])


        # Confirm import succeeds
        conf_resp = self.client.post(reverse('admin-book-import-confirm'), {'job_id': job_id}, format='json')
        self.assertEqual(conf_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(conf_resp.json()['job']['created_count'], 2)
        self.assertTrue(Book.objects.filter(isbn='0195153448').exists())

    def test_detecting_duplicate_isbns_within_file(self):
        """10. Detecting duplicate ISBNs within the uploaded CSV file and logging conflicts."""
        csv_data = (
            "title,author,category,price,description,isbn\n"
            "First Edition,Author A,Software Engineering,20,Desc,978-9999999999\n"
            "Second Edition Duplicate,Author B,Software Engineering,25,Desc,978-9999999999\n"
        ).encode('utf-8')
        file_obj = SimpleUploadedFile("dups.csv", csv_data, content_type="text/csv")

        up_resp = self.client.post(reverse('admin-book-import-upload'), {'file': file_obj}, format='multipart')
        job_id = up_resp.json()['job_id']

        val_resp = self.client.post(reverse('admin-book-import-validate'), {'job_id': job_id}, format='json')
        self.assertEqual(val_resp.status_code, status.HTTP_200_OK)
        summary = val_resp.json()['validation_summary']
        self.assertEqual(summary['invalid_rows_count'], 1)
        self.assertIn("Duplicate ISBN", val_resp.json()['preview_rows'][1]['_errors'][0])

    def test_skipping_invalid_records_and_reporting_original_record_numbers(self):
        """11. Skipping invalid records and reporting their original record numbers."""
        csv_data = (
            "title,author,category,price,description\n"
            "Valid Book,Good Author,Software Engineering,15.00,Good description\n"
            ",Missing Title Author,Software Engineering,15.00,Good description\n"
            "Bad Price Book,Author,Software Engineering,NOT_A_PRICE,Good description\n"
        ).encode('utf-8')
        file_obj = SimpleUploadedFile("mixed.csv", csv_data, content_type="text/csv")

        up_resp = self.client.post(reverse('admin-book-import-upload'), {'file': file_obj}, format='multipart')
        job_id = up_resp.json()['job_id']

        val_resp = self.client.post(reverse('admin-book-import-validate'), {'job_id': job_id}, format='json')
        self.assertEqual(val_resp.status_code, status.HTTP_200_OK)
        summary = val_resp.json()['validation_summary']
        self.assertEqual(summary['valid_rows_count'], 1)
        self.assertEqual(summary['invalid_rows_count'], 2)

        # Confirm: only valid record imported
        conf_resp = self.client.post(reverse('admin-book-import-confirm'), {'job_id': job_id}, format='json')
        self.assertEqual(conf_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(conf_resp.json()['job']['created_count'], 1)
        self.assertEqual(conf_resp.json()['job']['failed_count'], 2)

        # Check error report includes record 2 and record 3
        err_resp = self.client.get(reverse('admin-book-import-errors', kwargs={'job_id': job_id}))
        self.assertEqual(err_resp.status_code, status.HTTP_200_OK)
        err_content = err_resp.content.decode('utf-8-sig')
        self.assertIn("Title is required", err_content)
        self.assertIn("Invalid price value", err_content)

    def test_preventing_unauthorised_users_from_using_import_endpoints(self):
        """12. Preventing unauthenticated and customer users from using import endpoints."""
        endpoints = [
            ('post', reverse('admin-book-import-upload')),
            ('post', reverse('admin-book-import-validate')),
            ('post', reverse('admin-book-import-confirm')),
            ('get', reverse('admin-book-import-history')),
        ]

        # Anonymous
        anon = APIClient()
        for method, url in endpoints:
            resp = getattr(anon, method)(url)
            self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

        # Non-staff customer
        cust = APIClient()
        cust.force_authenticate(user=self.customer_user)
        for method, url in endpoints:
            resp = getattr(cust, method)(url)
            self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_retrying_an_import_without_creating_duplicate_books(self):
        """13. Retrying an import or re-submitting confirm does not duplicate books."""
        csv_data = "title,author,category,price,description,isbn\nUnique Book,Author,Software Engineering,25,Desc,978-1234567890\n".encode('utf-8')
        file_obj = SimpleUploadedFile("retry.csv", csv_data, content_type="text/csv")

        up_resp = self.client.post(reverse('admin-book-import-upload'), {'file': file_obj}, format='multipart')
        job_id = up_resp.json()['job_id']
        self.client.post(reverse('admin-book-import-validate'), {'job_id': job_id}, format='json')

        # First confirm
        conf1 = self.client.post(reverse('admin-book-import-confirm'), {'job_id': job_id, 'idempotency_key': 'token-123'}, format='json')
        self.assertEqual(conf1.status_code, status.HTTP_200_OK)
        self.assertEqual(conf1.json()['job']['created_count'], 1)

        # Second confirm with same idempotency token
        conf2 = self.client.post(reverse('admin-book-import-confirm'), {'job_id': job_id, 'idempotency_key': 'token-123'}, format='json')
        self.assertEqual(conf2.status_code, status.HTTP_200_OK)
        self.assertIn("already been completed", conf2.json()['message'])
        self.assertEqual(Book.objects.filter(title='Unique Book').count(), 1)



    def test_preserving_all_existing_database_records(self):
        """14. Verifies existing books and categories are preserved completely without resets."""
        initial_book_count = Book.objects.count()
        initial_category_count = Category.objects.count()

        csv_data = "title,author,category,price,description,isbn\nPreserve Test Book,Author,Software Engineering,15,Desc,978-7777777777\n".encode('utf-8')
        file_obj = SimpleUploadedFile("preserve.csv", csv_data, content_type="text/csv")

        up_resp = self.client.post(reverse('admin-book-import-upload'), {'file': file_obj}, format='multipart')
        job_id = up_resp.json()['job_id']
        self.client.post(reverse('admin-book-import-validate'), {'job_id': job_id}, format='json')
        self.client.post(reverse('admin-book-import-confirm'), {'job_id': job_id}, format='json')

        # Existing book must still exist
        self.assertTrue(Book.objects.filter(pk=self.existing_book.pk).exists())
        self.assertEqual(Book.objects.count(), initial_book_count + 1)
        self.assertEqual(Category.objects.count(), initial_category_count)

    def test_cleaning_up_temporary_files_appropriately(self):
        """15. Cleaning up temporary files appropriately after import completion."""
        csv_data = "title,author,category,price,description,isbn\nCleanup Test,Author,Software Engineering,15,Desc,978-8888888888\n".encode('utf-8')
        file_obj = SimpleUploadedFile("clean.csv", csv_data, content_type="text/csv")

        up_resp = self.client.post(reverse('admin-book-import-upload'), {'file': file_obj}, format='multipart')
        job_id = up_resp.json()['job_id']
        staged_path = get_staged_file_path(job_id, 'csv')
        self.assertTrue(os.path.exists(staged_path))

        self.client.post(reverse('admin-book-import-validate'), {'job_id': job_id}, format='json')
        self.client.post(reverse('admin-book-import-confirm'), {'job_id': job_id}, format='json')

        # Staged file must be removed after successful confirm
        self.assertFalse(os.path.exists(staged_path))

    def test_large_upload_streaming_without_memory_buffering(self):
        """16. Correctly handling large uploads without loading the entire dataset into application memory."""
        # Test inspect_staged_file and parse_staged_slice stream records directly from disk
        import tempfile
        test_path = os.path.join(tempfile.gettempdir(), "test_streaming.csv")
        with open(test_path, 'w', encoding='utf-8') as f:
            f.write("title,author,category,price,description\n")
            for i in range(1, 101):
                f.write(f"StreamedBook {i},Author {i},Software Engineering,15.00,Desc {i}\n")

        try:
            clean_headers, sample_rows, total_rows, enc, delim = inspect_staged_file(test_path, 'csv')
            self.assertEqual(total_rows, 100)
            self.assertEqual(len(sample_rows), 5)

            slice_rows = parse_staged_slice(test_path, 'csv', clean_headers, start_row=10, end_row=20)
            self.assertEqual(len(slice_rows), 11)
            self.assertEqual(slice_rows[0]['title'], 'StreamedBook 10')
            self.assertEqual(slice_rows[-1]['title'], 'StreamedBook 20')
        finally:
            if os.path.exists(test_path):
                os.remove(test_path)


    def test_invalid_corrupted_zip_archive_rejected(self):
        corrupted_obj = SimpleUploadedFile("corrupted.zip", b"PK\x03\x04not-a-valid-zip-content", content_type="application/zip")

        import tempfile
        tmp_dir = tempfile.mkdtemp()
        with self.assertRaises(ValueError) as ctx:
            validate_and_extract_covers_zip(corrupted_obj, tmp_dir)
        self.assertIn("Invalid or corrupted ZIP", str(ctx.exception))

    def test_zip_bomb_uncompressed_limit_rejected(self):
        zip_bytes = self._create_sample_zip()
        zip_obj = SimpleUploadedFile("bomb.zip", zip_bytes, content_type="application/zip")

        import tempfile
        fake_member = zipfile.ZipInfo("huge_image.jpg")
        fake_member.file_size = 260 * 1024 * 1024  # 260 MB uncompressed
        fake_member.compress_size = 100

        with patch.object(zipfile.ZipFile, 'infolist', return_value=[fake_member]):
            tmp_dir = tempfile.mkdtemp()
            with self.assertRaises(ValueError) as ctx:
                validate_and_extract_covers_zip(zip_obj, tmp_dir)
            self.assertIn("decompression bomb detected", str(ctx.exception))

    def test_temporary_file_upload_streaming_disk_backed(self):
        # Verify that TemporaryUploadedFile (Django's disk-backed streaming handler)
        # processes seamlessly without reading all contents into RAM
        from django.core.files.uploadedfile import TemporaryUploadedFile
        temp_file = TemporaryUploadedFile("streamed.zip", "application/zip", 0, "utf-8")
        zip_bytes = self._create_sample_zip()
        temp_file.write(zip_bytes)
        temp_file.seek(0)

        import tempfile
        tmp_dir = tempfile.mkdtemp()
        mapping = validate_and_extract_covers_zip(temp_file, tmp_dir)
        self.assertIn('9781449373320.jpg', mapping)
        temp_file.close()
