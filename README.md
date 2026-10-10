# AI Online Bookstore

An AI-Powered Online Bookstore built with **React (Vite)** on the frontend and **Django REST Framework** on the backend.

---

## Project Status: Phase 2 (Database Models, Catalog & Django Admin)

Phase 2 builds upon the Phase 1 foundation by establishing the core database schema:
- **`Category` & `Book` Models** with strict validations, unique slug generation, and database constraints.
- **Django Admin Interface** with search, filters, in-place toggle edits, and structured fieldsets.
- **Media File Handling** configured for development cover image uploads.
- **Reserved Apps** (`accounts`, `newsletter`) scaffolded for upcoming authentication and subscription milestones.
- **Preserved Health-Check** endpoint (`/api/health/`) and cross-origin security.

---

## Architecture Overview

```
Ai-Bookstore/
├── frontend/                     # React Single Page Application (Vite)
│   ├── src/
│   │   ├── api.js                # Reusable Axios API client with VITE_API_URL configuration
│   │   ├── App.jsx               # System health status dashboard component
│   │   ├── App.css               # Modern status card styling & animations
│   │   ├── index.css             # Global design system & theme variables
│   │   └── main.jsx              # React application entry point
│   ├── .env                      # Local environment configuration (VITE_API_URL)
│   ├── .env.example              # Environment variables template
│   ├── index.html                # HTML template with typography & SEO tags
│   ├── package.json              # Node.js project manifest & dependencies
│   └── vite.config.js            # Vite configuration (port 5173)
├── backend/                      # Django REST Framework Backend
│   ├── api/                      # Core bookstore API application
│   │   ├── views.py              # Health check endpoint view
│   │   ├── urls.py               # API route definitions (/health/)
│   │   └── tests.py              # Health check automated tests
│   ├── catalog/                  # Bookstore Catalogue Application
│   │   ├── models.py             # Category and Book models with validation
│   │   ├── admin.py              # Customized Django Admin interfaces
│   │   ├── migrations/           # 0001_initial database migrations
│   │   └── tests.py              # 14 tests for models, validation, and admin
│   ├── accounts/                 # Reserved app for future authentication
│   ├── newsletter/               # Reserved app for future subscriptions
│   ├── config/                   # Django project configuration
│   │   ├── settings.py           # DRF, CORS, MEDIA_URL/ROOT, and app settings
│   │   ├── urls.py               # Root URL router (mounts /api/, /admin/, media)
│   │   ├── asgi.py               # ASGI entry point
│   │   └── wsgi.py               # WSGI entry point
│   ├── media/                    # Development media storage (cover images)
│   ├── .venv/                    # Python virtual environment (ignored by Git)
│   ├── manage.py                 # Django management script
│   ├── requirements.txt          # Python dependencies (django, DRF, cors, pillow)
│   ├── .env.example              # Backend environment template
│   └── db.sqlite3                # Local SQLite database (ignored by Git)
├── .gitignore                    # Git ignore file for Python, Node, env, and DB
└── README.md                     # Project documentation & instructions
```

---

## Prerequisites

- **Python 3.10+**
- **Node.js 18+** & **npm 9+**
- **Windows PowerShell**

---

## Getting Started (Windows PowerShell)

Open two separate Windows PowerShell terminal tabs in VS Code or Windows Terminal.

### 1. Backend Setup & Run

In the first terminal:

```powershell
# Navigate to the backend directory
cd backend

# Create virtual environment (if not already created)
python -m venv .venv

# Activate virtual environment
.\.venv\Scripts\Activate.ps1

# Upgrade pip and install dependencies (including Pillow)
pip install -r requirements.txt

# Run database migrations
python manage.py migrate

# Run automated tests across all apps (16 passing tests)
python manage.py test

# Start Django development server on port 8000
python manage.py runserver 127.0.0.1:8000
```

The Django API server will be available at `http://127.0.0.1:8000`.

---

### 2. Creating a Django Superuser & Accessing Admin

To manage books and categories through the Django Admin interface:

```powershell
# From the backend directory with virtual environment activated:
.\.venv\Scripts\python.exe manage.py createsuperuser
```

Follow the prompts to enter:
- **Username** (e.g. `admin`)
- **Email** (e.g. `admin@example.com`)
- **Password** (min 8 characters)

Then navigate to:
```
http://127.0.0.1:8000/admin/
```

Log in with your superuser credentials to access:
- **Categories**: add, edit, search, filter, and toggle active status.
- **Books**: comprehensive book management with organized fieldsets (Basic Info, Publication Details, Pricing & Inventory, Catalogue Settings, and Timestamps).

---

### 3. Frontend Setup & Run

In the second terminal:

```powershell
# Navigate to the frontend directory
cd frontend

# Install npm dependencies (if not already installed)
npm install

# Start Vite development server on port 5173
npm run dev
```

The React dashboard will be accessible at `http://127.0.0.1:5173` or `http://localhost:5173`.

---

## Test Data Guidance (Optional Manual Input)

You can manually populate the following realistic test entries in Django Admin (`http://127.0.0.1:8000/admin/`):

### 1. Categories to Create First:
| Name | Description | Active |
| :--- | :--- | :--- |
| **Fiction** | Literary works of imagination, storytelling, and contemporary narratives. | Yes |
| **Technology** | Computing, software engineering, AI, and systems architecture. | Yes |
| **Business** | Entrepreneurship, leadership, economics, and corporate strategy. | Yes |
| **Science** | Physics, cosmology, biology, and scientific exploration. | Yes |
| **Self-Help** | Personal development, productivity, habits, and mindset. | Yes |

### 2. Sample Books to Add:
| Title | Author | Category | Price | Discount | Stock | ISBN | Flags |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **The Midnight Library** | Matt Haig | Fiction | $26.00 | $19.99 | 24 | `978-0525559474` | Bestseller |
| **Designing Data-Intensive Applications** | Martin Kleppmann | Technology | $49.99 | $39.99 | 15 | `978-1449373320` | Featured |
| **Zero to One** | Peter Thiel | Business | $28.00 | $21.50 | 30 | `978-0804139298` | Bestseller |
| **Astrophysics for People in a Hurry** | Neil deGrasse Tyson | Science | $18.95 | $14.50 | 18 | `978-0393609394` | New Arrival |
| **Atomic Habits** | James Clear | Self-Help | $27.00 | $19.99 | 45 | `978-0735211292` | Featured, Bestseller |

---

## Automated Test Coverage

The test suite covers both Phase 1 and Phase 2 implementations (`python manage.py test`):

- **Health Check API**: Status 200 verification & CORS headers.
- **Category Creation & String Representation**: `__str__` and automatic slug generation.
- **Category Slug Collisions**: Collision resolution with incremental suffixes.
- **Book Relationships**: Foreign key to Category with `related_name="books"` and protected deletion.
- **Book Slug Generation & Collisions**: Automatic unique slug creation from titles.
- **Optional ISBN Handling**: Multiple books permitted without ISBNs (`None` normalization).
- **Duplicate ISBN Prevention**: Enforced via model validation & database uniqueness.
- **Non-Negative Price Validation**: Enforced via `clean()` and `MinValueValidator`.
- **Discount Price Validation**: Ensures discount price cannot be negative or exceed regular price.
- **Admin Registrations**: Verifies `CategoryAdmin` and `BookAdmin` registrations, search fields, filters, and list editable attributes.

---

---

## Phase 3: Public Catalogue API and React Storefront

Phase 3 implements the public, read-only catalogue API with Django REST Framework and a complete React 19 storefront with React Router, search, category filtering, sorting, pagination, book detail views, and editorial styling.

### 1. Backend Catalogue API Endpoints

All public catalogue endpoints are read-only (`GET`, `HEAD`, `OPTIONS`). `POST`, `PUT`, `PATCH`, and `DELETE` requests return `405 Method Not Allowed`.

| Endpoint | Method | Description | Supported Query Parameters |
| :--- | :--- | :--- | :--- |
| `/api/health/` | `GET` | System health check (Phase 1) | None |
| `/api/books/` | `GET` | List active books (paginated) | `search`, `category`, `featured`, `bestseller`, `new_arrival`, `in_stock`, `ordering`, `page`, `page_size` |
| `/api/books/<id>/` | `GET` | Retrieve single active book by ID | None |
| `/api/categories/` | `GET` | List all active categories | None |
| `/api/categories/<slug>/books/` | `GET` | List active books in a category | `search`, `in_stock`, `ordering`, `page`, `page_size` |

#### Query Parameters:
- **Search (`?search=<query>`)**: Case-insensitive substring matching against book `title`, `author`, `description`, and `isbn`.
- **Category Filter (`?category=<slug>`)**: Filters books by category slug.
- **Boolean Filters**:
  - `?featured=true` — Featured titles
  - `?bestseller=true` — Bestselling titles
  - `?new_arrival=true` — Recently added titles
  - `?in_stock=true` — Titles with `stock_quantity > 0`
- **Sorting (`?ordering=<field>`)**:
  - `price` (Price: Low to High)
  - `-price` (Price: High to Low)
  - `title` (Title: A to Z)
  - `-created_at` (Default: Recently added first)
- **Pagination (`?page=<n>&page_size=<size>`)**: Standard DRF pagination payload with `count`, `next`, `previous`, and `results`. Default page size is 12 (bounded up to 50).

### 2. Seeding Sample Catalogue Data

To populate the database with 5 curated categories and 14 books:

```powershell
.\.venv\Scripts\python.exe manage.py seed_catalog
```

To clear and re-seed:
```powershell
.\.venv\Scripts\python.exe manage.py seed_catalog --clear
```

### 3. Frontend Storefront Routes

The React application uses React Router to provide clean navigation with URL persistence for filters and search:

- `/` — Editorial Homepage featuring hero search, categories showcase, featured titles, bestsellers, and new arrivals.
- `/books` — Full book catalogue with real-time search, category dropdown, sorting, in-stock filter, and pagination.
- `/books/:id` — Book detail page showcasing full cover image or stylized placeholder, pricing, discount calculations, inventory status, non-functional Phase 4 cart preview, and bibliographic specifications.
- `/categories/:slug` — Category-specific book listings with category metadata and sub-filtering.
- `*` — Editorial 404 error page with links back to the homepage and catalogue.

---

## Next Steps (Phase 4)

- User authentication (registration, login, JWT / session management).
- Persistent cart state and cart badge counter.
- Wishlist functionality.
- Checkout flow and order placement.

