import sqlite3
from flask import Flask, jsonify, request, render_template, Response
from flask_cors import CORS
from datetime import datetime, timedelta
import re
from weasyprint import HTML
from num2words import num2words

# --- Flask App Setup ---
app = Flask(__name__, template_folder='templates')
CORS(app)

# --- Database Configuration ---
DB_FILE = 'invoice_app.db'

def get_db_connection():
    """Establishes a connection to the SQLite database."""
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def calculate_dashboard_kpis(start_date, end_date):
    """A helper function to calculate total sales, profit, and invoice count for a given date range."""
    if not start_date or not end_date:
        return {'total_sales': 0, 'total_profit': 0, 'total_invoices': 0}

    conn = get_db_connection()
    cursor = conn.cursor()
    
    start_date_str = start_date.strftime('%Y-%m-%d')
    end_date_str = end_date.strftime('%Y-%m-%d')

    cursor.execute("SELECT SUM(total_value), COUNT(id) FROM Invoices WHERE date BETWEEN ? AND ?", (start_date_str, end_date_str))
    result = cursor.fetchone()
    total_sales = result[0] if result and result[0] is not None else 0
    total_invoices = result[1] if result and result[1] is not None else 0

    cursor.execute("""
        SELECT SUM(ii.quantity * (ii.price_per_unit - i.purchase_price)) 
        FROM Invoice_Items ii
        JOIN Items i ON ii.item_id = i.id
        JOIN Invoices inv ON ii.invoice_id = inv.id
        WHERE inv.date BETWEEN ? AND ? AND i.purchase_price IS NOT NULL
    """, (start_date_str, end_date_str))
    profit_result = cursor.fetchone()
    total_profit = profit_result[0] if profit_result and profit_result[0] is not None else 0
    
    conn.close()
    return {'total_sales': total_sales, 'total_profit': total_profit, 'total_invoices': total_invoices}


# --- API Endpoints ---

@app.route('/api/invoices/<int:invoice_id>', methods=['DELETE'])
def delete_invoice(invoice_id):
    """Deletes an invoice and its associated items from the database."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM Invoices WHERE id = ?", (invoice_id,))
        conn.commit()
        conn.close()
        if cursor.rowcount == 0:
            return jsonify({'error': 'Invoice not found'}), 404
        return jsonify({'message': 'Invoice deleted successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/invoices', methods=['GET'])
def get_invoices():
    """Fetches a list of invoices with customer names, supporting search, date filtering, and limit."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    search_term = request.args.get('search', '')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    limit = request.args.get('limit')

    params = []
    query = """
        SELECT i.id, i.invoice_no, i.date, i.total_value, i.status, c.name as customer_name
        FROM Invoices i JOIN Customers c ON i.customer_id = c.id
    """
    conditions = []
    if search_term:
        conditions.append("(i.invoice_no LIKE ? OR c.name LIKE ? OR i.total_value LIKE ?)")
        params.extend([f'%{search_term}%', f'%{search_term}%', f'%{search_term}%'])
    if start_date:
        conditions.append("i.date >= ?")
        params.append(start_date)
    if end_date:
        conditions.append("i.date <= ?")
        params.append(end_date)
    
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    
    query += " ORDER BY i.date DESC, i.id DESC"
    
    if limit:
        query += " LIMIT ?;"
        params.append(int(limit))
    else:
        query += ";"

    cursor.execute(query, params)
    invoices = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(invoices)


@app.route('/api/sales_data', methods=['GET'])
def get_sales_data():
    period = request.args.get('period', 'this-month')
    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')

    today = datetime.now()
    
    if period == 'custom' and start_date_str and end_date_str:
        current_start = datetime.strptime(start_date_str, '%Y-%m-%d')
        current_end = datetime.strptime(end_date_str, '%Y-%m-%d')
        prev_start, prev_end = None, None
    else:
        if period == 'this-month':
            current_start = today.replace(day=1)
            current_end = today
            prev_end = current_start - timedelta(days=1)
            prev_start = prev_end.replace(day=1)
        elif period == 'last-month':
            current_end = today.replace(day=1) - timedelta(days=1)
            current_start = current_end.replace(day=1)
            prev_end = current_start - timedelta(days=1)
            prev_start = prev_end.replace(day=1)
        elif period == 'this-year':
            current_start = today.replace(month=1, day=1)
            current_end = today
            prev_end = current_start - timedelta(days=1)
            prev_start = prev_end.replace(month=1, day=1)
        else: 
            current_start = today.replace(day=1)
            current_end = today
            prev_end = current_start - timedelta(days=1)
            prev_start = prev_end.replace(day=1)

    kpis = calculate_dashboard_kpis(current_start, current_end)
    previous_kpis = calculate_dashboard_kpis(prev_start, prev_end) if prev_start else {'total_sales': 0}

    change_string = "N/A"
    if previous_kpis['total_sales'] > 0:
        change = ((kpis['total_sales'] - previous_kpis['total_sales']) / previous_kpis['total_sales']) * 100
        change_string = f"{'+' if change >= 0 else ''}{change:.0f}%"
    elif kpis['total_sales'] > 0:
        change_string = "+100%"

    time_unit = 'day'
    date_format_for_query = '%Y-%m-%d'
    if (current_end - current_start).days > 60:
        time_unit = 'month'
        date_format_for_query = '%Y-%m-01'

    conn = get_db_connection()
    cursor = conn.cursor()
    query = f"SELECT STRFTIME('{date_format_for_query}', date) as period, SUM(total_value) as total_sales FROM Invoices WHERE date BETWEEN ? AND ? GROUP BY period ORDER BY period;"
    cursor.execute(query, (current_start.strftime('%Y-%m-%d'), current_end.strftime('%Y-%m-%d')))
    
    sales_data = cursor.fetchall()
    sales_dict = {row['period']: row['total_sales'] for row in sales_data}
    
    labels, data_points = [], []
    
    if time_unit == 'day':
        delta = (current_end - current_start).days + 1
        for i in range(delta):
            day = current_start + timedelta(days=i)
            day_str = day.strftime('%Y-%m-%d')
            labels.append(day_str)
            data_points.append(sales_dict.get(day_str, 0))
    else: 
        month_iter = current_start.replace(day=1)
        while month_iter <= current_end:
            month_str = month_iter.strftime('%Y-%m-01')
            labels.append(month_str)
            data_points.append(sales_dict.get(month_str, 0))
            next_month = (month_iter.replace(day=28) + timedelta(days=4)).replace(day=1)
            month_iter = next_month

    conn.close()
    
    response_data = {
        'labels': labels, 
        'data': data_points, 
        'total': kpis['total_sales'],
        'total_profit': kpis['total_profit'],
        'total_invoices': kpis['total_invoices'],
        'change': change_string,
        'time_unit': time_unit
    }
    return jsonify(response_data)


@app.route('/api/financial_year_summary', methods=['GET'])
def get_financial_year_summary():
    today = datetime.now()
    if today.month >= 4:
        fy_start = today.replace(month=4, day=1)
    else:
        fy_start = today.replace(year=today.year - 1, month=4, day=1)
    fy_end = today
    kpis = calculate_dashboard_kpis(fy_start, fy_end)
    return jsonify({'total_sales': kpis['total_sales'], 'total_profit': kpis['total_profit']})

def get_pdf_data(invoice_id):
    """Fetches all data needed for any PDF template."""
    conn = get_db_connection()
    data = {}
    
    invoice = conn.execute('SELECT * FROM Invoices WHERE id = ?', (invoice_id,)).fetchone()
    if not invoice:
        conn.close()
        return None
    data['invoice'] = dict(invoice)
        
    data['customer'] = dict(conn.execute('SELECT * FROM Customers WHERE id = ?', (invoice['customer_id'],)).fetchone())
    data['business'] = dict(conn.execute('SELECT * FROM Business LIMIT 1').fetchone())
    data['items'] = [dict(row) for row in conn.execute('SELECT ii.*, i.name, i.hsn_code FROM Invoice_Items ii JOIN Items i ON ii.item_id = i.id WHERE ii.invoice_id = ?', (invoice_id,)).fetchall()]

    data['total_quantity'] = sum(item['quantity'] for item in data['items'])
    
    tax_summary = {}
    for item in data['items']:
        rate = item['gst_rate']
        if rate not in tax_summary:
            tax_summary[rate] = {'cgst': 0, 'sgst': 0}
        tax_summary[rate]['cgst'] += item['cgst_amount']
        tax_summary[rate]['sgst'] += item['sgst_amount']
    data['tax_summary'] = tax_summary
    
    amount_in_rupees = int(invoice['total_value'])
    data['amount_in_words'] = f"{num2words(amount_in_rupees, lang='en_IN').title()} Rupees Only"
    
    conn.close()
    return data

def create_pdf_response(template_name, data):
    """Renders an HTML template and converts it to a PDF response."""
    if not data:
        return "Invoice not found", 404
    
    html = render_template(template_name, **data)
    pdf = HTML(string=html).write_pdf()
    
    filename = f'invoice_{data["invoice"]["invoice_no"].replace("/", "-")}.pdf'
    return Response(pdf, mimetype='application/pdf', headers={
        'Content-Disposition': f'inline; filename={filename}'
    })

@app.route('/api/invoices/<int:invoice_id>/pdf')
def generate_invoice_pdf(invoice_id):
    theme = request.args.get('theme', 'default')
    
    valid_themes = ['default', 'modern', 'minimalist', 'classic', 'creative', 'technical']
    if theme not in valid_themes:
        return "Invalid theme selected", 400

    template_name = f"invoice_pdf_{theme}.html" if theme != 'default' else "invoice_pdf.html"
    
    pdf_data = get_pdf_data(invoice_id)
    if not pdf_data:
        return "Invoice not found", 404

    html = render_template(template_name, **pdf_data)
    pdf = HTML(string=html).write_pdf()
    
    filename = f'invoice_{pdf_data["invoice"]["invoice_no"].replace("/", "-")}.pdf'
    return Response(pdf, mimetype='application/pdf', headers={
        'Content-Disposition': f'inline; filename={filename}'
    })

# --- START: MODIFIED/NEW CUSTOMER AND ITEM ENDPOINTS ---

@app.route('/api/customers', methods=['GET', 'POST'])
def handle_customers():
    """Handles fetching a paginated list of customers and creating new ones."""
    conn = get_db_connection()
    cursor = conn.cursor()

    if request.method == 'POST':
        data = request.get_json()
        if not data or not data.get('name') or not data.get('address'):
            return jsonify({'error': 'Name and Address are required'}), 400
        try:
            cursor.execute(
                "INSERT INTO Customers (name, phone, gstin, address, place_of_supply) VALUES (?, ?, ?, ?, ?)",
                (data['name'], data.get('phone'), data.get('gstin'), data['address'], data['place_of_supply'])
            )
            new_customer_id = cursor.lastrowid
            conn.commit()
            cursor.execute("SELECT * FROM Customers WHERE id = ?", (new_customer_id,))
            new_customer = dict(cursor.fetchone())
            conn.close()
            return jsonify(new_customer), 201
        except sqlite3.IntegrityError:
            conn.close()
            return jsonify({'error': 'A customer with this name or phone might already exist'}), 409

    # GET request logic (now with pagination and improved search)
    search_term = request.args.get('search', '')
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 15)) # Default to 15 per page
    offset = (page - 1) * limit

    params = []
    count_params = []
    
    base_query = "FROM Customers"
    conditions = []

    if search_term:
        conditions.append("(name LIKE ? OR phone LIKE ? OR gstin LIKE ?)")
        search_like = f'%{search_term}%'
        params.extend([search_like, search_like, search_like])
        count_params.extend([search_like, search_like, search_like])

    if conditions:
        base_query += " WHERE " + " AND ".join(conditions)

    count_query = "SELECT COUNT(id) " + base_query
    total_customers = cursor.execute(count_query, count_params).fetchone()[0]

    data_query = "SELECT * " + base_query + " ORDER BY name LIMIT ? OFFSET ?"
    params.extend([limit, offset])
    cursor.execute(data_query, params)
    
    customers = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    return jsonify({
        'customers': customers,
        'total': total_customers,
        'page': page,
        'limit': limit
    })

@app.route('/api/customers/<int:customer_id>', methods=['GET', 'PUT', 'DELETE'])
def handle_customer_by_id(customer_id):
    """Handles GET, PUT, and DELETE for a single customer."""
    conn = get_db_connection()
    cursor = conn.cursor()

    if request.method == 'GET':
        customer = cursor.execute('SELECT * FROM Customers WHERE id = ?', (customer_id,)).fetchone()
        conn.close()
        if customer is None:
            return jsonify({'error': 'Customer not found'}), 404
        return jsonify(dict(customer))

    if request.method == 'PUT':
        data = request.get_json()
        if not data or not data.get('name') or not data.get('address'):
            return jsonify({'error': 'Name and Address are required'}), 400
        try:
            cursor.execute(
                """UPDATE Customers 
                   SET name = ?, phone = ?, gstin = ?, address = ?, place_of_supply = ?
                   WHERE id = ?""",
                (data['name'], data.get('phone'), data.get('gstin'), data['address'], data['place_of_supply'], customer_id)
            )
            conn.commit()
            if cursor.rowcount == 0:
                conn.close()
                return jsonify({'error': 'Customer not found'}), 404
            
            cursor.execute("SELECT * FROM Customers WHERE id = ?", (customer_id,))
            updated_customer = dict(cursor.fetchone())
            conn.close()
            return jsonify(updated_customer)
        except Exception as e:
            conn.close()
            return jsonify({'error': str(e)}), 500

    if request.method == 'DELETE':
        try:
            invoice_count = cursor.execute("SELECT COUNT(id) FROM Invoices WHERE customer_id = ?", (customer_id,)).fetchone()[0]
            if invoice_count > 0:
                return jsonify({'error': f'Cannot delete. Customer has {invoice_count} associated invoice(s).'}), 409
            
            cursor.execute("DELETE FROM Customers WHERE id = ?", (customer_id,))
            conn.commit()
            if cursor.rowcount == 0:
                return jsonify({'error': 'Customer not found'}), 404
            return jsonify({'message': 'Customer deleted successfully'}), 200
        except Exception as e:
            return jsonify({'error': str(e)}), 500
        finally:
            conn.close()


@app.route('/api/items', methods=['GET', 'POST'])
def handle_items():
    """Handles fetching and creating items."""
    conn = get_db_connection()
    cursor = conn.cursor()

    if request.method == 'POST':
        data = request.get_json()
        if not data or not data.get('name'):
            return jsonify({'error': 'Item Name is required'}), 400
        try:
            cursor.execute(
                """
                INSERT INTO Items (name, hsn_code, default_unit, default_mrp, purchase_price, default_sale_price, default_tax_rate, inclusive_of_tax)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    data['name'], data.get('hsn_code'), data.get('default_unit'),
                    data.get('default_mrp'), data.get('purchase_price'),
                    data.get('default_sale_price'), data.get('default_tax_rate'),
                    data.get('inclusive_of_tax', False)
                )
            )
            new_item_id = cursor.lastrowid
            conn.commit()

            cursor.execute("SELECT * FROM Items WHERE id = ?", (new_item_id,))
            new_item = dict(cursor.fetchone())
            conn.close()
            return jsonify(new_item), 201
        except sqlite3.IntegrityError:
            conn.close()
            return jsonify({'error': 'An item with this name might already exist'}), 409
        except Exception as e:
            conn.close()
            return jsonify({'error': f'Database error: {e}'}), 500

    # GET request logic
    search_term = request.args.get('search', '')
    if search_term:
        query = "SELECT * FROM Items WHERE name LIKE ? LIMIT 20"
        cursor.execute(query, (f'%{search_term}%',))
    else:
        query = "SELECT * FROM Items LIMIT 20"
        cursor.execute(query)
    items = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(items)


@app.route('/api/units', methods=['GET'])
def get_units():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM Units ORDER BY name")
    units = [row['name'] for row in cursor.fetchall()]
    conn.close()
    return jsonify(units)

@app.route('/api/invoice_prefixes', methods=['GET'])
def get_invoice_prefixes():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM Invoice_Prefixes ORDER BY is_default DESC, prefix DESC")
    prefixes = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(prefixes)

@app.route('/api/latest_invoice_number', methods=['GET'])
def get_latest_invoice_number():
    prefix = request.args.get('prefix')
    if not prefix:
        return jsonify({'error': 'Prefix is required'}), 400
    conn = get_db_connection()
    cursor = conn.cursor()
    query = "SELECT invoice_no FROM Invoices WHERE invoice_no LIKE ? ORDER BY CAST(SUBSTR(invoice_no, INSTR(invoice_no, '/') + 1) AS INTEGER) DESC LIMIT 1"
    cursor.execute(query, (f'{prefix}%',))
    last_invoice = cursor.fetchone()
    next_num = 1
    if last_invoice:
        last_num_str = re.search(r'/(\d+)$', last_invoice['invoice_no'])
        if last_num_str:
            next_num = int(last_num_str.group(1)) + 1
    conn.close()
    return jsonify({'next_number': f"{next_num:04d}"})

@app.route('/api/invoices', methods=['POST'])
def create_invoice():
    """Creates a new invoice and its associated items."""
    data = request.get_json()
    if not data or not data.get('customer_id') or not data.get('items'):
        return jsonify({'error': 'Missing required invoice data'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Insert into Invoices table
        cursor.execute("""
            INSERT INTO Invoices (invoice_no, date, customer_id, sale_type, notes, 
                                  total_value, taxable_value, cgst, sgst, igst, cess, round_off, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            data['invoice_no'], data['date'], data['customer_id'], data.get('sale_type', 'CASH'),
            data.get('notes'), data['total_value'], data['taxable_value'], data['cgst'],
            data['sgst'], data.get('igst', 0), data.get('cess', 0), data['round_off'], 'PAID'
        ))
        invoice_id = cursor.lastrowid

        # Insert into Invoice_Items table
        items_to_insert = []
        for item in data['items']:
            items_to_insert.append((
                invoice_id, item['item_id'], item.get('quantity', 1), item.get('free_quantity', 0),
                item.get('unit', 'PCS'), item['price_per_unit'], item.get('discount', 0),
                item['gst_rate'], item['cgst_amount'], item['sgst_amount'], item.get('igst_amount', 0),
                item.get('cess_amount', 0), item['total_amount'], item.get('hsn_code')
            ))

        cursor.executemany("""
            INSERT INTO Invoice_Items (invoice_id, item_id, quantity, free_quantity, unit, 
                                       price_per_unit, discount, gst_rate, cgst_amount, 
                                       sgst_amount, igst_amount, cess_amount, total_amount, hsn_code)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, items_to_insert)

        conn.commit()
        return jsonify({'message': 'Invoice created successfully', 'invoice_id': invoice_id}), 201
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/invoices/<int:invoice_id>', methods=['GET'])
def get_invoice_details(invoice_id):
    """Fetches full details for a single invoice for editing."""
    try:
        conn = get_db_connection()
        # Fetch main invoice details
        invoice = conn.execute('SELECT * FROM Invoices WHERE id = ?', (invoice_id,)).fetchone()
        if not invoice:
            return jsonify({'error': 'Invoice not found'}), 404

        # Fetch customer details
        customer = conn.execute('SELECT * FROM Customers WHERE id = ?', (invoice['customer_id'],)).fetchone()
        
        # Fetch invoice items
        items = conn.execute("""
            SELECT ii.*, i.name as item_name, i.default_mrp
            FROM Invoice_Items ii
            JOIN Items i ON ii.item_id = i.id
            WHERE ii.invoice_id = ?
        """, (invoice_id,)).fetchall()

        conn.close()

        # Prepare the response
        response_data = {
            'invoice': dict(invoice),
            'customer': dict(customer),
            'items': [dict(item) for item in items]
        }
        return jsonify(response_data)

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/invoices/<int:invoice_id>', methods=['PUT'])
def update_invoice(invoice_id):
    """Updates an existing invoice."""
    data = request.get_json()
    if not data or not data.get('customer_id') or not data.get('items'):
        return jsonify({'error': 'Missing required invoice data'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Start a transaction
        cursor.execute("BEGIN TRANSACTION;")

        # 1. Delete old invoice items
        cursor.execute("DELETE FROM Invoice_Items WHERE invoice_id = ?", (invoice_id,))

        # 2. Update the main invoice table
        cursor.execute("""
            UPDATE Invoices 
            SET invoice_no = ?, date = ?, customer_id = ?, sale_type = ?, notes = ?, 
                total_value = ?, taxable_value = ?, cgst = ?, sgst = ?, igst = ?, 
                cess = ?, round_off = ?, status = ?
            WHERE id = ?
        """, (
            data['invoice_no'], data['date'], data['customer_id'], data.get('sale_type', 'CASH'),
            data.get('notes'), data['total_value'], data['taxable_value'], data['cgst'],
            data['sgst'], data.get('igst', 0), data.get('cess', 0), data['round_off'], 'PAID',
            invoice_id
        ))

        # 3. Insert the new/updated invoice items
        items_to_insert = []
        for item in data['items']:
            items_to_insert.append((
                invoice_id, item['item_id'], item.get('quantity', 1), item.get('free_quantity', 0),
                item.get('unit', 'PCS'), item['price_per_unit'], item.get('discount', 0),
                item['gst_rate'], item['cgst_amount'], item['sgst_amount'], item.get('igst_amount', 0),
                item.get('cess_amount', 0), item['total_amount'], item.get('hsn_code')
            ))

        cursor.executemany("""
            INSERT INTO Invoice_Items (invoice_id, item_id, quantity, free_quantity, unit, 
                                       price_per_unit, discount, gst_rate, cgst_amount, 
                                       sgst_amount, igst_amount, cess_amount, total_amount, hsn_code)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, items_to_insert)

        conn.commit()
        return jsonify({'message': 'Invoice updated successfully', 'invoice_id': invoice_id}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


if __name__ == '__main__':
    print("Starting Flask server...")
    app.run(debug=True, port=5000)
