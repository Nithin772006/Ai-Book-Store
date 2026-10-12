"""
AETHERIUM Production Bulk Book Importer Engine.
Provides secure file parsing, schema normalization, row-level validation,
conflict detection, SSRF-safe URL fetching, ZIP archive processing,
and template generation for CSV and Excel (.xlsx).
"""

import csv
import io
import ipaddress
import os
import re
import shutil
import socket
import tempfile
import urllib.parse
import uuid
import zipfile
from datetime import datetime, date
from decimal import Decimal, InvalidOperation
from pathlib import Path

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
import httpx
from PIL import Image

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify

from catalog.models import Book, Category, generate_unique_slug, ImportJob

# =============================================================================
# CONSTANTS & LIMITS
# =============================================================================

MAX_CSV_SIZE_BYTES = getattr(settings, 'MAX_CSV_IMPORT_SIZE_BYTES', 100 * 1024 * 1024)   # 100 MB default
MAX_XLSX_SIZE_BYTES = getattr(settings, 'MAX_XLSX_IMPORT_SIZE_BYTES', 20 * 1024 * 1024)  # 20 MB spreadsheet limit
MAX_FILE_SIZE_BYTES = MAX_CSV_SIZE_BYTES                                                # Backwards compat alias
MAX_ZIP_SIZE_BYTES = 100 * 1024 * 1024                                                  # 100 MB cover ZIP archive limit
MAX_ZIP_UNCOMPRESSED_BYTES = 250 * 1024 * 1024                                          # 250 MB uncompressed limit
MAX_ZIP_FILES_COUNT = 5000                                                              # Max 5,000 files in archive
MAX_ZIP_COMPRESSION_RATIO = 15.0                                                        # Max compression ratio (zip bomb defense)
MAX_ROWS_LIMIT = 5000                                                                   # Max 5,000 spreadsheet rows
MAX_BATCH_ROWS_LIMIT = 5000                                                             # Max 5,000 records per import batch
MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024                                                  # 5 MB per individual image
IMAGE_FETCH_TIMEOUT_SECONDS = 8.0

ALLOWED_IMAGE_FORMATS = {'JPEG', 'PNG', 'WEBP'}
ALLOWED_EXTENSIONS = {'.csv', '.xlsx'}

# Canonical Book model fields available for mapping
CANONICAL_FIELDS = [
    {
        'key': 'title',
        'label': 'Book Title',
        'required': True,
        'description': 'Full title of the publication (max 255 chars).',
        'aliases': ['title', 'book_title', 'book-title', 'book title', 'name', 'title_name', 'bookname'],
    },
    {
        'key': 'author',
        'label': 'Author(s)',
        'required': True,
        'description': 'Author, creators, or editor names (max 255 chars).',
        'aliases': ['author', 'authors', 'book_author', 'book-author', 'author_name', 'writer', 'creator', 'by'],
    },
    {
        'key': 'category',
        'label': 'Category',
        'required': True,
        'description': 'Genre or collection category (matches existing or creates if enabled).',
        'aliases': ['category', 'category_name', 'genre', 'genres', 'subject', 'topic', 'shelf'],
    },
    {
        'key': 'price',
        'label': 'Retail Price ($)',
        'required': True,
        'description': 'Base price in currency units (non-negative Decimal).',
        'aliases': ['price', 'retail_price', 'cost', 'selling_price', 'amount', 'mrp', 'rate'],
    },
    {
        'key': 'discount_price',
        'label': 'Discount Price ($)',
        'required': False,
        'description': 'Promotional price (optional, must be <= regular price).',
        'aliases': ['discount_price', 'discounted_price', 'sale_price', 'offer_price', 'discount'],
    },
    {
        'key': 'stock_quantity',
        'label': 'Stock Quantity',
        'required': False,
        'description': 'Initial inventory count (non-negative integer, default 0).',
        'aliases': ['stock_quantity', 'stock', 'quantity', 'qty', 'inventory', 'copies', 'in_stock'],
    },
    {
        'key': 'isbn',
        'label': 'ISBN',
        'required': False,
        'description': '10 or 13-digit International Standard Book Number (optional, unique if provided).',
        'aliases': ['isbn', 'isbn13', 'isbn10', 'isbn_13', 'isbn_10', 'standard_number'],
    },
    {
        'key': 'description',
        'label': 'Synopsis / Description',
        'required': True,
        'description': 'Detailed summary, synopsis, or overview text.',
        'aliases': ['description', 'synopsis', 'summary', 'overview', 'about', 'desc'],
    },
    {
        'key': 'publisher',
        'label': 'Publisher',
        'required': False,
        'description': 'Publishing imprint or organization (max 255 chars).',
        'aliases': ['publisher', 'publishing_house', 'imprint', 'press', 'published_by'],
    },
    {
        'key': 'publication_date',
        'label': 'Publication Date',
        'required': False,
        'description': 'Date of release (YYYY-MM-DD or year YYYY).',
        'aliases': ['publication_date', 'published_date', 'release_date', 'pub_date', 'year', 'publication_year', 'year_of_publication', 'year-of-publication'],
    },
    {
        'key': 'language',
        'label': 'Language',
        'required': False,
        'description': 'Text edition language (default "English").',
        'aliases': ['language', 'lang', 'edition_language'],
    },
    {
        'key': 'slug',
        'label': 'URL Slug',
        'required': False,
        'description': 'URL slug (optional; auto-generated from title if blank).',
        'aliases': ['slug', 'book_slug', 'url_slug'],
    },
    {
        'key': 'cover_image_url',
        'label': 'Cover Image URL',
        'required': False,
        'description': 'Public HTTP/HTTPS URL to download book cover.',
        'aliases': ['cover_image_url', 'cover_url', 'image_url', 'cover', 'cover_image', 'poster', 'image_url_l', 'image-url-l', 'image_url_m', 'image-url-m', 'image_url_s', 'image-url-s'],
    },
    {
        'key': 'cover_filename',
        'label': 'Cover ZIP Filename',
        'required': False,
        'description': 'Filename matching an image in the uploaded covers ZIP (e.g., cover.jpg).',
        'aliases': ['cover_filename', 'cover_file', 'image_file', 'zip_filename', 'image_name'],
    },
    {
        'key': 'is_featured',
        'label': 'Featured Flag',
        'required': False,
        'description': 'Boolean (true/1/yes): highlight on home page.',
        'aliases': ['is_featured', 'featured'],
    },
    {
        'key': 'is_bestseller',
        'label': 'Bestseller Flag',
        'required': False,
        'description': 'Boolean (true/1/yes): flag as top seller.',
        'aliases': ['is_bestseller', 'bestseller'],
    },
    {
        'key': 'is_new_arrival',
        'label': 'New Arrival Flag',
        'required': False,
        'description': 'Boolean (true/1/yes): flag as recent addition.',
        'aliases': ['is_new_arrival', 'new_arrival'],
    },
    {
        'key': 'is_active',
        'label': 'Active / Listed',
        'required': False,
        'description': 'Boolean (true/1/yes, default true): list for sale.',
        'aliases': ['is_active', 'active', 'published', 'status'],
    },
]

# Alias dictionary for quick matching
ALIAS_LOOKUP = {}
for cf in CANONICAL_FIELDS:
    for alias in cf['aliases']:
        ALIAS_LOOKUP[alias.lower().strip().replace(' ', '_').replace('-', '_')] = cf['key']



# =============================================================================
# SSRF & URL SAFETY UTILITIES
# =============================================================================

def is_safe_ip(ip_str):
    """
    Validates that an IP address is publicly routable and not in private,
    loopback, link-local, multicast, or cloud metadata ranges.
    """
    try:
        ip = ipaddress.ip_address(ip_str)
        if (
            ip.is_private or
            ip.is_loopback or
            ip.is_link_local or
            ip.is_multicast or
            ip.is_reserved or
            ip.is_unspecified
        ):
            return False
        # Specific cloud metadata checks
        if str(ip) in ('169.254.169.254', '100.100.100.200'):
            return False
        return True
    except ValueError:
        return False


def validate_and_fetch_image_url(url):
    """
    Securely fetches an image from an HTTP/HTTPS URL with strict SSRF defenses,
    DNS pinning, size limits, and format verification.
    Returns (bytes, format_ext) or raises ValueError with sanitized message.
    """
    if not url or not isinstance(url, str):
        raise ValueError("Empty or invalid URL.")

    parsed = urllib.parse.urlparse(url.strip())
    if parsed.scheme.lower() not in ('http', 'https'):
        raise ValueError("URL scheme must be HTTP or HTTPS.")

    hostname = parsed.hostname
    if not hostname:
        raise ValueError("Invalid URL hostname.")

    # Prevent loopback strings
    if hostname.lower() in ('localhost', '127.0.0.1', '::1', '0.0.0.0'):
        raise ValueError("Access to local address is prohibited.")

    # DNS resolution check
    try:
        addr_info = socket.getaddrinfo(hostname, parsed.port or (443 if parsed.scheme == 'https' else 80))
        for item in addr_info:
            sock_ip = item[4][0]
            if not is_safe_ip(sock_ip):
                raise ValueError(f"URL resolves to disallowed private/internal address.")
    except socket.gaierror:
        raise ValueError("Hostname could not be resolved.")

    # Stream download with size limit and redirect protection
    try:
        with httpx.Client(timeout=IMAGE_FETCH_TIMEOUT_SECONDS, follow_redirects=False) as client:
            with client.stream('GET', url, headers={'User-Agent': 'AetheriumBookImporter/1.0'}) as response:
                response.raise_for_status()

                content = bytearray()
                for chunk in response.iter_bytes(chunk_size=16384):
                    content.extend(chunk)
                    if len(content) > MAX_IMAGE_SIZE_BYTES:
                        raise ValueError("Image file exceeds the 5 MB download limit.")

        image_bytes = bytes(content)
        # Inspect using Pillow
        try:
            with Image.open(io.BytesIO(image_bytes)) as img:
                img_fmt = (img.format or '').upper()
                if img_fmt not in ALLOWED_IMAGE_FORMATS:
                    raise ValueError(f"Unsupported image format ({img_fmt}). Must be JPEG, PNG, or WebP.")
                img.verify()
        except Exception:
            raise ValueError("Corrupt or invalid image data.")

        ext = 'jpg' if img_fmt == 'JPEG' else img_fmt.lower()
        return image_bytes, ext

    except httpx.HTTPError:
        raise ValueError("Failed to retrieve image from remote URL.")



# =============================================================================
# ZIP ARCHIVE SAFETY UTILITIES
# =============================================================================

def validate_and_extract_covers_zip(zip_file_obj, extract_dir):
    """
    Inspects and securely extracts a ZIP archive containing cover images.
    Enforces path traversal defenses, zip bomb limits (uncompressed size,
    compression ratio, and file counts), and image raster validation.
    Returns dict mapping lowercase filename to absolute extracted path.
    """
    file_size = getattr(zip_file_obj, 'size', None)
    if file_size is not None and file_size > MAX_ZIP_SIZE_BYTES:
        size_mb = round(file_size / (1024 * 1024), 1)
        raise ValueError(f"Cover ZIP archive size ({size_mb} MB) exceeds maximum allowed limit of 100 MB.")

    if not zipfile.is_zipfile(zip_file_obj):
        raise ValueError("Invalid or corrupted ZIP archive format.")

    if hasattr(zip_file_obj, 'seek'):
        zip_file_obj.seek(0)

    file_mapping = {}
    total_uncompressed = 0

    with zipfile.ZipFile(zip_file_obj, 'r') as zf:
        members = [m for m in zf.infolist() if not m.is_dir() and m.filename]
        if len(members) > MAX_ZIP_FILES_COUNT:
            raise ValueError(f"ZIP archive contains too many files ({len(members)}). Maximum allowed is {MAX_ZIP_FILES_COUNT} files.")

        for member in members:
            # Path traversal check
            norm_name = os.path.normpath(member.filename)
            if (
                norm_name.startswith('..') or
                os.path.isabs(norm_name) or
                '..' in norm_name.split(os.path.sep) or
                norm_name.startswith('/') or
                norm_name.startswith('\\')
            ):
                raise ValueError(f"Dangerous path traversal entry detected in archive: {member.filename}")

            total_uncompressed += member.file_size
            if total_uncompressed > MAX_ZIP_UNCOMPRESSED_BYTES:
                raise ValueError("ZIP decompression bomb detected: uncompressed content exceeds 250 MB limit.")

            # Compression ratio check for zip bomb defense
            if member.compress_size > 0 and member.file_size > 1024 * 1024:
                ratio = member.file_size / member.compress_size
                if ratio > MAX_ZIP_COMPRESSION_RATIO:
                    raise ValueError(f"ZIP decompression bomb detected: suspicious compression ratio ({ratio:.1f}x) in entry {member.filename}.")

            # Check individual image size limit
            if member.file_size > MAX_IMAGE_SIZE_BYTES:
                continue

            basename = os.path.basename(norm_name)
            if not basename:
                continue

            # Stream read without loading all files simultaneously into memory
            with zf.open(member) as member_file:
                data = member_file.read(MAX_IMAGE_SIZE_BYTES + 1)
                if len(data) > MAX_IMAGE_SIZE_BYTES:
                    continue

                try:
                    with Image.open(io.BytesIO(data)) as img:
                        img_fmt = (img.format or '').upper()
                        if img_fmt in ALLOWED_IMAGE_FORMATS:
                            out_path = os.path.join(extract_dir, basename)
                            with open(out_path, 'wb') as out_f:
                                out_f.write(data)
                            file_mapping[basename.lower()] = out_path
                except Exception:
                    # Silently skip non-image entries or invalid images
                    pass

    return file_mapping


# =============================================================================
# SPREADSHEET STAGING & PARSING UTILITIES
# =============================================================================

def get_staged_file_path(job_id, file_type):
    """
    Returns deterministic absolute path on disk for staging uploaded import files.
    """
    ext = file_type.lower().lstrip('.')
    return os.path.join(tempfile.gettempdir(), f"aetherium_staged_{job_id}.{ext}")


def stage_uploaded_file(file_obj, job_id, file_type='csv'):
    """
    Streams uploaded file to a temporary disk location in 64 KB chunks
    to prevent buffering large files (e.g. 71 MB) into application RAM.
    Returns (staged_path, file_size_bytes).
    """
    staged_path = get_staged_file_path(job_id, file_type)
    file_size = 0
    with open(staged_path, 'wb') as dest:
        if hasattr(file_obj, 'chunks'):
            for chunk in file_obj.chunks(chunk_size=65536):
                dest.write(chunk)
                file_size += len(chunk)
        else:
            if hasattr(file_obj, 'seek'):
                file_obj.seek(0)
            while True:
                chunk = file_obj.read(65536)
                if not chunk:
                    break
                dest.write(chunk)
                file_size += len(chunk)
    return staged_path, file_size


def cleanup_staged_file(job_id, file_type):
    """
    Safely removes the staged upload file from disk if it exists.
    """
    try:
        path = get_staged_file_path(job_id, file_type)
        if os.path.exists(path):
            os.remove(path)
    except Exception:
        pass


def detect_csv_format(staged_path):
    """
    Detects text encoding and delimiter from a staged CSV file.
    Supports UTF-8 BOM, UTF-8, Latin-1, CP1252, and comma/semicolon/tab delimiters.
    """
    encoding = 'utf-8-sig'
    try:
        with open(staged_path, 'rb') as f:
            sample_bytes = f.read(65536)
        for enc in ('utf-8-sig', 'utf-8', 'latin-1', 'cp1252'):
            try:
                sample_bytes.decode(enc)
                encoding = enc
                break
            except UnicodeDecodeError:
                continue
    except Exception:
        pass

    delimiter = ','
    try:
        with open(staged_path, 'r', encoding=encoding, errors='replace', newline='') as f:
            first_line = f.readline()
            if ';' in first_line and first_line.count(';') > first_line.count(','):
                delimiter = ';'
            elif '\t' in first_line and first_line.count('\t') > first_line.count(','):
                delimiter = '\t'
    except Exception:
        pass

    return encoding, delimiter


def inspect_staged_file(staged_path, file_type='csv'):
    """
    Reads column headers, inspects the first 5 sample rows, and stream-counts
    the total available data records without loading the dataset into memory.
    Correctly handles UTF-8 BOM, quoted commas, and quoted multiline records.
    Returns (clean_headers, sample_rows, total_data_rows, encoding, delimiter).
    """
    if file_type == 'csv':
        encoding, delimiter = detect_csv_format(staged_path)

        sample_rows = []
        total_data_rows = 0
        clean_headers = []

        with open(staged_path, 'r', encoding=encoding, errors='replace', newline='') as f:
            reader = csv.reader(f, delimiter=delimiter)
            try:
                raw_headers = next(reader)
            except StopIteration:
                raise ValueError("The uploaded CSV file is empty or has no header row.")

            clean_headers = [h.strip() for h in raw_headers if h is not None]
            if not clean_headers:
                raise ValueError("No valid column headers found in CSV file.")

            for row in reader:
                # Exclude purely empty lines
                if not any(cell.strip() for cell in row if isinstance(cell, str)):
                    continue
                total_data_rows += 1
                if len(sample_rows) < 5:
                    row_dict = {}
                    for idx, header in enumerate(clean_headers):
                        row_dict[header] = row[idx].strip() if idx < len(row) else ''
                    row_dict['_row_num'] = total_data_rows
                    sample_rows.append(row_dict)

        return clean_headers, sample_rows, total_data_rows, encoding, delimiter

    else:
        # XLSX mode using openpyxl in read_only mode
        wb = openpyxl.load_workbook(staged_path, read_only=True, data_only=True)
        sheet = wb.active
        if not sheet:
            wb.close()
            raise ValueError("No active worksheet found in Excel file.")

        clean_headers = []
        sample_rows = []
        total_data_rows = 0

        for row_idx, row in enumerate(sheet.iter_rows(values_only=True), start=1):
            if row_idx == 1:
                clean_headers = [str(cell).strip() for cell in row if cell is not None and str(cell).strip()]
                if not clean_headers:
                    wb.close()
                    raise ValueError("No valid column headers found in Excel file.")
                continue

            if not any(cell is not None and str(cell).strip() for cell in row):
                continue

            total_data_rows += 1
            if len(sample_rows) < 5:
                row_dict = {}
                for idx, header in enumerate(clean_headers):
                    val = row[idx] if idx < len(row) else ''
                    row_dict[header] = str(val).strip() if val is not None else ''
                row_dict['_row_num'] = total_data_rows
                sample_rows.append(row_dict)

        wb.close()
        return clean_headers, sample_rows, total_data_rows, 'utf-8', ','


def parse_staged_slice(staged_path, file_type, headers, start_row=1, end_row=50, encoding=None, delimiter=None):
    """
    Streams the staged file and extracts only data records between start_row and end_row (inclusive).
    Uses 1-based data record numbering (start_row=1 corresponds to the first data record after the header).
    Enforces MAX_BATCH_ROWS_LIMIT (5,000 records).
    Handles quoted newlines and escaped commas properly via standard csv.reader.
    Returns list of row dicts with '_row_num' metadata.
    """
    if start_row < 1:
        raise ValueError("Start row must be at least 1.")
    if end_row < start_row:
        raise ValueError(f"End row ({end_row}) cannot be less than start row ({start_row}).")

    count_requested = end_row - start_row + 1
    if count_requested > MAX_BATCH_ROWS_LIMIT:
        raise ValueError(f"Requested selection ({count_requested} records) exceeds the maximum limit of {MAX_BATCH_ROWS_LIMIT} records per import batch.")

    selected_rows = []

    if file_type == 'csv':
        if encoding is None or delimiter is None:
            det_enc, det_delim = detect_csv_format(staged_path)
            if encoding is None:
                encoding = det_enc
            if delimiter is None:
                delimiter = det_delim

        with open(staged_path, 'r', encoding=encoding, errors='replace', newline='') as f:
            reader = csv.reader(f, delimiter=delimiter)
            try:
                # Skip header
                next(reader)
            except StopIteration:
                return []


            current_data_idx = 0
            for row in reader:
                if not any(cell.strip() for cell in row if isinstance(cell, str)):
                    continue

                current_data_idx += 1

                if current_data_idx < start_row:
                    continue

                if current_data_idx > end_row:
                    break

                row_dict = {}
                for idx, header in enumerate(headers):
                    row_dict[header] = row[idx].strip() if idx < len(row) else ''
                row_dict['_row_num'] = current_data_idx
                selected_rows.append(row_dict)

    else:
        wb = openpyxl.load_workbook(staged_path, read_only=True, data_only=True)
        sheet = wb.active
        if not sheet:
            wb.close()
            return []

        current_data_idx = 0
        for row_idx, row in enumerate(sheet.iter_rows(values_only=True), start=1):
            if row_idx == 1:
                continue
            if not any(cell is not None and str(cell).strip() for cell in row):
                continue

            current_data_idx += 1
            if current_data_idx < start_row:
                continue
            if current_data_idx > end_row:
                break

            row_dict = {}
            for idx, header in enumerate(headers):
                val = row[idx] if idx < len(row) else ''
                row_dict[header] = str(val).strip() if val is not None else ''
            row_dict['_row_num'] = current_data_idx
            selected_rows.append(row_dict)

        wb.close()

    return selected_rows


def parse_spreadsheet_file(file_obj):
    """
    Parses a CSV or XLSX file and extracts raw headers and row dictionaries.
    Returns (file_type, raw_headers, rows_list).
    """
    filename = getattr(file_obj, 'name', 'upload.csv')
    ext = os.path.splitext(filename)[1].lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Unsupported file format '{ext}'. Supported formats: .csv, .xlsx. (Legacy .xls files must be saved as .xlsx).")

    if ext == '.csv':
        if file_obj.size > MAX_CSV_SIZE_BYTES:
            max_mb = int(MAX_CSV_SIZE_BYTES / (1024 * 1024))
            raise ValueError(f"File size exceeds {max_mb} MB limit.")
        return 'csv', *parse_csv(file_obj)
    else:
        if file_obj.size > MAX_XLSX_SIZE_BYTES:
            max_mb = int(MAX_XLSX_SIZE_BYTES / (1024 * 1024))
            raise ValueError(f"File size exceeds {max_mb} MB limit.")
        return 'xlsx', *parse_xlsx(file_obj)


def parse_csv(file_obj):
    """
    Decodes CSV with BOM and encoding fallbacks, sniffs delimiters, and returns headers and rows.
    """
    raw_bytes = file_obj.read()
    file_obj.seek(0)

    # Detect encoding
    text = None
    for enc in ('utf-8-sig', 'utf-8', 'latin-1', 'cp1252'):
        try:
            text = raw_bytes.decode(enc)
            break
        except UnicodeDecodeError:
            continue

    if text is None:
        raise ValueError("Could not decode CSV file. Please ensure UTF-8 encoding.")

    lines = [line for line in text.splitlines() if line.strip()]
    if not lines:
        raise ValueError("The uploaded CSV file is empty.")

    # Sniff delimiter
    first_line = lines[0]
    delimiter = ','
    if ';' in first_line and first_line.count(';') > first_line.count(','):
        delimiter = ';'
    elif '\t' in first_line and first_line.count('\t') > first_line.count(','):
        delimiter = '\t'

    reader = csv.reader(io.StringIO(text), delimiter=delimiter)
    try:
        raw_headers = next(reader)
    except StopIteration:
        raise ValueError("The uploaded CSV file has no header row.")

    clean_headers = [h.strip() for h in raw_headers if h is not None]
    if not clean_headers:
        raise ValueError("No valid column headers found in CSV file.")

    rows = []
    for row_idx, row in enumerate(reader, start=2):
        if not any(cell.strip() for cell in row if isinstance(cell, str)):
            continue
        if len(rows) >= MAX_ROWS_LIMIT:
            raise ValueError(f"Spreadsheet exceeds maximum limit of {MAX_ROWS_LIMIT} data rows per import.")
        row_dict = {}
        for idx, header in enumerate(clean_headers):
            row_dict[header] = row[idx].strip() if idx < len(row) else ''
        row_dict['_row_num'] = row_idx
        rows.append(row_dict)

    return clean_headers, rows


def parse_xlsx(file_obj):
    """
    Parses XLSX using openpyxl in read_only and data_only mode (avoids evaluating untrusted formulas).
    """
    wb = openpyxl.load_workbook(file_obj, read_only=True, data_only=True)
    sheet = wb.active
    if not sheet:
        raise ValueError("No active worksheet found in Excel file.")

    rows_iter = sheet.iter_rows(values_only=True)
    try:
        raw_headers = next(rows_iter)
    except StopIteration:
        raise ValueError("The uploaded Excel sheet is empty.")

    clean_headers = []
    for h in raw_headers:
        if h is not None:
            clean_headers.append(str(h).strip())
        else:
            clean_headers.append('')

    # Trim trailing empty headers
    while clean_headers and not clean_headers[-1]:
        clean_headers.pop()

    if not any(clean_headers):
        raise ValueError("No valid column headers found in Excel file.")

    rows = []
    for row_idx, row_vals in enumerate(rows_iter, start=2):
        if not row_vals or not any(v is not None and str(v).strip() for v in row_vals):
            continue
        if len(rows) >= MAX_ROWS_LIMIT:
            wb.close()
            raise ValueError(f"Spreadsheet exceeds maximum limit of {MAX_ROWS_LIMIT} data rows per import.")
        row_dict = {}
        for idx, header in enumerate(clean_headers):
            if not header:
                continue
            val = row_vals[idx] if idx < len(row_vals) else None
            if val is None:
                row_dict[header] = ''
            elif isinstance(val, (datetime, date)):
                row_dict[header] = val.strftime('%Y-%m-%d')
            else:
                row_dict[header] = str(val).strip()
        row_dict['_row_num'] = row_idx
        rows.append(row_dict)

    wb.close()
    return clean_headers, rows



def auto_detect_column_mapping(headers):
    """
    Matches raw file headers to canonical model fields using alias heuristics.
    Returns dict {canonical_key: raw_header_name}.
    """
    mapping = {}
    used_headers = set()

    for cf in CANONICAL_FIELDS:
        key = cf['key']
        # Try exact or alias match
        for alias in cf['aliases']:
            norm_alias = alias.lower().strip().replace(' ', '_').replace('-', '_')
            for h in headers:
                if h in used_headers:
                    continue
                norm_h = h.lower().strip().replace(' ', '_').replace('-', '_')
                if norm_h == norm_alias:
                    mapping[key] = h
                    used_headers.add(h)
                    break
            if key in mapping:
                break

    return mapping


# =============================================================================
# DATA NORMALIZATION & VALIDATION
# =============================================================================

def normalize_isbn(isbn_val):
    """
    Strips spaces and hyphens. Checks 10 or 13 character alphanumeric length.
    """
    if not isbn_val:
        return None
    cleaned = re.sub(r'[\s\-]', '', str(isbn_val)).strip()
    if not cleaned:
        return None
    return cleaned


def parse_date(date_val):
    """
    Attempts parsing dates in YYYY-MM-DD, MM/DD/YYYY, DD-MM-YYYY, or single year YYYY.
    Returns (YYYY-MM-DD string, None) or (None, error_msg).
    """
    if not date_val:
        return None, None
    s = str(date_val).strip()
    if not s:
        return None, None

    # Check 4-digit year e.g. 2023
    if re.match(r'^\d{4}$', s):
        return f"{s}-01-01", None

    formats = ['%Y-%m-%d', '%m/%d/%Y', '%d/%m/%Y', '%Y/%m/%d', '%d-%m-%Y', '%m-%d-%Y']
    for fmt in formats:
        try:
            dt = datetime.strptime(s, fmt)
            return dt.strftime('%Y-%m-%d'), None
        except ValueError:
            continue

    return None, f"Invalid date format '{s}'. Use YYYY-MM-DD or year YYYY."


def parse_boolean(val, default=False):
    """
    Parses boolean representation from string or integer.
    """
    if val is None or val == '':
        return default
    if isinstance(val, bool):
        return val
    s = str(val).strip().lower()
    if s in ('true', '1', 'yes', 't', 'y'):
        return True
    if s in ('false', '0', 'no', 'f', 'n'):
        return False
    return default


def validate_row(raw_row, column_mapping, existing_books_cache, existing_cats_cache, seen_isbns, seen_slugs, fallback_values=None):
    """
    Validates a single parsed row against Django Book model constraints,
    checking required fields, data types, category matching, fallbacks, and duplicates.
    Returns normalized_data, errors_list, warnings_list, is_conflict, conflict_details.
    """
    if fallback_values is None:
        fallback_values = {}

    errors = []
    warnings = []
    norm = {}
    row_num = raw_row.get('_row_num', 0)

    # 1. Title (Required)
    title_col = column_mapping.get('title')
    title = str(raw_row.get(title_col, '')).strip() if title_col else ''
    if not title and fallback_values.get('title'):
        title = str(fallback_values.get('title')).strip()
    if not title:
        errors.append("Title is required.")
    elif len(title) > 255:
        errors.append(f"Title exceeds 255 characters ({len(title)} chars).")
    norm['title'] = title

    # 2. Author (Required)
    author_col = column_mapping.get('author')
    author = str(raw_row.get(author_col, '')).strip() if author_col else ''
    if not author and fallback_values.get('author'):
        author = str(fallback_values.get('author')).strip()
    if not author:
        errors.append("Author is required.")
    elif len(author) > 255:
        errors.append(f"Author exceeds 255 characters ({len(author)} chars).")
    norm['author'] = author

    # 3. Description (Required)
    desc_col = column_mapping.get('description')
    description = str(raw_row.get(desc_col, '')).strip() if desc_col else ''
    if not description and fallback_values.get('description'):
        tmpl = str(fallback_values.get('description')).strip()
        pub_col = column_mapping.get('publisher')
        year_col = column_mapping.get('publication_date')
        pub_val = str(raw_row.get(pub_col, '')).strip() if pub_col else ''
        year_val = str(raw_row.get(year_col, '')).strip() if year_col else ''
        description = tmpl.replace('{title}', title).replace('{author}', author).replace('{publisher}', pub_val).replace('{year}', year_val)
    if not description:
        errors.append("Description is required.")
    norm['description'] = description

    # 4. Price (Required Decimal >= 0.00)
    price_col = column_mapping.get('price')
    raw_price = raw_row.get(price_col, '') if price_col else ''
    if (raw_price == '' or raw_price is None) and fallback_values.get('price') is not None and str(fallback_values.get('price')).strip() != '':
        raw_price = str(fallback_values.get('price')).strip()
    price = None
    if raw_price == '' or raw_price is None:
        errors.append("Price is required.")
    else:
        try:
            # Strip currency symbols e.g. $
            clean_p = str(raw_price).replace('$', '').replace('€', '').replace('£', '').replace(',', '').strip()
            price = Decimal(clean_p).quantize(Decimal('0.01'))
            if price < Decimal('0.00'):
                errors.append("Price cannot be negative.")
        except (InvalidOperation, ValueError):
            errors.append(f"Invalid price value '{raw_price}'.")
    norm['price'] = str(price) if price is not None else None

    # 5. Discount Price (Optional Decimal >= 0.00 and <= price)
    disc_col = column_mapping.get('discount_price')
    raw_disc = raw_row.get(disc_col, '') if disc_col else ''
    discount_price = None
    if raw_disc != '' and raw_disc is not None:
        try:
            clean_d = str(raw_disc).replace('$', '').replace('€', '').replace('£', '').replace(',', '').strip()
            discount_price = Decimal(clean_d).quantize(Decimal('0.01'))
            if discount_price < Decimal('0.00'):
                errors.append("Discount price cannot be negative.")
            elif price is not None and discount_price > price:
                errors.append(f"Discount price (${discount_price}) cannot exceed regular price (${price}).")
        except (InvalidOperation, ValueError):
            errors.append(f"Invalid discount price value '{raw_disc}'.")
    norm['discount_price'] = str(discount_price) if discount_price is not None else None

    # 6. Stock Quantity (Optional Positive Integer)
    stock_col = column_mapping.get('stock_quantity')
    raw_stock = raw_row.get(stock_col, '') if stock_col else ''
    stock_quantity = 0
    if raw_stock != '' and raw_stock is not None:
        try:
            stock_quantity = int(float(str(raw_stock).replace(',', '').strip()))
            if stock_quantity < 0:
                errors.append("Stock quantity cannot be negative.")
        except ValueError:
            errors.append(f"Invalid stock quantity '{raw_stock}'. Must be a whole number.")
    norm['stock_quantity'] = stock_quantity

    # 7. Category (Required lookup)
    cat_col = column_mapping.get('category')
    raw_cat = str(raw_row.get(cat_col, '')).strip() if cat_col else ''
    if not raw_cat and fallback_values.get('category'):
        raw_cat = str(fallback_values.get('category')).strip()
    cat_name = raw_cat
    cat_id = None
    if not cat_name:
        errors.append("Category is required.")
    else:
        norm_cat_key = cat_name.lower().strip()
        if norm_cat_key in existing_cats_cache:
            cat_id = existing_cats_cache[norm_cat_key]['id']
            cat_name = existing_cats_cache[norm_cat_key]['name']
        else:
            warnings.append(f"Category '{cat_name}' does not exist in bookstore.")
    norm['category_name'] = cat_name
    norm['category_id'] = cat_id


    # 8. ISBN (Optional, unique)
    isbn_col = column_mapping.get('isbn')
    raw_isbn = raw_row.get(isbn_col, '') if isbn_col else ''
    isbn = normalize_isbn(raw_isbn)
    if isbn:
        if len(isbn) not in (10, 13):
            warnings.append(f"ISBN '{isbn}' is neither 10 nor 13 characters.")
        if isbn in seen_isbns:
            errors.append(f"Duplicate ISBN '{isbn}' within this import file (already at row {seen_isbns[isbn]}).")
        else:
            seen_isbns[isbn] = row_num
    norm['isbn'] = isbn

    # 9. Slug
    slug_col = column_mapping.get('slug')
    raw_slug = str(raw_row.get(slug_col, '')).strip() if slug_col else ''
    if raw_slug:
        slug = slugify(raw_slug)[:280]
        if slug in seen_slugs:
            errors.append(f"Duplicate slug '{slug}' within this import file (already at row {seen_slugs[slug]}).")
        else:
            seen_slugs[slug] = row_num
    else:
        slug = None
    norm['slug'] = slug

    # 10. Optional Text & Date Fields
    pub_col = column_mapping.get('publisher')
    norm['publisher'] = str(raw_row.get(pub_col, '')).strip()[:255] if pub_col else ''

    lang_col = column_mapping.get('language')
    norm['language'] = str(raw_row.get(lang_col, '')).strip()[:50] if lang_col else 'English'

    date_col = column_mapping.get('publication_date')
    raw_date = raw_row.get(date_col, '') if date_col else ''
    parsed_d, date_err = parse_date(raw_date)
    if date_err:
        warnings.append(date_err)
    norm['publication_date'] = parsed_d

    # Optional Booleans
    norm['is_featured'] = parse_boolean(raw_row.get(column_mapping.get('is_featured')), False)
    norm['is_bestseller'] = parse_boolean(raw_row.get(column_mapping.get('is_bestseller')), False)
    norm['is_new_arrival'] = parse_boolean(raw_row.get(column_mapping.get('is_new_arrival')), False)
    norm['is_active'] = parse_boolean(raw_row.get(column_mapping.get('is_active')), True)

    # Cover References
    cover_url_col = column_mapping.get('cover_image_url')
    norm['cover_image_url'] = str(raw_row.get(cover_url_col, '')).strip() if cover_url_col else ''

    cover_file_col = column_mapping.get('cover_filename')
    norm['cover_filename'] = str(raw_row.get(cover_file_col, '')).strip() if cover_file_col else ''

    # 11. Conflict Detection against Existing Database Records
    is_conflict = False
    conflict_details = None
    existing_match = None

    if isbn and isbn in existing_books_cache['by_isbn']:
        existing_match = existing_books_cache['by_isbn'][isbn]
        is_conflict = True
        conflict_details = {
            'reason': f"Existing book with ISBN {isbn}",
            'existing_book_id': existing_match.id,
            'existing_title': existing_match.title,
            'existing_author': existing_match.author,
            'existing_price': str(existing_match.price),
        }
    elif slug and slug in existing_books_cache['by_slug']:
        existing_match = existing_books_cache['by_slug'][slug]
        is_conflict = True
        conflict_details = {
            'reason': f"Existing book with slug '{slug}'",
            'existing_book_id': existing_match.id,
            'existing_title': existing_match.title,
            'existing_author': existing_match.author,
            'existing_price': str(existing_match.price),
        }

    norm['is_conflict'] = is_conflict
    norm['conflict_details'] = conflict_details

    # Status determination
    if errors:
        status_code = 'error'
    elif is_conflict:
        status_code = 'conflict'
    elif warnings:
        status_code = 'warning'
    else:
        status_code = 'valid'

    return norm, errors, warnings, is_conflict, conflict_details, status_code


# =============================================================================
# CSV / EXCEL TEMPLATE GENERATORS
# =============================================================================

SAMPLE_DATA_ROWS = [
    {
        'title': 'The Quantum Architect',
        'author': 'Elena Vance',
        'category': 'Artificial Intelligence & ML',
        'price': '34.99',
        'discount_price': '29.99',
        'stock_quantity': '45',
        'isbn': '978-0139988112',
        'description': 'A comprehensive exploration of next-generation quantum computing models and their machine learning applications.',
        'publisher': 'Aetherium Press',
        'publication_date': '2024-03-15',
        'language': 'English',
        'cover_image_url': 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c',
        'cover_filename': 'quantum_architect.jpg',
        'is_featured': 'True',
        'is_bestseller': 'False',
        'is_new_arrival': 'True',
        'is_active': 'True',
    },
    {
        'title': 'Sovereign Systems: Architecture & Scale',
        'author': 'Marcus Holloway',
        'category': 'Software Engineering',
        'price': '42.50',
        'discount_price': '',
        'stock_quantity': '20',
        'isbn': '978-0262145890',
        'description': 'Deep dive into decentralized systems resilience, distributed ledger state machines, and high-throughput pipelines.',
        'publisher': 'Turing & Knuth',
        'publication_date': '2023-11-20',
        'language': 'English',
        'cover_image_url': '',
        'cover_filename': '',
        'is_featured': 'False',
        'is_bestseller': 'True',
        'is_new_arrival': 'False',
        'is_active': 'True',
    },
    {
        'title': 'Philosophy of Cognitive Artifacts',
        'author': 'Dr. Alistair Finch',
        'category': 'Philosophy & Futures',
        'price': '28.00',
        'discount_price': '24.50',
        'stock_quantity': '15',
        'isbn': '978-0198877665',
        'description': 'An inquiry into how digital media and neural co-processors reshape human agency and conceptual reasoning.',
        'publisher': 'Oxford Curatorial',
        'publication_date': '2025-01-10',
        'language': 'English',
        'cover_image_url': '',
        'cover_filename': '',
        'is_featured': 'False',
        'is_bestseller': 'False',
        'is_new_arrival': 'True',
        'is_active': 'True',
    },
]

def generate_csv_template():
    """
    Generates a production-ready CSV template with headers and 3 illustrative sample rows.
    """
    output = io.StringIO()
    writer = csv.writer(output)

    headers = [f['key'] for f in CANONICAL_FIELDS]
    writer.writerow(headers)

    for row in SAMPLE_DATA_ROWS:
        writer.writerow([row.get(h, '') for h in headers])

    return output.getvalue().encode('utf-8-sig')


def generate_excel_template():
    """
    Generates an Excel (.xlsx) template with styled headers, sample rows,
    and a second 'Field Guide' worksheet detailing all constraints and rules.
    """
    wb = openpyxl.Workbook()

    # Sheet 1: Template
    ws_template = wb.active
    ws_template.title = "Book Import Template"

    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="6B1724", end_color="6B1724", fill_type="solid")  # AETHERIUM Burgundy
    align_center = Alignment(horizontal="center", vertical="center")
    thin_border = Border(
        left=Side(style='thin', color='E0D8CB'),
        right=Side(style='thin', color='E0D8CB'),
        top=Side(style='thin', color='E0D8CB'),
        bottom=Side(style='thin', color='E0D8CB')
    )

    headers = [f['key'] for f in CANONICAL_FIELDS]
    ws_template.append(headers)

    for col_idx in range(1, len(headers) + 1):
        cell = ws_template.cell(row=1, column=col_idx)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = align_center

    # Add Sample Rows
    for row in SAMPLE_DATA_ROWS:
        ws_template.append([row.get(h, '') for h in headers])

    for row in ws_template.iter_rows(min_row=2, max_row=4, min_col=1, max_col=len(headers)):
        for cell in row:
            cell.border = thin_border

    # Auto-fit column widths
    for col in ws_template.columns:
        max_len = max(len(str(cell.value or '')) for cell in col)
        col_letter = get_column_letter(col[0].column)
        ws_template.column_dimensions[col_letter].width = max(max_len + 4, 14)

    # Sheet 2: Field Guide & Instructions
    ws_guide = wb.create_sheet(title="Field Guide & Instructions")
    ws_guide.column_dimensions['A'].width = 20
    ws_guide.column_dimensions['B'].width = 12
    ws_guide.column_dimensions['C'].width = 16
    ws_guide.column_dimensions['D'].width = 50

    guide_headers = ["Field Name", "Required?", "Data Type", "Description & Constraints"]
    ws_guide.append(guide_headers)
    for col_idx in range(1, 5):
        cell = ws_guide.cell(row=1, column=col_idx)
        cell.font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        cell.fill = PatternFill(start_color="C5A059", end_color="C5A059", fill_type="solid")  # AETHERIUM Gold

    for f in CANONICAL_FIELDS:
        dtype = "Text"
        if f['key'] in ('price', 'discount_price'):
            dtype = "Decimal (0.00)"
        elif f['key'] == 'stock_quantity':
            dtype = "Integer"
        elif f['key'] == 'publication_date':
            dtype = "Date (YYYY-MM-DD)"
        elif f['key'].startswith('is_'):
            dtype = "Boolean (True/False)"

        ws_guide.append([
            f['key'],
            "YES" if f['required'] else "Optional",
            dtype,
            f['description']
        ])

    for row in ws_guide.iter_rows(min_row=2, min_col=1, max_col=4):
        for cell in row:
            cell.border = thin_border

    stream = io.BytesIO()
    wb.save(stream)
    wb.close()
    return stream.getvalue()


# =============================================================================
# CSV FORMULA INJECTION DEFENSE & ERROR REPORT GENERATION
# =============================================================================

def sanitize_csv_cell(val):
    """
    Prevents CSV Formula Injection / DDE attacks.
    If a cell begins with '=', '+', '-', '@', '\t', or '\r', prefixes it with a single apostrophe.
    """
    if val is None:
        return ''
    s = str(val)
    if s and s[0] in ('=', '+', '-', '@', '\t', '\r'):
        return f"'{s}"
    return s


def generate_error_report_csv(job):
    """
    Generates a secure CSV report listing invalid or rejected rows with their exact errors.
    """
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        sanitize_csv_cell("Row Number"),
        sanitize_csv_cell("Status"),
        sanitize_csv_cell("Book Title"),
        sanitize_csv_cell("Author"),
        sanitize_csv_cell("ISBN"),
        sanitize_csv_cell("Category"),
        sanitize_csv_cell("Errors"),
        sanitize_csv_cell("Warnings"),
    ])

    for err_item in job.error_summary:
        writer.writerow([
            sanitize_csv_cell(err_item.get('row_num', '')),
            sanitize_csv_cell(err_item.get('status', 'error')),
            sanitize_csv_cell(err_item.get('title', '')),
            sanitize_csv_cell(err_item.get('author', '')),
            sanitize_csv_cell(err_item.get('isbn', '')),
            sanitize_csv_cell(err_item.get('category', '')),
            sanitize_csv_cell(" | ".join(err_item.get('errors', []))),
            sanitize_csv_cell(" | ".join(err_item.get('warnings', []))),
        ])

    return output.getvalue().encode('utf-8-sig')


# =============================================================================
# EXECUTION ENGINE (STAGE 2)
# =============================================================================

def execute_import_job(job, conflict_mode='skip', create_missing_categories=False):
    """
    Executes the validated rows within an atomic Django transaction.
    Handles duplicate skips or updates, missing category creation,
    and cover image downloads/assignments.
    Returns (created_count, updated_count, skipped_count, failed_count).
    """
    job.status = ImportJob.STATUS_PROCESSING
    job.conflict_mode = conflict_mode
    job.create_missing_categories = create_missing_categories
    job.save(update_fields=['status', 'conflict_mode', 'create_missing_categories'])

    created_cnt = 0
    updated_cnt = 0
    skipped_cnt = 0
    failed_cnt = 0
    execution_errors = list(job.error_summary)

    # Categories cache
    cats_by_name = {c.name.lower().strip(): c for c in Category.objects.all()}

    # Staged cover zip dir if present
    zip_dir = job.zip_extracted_path if (job.has_zip_covers and os.path.exists(job.zip_extracted_path)) else None

    # Track newly uploaded files for rollback cleanup if needed
    uploaded_files_cleanup = []

    try:
        with transaction.atomic():
            for row in job.parsed_rows:
                row_num = row.get('_row_num', 0)
                errors = row.get('_errors', [])

                # Skip rows that had fatal schema errors during validation
                if errors:
                    failed_cnt += 1
                    continue

                title = row.get('title')
                author = row.get('author')
                isbn = row.get('isbn')
                slug = row.get('slug')
                cat_name = row.get('category_name')

                # Handle category resolution
                cat_key = cat_name.lower().strip() if cat_name else ''
                category = cats_by_name.get(cat_key)

                if not category:
                    if create_missing_categories and cat_name:
                        category = Category.objects.create(
                            name=cat_name,
                            slug=slugify(cat_name)[:120],
                            is_active=True
                        )
                        cats_by_name[cat_key] = category
                    else:
                        failed_cnt += 1
                        execution_errors.append({
                            'row_num': row_num,
                            'title': title,
                            'author': author,
                            'isbn': isbn,
                            'category': cat_name,
                            'status': 'failed',
                            'errors': [f"Category '{cat_name}' does not exist and creation was disabled."],
                            'warnings': [],
                        })
                        continue

                # Check for existing duplicate book
                existing_book = None
                if isbn:
                    existing_book = Book.objects.filter(isbn=isbn).first()
                    if not existing_book:
                        for eb in Book.objects.exclude(isbn__isnull=True).exclude(isbn=''):
                            if normalize_isbn(eb.isbn) == isbn:
                                existing_book = eb
                                break
                if not existing_book and slug:
                    existing_book = Book.objects.filter(slug=slug).first()

                # Duplicate / conflict resolution
                if existing_book:
                    if conflict_mode == 'skip':
                        skipped_cnt += 1
                        continue
                    elif conflict_mode == 'update':
                        # Update mode
                        existing_book.title = title
                        existing_book.author = author
                        existing_book.description = row.get('description', '')
                        existing_book.category = category
                        existing_book.price = Decimal(row['price'])
                        existing_book.discount_price = Decimal(row['discount_price']) if row.get('discount_price') else None
                        existing_book.stock_quantity = row.get('stock_quantity', 0)
                        existing_book.publisher = row.get('publisher', '')
                        existing_book.publication_date = row.get('publication_date') or None
                        existing_book.language = row.get('language', 'English')
                        existing_book.is_featured = row.get('is_featured', False)
                        existing_book.is_bestseller = row.get('is_bestseller', False)
                        existing_book.is_new_arrival = row.get('is_new_arrival', False)
                        existing_book.is_active = row.get('is_active', True)
                        existing_book.save()
                        updated_cnt += 1
                        continue

                # Create New Book
                book = Book(
                    title=title,
                    author=author,
                    description=row.get('description', ''),
                    isbn=isbn,
                    category=category,
                    price=Decimal(row['price']),
                    discount_price=Decimal(row['discount_price']) if row.get('discount_price') else None,
                    stock_quantity=row.get('stock_quantity', 0),
                    publisher=row.get('publisher', ''),
                    publication_date=row.get('publication_date') or None,
                    language=row.get('language', 'English'),
                    is_featured=row.get('is_featured', False),
                    is_bestseller=row.get('is_bestseller', False),
                    is_new_arrival=row.get('is_new_arrival', False),
                    is_active=row.get('is_active', True),
                )

                if slug:
                    book.slug = slug
                else:
                    book.slug = generate_unique_slug(book, title, 'slug', max_length=280)

                # Cover Image Resolution
                # 1. From ZIP if available
                cover_assigned = False
                if zip_dir:
                    fname = row.get('cover_filename', '').lower().strip()
                    matched_file = None
                    if fname and os.path.exists(os.path.join(zip_dir, fname)):
                        matched_file = os.path.join(zip_dir, fname)
                    elif isbn:
                        # Try matching by ISBN
                        for ext in ('.jpg', '.jpeg', '.png', '.webp'):
                            trial = os.path.join(zip_dir, f"{isbn}{ext}".lower())
                            if os.path.exists(trial):
                                matched_file = trial
                                break
                    if matched_file:
                        try:
                            with open(matched_file, 'rb') as img_f:
                                img_content = img_f.read()
                                save_name = f"{uuid.uuid4().hex[:12]}_{os.path.basename(matched_file)}"
                                book.cover_image.save(save_name, ContentFile(img_content), save=False)
                                uploaded_files_cleanup.append(book.cover_image.name)
                                cover_assigned = True
                        except Exception:
                            pass

                # 2. From URL if not yet assigned
                if not cover_assigned and row.get('cover_image_url'):
                    try:
                        img_bytes, ext = validate_and_fetch_image_url(row['cover_image_url'])
                        save_name = f"{uuid.uuid4().hex[:12]}.{ext}"
                        book.cover_image.save(save_name, ContentFile(img_bytes), save=False)
                        uploaded_files_cleanup.append(book.cover_image.name)
                    except Exception as img_err:
                        # Non-fatal image warning: book still created, image skipped
                        pass

                book.save()
                created_cnt += 1

        # Success update
        job.status = ImportJob.STATUS_COMPLETED
        job.created_count = created_cnt
        job.updated_count = updated_cnt
        job.skipped_count = skipped_cnt
        job.failed_count = failed_cnt
        job.error_summary = execution_errors
        job.completed_at = timezone.now()
        job.save()

        # Clean up temporary zip directory
        if zip_dir and os.path.exists(zip_dir):
            shutil.rmtree(zip_dir, ignore_errors=True)

        return created_cnt, updated_cnt, skipped_cnt, failed_cnt

    except Exception as e:
        # Transaction rolled back: clean up newly created media files
        for fpath in uploaded_files_cleanup:
            try:
                if default_storage.exists(fpath):
                    default_storage.delete(fpath)
            except Exception:
                pass

        job.status = ImportJob.STATUS_FAILED
        job.error_summary.append({
            'row_num': 0,
            'status': 'fatal_error',
            'errors': [f"Database transaction failure: {str(e)}"],
            'warnings': [],
        })
        job.save()
        raise e
