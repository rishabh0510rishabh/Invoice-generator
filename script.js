document.addEventListener('DOMContentLoaded', () => {
    // --- GLOBAL STATE ---
    let salesChart;
    let currentInvoiceData = [];
    let currentSort = { column: 'invoice_no', order: 'desc' };
    let activeTab = sessionStorage.getItem('activeTab') || 'home';
    const API_BASE_URL = 'http://127.0.0.1:5000/api';
    let invoiceIdToDelete = null;
    let currentCustomerId = null;
    let customerCurrentPage = 1;
    let customerTotalPages = 1;
    const CUSTOMERS_PER_PAGE = 15;
    // NEW: Item Tab State
    let currentItemId = null;
    let itemCurrentPage = 1;
    let itemTotalPages = 1;
    const ITEMS_PER_PAGE = 15;
    let unitList = [];
    const GST_RATES = [0, 5, 12, 18, 28];
    const GST_STATE_CODES = {"01":"Jammu and Kashmir","02":"Himachal Pradesh","03":"Punjab","04":"Chandigarh","05":"Uttarakhand","06":"Haryana","07":"Delhi","08":"Rajasthan","09":"Uttar Pradesh","10":"Bihar","11":"Sikkim","12":"Arunachal Pradesh","13":"Nagaland","14":"Manipur","15":"Mizoram","16":"Tripura","17":"Meghalaya","18":"Assam","19":"West Bengal","20":"Jharkhand","21":"Odisha","22":"Chhattisgarh","23":"Madhya Pradesh","24":"Gujarat","25":"Daman and Diu","26":"Dadra and Nagar Haveli","27":"Maharashtra","28":"Andhra Pradesh (Old)","29":"Karnataka","30":"Goa","31":"Lakshadweep","32":"Kerala","33":"Tamil Nadu","34":"Puducherry","35":"Andaman and Nicobar Islands","36":"Telangana","37":"Andhra Pradesh (New)","97":"Other Territory"};

    // --- ELEMENT SELECTORS ---
    const root = document.body;
    const tabBtns = document.querySelectorAll('.tab-btn');
    const subMenuBtns = document.querySelectorAll('.sub-menu-btn');
    const tiles = document.querySelectorAll('.tile');
    const themeToggle = document.getElementById('theme-toggle');
    const defaultPriceModeToggle = document.getElementById('default-price-mode-toggle');
    const collapseBtn = document.querySelector('.collapse-btn');
    const sidebar = document.querySelector('.sidebar');
    const confirmationModal = document.getElementById('confirmation-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');
    const modalConfirmBtn = document.getElementById('modal-confirm-btn');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    const closeModalBtn = document.getElementById('close-modal-btn');

    // Dashboard Elements
    const timeframeSelect = document.getElementById('timeframe-select');
    const customDateRangePicker = document.getElementById('custom-date-range-picker');
    const customStartDateInput = document.getElementById('custom-start-date');
    const customEndDateInput = document.getElementById('custom-end-date');
    const recentInvoicesList = document.getElementById('recent-invoices-list');

    // Sale Tab Elements
    const invoiceListBody = document.getElementById('invoice-list-body');
    const invoiceSearchInput = document.getElementById('invoice-search');
    const dateRangeFilter = document.getElementById('date-range-filter');
    const customDateContainer = document.getElementById('custom-date-container');
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    const filteredSalesTotalEl = document.getElementById('filtered-sales-total');
    const saleTableHead = document.querySelector('#sale .data-table thead');

    // Customer Tab Elements
    const customerListBody = document.getElementById('customer-list-body');
    const customerSearchInput = document.getElementById('customer-search-main');
    const addNewCustomerBtn = document.getElementById('add-new-customer-btn');
    const customerModal = document.getElementById('customer-modal');
    const customerModalTitle = document.getElementById('customer-modal-title');
    const closeCustomerModalBtn = document.getElementById('close-customer-modal-main');
    const saveCustomerBtn = document.getElementById('save-customer-btn-main');
    const cancelCustomerBtn = document.getElementById('cancel-customer-btn-main');
    const customerForm = document.getElementById('customer-form');
    const customerIdInput = document.getElementById('customer-id-input');
    const customerNameInput = document.getElementById('customer-name-main');
    const customerAddressInput = document.getElementById('customer-address-main');
    const customerPhoneInput = document.getElementById('customer-phone-main');
    const customerGstinInput = document.getElementById('customer-gstin-main');
    const customerPosSelect = document.getElementById('customer-pos-main');
    const customerFormError = document.getElementById('customer-form-error-main');

    // NEW: Item Tab Elements
    const itemListBody = document.getElementById('item-list-body');
    const itemSearchInput = document.getElementById('item-search-main');
    const addNewItemBtn = document.getElementById('add-new-item-btn');
    const itemModal = document.getElementById('item-modal');
    const itemModalTitle = document.getElementById('item-modal-title');
    const closeItemModalBtn = document.getElementById('close-item-modal-main');
    const saveItemBtn = document.getElementById('save-item-btn-main');
    const cancelItemBtn = document.getElementById('cancel-item-btn-main');
    const itemForm = document.getElementById('item-form');
    const itemIdInput = document.getElementById('item-id-input');
    const itemNameInput = document.getElementById('item-name-main');
    const itemHsnInput = document.getElementById('item-hsn-main');
    const itemUnitSelect = document.getElementById('item-unit-main');
    const itemMrpInput = document.getElementById('item-mrp-main');
    const itemPurchasePriceInput = document.getElementById('item-purchase-price-main');
    const itemSalePriceInput = document.getElementById('item-price-main');
    const itemTaxSelect = document.getElementById('item-tax-main');
    const itemInclusiveToggle = document.getElementById('item-inclusive-main');
    const itemFormError = document.getElementById('item-form-error-main');

    // NEW: Backup Tab Elements
    const backupDbBtn = document.getElementById('backup-db-btn');
    const restoreDbBtn = document.getElementById('restore-db-btn');
    const restoreDbInput = document.getElementById('restore-db-input');
    const restoreFileName = document.getElementById('restore-file-name');

    // --- HELPER FUNCTIONS ---
    const debounce = (func, delay) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    };

    const formatDate = (date) => {
        if (!date) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // --- INITIALIZATION ---
    async function initializePage() {
        document.body.classList.add('pre-init');
        initializeChart();
        applyTheme();
        applyDefaultPriceModeSetting();
        
        try {
            const unitsResponse = await fetch(`${API_BASE_URL}/units`);
            unitList = await unitsResponse.json();
        } catch (error) {
            console.error("Failed to fetch units:", error);
            unitList = ["PCS", "BTL", "KG"]; // Fallback
        }
        
        setupEventListeners();
        
        updateDashboardData('this-month');
        fetchRecentInvoices();
        fetchFinancialYearSummary();

        activateTab(activeTab);
        document.body.classList.remove('pre-init');
    }
    
    // --- TAB & THEME MANAGEMENT ---
    function activateTab(tabName) {
        tabBtns.forEach(btn => btn.classList.remove('active'));
        const targetBtn = Array.from(tabBtns).find(btn => btn.dataset.tab === tabName);
        if (targetBtn) targetBtn.classList.add('active');

        tiles.forEach(tile => tile.classList.remove('active'));
        const targetTile = document.getElementById(tabName);
        if (targetTile) targetTile.classList.add('active');

        activeTab = tabName;
        sessionStorage.setItem('activeTab', activeTab);

        if (tabName === 'sale') fetchInvoices();
        else if (tabName === 'customer') fetchCustomers();
        else if (tabName === 'items') fetchItems();
    }
    // ... (Existing applyTheme, applyDefaultPriceModeSetting functions) ...
    function applyTheme() {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        root.className = '';
        root.classList.add(savedTheme);
        if (themeToggle) themeToggle.checked = (savedTheme === 'dark');
    }

    function applyDefaultPriceModeSetting() {
        if (defaultPriceModeToggle) {
            const defaultMode = localStorage.getItem('defaultPriceMode') || 'inclusive';
            defaultPriceModeToggle.checked = (defaultMode === 'inclusive');
        }
    }

    // --- DASHBOARD FUNCTIONS ---
    // ... (All existing dashboard functions remain here) ...
    function initializeChart() {
        const salesChartCanvas = document.getElementById('sales-chart');
        if (!salesChartCanvas) return;
        salesChart = new Chart(salesChartCanvas, {
            type: 'line',
            data: { labels: [], datasets: [{ label: 'Total Sale', data: [], borderColor: '#007bff', backgroundColor: 'rgba(0, 123, 255, 0.1)', fill: true, tension: 0.4 }] },
            options: {
                responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, ticks: { callback: (value) => '₹' + value.toLocaleString('en-IN') } }, x: { type: 'time', time: { unit: 'day', tooltipFormat: 'MMM dd, yyyy', displayFormats: { day: 'MMM dd' } }, grid: { display: false } } }
            }
        });
    }
    async function updateDashboardData(period, startDate = null, endDate = null) {
        if (!salesChart) return;
        let url = `${API_BASE_URL}/sales_data?period=${period}`;
        if (period === 'custom' && startDate && endDate) {
            url += `&start_date=${startDate}&end_date=${endDate}`;
        }
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Network response was not ok');
            const dashboardData = await response.json();
            document.getElementById('kpi-total-sales').innerText = dashboardData.total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            document.getElementById('kpi-total-profit').innerText = dashboardData.total_profit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            document.getElementById('kpi-total-invoices').innerText = dashboardData.total_invoices.toLocaleString('en-IN');
            document.getElementById('sales-change').innerText = dashboardData.change;
            const formattedData = dashboardData.data.map((value, index) => ({ x: new Date(dashboardData.labels[index]), y: value }));
            salesChart.data.datasets[0].data = formattedData;
            const timeUnit = dashboardData.time_unit || 'day';
            salesChart.options.scales.x.time.unit = timeUnit;
            salesChart.options.scales.x.time.displayFormats[timeUnit] = timeUnit === 'month' ? 'MMM yyyy' : 'MMM dd';
            salesChart.update();
        } catch (error) {
            console.error('Failed to fetch dashboard data:', error);
        }
    }
    async function fetchFinancialYearSummary() {
        try {
            const response = await fetch(`${API_BASE_URL}/financial_year_summary`);
            if (!response.ok) throw new Error('Network response was not ok');
            const summaryData = await response.json();
            document.getElementById('fy-total-sales').innerText = summaryData.total_sales.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            document.getElementById('fy-total-profit').innerText = summaryData.total_profit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        } catch (error) {
            console.error('Failed to fetch financial year summary:', error);
        }
    }
    async function fetchRecentInvoices() {
        try {
            const response = await fetch(`${API_BASE_URL}/invoices?limit=5`);
            if (!response.ok) throw new Error('Network response was not ok');
            const invoices = await response.json();
            renderRecentInvoices(invoices);
        } catch (error) {
            console.error('Failed to fetch recent invoices:', error);
            recentInvoicesList.innerHTML = '<li>Error loading invoices.</li>';
        }
    }
    function renderRecentInvoices(invoices) {
        recentInvoicesList.innerHTML = '';
        if (invoices.length === 0) {
            recentInvoicesList.innerHTML = '<li>No recent invoices found.</li>';
            return;
        }
        invoices.forEach(invoice => {
            const li = document.createElement('li');
            li.innerHTML = `<div><div class="invoice-list-customer">${invoice.customer_name}</div><div class="invoice-list-number" style="font-size: 0.8em; opacity: 0.7;">#${invoice.invoice_no}</div></div><div class="invoice-list-amount">₹${parseFloat(invoice.total_value).toLocaleString('en-IN')}</div>`;
            recentInvoicesList.appendChild(li);
        });
    }

    // --- SALE TAB FUNCTIONS ---
    // ... (All existing sale tab functions remain here) ...
    async function fetchInvoices() {
        const searchTerm = invoiceSearchInput.value;
        const startDate = startDateInput.value;
        const endDate = endDateInput.value;
        try {
            const response = await fetch(`${API_BASE_URL}/invoices?search=${searchTerm}&start_date=${startDate}&end_date=${endDate}`);
            if (!response.ok) throw new Error('Network response was not ok');
            currentInvoiceData = await response.json();
            sortAndRenderInvoices();
        } catch (error) {
            console.error('Failed to fetch invoices:', error);
            invoiceListBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Error loading invoices.</td></tr>';
        }
    }
    function sortAndRenderInvoices() {
        if (!currentInvoiceData) return;
        const extractInvoiceNumber = (invoiceNo) => {
            const match = invoiceNo.match(/\/(\d+)$/);
            return match ? parseInt(match[1], 10) : 0;
        };
        currentInvoiceData.sort((a, b) => {
            let valA, valB;
            if (currentSort.column === 'total_value') {
                valA = parseFloat(a.total_value);
                valB = parseFloat(b.total_value);
            } else if (currentSort.column === 'invoice_no') {
                valA = extractInvoiceNumber(a.invoice_no);
                valB = extractInvoiceNumber(b.invoice_no);
            } else {
                valA = a[currentSort.column];
                valB = b[currentSort.column];
            }
            if (valA < valB) return currentSort.order === 'asc' ? -1 : 1;
            if (valA > valB) return currentSort.order === 'asc' ? 1 : -1;
            return 0;
        });
        renderInvoices();
    }
    function updateSortState(column, order) {
        currentSort.column = column;
        currentSort.order = order;
        document.querySelectorAll('#sale .data-table th .sort-arrow').forEach(arrow => arrow.textContent = '');
        const activeHeader = document.querySelector(`#sale th[data-sort="${column}"]`);
        if (activeHeader) activeHeader.querySelector('.sort-arrow').textContent = order === 'asc' ? '▲' : '▼';
        sortAndRenderInvoices();
    }
    function renderInvoices() {
        invoiceListBody.innerHTML = '';
        if (currentInvoiceData.length === 0) {
            invoiceListBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No invoices found.</td></tr>';
            filteredSalesTotalEl.textContent = '₹0.00';
            return;
        }
        let totalSales = 0;
        currentInvoiceData.forEach(invoice => {
            totalSales += parseFloat(invoice.total_value);
            const row = document.createElement('tr');
            row.setAttribute('data-invoice-id', invoice.id);
            const statusClass = `status-${invoice.status.toLowerCase()}`;
            row.innerHTML = `<td>${invoice.invoice_no}</td><td>${invoice.customer_name}</td><td>${new Date(invoice.date).toLocaleDateString('en-IN')}</td><td>₹${parseFloat(invoice.total_value).toLocaleString('en-IN')}</td><td><span class="status-badge ${statusClass}">${invoice.status}</span></td><td class="actions-cell"><button class="action-btn edit-btn" title="Edit">✏️</button><button class="action-btn download-pdf-btn" title="Download PDF">📄</button><div class="more-actions-btn"><button class="action-btn" title="More Options">⋮</button><div class="dropdown-menu"><button class="dropdown-item delete-btn" style="color: #dc3545;">Delete</button></div></div></td>`;
            invoiceListBody.appendChild(row);
        });
        filteredSalesTotalEl.textContent = `₹${totalSales.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    }

    // --- CUSTOMER TAB FUNCTIONS ---
    // ... (All existing customer tab functions remain here) ...
    async function fetchCustomers(page = 1) {
        const searchTerm = customerSearchInput.value;
        try {
            const response = await fetch(`${API_BASE_URL}/customers?search=${searchTerm}&page=${page}&limit=${CUSTOMERS_PER_PAGE}`);
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            renderCustomers(data.customers);
            customerCurrentPage = data.page;
            customerTotalPages = Math.ceil(data.total / data.limit);
            renderCustomerPagination();
        } catch (error) {
            console.error('Failed to fetch customers:', error);
            customerListBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Error loading customers.</td></tr>';
        }
    }
    function renderCustomers(customers) {
        customerListBody.innerHTML = '';
        if (customers.length === 0) {
            customerListBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No customers found.</td></tr>';
            return;
        }
        customers.forEach(customer => {
            const row = document.createElement('tr');
            row.setAttribute('data-customer-id', customer.id);
            row.innerHTML = `<td>${customer.name}</td><td>${customer.phone || 'N/A'}</td><td>${customer.gstin || 'N/A'}</td><td>${customer.place_of_supply}</td><td class="actions-cell"><button class="action-btn edit-customer-btn" title="Edit">✏️</button><button class="action-btn delete-customer-btn" title="Delete" style="color: #dc3545;">🗑️</button></td>`;
            customerListBody.appendChild(row);
        });
    }
    function renderCustomerPagination() {
        const paginationFooter = document.querySelector('#customer .pagination-footer');
        paginationFooter.innerHTML = '';
        if (customerTotalPages <= 1) return;
        const prevBtn = document.createElement('button');
        prevBtn.textContent = '‹ Prev';
        prevBtn.className = 'action-button secondary';
        prevBtn.disabled = customerCurrentPage === 1;
        prevBtn.addEventListener('click', () => fetchCustomers(customerCurrentPage - 1));
        paginationFooter.appendChild(prevBtn);
        const pageInfo = document.createElement('span');
        pageInfo.textContent = `Page ${customerCurrentPage} of ${customerTotalPages}`;
        pageInfo.style.margin = '0 15px';
        paginationFooter.appendChild(pageInfo);
        const nextBtn = document.createElement('button');
        nextBtn.textContent = 'Next ›';
        nextBtn.className = 'action-button secondary';
        nextBtn.disabled = customerCurrentPage === customerTotalPages;
        nextBtn.addEventListener('click', () => fetchCustomers(customerCurrentPage + 1));
        paginationFooter.appendChild(nextBtn);
    }
    function showCustomerModal(customer = null) {
        customerForm.reset();
        customerFormError.style.display = 'none';
        customerPosSelect.innerHTML = '<option value="">Select State</option>' + Object.values(GST_STATE_CODES).map(state => `<option value="${state}">${state}</option>`).join('');
        if (customer) {
            currentCustomerId = customer.id;
            customerModalTitle.textContent = 'Edit Customer';
            saveCustomerBtn.textContent = 'Update Customer';
            customerIdInput.value = customer.id;
            customerNameInput.value = customer.name;
            customerAddressInput.value = customer.address;
            customerPhoneInput.value = customer.phone || '';
            customerGstinInput.value = customer.gstin || '';
            customerPosSelect.value = customer.place_of_supply;
        } else {
            currentCustomerId = null;
            customerModalTitle.textContent = 'Add New Customer';
            saveCustomerBtn.textContent = 'Save Customer';
        }
        customerModal.style.display = 'flex';
    }
    function hideCustomerModal() {
        customerModal.style.display = 'none';
    }
    async function handleSaveCustomer() {
        const name = customerNameInput.value.trim();
        const address = customerAddressInput.value.trim();
        const phone = customerPhoneInput.value.trim();
        const gstin = customerGstinInput.value.trim();
        const pos = customerPosSelect.value;
        if (!name || !address || !pos) {
            customerFormError.textContent = 'Name, Address, and Place of Supply are required.';
            customerFormError.style.display = 'block';
            return;
        }
        const customerData = { name, address, phone, gstin, place_of_supply: pos };
        const method = currentCustomerId ? 'PUT' : 'POST';
        const url = currentCustomerId ? `${API_BASE_URL}/customers/${currentCustomerId}` : `${API_BASE_URL}/customers`;
        const actionText = currentCustomerId ? 'updated' : 'created';
        try {
            const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(customerData) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            showNotification(`Customer '${result.name}' ${actionText} successfully.`, 'success');
            hideCustomerModal();
            fetchCustomers(customerCurrentPage);
        } catch (error) {
            customerFormError.textContent = `Error: ${error.message}`;
            customerFormError.style.display = 'block';
        }
    }
    async function handleDeleteCustomer(customerId) {
        const customerRow = customerListBody.querySelector(`tr[data-customer-id="${customerId}"]`);
        const customerName = customerRow ? customerRow.cells[0].textContent : 'the customer';
        showConfirmationModal('delete_customer', { customerId, customerName });
    }

    // --- NEW: ITEM TAB FUNCTIONS ---
    async function fetchItems(page = 1) {
        const searchTerm = itemSearchInput.value;
        try {
            const response = await fetch(`${API_BASE_URL}/items?search=${searchTerm}&page=${page}&limit=${ITEMS_PER_PAGE}`);
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            renderItems(data.items);
            itemCurrentPage = data.page;
            itemTotalPages = Math.ceil(data.total / data.limit);
            renderItemPagination();
        } catch (error) {
            console.error('Failed to fetch items:', error);
            itemListBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Error loading items.</td></tr>';
        }
    }

    function renderItems(items) {
        itemListBody.innerHTML = '';
        if (items.length === 0) {
            itemListBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No items found.</td></tr>';
            return;
        }
        items.forEach(item => {
            const row = document.createElement('tr');
            row.setAttribute('data-item-id', item.id);
            row.innerHTML = `
                <td>${item.name}</td>
                <td>${item.hsn_code || 'N/A'}</td>
                <td>₹${item.default_sale_price.toLocaleString('en-IN')}</td>
                <td>${item.default_tax_rate}%</td>
                <td class="actions-cell">
                    <button class="action-btn edit-item-btn" title="Edit">✏️</button>
                    <button class="action-btn delete-item-btn" title="Delete" style="color: #dc3545;">🗑️</button>
                </td>
            `;
            itemListBody.appendChild(row);
        });
    }

    function renderItemPagination() {
        const paginationFooter = document.querySelector('#items .pagination-footer');
        paginationFooter.innerHTML = '';
        if (itemTotalPages <= 1) return;
        const prevBtn = document.createElement('button');
        prevBtn.textContent = '‹ Prev';
        prevBtn.className = 'action-button secondary';
        prevBtn.disabled = itemCurrentPage === 1;
        prevBtn.addEventListener('click', () => fetchItems(itemCurrentPage - 1));
        paginationFooter.appendChild(prevBtn);
        const pageInfo = document.createElement('span');
        pageInfo.textContent = `Page ${itemCurrentPage} of ${itemTotalPages}`;
        pageInfo.style.margin = '0 15px';
        paginationFooter.appendChild(pageInfo);
        const nextBtn = document.createElement('button');
        nextBtn.textContent = 'Next ›';
        nextBtn.className = 'action-button secondary';
        nextBtn.disabled = itemCurrentPage === itemTotalPages;
        nextBtn.addEventListener('click', () => fetchItems(itemCurrentPage + 1));
        paginationFooter.appendChild(nextBtn);
    }
    
    function showItemModal(item = null) {
        itemForm.reset();
        itemFormError.style.display = 'none';
        itemUnitSelect.innerHTML = unitList.map(u => `<option value="${u}">${u}</option>`).join('');
        itemTaxSelect.innerHTML = GST_RATES.map(r => `<option value="${r}">${r}%</option>`).join('');

        if (item) {
            currentItemId = item.id;
            itemModalTitle.textContent = 'Edit Item';
            saveItemBtn.textContent = 'Update Item';
            itemIdInput.value = item.id;
            itemNameInput.value = item.name;
            itemHsnInput.value = item.hsn_code || '';
            itemUnitSelect.value = item.default_unit;
            itemMrpInput.value = item.default_mrp;
            itemPurchasePriceInput.value = item.purchase_price || '';
            itemSalePriceInput.value = item.default_sale_price;
            itemTaxSelect.value = item.default_tax_rate;
            itemInclusiveToggle.checked = item.inclusive_of_tax;
        } else {
            currentItemId = null;
            itemModalTitle.textContent = 'Add New Item';
            saveItemBtn.textContent = 'Save Item';
        }
        itemModal.style.display = 'flex';
    }

    function hideItemModal() {
        itemModal.style.display = 'none';
    }

    async function handleSaveItem() {
        if (!itemForm.checkValidity()) {
            itemFormError.textContent = 'Please fill out all required fields.';
            itemFormError.style.display = 'block';
            return;
        }
        const itemData = {
            name: itemNameInput.value.trim(),
            hsn_code: itemHsnInput.value.trim(),
            default_unit: itemUnitSelect.value,
            default_mrp: parseFloat(itemMrpInput.value),
            purchase_price: parseFloat(itemPurchasePriceInput.value) || null,
            default_sale_price: parseFloat(itemSalePriceInput.value),
            default_tax_rate: parseInt(itemTaxSelect.value, 10),
            inclusive_of_tax: itemInclusiveToggle.checked
        };
        const method = currentItemId ? 'PUT' : 'POST';
        const url = currentItemId ? `${API_BASE_URL}/items/${currentItemId}` : `${API_BASE_URL}/items`;
        const actionText = currentItemId ? 'updated' : 'created';
        try {
            const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(itemData) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            showNotification(`Item '${result.name}' ${actionText} successfully.`, 'success');
            hideItemModal();
            fetchItems(itemCurrentPage);
        } catch (error) {
            itemFormError.textContent = `Error: ${error.message}`;
            itemFormError.style.display = 'block';
        }
    }

    async function handleDeleteItem(itemId) {
        const itemRow = itemListBody.querySelector(`tr[data-item-id="${itemId}"]`);
        const itemName = itemRow ? itemRow.cells[0].textContent : 'the item';
        showConfirmationModal('delete_item', { itemId, itemName });
    }


    // --- MODAL & ACTION HANDLERS ---
    function showConfirmationModal(type, data) {
        if (type === 'delete_invoice') {
            const { invoiceId, invoiceIdentifier } = data;
            invoiceIdToDelete = invoiceId; // Keep using this for the handler
            modalTitle.textContent = 'Confirm Deletion';
            modalMessage.textContent = `Are you sure you want to delete ${invoiceIdentifier}? This action cannot be undone.`;
            modalConfirmBtn.className = 'action-button danger';
            modalConfirmBtn.textContent = 'Delete';
        } else if (type === 'delete_customer') {
            const { customerId, customerName } = data;
            modalTitle.textContent = 'Confirm Deletion';
            modalMessage.textContent = `Are you sure you want to delete ${customerName}? This action cannot be undone.`;
            modalConfirmBtn.className = 'action-button danger';
            modalConfirmBtn.textContent = 'Delete';
            // Temporarily re-assign confirm button's action
            modalConfirmBtn.onclick = () => {
                // Restore default action after click
                modalConfirmBtn.onclick = handleDeleteInvoice; 
                handleDeleteCustomerConfirmed(customerId);
            };
        } else if (type === 'delete_item') {
            const { itemId, itemName } = data;
            modalTitle.textContent = 'Confirm Deletion';
            modalMessage.textContent = `Are you sure you want to delete ${itemName}? This action cannot be undone.`;
            modalConfirmBtn.className = 'action-button danger';
            modalConfirmBtn.textContent = 'Delete';
            modalConfirmBtn.onclick = () => {
                modalConfirmBtn.onclick = handleDeleteInvoice;
                handleDeleteItemConfirmed(itemId);
            };
        } else if (type === 'restore_db') {
            modalTitle.textContent = 'Confirm Restore';
            modalMessage.textContent = `This will overwrite all current data with the backup file. This action is irreversible. Are you sure you want to continue?`;
            modalConfirmBtn.className = 'action-button danger';
            modalConfirmBtn.textContent = 'Restore & Overwrite';
            modalConfirmBtn.onclick = () => {
                modalConfirmBtn.onclick = handleDeleteInvoice;
                handleRestoreDbConfirmed();
            };
        }
        confirmationModal.classList.add('show');
    }

    function hideConfirmationModal() {
        confirmationModal.classList.remove('show');
        // Restore default action when modal is hidden
        modalConfirmBtn.onclick = handleDeleteInvoice;
    }
    
    async function handleDeleteCustomerConfirmed(customerId) {
        try {
            const response = await fetch(`${API_BASE_URL}/customers/${customerId}`, { method: 'DELETE' });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            showNotification(result.message, 'success');
            fetchCustomers(customerCurrentPage);
        } catch (error) {
            showNotification(`Error: ${error.message}`, 'error');
        } finally {
            hideConfirmationModal();
        }
    }
    
    async function handleDeleteItemConfirmed(itemId) {
        try {
            const response = await fetch(`${API_BASE_URL}/items/${itemId}`, { method: 'DELETE' });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            showNotification(result.message, 'success');
            fetchItems(itemCurrentPage);
        } catch (error) {
            showNotification(`Error: ${error.message}`, 'error');
        } finally {
            hideConfirmationModal();
        }
    }

    function showNotification(message, type = 'success') {
        const notification = document.getElementById('notification');
        if (!notification) return;
        notification.textContent = message;
        notification.className = `notification ${type}`;
        notification.classList.add('show');
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    async function handleDeleteInvoice() {
        if (!invoiceIdToDelete) return;
        showConfirmationModal('delete_invoice', {
            invoiceId: invoiceIdToDelete,
            invoiceIdentifier: currentInvoiceData.find(inv => inv.id === invoiceIdToDelete)?.invoice_no || 'the invoice'
        });
    }

    // --- EVENT HANDLERS ---
    // ... (Existing tab, theme, dashboard, and sale tab handlers) ...
    function handleTabClick(e) {
        const targetTab = e.currentTarget.dataset.tab;
        const parentContainer = e.currentTarget.parentElement;
        const subMenu = parentContainer.querySelector('.sub-menu');
        document.querySelectorAll('.sub-menu').forEach(menu => {
            if (menu !== subMenu) menu.classList.remove('open');
        });
        if (subMenu) subMenu.classList.toggle('open');
        activateTab(targetTab);
    }
    function handleSubMenuClick(e) {
        e.stopPropagation();
        const subTab = e.currentTarget.dataset.subTab;
        if (subTab === 'add-sale') {
            window.open('invoice.html', '_blank');
        }
    }
    function handleCollapse() {
        sidebar.classList.toggle('collapsed');
        collapseBtn.textContent = sidebar.classList.contains('collapsed') ? '›' : '‹';
    }
    function handleThemeToggle() {
        const newTheme = themeToggle.checked ? 'dark' : 'light';
        root.className = '';
        root.classList.add(newTheme);
        localStorage.setItem('theme', newTheme);
    }
    function handleDefaultPriceModeToggle() {
        const newMode = defaultPriceModeToggle.checked ? 'inclusive' : 'exclusive';
        localStorage.setItem('defaultPriceMode', newMode);
    }
    function handleTimeframeChange() {
        const selectedPeriod = timeframeSelect.value;
        customDateRangePicker.style.display = selectedPeriod === 'custom' ? 'flex' : 'none';
        if (selectedPeriod !== 'custom') updateDashboardData(selectedPeriod);
    }
    function handleDropdownClick(e) {
        const isDropdownButton = e.target.closest('.more-actions-btn');
        document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
            if (!isDropdownButton || menu.parentElement !== isDropdownButton) {
                menu.classList.remove('show', 'drop-up');
            }
        });
        if (isDropdownButton) {
            const menu = isDropdownButton.querySelector('.dropdown-menu');
            if (menu) {
                menu.classList.toggle('show');
                if (menu.classList.contains('show')) {
                    const rect = menu.getBoundingClientRect();
                    if (window.innerHeight - rect.top < Math.min(menu.scrollHeight, window.innerHeight * 0.5) + 16) {
                        menu.classList.add('drop-up');
                    }
                }
            }
        }
    }
    function handleCustomDateChange() {
        const startDate = customStartDateInput.value;
        const endDate = customEndDateInput.value;
        if (startDate && endDate) updateDashboardData('custom', startDate, endDate);
    }
    function handleSaleDateFilterChange() {
        const period = dateRangeFilter.value;
        customDateContainer.style.display = period === 'custom' ? 'block' : 'none';
        if (period !== 'custom') {
            const getDateRangeForFilter = (p) => {
                const now = new Date();
                let start, end;
                switch (p) {
                    case 'this_month': start = new Date(now.getFullYear(), now.getMonth(), 1); end = new Date(now.getFullYear(), now.getMonth() + 1, 0); break;
                    case 'last_month': start = new Date(now.getFullYear(), now.getMonth() - 1, 1); end = new Date(now.getFullYear(), now.getMonth(), 0); break;
                    case 'this_quarter': const q = Math.floor(now.getMonth() / 3); start = new Date(now.getFullYear(), q * 3, 1); end = new Date(now.getFullYear(), q * 3 + 3, 0); break;
                    case 'last_quarter': let y = now.getFullYear(), lq = Math.floor(now.getMonth() / 3) - 1; if (lq < 0) { lq = 3; y -= 1; } start = new Date(y, lq * 3, 1); end = new Date(y, lq * 3 + 3, 0); break;
                    default: return { startDate: '', endDate: '' };
                }
                return { startDate: formatDate(start), endDate: formatDate(end) };
            };
            const dates = getDateRangeForFilter(period);
            startDateInput.value = dates.startDate;
            endDateInput.value = dates.endDate;
            fetchInvoices();
        }
    }
    function handleSortClick(e) {
        const header = e.target.closest('th[data-sort]');
        if (!header) return;
        const column = header.dataset.sort;
        const newOrder = currentSort.column === column && currentSort.order === 'desc' ? 'asc' : 'desc';
        const sortBySelect = document.getElementById('sort-by-select');
        if (sortBySelect) sortBySelect.value = `${column}_${newOrder}`;
        updateSortState(column, newOrder);
    }
    
    // NEW: Backup/Restore Handlers
    async function handleRestoreDbConfirmed() {
        const file = restoreDbInput.files[0];
        const formData = new FormData();
        formData.append('backup_file', file);
        try {
            const response = await fetch(`${API_BASE_URL}/restore`, { method: 'POST', body: formData });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            showNotification(result.message, 'success');
            setTimeout(() => window.location.reload(), 2000);
        } catch (error) {
            showNotification(`Restore failed: ${error.message}`, 'error');
        } finally {
            hideConfirmationModal();
        }
    }


    // --- EVENT LISTENERS SETUP ---
    function setupEventListeners() {
        // ... (Existing listeners for tabs, theme, dashboard, sales) ...
        tabBtns.forEach(btn => btn.addEventListener('click', handleTabClick));
        subMenuBtns.forEach(btn => btn.addEventListener('click', handleSubMenuClick));
        themeToggle?.addEventListener('change', handleThemeToggle);
        defaultPriceModeToggle?.addEventListener('change', handleDefaultPriceModeToggle);
        collapseBtn?.addEventListener('click', handleCollapse);
        timeframeSelect?.addEventListener('change', handleTimeframeChange);
        customStartDateInput?.addEventListener('change', handleCustomDateChange);
        customEndDateInput?.addEventListener('change', handleCustomDateChange);
        document.getElementById('add-sale-btn-home')?.addEventListener('click', () => window.open('invoice.html', '_blank'));
        invoiceSearchInput?.addEventListener('input', debounce(fetchInvoices, 300));
        dateRangeFilter?.addEventListener('change', handleSaleDateFilterChange);
        startDateInput?.addEventListener('change', fetchInvoices);
        endDateInput?.addEventListener('change', fetchInvoices);
        saleTableHead?.addEventListener('click', handleSortClick);
        const sortBySelect = document.getElementById('sort-by-select');
        if (sortBySelect) sortBySelect.addEventListener('change', (e) => { const [col, ord] = e.target.value.split('_'); updateSortState(col, ord); });
        const pdfThemeSelector = document.getElementById('pdf-theme-selector');
        if (pdfThemeSelector) pdfThemeSelector.addEventListener('change', (e) => { if (e.target.name === 'pdf_theme') localStorage.setItem('pdfTheme', e.target.value); });
        
        // Customer Tab Listeners
        addNewCustomerBtn?.addEventListener('click', () => showCustomerModal());
        customerSearchInput?.addEventListener('input', debounce(() => fetchCustomers(1), 300));
        saveCustomerBtn?.addEventListener('click', handleSaveCustomer);
        cancelCustomerBtn?.addEventListener('click', hideCustomerModal);
        closeCustomerModalBtn?.addEventListener('click', hideCustomerModal);
        customerListBody?.addEventListener('click', async (e) => {
            const editBtn = e.target.closest('.edit-customer-btn');
            const deleteBtn = e.target.closest('.delete-customer-btn');
            if (editBtn) {
                const customerId = editBtn.closest('tr').dataset.customerId;
                const response = await fetch(`${API_BASE_URL}/customers/${customerId}`);
                const customer = await response.json();
                showCustomerModal(customer);
            }
            if (deleteBtn) {
                const customerId = parseInt(deleteBtn.closest('tr').dataset.customerId, 10);
                handleDeleteCustomer(customerId);
            }
        });

        // NEW: Item Tab Listeners
        addNewItemBtn?.addEventListener('click', () => showItemModal());
        itemSearchInput?.addEventListener('input', debounce(() => fetchItems(1), 300));
        saveItemBtn?.addEventListener('click', handleSaveItem);
        cancelItemBtn?.addEventListener('click', hideItemModal);
        closeItemModalBtn?.addEventListener('click', hideItemModal);
        itemListBody?.addEventListener('click', async (e) => {
            const editBtn = e.target.closest('.edit-item-btn');
            const deleteBtn = e.target.closest('.delete-item-btn');
            if (editBtn) {
                const itemId = editBtn.closest('tr').dataset.itemId;
                const response = await fetch(`${API_BASE_URL}/items/${itemId}`);
                const item = await response.json();
                showItemModal(item);
            }
            if (deleteBtn) {
                const itemId = parseInt(deleteBtn.closest('tr').dataset.itemId, 10);
                handleDeleteItem(itemId);
            }
        });

        // NEW: Backup Tab Listeners
        backupDbBtn?.addEventListener('click', () => { window.location.href = `${API_BASE_URL}/backup`; });
        restoreDbBtn?.addEventListener('click', () => restoreDbInput.click());
        restoreDbInput?.addEventListener('change', () => {
            const file = restoreDbInput.files[0];
            if (file) {
                restoreFileName.textContent = file.name;
                showConfirmationModal('restore_db');
            }
        });

        // Global click listener
        document.body.addEventListener('click', (e) => {
            const downloadBtn = e.target.closest('.download-pdf-btn');
            const deleteBtn = e.target.closest('.delete-btn');
            const editBtn = e.target.closest('.edit-btn');
            if (editBtn) {
                e.stopPropagation();
                const invoiceId = editBtn.closest('tr').dataset.invoiceId;
                window.location.href = `invoice.html?id=${invoiceId}`;
            } else if (downloadBtn) {
                e.stopPropagation();
                const invoiceId = downloadBtn.closest('tr').dataset.invoiceId;
                const theme = localStorage.getItem('pdfTheme') || 'default';
                window.open(`${API_BASE_URL}/invoices/${invoiceId}/pdf?theme=${theme}`);
            } else if (deleteBtn) {
                e.stopPropagation(); 
                const row = deleteBtn.closest('tr');
                if (row && row.dataset.invoiceId) {
                   const invoiceId = parseInt(row.dataset.invoiceId, 10);
                   document.querySelectorAll('.dropdown-menu.show').forEach(menu => menu.classList.remove('show'));
                   handleDeleteInvoice(invoiceId);
                }
            } else {
                handleDropdownClick(e);
            }
        });
        
        modalConfirmBtn.addEventListener('click', () => modalConfirmBtn.onclick());
        modalCancelBtn.addEventListener('click', hideConfirmationModal);
        closeModalBtn.addEventListener('click', hideConfirmationModal);
    }

    initializePage();
});
