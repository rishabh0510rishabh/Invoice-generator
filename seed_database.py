import sqlite3
import os
from datetime import datetime
from dateutil.relativedelta import relativedelta
import random
import time

# --- CONFIGURATION ---
DB_FILE = 'invoice_app.db'
SCHEMA_FILE = 'schema.sql'
NUM_CUSTOMERS = 200
NUM_ITEMS = 80
MONTHS_TO_GENERATE = 18
INVOICES_PER_MONTH_AVG = 120

# --- DATA FOR PROCEDURAL GENERATION ---
FIRST_NAMES = ['Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan', 'Saanvi', 'Aanya', 'Aadhya', 'Aaradhya', 'Ananya', 'Pari', 'Diya', 'Myra', 'Anika', 'Avni','Rishabh','Suraj']
LAST_NAMES = ['Sharma', 'Verma', 'Gupta', 'Singh', 'Kumar', 'Patel', 'Shah', 'Mehta', 'Jain', 'Agarwal', 'Khan', 'Ali', 'Reddy', 'Naidu', 'Rao']
CITIES_STATES = {
    'Mumbai': 'Maharashtra', 'Delhi': 'Delhi', 'Bangalore': 'Karnataka', 'Hyderabad': 'Telangana',
    'Ahmedabad': 'Gujarat', 'Chennai': 'Tamil Nadu', 'Kolkata': 'West Bengal', 'Pune': 'Maharashtra',
    'Jaipur': 'Rajasthan', 'Lucknow': 'Uttar Pradesh', 'Kanpur': 'Uttar Pradesh', 'Nagpur': 'Maharashtra',
    'Indore': 'Madhya Pradesh', 'Thane': 'Maharashtra', 'Bhopal': 'Madhya Pradesh', 'Patna': 'Bihar',
    'Ghaziabad': 'Uttar Pradesh', 'Ludhiana': 'Punjab', 'Agra': 'Uttar Pradesh', 'Nashik': 'Maharashtra'
}
ITEM_ADJECTIVES = ['Premium', 'Organic', 'Herbal', 'Advanced', 'Gentle', 'Radiant', 'Soothing', 'Matte', 'Glossy', 'HD', 'Natural', 'Pure', 'Intense', 'Daily', 'Luminous']
ITEM_TYPES = ['Face Wash', 'Lipstick', 'Foundation', 'Serum', 'Moisturizer', 'Shampoo', 'Conditioner', 'Hair Oil', 'Sunscreen', 'Toner', 'Cleanser', 'Exfoliator', 'Mask', 'Eye Cream', 'Body Lotion']
ITEM_SUFFIXES = ['Plus', 'Pro', 'Max', 'for Men', 'for Women', '200ml', '50g', 'Kit', 'for Oily Skin', 'for Dry Skin', 'UV Protect', 'Intense Repair', 'Classic', 'Gold']

# --- HELPER FUNCTIONS ---
def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def apply_schema():
    if not os.path.exists(SCHEMA_FILE):
        print(f"❌ Schema file '{SCHEMA_FILE}' not found.")
        return False
    try:
        with open(SCHEMA_FILE, 'r') as f:
            schema_sql = f.read()
        conn = get_db_connection()
        conn.executescript(schema_sql)
        conn.commit()
        conn.close()
        print("🧱 Schema applied successfully!")
        return True
    except Exception as e:
        print(f"❌ Failed to apply schema: {e}")
        return False

def clear_all_data():
    conn = get_db_connection()
    cursor = conn.cursor()
    print("\n🧹 Clearing all existing data...")
    tables = [
        'Invoice_Items', 'Invoices', 'Items', 'Customers',
        'Categories', 'Business', 'HSN_Codes', 'Invoice_Prefixes', 'Units'
    ]
    for table in tables:
        try:
            cursor.execute(f"DELETE FROM {table};")
            # Reset auto-increment counters
            cursor.execute(f"DELETE FROM sqlite_sequence WHERE name='{table}';")
        except sqlite3.OperationalError:
            pass # Table might not exist yet
    conn.commit()
    conn.close()
    print("✅ All tables cleared.")

# --- SEEDING FUNCTIONS ---
def seed_base_data(cursor):
    print("\n🌱 Seeding base data (Units, Customers, Items, etc.)...")
    
    # *** ADDED: Explicitly seed Units ***
    units_to_add = [
        ('PCS',), ('BTL',), ('BOX',), ('BUN',), ('BDL',), ('CAN',), ('CTN',),
        ('DZN',), ('GM',), ('KG',), ('LTR',), ('MTR',), ('NOS',), ('PAC',),
        ('ROL',), ('SET',), ('SQF',), ('TBS',), ('TUB',)
    ]
    cursor.executemany("INSERT OR IGNORE INTO Units (name) VALUES (?)", units_to_add)
    print("✅ Seeded measurement units.")

    # Business
    cursor.execute("INSERT OR IGNORE INTO Business (name, address, gstin, contact_number) VALUES (?, ?, ?, ?)",
                   ('AMAR BEAUTY PLACE', 'Ghaziabad, Uttar Pradesh', '09ABCDE1234F1Z5', '9876543210'))
    
    # Invoice Prefixes
    prefixes = [('FY25-26/', 1), ('FY24-25/', 0)]
    cursor.executemany("INSERT OR IGNORE INTO Invoice_Prefixes (prefix, is_default) VALUES (?, ?)", prefixes)

    # Categories
    categories = ['Cosmetics', 'Skincare', 'Haircare']
    category_ids = {}
    for cat in categories:
        cursor.execute("INSERT OR IGNORE INTO Categories (name) VALUES (?)", (cat,))
        cursor.execute("SELECT id FROM Categories WHERE name=?", (cat,))
        category_ids[cat] = cursor.fetchone()['id']

    # Customers
    customers_to_add = []
    for _ in range(NUM_CUSTOMERS):
        city, state = random.choice(list(CITIES_STATES.items()))
        customers_to_add.append((
            f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}",
            f"{random.randint(6, 9)}{random.randint(100000000, 999999999)}",
            f"{city} Main Road",
            state
        ))
    cursor.executemany("INSERT INTO Customers (name, phone, address, place_of_supply) VALUES (?, ?, ?, ?)", customers_to_add)

    # Items
    items_to_add = []
    item_names = set()
    while len(items_to_add) < NUM_ITEMS:
        name = f"{random.choice(ITEM_ADJECTIVES)} {random.choice(ITEM_TYPES)} {random.choice(ITEM_SUFFIXES)}"
        if name in item_names:
            continue
        item_names.add(name)

        purchase_price = round(random.uniform(50.0, 500.0), 2)
        sale_price = round(purchase_price * random.uniform(1.5, 2.5), 2)
        items_to_add.append((
            name, '3304', 'PCS', sale_price * 1.2, purchase_price, sale_price,
            random.choice([5.0, 12.0, 18.0]), random.choice(list(category_ids.values())), random.choice([True, False])
        ))
    cursor.executemany("""
        INSERT INTO Items (name, hsn_code, default_unit, default_mrp, purchase_price,
                           default_sale_price, default_tax_rate, category_id, inclusive_of_tax)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, items_to_add)
    print(f"✅ Seeded {NUM_CUSTOMERS} customers and {NUM_ITEMS} items.")

def seed_invoices(cursor):
    print(f"\n⏳ Generating approx. {INVOICES_PER_MONTH_AVG * MONTHS_TO_GENERATE} invoices...")
    start_time = time.time()
    cursor.execute("SELECT id FROM Customers")
    customer_ids = [row['id'] for row in cursor.fetchall()]
    cursor.execute("SELECT id, default_sale_price, default_tax_rate, default_unit FROM Items")
    items = [dict(row) for row in cursor.fetchall()]
    
    invoice_counters = {}
    total_invoices_created = 0
    
    # Start generating from MONTHS_TO_GENERATE months ago
    current_date = datetime.now().replace(day=1) - relativedelta(months=MONTHS_TO_GENERATE - 1)

    for _ in range(MONTHS_TO_GENERATE):
        # Determine the financial year string based on the current month
        year = current_date.year
        month = current_date.month
        if month < 4:
            fy_str = f"FY{str(year-1)[-2:]}-{str(year)[-2:]}"
        else:
            fy_str = f"FY{str(year)[-2:]}-{str(year+1)[-2:]}"
        
        # Reset invoice counter for the new financial year
        if fy_str not in invoice_counters:
            invoice_counters[fy_str] = 1

        invoices_this_month = random.randint(INVOICES_PER_MONTH_AVG - 20, INVOICES_PER_MONTH_AVG + 20)
        
        # Ensure we don't go past the current date if generating for the present month
        end_of_month = (current_date.replace(day=28) + relativedelta(days=4)).replace(day=1) - relativedelta(days=1)
        if datetime.now() < end_of_month:
            end_of_month = datetime.now()

        for _ in range(invoices_this_month):
            # Ensure the generated date doesn't exceed the end of the month or today's date
            if current_date > end_of_month:
                break
            
            invoice_date = current_date
            customer_id = random.choice(customer_ids)
            
            invoice_num = invoice_counters[fy_str]
            invoice_counters[fy_str] += 1
            invoice_no_str = f"{fy_str}/{invoice_num:04d}"
            
            items_for_this_invoice = random.sample(items, k=random.randint(1, 5))
            invoice_items_to_add = []
            total_taxable = 0
            total_cgst = 0
            total_sgst = 0

            for item in items_for_this_invoice:
                qty = random.randint(1, 10)
                price = item['default_sale_price']
                gst_rate = item['default_tax_rate']
                unit = item['default_unit']
                taxable_amount = qty * price
                tax = taxable_amount * (gst_rate / 100)
                total_amount = taxable_amount + tax
                invoice_items_to_add.append((item['id'], unit, qty, price, gst_rate, tax / 2, tax / 2, 0, total_amount))
                total_taxable += taxable_amount
                total_cgst += tax / 2
                total_sgst += tax / 2
            
            exact_total_value = total_taxable + total_cgst + total_sgst
            rounded_total_value = round(exact_total_value)
            round_off_amount = rounded_total_value - exact_total_value
            
            cursor.execute("""
                INSERT INTO Invoices 
                (invoice_no, date, customer_id, sale_type, status, total_value, taxable_value, cgst, sgst, igst, cess, round_off) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (invoice_no_str, invoice_date.strftime('%Y-%m-%d'), customer_id, 'CASH', 'PAID', rounded_total_value, total_taxable, total_cgst, total_sgst, 0, 0, round_off_amount))
            
            invoice_id = cursor.lastrowid
            for item_data in invoice_items_to_add:
                cursor.execute("INSERT INTO Invoice_Items (invoice_id, item_id, unit, quantity, price_per_unit, gst_rate, cgst_amount, sgst_amount, igst_amount, total_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", (invoice_id, *item_data))
            total_invoices_created += 1

            # Increment the current date by a random number of hours to simulate passing time
            current_date += relativedelta(hours=random.randint(1, 18))

        print(f"  - Generated {invoices_this_month} invoices for {current_date.strftime('%B %Y')}")
        # Move to the next month for the next loop iteration
        current_date = (current_date.replace(day=28) + relativedelta(days=4)).replace(day=1)

    end_time = time.time()
    print(f"\n✅ Successfully generated {total_invoices_created} invoices in {end_time - start_time:.2f} seconds.")

# --- MAIN EXECUTION ---
if __name__ == '__main__':
    if apply_schema():
        clear_all_data()
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            seed_base_data(cursor)
            seed_invoices(cursor)
            conn.commit()
            print("\n🎉 Database seeding complete!")
        except Exception as e:
            print(f"\n❌ An error occurred during seeding: {e}")
            conn.rollback()
        finally:
            conn.close()