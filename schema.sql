-- Creates the Business table to store company details
CREATE TABLE IF NOT EXISTS Business (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    gstin VARCHAR(15) NOT NULL,
    contact_number VARCHAR(15) NOT NULL,
    email VARCHAR(100),
    website VARCHAR(200),
    logo_path TEXT
);

-- Creates the Customers table
CREATE TABLE IF NOT EXISTS Customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(15) NOT NULL,
    gstin VARCHAR(15),
    address TEXT,
    place_of_supply VARCHAR(100) NOT NULL,
    is_verified BOOLEAN DEFAULT 0
);

-- Creates the Categories table for items
CREATE TABLE IF NOT EXISTS Categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) UNIQUE NOT NULL
);

-- Creates the Units table for item measurements
CREATE TABLE IF NOT EXISTS Units (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(50) UNIQUE NOT NULL
);

-- Creates the HSN_Codes table
CREATE TABLE IF NOT EXISTS HSN_Codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code VARCHAR(8) UNIQUE NOT NULL,
    description TEXT
);

-- Creates the Items table with the new tax rate column
CREATE TABLE Items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    hsn_code TEXT,
    default_unit TEXT,
    default_mrp REAL NOT NULL,
    purchase_price REAL,
    default_sale_price REAL NOT NULL,
    default_tax_rate REAL NOT NULL,
    default_gst_rate REAL,
    inclusive_of_tax BOOLEAN NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT 1,
    category_id INTEGER,
    FOREIGN KEY (category_id) REFERENCES Categories (id)
);
-- Creates the Invoices table
CREATE TABLE IF NOT EXISTS Invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_no VARCHAR(20) UNIQUE NOT NULL,
    date DATE NOT NULL,
    customer_id INTEGER NOT NULL,
    sale_type VARCHAR(10) NOT NULL, -- "CASH" or "CREDIT"
    payment_terms TEXT,
    notes TEXT,
    total_value DECIMAL(12, 2) NOT NULL,
    taxable_value DECIMAL(12, 2) NOT NULL,
    cgst DECIMAL(12, 2) NOT NULL,
    sgst DECIMAL(12, 2) NOT NULL,
    igst DECIMAL(12, 2) NOT NULL,
    cess DECIMAL(12, 2) NOT NULL,
    round_off DECIMAL(10, 2) DEFAULT 0, -- NEW: Added round_off column
    status VARCHAR(10) NOT NULL DEFAULT 'PENDING', -- "PENDING" or "PAID"
    FOREIGN KEY (customer_id) REFERENCES Customers (id)
);

-- Creates the Invoice_Items table to link items to an invoice
CREATE TABLE IF NOT EXISTS Invoice_Items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    free_quantity INTEGER DEFAULT 0,
    unit VARCHAR(50) NOT NULL,
    price_per_unit DECIMAL(10, 2) NOT NULL,
    discount DECIMAL(10, 2) DEFAULT 0,
    gst_rate DECIMAL(5, 2) NOT NULL,
    cgst_amount DECIMAL(12, 2) NOT NULL,
    sgst_amount DECIMAL(12, 2) NOT NULL,
    igst_amount DECIMAL(12, 2) NOT NULL,
    cess_amount DECIMAL(12, 2) DEFAULT 0,
    total_amount DECIMAL(12, 2) NOT NULL,
    hsn_code VARCHAR(8),
    is_reverse_charge BOOLEAN DEFAULT 0,
    FOREIGN KEY (invoice_id) REFERENCES Invoices (id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES Items (id)
);

-- NEW: Creates the Invoice_Prefixes table
CREATE TABLE IF NOT EXISTS Invoice_Prefixes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prefix VARCHAR(50) UNIQUE NOT NULL,
    is_default BOOLEAN DEFAULT 0
);

-- Add indexes for faster searching
CREATE INDEX IF NOT EXISTS idx_invoice_no ON Invoices (invoice_no);
CREATE INDEX IF NOT EXISTS idx_customer_name ON Customers (name);
CREATE INDEX IF NOT EXISTS idx_item_name ON Items (name);

-- Pre-populate the Units table
INSERT OR IGNORE INTO Units (name) VALUES
('PCS'), ('BTL'), ('BOX'), ('BUN'), ('BDL'), ('CAN'), ('CTN'),
('DZN'), ('GM'), ('KG'), ('LTR'), ('MTR'), ('NOS'), ('PAC'),
('ROL'), ('SET'), ('SQF'), ('TBS'), ('TUB');