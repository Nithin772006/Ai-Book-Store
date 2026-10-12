# AETHERIUM — Bulk Book Importer Technical & Curatorial Guide

This document details the production architecture, security safeguards, spreadsheet schema, and operational workflow for the Bulk Book Importer in AETHERIUM's Admin Panel and Django REST Framework backend.

---

## 1. Architectural Overview

The Bulk Book Importer is designed for ingesting large catalogue archives (such as Kaggle datasets or publisher catalogs with hundreds to thousands of titles) through a two-stage transaction-safe workflow:

```
[ Stage 1: Ingestion & Validation ]
Upload File (.csv / .xlsx) [+ Optional ZIP]
            ↓
Smart Alias Column Mapping
            ↓
Dry-Run Validation & Conflict Detection
            ↓
Paginated Normalized Preview Table

[ Stage 2: Transactional Execution ]
Explicit Staff Confirmation
            ↓
Atomic Database Writes (Django `transaction.atomic()`)
            ↓
Cover Asset Processing (SSRF URL / ZIP → Supabase Storage)
            ↓
Final Tally & Downloadable CSV Error Report
```

---

## 2. Accepted Formats & File Limits

| Aspect | Specification / Limit | Notes |
| :--- | :--- | :--- |
| **CSV Datasets** | **100 MB** (`.csv`) | Supports massive catalogues (~27,000+ volumes, e.g. Kaggle Book-Crossing). Streamed to disk without memory saturation. |
| **Excel Spreadsheets** | **20 MB** (`.xlsx`) | Modern openxml spreadsheets. Configured independently. |
| **Legacy `.xls`** | Not supported | Must be opened and saved as `.xlsx` prior to upload |
| **CSV Encodings** | UTF-8, UTF-8-sig, Latin-1, CP1252 | Auto-detected with delimiter sniffing (comma, semicolon, tab) and UTF-8 BOM support |
| **Max Batch Slicing** | **5,000 rows** per import batch | Configurable via `MAX_BATCH_ROWS_LIMIT`. Selectable via quantity presets or custom range. |
| **Optional Cover ZIP** | **100 MB** compressed / **250 MB** uncompressed | Verified against path traversal and decompression bombs |
| **Cover Image Formats** | JPEG, PNG, WEBP | Max 5 MB per image, verified via Pillow format headers |

---

## 3. Schema & Column Definitions

The importer maps file columns to AETHERIUM's `catalog.models.Book` model:

### Required Fields

| Field Name | Type / Format | Validation Rule & Constraints | Smart Auto-Match Aliases |
| :--- | :--- | :--- | :--- |
| **`title`** | Text (max 255) | Must not be empty. Normalized whitespace. | `title`, `book_title`, `name`, `volume` |
| **`author`** | Text (max 255) | Must not be empty. Normalized whitespace. | `author`, `authors`, `writer`, `creator` |
| **`category`** | Text | Must match an existing category in the bookstore (unless automatic category creation is explicitly enabled). | `category`, `category_name`, `genre`, `discipline` |
| **`price`** | Decimal (0.00) | Must be a positive decimal >= 0.00. Currency symbols (`$`, `€`, `£`) are stripped automatically. | `price`, `cost`, `retail_price`, `amount` |
| **`description`**| Text | Volume description/synopsis. Preserves full formatting. | `description`, `synopsis`, `summary`, `overview` |

### Optional Fields

| Field Name | Type / Format | Default | Description & Aliases |
| :--- | :--- | :--- | :--- |
| **`isbn`** | Alphanumeric (10 or 13) | `None` | Hyphens and spaces stripped. Validated for uniqueness within the file and against existing database records. Aliases: `isbn`, `isbn13`, `isbn10`. |
| **`discount_price`** | Decimal (0.00) | `None` | Must be >= 0.00 and <= regular `price`. Aliases: `discount_price`, `sale_price`. |
| **`stock_quantity`** | Integer >= 0 | `0` | Must be an integer >= 0. Aliases: `stock_quantity`, `quantity`, `inventory`, `stock`. |
| **`publisher`** | Text (max 255) | `""` | Publishing house name. Aliases: `publisher`, `press`, `imprint`. |
| **`publication_date`** | Date (`YYYY-MM-DD` or `YYYY`) | `None` | Accepts `YYYY-MM-DD`, `MM/DD/YYYY`, `DD-MM-YYYY`, or 4-digit year `YYYY`. Aliases: `publication_date`, `published_date`, `year`. |
| **`language`** | Text (max 50) | `'English'` | Volume language. Aliases: `language`, `lang`. |
| **`cover_image_url`** | Safe HTTP/HTTPS URL | `""` | Downloaded securely, validated as raster image, and saved to Supabase bucket. Aliases: `cover_image_url`, `cover_url`, `image_url`. |
| **`cover_filename`** | Filename | `""` | Filename inside uploaded ZIP archive (e.g. `9780139988112.jpg`). Aliases: `cover_filename`, `cover_file`, `cover_image`. |
| **`is_featured`** | Boolean (`true`/`false`) | `False` | Aliases: `is_featured`, `featured`. |
| **`is_bestseller`** | Boolean (`true`/`false`) | `False` | Aliases: `is_bestseller`, `bestseller`. |
| **`is_new_arrival`** | Boolean (`true`/`false`) | `False` | Aliases: `is_new_arrival`, `new_arrival`. |
| **`is_active`** | Boolean (`true`/`false`) | `True` | Whether volume is listed on storefront. Aliases: `is_active`, `active`, `published`. |

---

## 4. Category Matching & Resolution Policy

1. **Existing Categories First**:
   - The importer resolves categories against current database records (`Artificial Intelligence & ML`, `Software Engineering`, `Theoretical Computing`, `Architecture & Systems`, `Philosophy & Futures`).
   - Matching is case-insensitive and trims leading/trailing spaces.
2. **Missing Category Protection**:
   - **Never created silently**: By default, rows with unrecognized categories produce a warning and are rejected during confirmation to prevent taxonomy pollution.
   - **Deliberate Option**: The confirmation panel offers an explicit toggle: *"Automatically create missing categories"*. When selected, missing categories are created with unique slugs during execution.

---

## 5. Duplicate Detection & Conflict Policies

- **Conflict Detection Keys**:
  - Normalized ISBN (e.g., `978-1449373320` matches `9781449373320`).
  - Unique slug matches.
  - In-file duplicate detection (flags duplicate ISBNs or slugs within the uploaded spreadsheet).
- **Default Import Mode**: **Create new books only (`skip`)**
  - Conflicting books are preserved exactly as they are in the database.
  - Customer carts, orders, and purchase snapshots are never modified.
- **Explicit Update Mode (`update`)**:
  - Staff must explicitly select *"Update existing books"*.
  - When confirmed, updates the title, author, price, discount price, stock, description, and cover image for matching records.

---

## 6. Cover Imagery Workflows

### Option A: Cover Image URLs
- Only `http://` and `https://` schemes are permitted.
- **SSRF Safeguards**:
  - Hostnames resolving to private (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), loopback (`127.0.0.1`, `localhost`), link-local, multicast, or cloud metadata IP addresses (`169.254.169.254`, `100.100.100.200`) are rejected immediately before request dispatch.
  - Streamed response with maximum 5 MB threshold and 8-second timeout.
  - Content verified with Pillow to ensure valid JPEG, PNG, or WebP bytes.

### Option B: ZIP Archive of Cover Files
- Optional ZIP file uploaded alongside the spreadsheet.
- **Archive Safeguards**:
  - Prevents directory traversal attacks (`../` paths rejected).
  - Uncompressed decompression size capped at 100 MB (prevents Zip Bomb attacks).
  - Matches covers by exact `cover_filename` column reference or normalized ISBN filename (e.g., `9780139988112.jpg`).
  - Successfully uploads to Supabase `book-covers` bucket with collision-safe filenames.
  - If a transaction aborts, newly created storage files are cleaned up automatically.

---

## 7. Security Defenses & Authorization

- **Server-Side Staff Authorization**:
  - All endpoints enforce DRF's `IsStaffAdmin` permission (`request.user.is_authenticated and request.user.is_staff`). Client-side state is never trusted.
- **Strict CSRF Enforcement**:
  - State-changing POST endpoints enforce `enforce_csrf(request)` using Django's `CSRFCheck`.
- **CSV Formula Injection / DDE Attack Defense**:
  - Any field starting with `=`, `+`, `-`, `@`, `\t`, or `\r` is automatically sanitized by prepending a single apostrophe (`'`).
- **Idempotency Protection**:
  - Every confirmation request generates a UUID v4 idempotency key to prevent accidental duplicate submission.

---

## 8. Operational Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/admin/books/import/template/?format=csv\|xlsx` | Download template with sample data and field guide. |
| `POST` | `/api/admin/books/import/upload/` | Multipart upload for spreadsheet and optional ZIP. |
| `POST` | `/api/admin/books/import/validate/` | Dry-run validation and conflict detection. |
| `POST` | `/api/admin/books/import/confirm/` | Transactional import execution. |
| `GET` | `/api/admin/books/import/history/` | Paginated audit history of past import jobs. |
| `GET` | `/api/admin/books/import/jobs/<job_id>/errors/` | Download CSV error report for rejected rows. |

---

## 9. How to Fix Validation Errors & Retry

1. **Missing Required Fields**: Ensure `title`, `author`, `category`, `price`, and `description` are present.
2. **Invalid Price or Stock**: Price must be a non-negative number; stock must be an integer.
3. **Unknown Category**: Either add the category manually in the admin panel, enable *"Automatically create missing categories"*, or correct the spelling.
4. **Duplicate ISBNs in File**: Remove duplicate rows before re-uploading.
5. **Download Error Report**: Click *"Download Error Report (CSV)"* on any completed job to get a row-by-row breakdown of why rows were rejected. Correct the rejected rows and upload them as a new batch.
 
---
 
## 10. Smart Batch Slicing: Quantity & Row Range Modes
 
Staff can upload huge datasets (such as a 71 MB CSV with 27,136 books) without manual splitting or Excel editing:
 
### A. Book Quantity Selector
After upload, the panel prompts: **“How many books would you like to import?”**
- **Presets**: 10 books, 50 books (*default*), 100 books, 250 books, 500 books, 1,000 books, 2,000 books, 5,000 books.
- **Custom Quantity**: Enter any integer from 1 to 5,000.
- If requested quantity exceeds the available rows in the file, the importer displays the actual available count and automatically scales the batch safely.
 
### B. Advanced Row Range Selection
- Select any custom 1-based data record slice (excluding header row).
- Quick presets: `1–50`, `51–100`, `101–150`, `501–1,000`.
- Validates that `Start row >= 1`, `End row >= Start row`, and `(End row - Start row + 1) <= 5,000`.
- Quoted multiline fields and commas inside quotes are parsed strictly according to RFC 4180 without corrupting record numbering.
 
### C. Safe Fallback Defaults for Missing Fields
For datasets (such as Kaggle Book-Crossing) that only supply ISBN, Title, Author, Year, and Publisher, the importer enables explicit fallback defaults:
- **Price ($ USD)**: Explicit default (e.g. `$19.99`).
- **Category**: Dropdown of active database categories or custom category name.
- **Description Synopsis**: Template string e.g. `Catalogue volume published by {publisher} ({year}).`
- This ensures books satisfy database integrity without inventing synthetic ISBNs or hallucinating data.
 
---
 
## 11. Reverse Proxy & Production Server Configuration
 
To support uploads of 71 MB (and up to 100 MB) through reverse proxies in production environments, ensure proxy body size limits are updated:
 
### Nginx Configuration
In your Nginx site configuration block (`/etc/nginx/sites-available/aetherium` or `/etc/nginx/conf.d/default.conf`):
```nginx
server {
    listen 80;
    server_name bookstore.aetherium.com;
 
    # Increase maximum client request body size to accept up to 100 MB CSV / ZIP
    client_max_body_size 105M;
 
    # Increase proxy timeout for streaming large uploads
    proxy_read_timeout 300s;
    proxy_connect_timeout 300s;
    proxy_send_timeout 300s;
 
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
 
### Gunicorn / Django Settings
In Django (`backend/config/settings.py`):
```python
DATA_UPLOAD_MAX_MEMORY_SIZE = 110 * 1024 * 1024  # 110 MB
FILE_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024    # 5 MB threshold: files > 5 MB stream to disk tempfile
```
 
### Cloudflare / CDN Considerations
- Cloudflare Free / Pro tiers enforce a 100 MB client body limit for HTTP requests. If uploads exceed 100 MB, utilize Cloudflare Enterprise or bypass the CDN proxy for the `/api/admin/books/import/upload/` route.
