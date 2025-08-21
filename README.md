# Invoice Generator Dashboard

A **full-stack invoice management system** with a modern UI and robust backend.  
Built using **Flask + SQLite** (backend) and **HTML/CSS/JavaScript** (frontend), this project allows you to create, manage, and track invoices while also providing **sales analytics** and **profit tracking**.

---

## ✨ Features
- 📊 **Dashboard Analytics**
  - Monthly/Yearly sales overview with charts (Chart.js)
  - KPI cards for total sales, profit, and invoice count
  - Recent invoices quick view

- 🧾 **Invoice Management**
  - Create new invoices with customer & item search
  - Add discounts, tax (GST), round-off, and final totals
  - Save or print invoices (PDF generation via WeasyPrint)
  - Edit existing invoices

- 👥 **Customer Management**
  - Add, edit, and manage customer records
  - Store GSTIN, address, and place of supply
  - Integrated customer search

- 📦 **Item Management**
  - Add & edit items with HSN, units, MRP, purchase price, and GST
  - Category support
  - Profit tracking from purchase vs. sale price

- ☁️ **Backup & Restore**
  - Backup the SQLite database
  - Restore from a backup file

- 🎨 **Modern UI**
  - Responsive dashboard layout
  - Light/Dark theme support
  - Smooth animations & clean design

---

## 🛠️ Tech Stack
- **Frontend:** HTML, CSS, JavaScript (Chart.js for analytics)
- **Backend:** Python (Flask, Flask-CORS)
- **Database:** SQLite
- **PDF Generation:** WeasyPrint
- **Data Seeding:** Python script (`seed_database.py`)

---

## 📂 Project Structure
index.html # Dashboard page
├── invoice.html # Invoice creation page
├── styles.css # Dashboard styles
├── invoice.css # Invoice page styles
├── script.js # Dashboard logic
├── invoice.js # Invoice page logic
├── requirements.txt #dependencies
├── server.py # Flask backend API
├── schema.sql # Database schema
├── seed_database.py # Script to seed sample data
├── invoice_app.db # SQLite database (generated)


---

## 🚀 Getting Started

### 1. Clone the Repository
bash 
git clone https://github.com/rishabh0510rishabh/invoice-generator-
cd invoice-generator-

### 2. Create & Activate Virtual Environment

python -m venv venv
source venv/bin/activate   # On Linux/Mac
venv\Scripts\activate      # On Windows

### 3. Install Dependencies
pip install -r requirements.txt

### 4. Initialize Database
python seed_database.py

### 5. Run the Server
python server.py
Server runs on http://127.0.0.1:5000

### 6. Open Frontend
Open index.html for dashboard



