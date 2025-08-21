document.addEventListener('DOMContentLoaded', () => {
    // --- GLOBAL STATE & CONFIG ---
    let unitList = [];
    let isUpdatingDiscount = false; // Flag to prevent infinite loops
    let activeRowForAddItem = null; 
    let currentInvoiceId = null; 
    const API_BASE_URL = 'http://127.0.0.1:5000/api';
    const GST_RATES = [0, 5, 12, 18, 28];
    const GST_STATE_CODES = {"01":"Jammu and Kashmir","02":"Himachal Pradesh","03":"Punjab","04":"Chandigarh","05":"Uttarakhand","06":"Haryana","07":"Delhi","08":"Rajasthan","09":"Uttar Pradesh","10":"Bihar","11":"Sikkim","12":"Arunachal Pradesh","13":"Nagaland","14":"Manipur","15":"Mizoram","16":"Tripura","17":"Meghalaya","18":"Assam","19":"West Bengal","20":"Jharkhand","21":"Odisha","22":"Chhattisgarh","23":"Madhya Pradesh","24":"Gujarat","25":"Daman and Diu","26":"Dadra and Nagar Haveli","27":"Maharashtra","28":"Andhra Pradesh (Old)","29":"Karnataka","30":"Goa","31":"Lakshadweep","32":"Kerala","33":"Tamil Nadu","34":"Puducherry","35":"Andaman and Nicobar Islands","36":"Telangana","37":"Andhra Pradesh (New)","97":"Other Territory"};
    
    // --- DOM ELEMENT SELECTORS ---
    const invoiceContainer = document.querySelector('.invoice-container');
    const invoiceBody = document.getElementById('invoice-body');
    
    // Customer Modal Elements
    const addCustomerModal = document.getElementById('add-customer-modal');
    const addCustomerForm = document.getElementById('add-customer-form');
    const newCustomerGstin = document.getElementById('new-customer-gstin');
    const newCustomerPos = document.getElementById('new-customer-pos');
    
    // Item Modal Elements
    const addItemModal = document.getElementById('add-item-modal');
    const addItemForm = document.getElementById('add-item-form');
    const saveConfirmationModal = document.getElementById('save-confirmation-modal');
    const saveModalTitle = document.getElementById('save-modal-title');
    const saveModalMessage = document.getElementById('save-modal-message');
    const confirmSaveBtn = document.getElementById('confirm-save-btn');
    const cancelSaveBtn = document.getElementById('cancel-save-btn');
    const closeSaveModalBtn = document.getElementById('close-save-modal');
    let actionToConfirm = null;

    // --- INITIALIZATION ---
    async function initializePage() {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        document.body.classList.add(savedTheme);
        document.getElementById('invoice-date').valueAsDate = new Date();

        const urlParams = new URLSearchParams(window.location.search);
        const invoiceId = urlParams.get('id');

        if (invoiceId) {
            currentInvoiceId = invoiceId;
            await loadInvoiceForEditing(invoiceId);
        } else {
            // This is the original logic for a new invoice
            addRow();
            calculateAllTotals();
        }

        const defaultMode = localStorage.getItem('defaultPriceMode') || 'inclusive';
        document.getElementById('price-mode-checkbox').checked = (defaultMode === 'inclusive');

        try {
            const unitsResponse = await fetch(`${API_BASE_URL}/units`);
            unitList = await unitsResponse.json();
        } catch (error) {
            console.error("Failed to fetch units:", error);
            unitList = ["PCS", "BTL", "KG"]; // Fallback
        }
        setupEventListeners();
        setupInvoiceNumber();
        applyDefaultPdfTheme();
        addRow();
        calculateAllTotals();
    }
    initializePage();

    // --- DEBOUNCE FUNCTION ---
    const debounce = (func, delay) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    };
    
    // --- EVENT LISTENER SETUP ---
    function setupEventListeners() {
        document.getElementById('add-row-btn').addEventListener('click', addRow);
        document.getElementById('price-mode-checkbox').addEventListener('change', handlePriceModeChange);
        // ADD THESE NEW EVENT LISTENERS
        document.querySelector('button[name="save"]').addEventListener('click', () => showSaveConfirmationModal(false));
        document.querySelector('button[name="print"]').addEventListener('click', () => showSaveConfirmationModal(true));

        // Listeners for the new confirmation modal
        confirmSaveBtn.addEventListener('click', () => {
            if (actionToConfirm) {
                actionToConfirm();
            }
            hideSaveConfirmationModal();
        });
        cancelSaveBtn.addEventListener('click', hideSaveConfirmationModal);
        closeSaveModalBtn.addEventListener('click', hideSaveConfirmationModal);
        // Listeners for the final, total discount inputs
        document.getElementById('final-discount-percent').addEventListener('input', handleFinalPercentDiscountInput);
        document.getElementById('final-discount-amount').addEventListener('input', handleFinalAmountDiscountInput);
        
        const debouncedInputHandler = debounce(target => {
            if (target.classList.contains('item-search') && target.closest('tr') === invoiceBody.querySelector('tr:last-child')) {
                addRow();
            }
            if (target.matches('.qty, .price-per-unit, .tax-select, .free-qty, .mrp')) {
                calculateAllTotals();
            }
        }, 250);

        invoiceBody.addEventListener('input', e => {
            if (e.target.matches('.hsn-code')) e.target.value = e.target.value.replace(/[^0-9]/g, '');

            if (e.target.classList.contains('discount-percent')) {
                handleRowPercentDiscount(e.target);
                return; 
            }
            if (e.target.classList.contains('discount-amount')) {
                handleRowAmountDiscount(e.target);
                return; 
            }
            
            debouncedInputHandler(e.target);
        });

        const customerSearchInput = document.getElementById('customer-search');
        customerSearchInput.addEventListener('focus', () => fetchAndDisplayCustomers());
        customerSearchInput.addEventListener('input', debounce(fetchAndDisplayCustomers, 300));

        invoiceBody.addEventListener('focusin', (e) => {
            if (e.target.classList.contains('item-search')) {
                fetchAndDisplayItems(e.target);
            }
        });
        invoiceBody.addEventListener('input', debounce((e) => {
            if (e.target.classList.contains('item-search')) {
                fetchAndDisplayItems(e.target);
            }
        }, 300));

        document.addEventListener('click', e => {
            if (e.target.classList.contains('add-party-btn')) {
                if (e.target.textContent.includes('Add Customer')) {
                    showAddCustomerModal();
                } else if (e.target.textContent.includes('Add Item')) {
                    const searchWrapper = e.target.closest('.search-results-list').parentElement;
                    const activeInput = searchWrapper.querySelector('.item-search');
                    showAddItemModal(activeInput.closest('tr'));
                }
            }
            if (!e.target.closest('.search-wrapper')) {
                document.querySelectorAll('.search-results-list').forEach(list => list.classList.remove('show'));
            }
        });

        // Customer Modal Listeners
        document.getElementById('save-customer-btn').addEventListener('click', handleSaveCustomer);
        document.getElementById('cancel-customer-btn').addEventListener('click', hideAddCustomerModal);
        document.getElementById('close-customer-modal').addEventListener('click', hideAddCustomerModal);
        newCustomerGstin.addEventListener('input', handleGstinInput);

        // Item Modal Listeners
        document.getElementById('save-item-btn').addEventListener('click', handleSaveItem);
        document.getElementById('cancel-item-btn').addEventListener('click', hideAddItemModal);
        document.getElementById('close-item-modal').addEventListener('click', hideAddItemModal);
    }
    
    // --- HANDLER FUNCTIONS ---

    function handlePriceModeChange() {
        const isNowInclusive = document.getElementById('price-mode-checkbox').checked;
        invoiceBody.querySelectorAll('tr').forEach(row => {
            const priceInput = row.querySelector('.price-per-unit');
            let currentPrice = parseFloat(priceInput.value) || 0;
            if (currentPrice === 0) return;
    
            const taxPercent = parseFloat(row.querySelector('.tax-select').value) || 0;
            const taxRate = taxPercent / 100;
            let newPrice;
    
            if (isNowInclusive) {
                newPrice = currentPrice * (1 + taxRate);
            } else {
                newPrice = currentPrice / (1 + taxRate);
            }
            priceInput.value = newPrice.toFixed(2);
        });
        calculateAllTotals();
    }

    async function loadInvoiceForEditing(invoiceId) {
        try {
            const response = await fetch(`${API_BASE_URL}/invoices/${invoiceId}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch invoice data. Status: ${response.status}`);
            }
            const data = await response.json();

            // Update UI for "edit mode"
            document.querySelector('.invoice-header h2').textContent = `Edit Invoice #${data.invoice.invoice_no}`;
            document.querySelector('button[name="save"]').textContent = 'Update';
            document.querySelector('button[name="print"]').textContent = 'Update & Print';

            // Populate customer details
            document.getElementById('customer-search').value = data.customer.name;
            document.getElementById('customer-address-display').textContent = data.customer.address;
            
            // Populate invoice meta
            const [prefix, suffix] = data.invoice.invoice_no.split('/');
            document.getElementById('invoice-prefix-select').value = `${prefix}/`;
            document.getElementById('invoice-number-suffix').value = suffix;
            document.getElementById('invoice-date').value = data.invoice.date;
            document.querySelector('textarea[name="description"]').value = data.invoice.notes || '';

            // Populate items table
            invoiceBody.innerHTML = ''; // Clear any empty rows
            data.items.forEach(item => {
                addRow(); // Add a new blank row
                const newRow = invoiceBody.querySelector('tr:last-child');
                fillRowWithItemData(newRow, {
                    name: item.item_name,
                    hsn_code: item.hsn_code,
                    default_mrp: item.default_mrp,
                    // Note: price_per_unit is exclusive of tax in the DB
                    default_sale_price: item.price_per_unit, 
                    inclusive_of_tax: false, // Treat DB price as exclusive
                    default_unit: item.unit,
                    default_tax_rate: item.gst_rate,
                });

                // Manually set quantity and discount as they are specific to this invoice
                newRow.querySelector('.qty').value = item.quantity;
                newRow.querySelector('.discount-amount').value = item.discount || '';
                handleRowAmountDiscount(newRow.querySelector('.discount-amount')); // Recalculate discount %
            });

            calculateAllTotals();
            showNotification(`Editing Invoice #${data.invoice.invoice_no}`, 'success');

        } catch (error) {
            console.error('Error loading invoice for editing:', error);
            alert('Could not load invoice data. Please try again.');
            window.location.href = 'index.html'; // Redirect on error
        }
    }

    function handleRowPercentDiscount(percentInput) {
        if (isUpdatingDiscount) return;
        const row = percentInput.closest('tr');
        const amountInput = row.querySelector('.discount-amount');
        const price = parseFloat(row.querySelector('.price-per-unit').value) || 0;
        const qty = parseFloat(row.querySelector('.qty').value) || 0;
        const percent = parseFloat(percentInput.value) || 0;
        const preDiscountTotal = price * qty;
        
        isUpdatingDiscount = true;
        if (percent > 0 && preDiscountTotal > 0) {
            const amount = preDiscountTotal * (percent / 100);
            amountInput.value = amount.toFixed(2);
        } else {
            amountInput.value = '';
        }
        isUpdatingDiscount = false;
        calculateAllTotals();
    }

    function handleRowAmountDiscount(amountInput) {
        if (isUpdatingDiscount) return;
        const row = amountInput.closest('tr');
        const percentInput = row.querySelector('.discount-percent');
        const price = parseFloat(row.querySelector('.price-per-unit').value) || 0;
        const qty = parseFloat(row.querySelector('.qty').value) || 0;
        const amount = parseFloat(amountInput.value) || 0;
        const preDiscountTotal = price * qty;
    
        isUpdatingDiscount = true;
        if (amount > 0 && preDiscountTotal > 0) {
            const percent = (amount / preDiscountTotal) * 100;
            percentInput.value = percent.toFixed(2);
        } else {
            percentInput.value = '';
        }
        isUpdatingDiscount = false;
        calculateAllTotals();
    }

    function handleFinalPercentDiscountInput() {
        if (isUpdatingDiscount) return;
        const percentInput = document.getElementById('final-discount-percent');
        const amountInput = document.getElementById('final-discount-amount');
        const taxableTotalSpan = document.getElementById('taxable-total');
        const tempTaxableTotal = parseFloat(taxableTotalSpan.dataset.preDiscountTotal) || 0;
        const percent = parseFloat(percentInput.value) || 0;
    
        isUpdatingDiscount = true;
        if (percent > 0 && tempTaxableTotal > 0) {
            const amount = tempTaxableTotal * (percent / 100);
            amountInput.value = amount.toFixed(2);
        } else {
            amountInput.value = '';
        }
        isUpdatingDiscount = false;
        calculateAllTotals();
    }

    function handleFinalAmountDiscountInput() {
        if (isUpdatingDiscount) return;
        const percentInput = document.getElementById('final-discount-percent');
        const amountInput = document.getElementById('final-discount-amount');
        const taxableTotalSpan = document.getElementById('taxable-total');
        const tempTaxableTotal = parseFloat(taxableTotalSpan.dataset.preDiscountTotal) || 0;
        const amount = parseFloat(amountInput.value) || 0;
        
        isUpdatingDiscount = true;
        if (amount > 0 && tempTaxableTotal > 0) {
            const percent = (amount / tempTaxableTotal) * 100;
            percentInput.value = percent.toFixed(2);
        } else {
            percentInput.value = '';
        }
        isUpdatingDiscount = false;
        calculateAllTotals();
    }

    // --- INVOICE NUMBER & SEARCH LOGIC ---
    async function setupInvoiceNumber() {
        const prefixSelect = document.getElementById('invoice-prefix-select');
        try {
            const prefixesResponse = await fetch(`${API_BASE_URL}/invoice_prefixes`);
            const prefixes = await prefixesResponse.json();
            prefixSelect.innerHTML = prefixes.map(p => `<option value="${p.prefix}">${p.prefix}</option>`).join('');
            await updateInvoiceNumber();
            prefixSelect.addEventListener('change', updateInvoiceNumber);
        } catch (error) { console.error('Failed to setup invoice number:', error); }
    }
    async function updateInvoiceNumber() {
        const prefixSelect = document.getElementById('invoice-prefix-select');
        const suffixInput = document.getElementById('invoice-number-suffix');
        const selectedPrefix = prefixSelect.value;
        if (!selectedPrefix) return;
        try {
            const numberResponse = await fetch(`${API_BASE_URL}/latest_invoice_number?prefix=${selectedPrefix}`);
            const data = await numberResponse.json();
            if (data.next_number) suffixInput.value = data.next_number;
        } catch (error) { console.error('Failed to fetch latest invoice number:', error); }
    }

    async function fetchAndDisplayCustomers() {
        const inputEl = document.getElementById('customer-search');
        const resultsContainer = document.getElementById('customer-results');
        try {
            const response = await fetch(`${API_BASE_URL}/customers?search=${inputEl.value}`);
            const customers = await response.json();
            resultsContainer.innerHTML = '';

            const addBtn = document.createElement('div');
            addBtn.className = 'add-party-btn';
            addBtn.textContent = '⊕ Add Customer';
            resultsContainer.appendChild(addBtn);
            resultsContainer.classList.add('show');

            customers.forEach(customer => {
                const item = document.createElement('div');
                item.className = 'result-item';
                item.innerHTML = `<div class="result-item-name">${customer.name}</div><div class="result-item-details">${customer.phone || 'No phone'}</div>`;
                item.addEventListener('click', () => {
                    inputEl.value = customer.name;
                    document.getElementById('customer-address-display').textContent = customer.address || 'No address provided.';
                    resultsContainer.classList.remove('show');
                });
                resultsContainer.appendChild(item);
            });
        } catch (error) { console.error('Failed to fetch customers:', error); }
    }
    async function fetchAndDisplayItems(targetInput) {
        const resultsContainer = targetInput.closest('.search-wrapper').querySelector('.search-results-list');
        try {
            const response = await fetch(`${API_BASE_URL}/items?search=${targetInput.value}`);
            const items = await response.json();
            resultsContainer.innerHTML = '';
            
            const addBtn = document.createElement('div');
            addBtn.className = 'add-party-btn';
            addBtn.textContent = '⊕ Add Item';
            resultsContainer.appendChild(addBtn);
            resultsContainer.classList.add('show');

            items.forEach(item => {
                const resultDiv = document.createElement('div');
                resultDiv.className = 'result-item';
                resultDiv.innerHTML = `<div class="result-item-name">${item.name}</div><div class="result-item-details">Price: ₹${item.default_sale_price.toFixed(2)}</div>`;
                resultDiv.addEventListener('click', () => {
                    const row = targetInput.closest('tr');
                    fillRowWithItemData(row, item);
                    resultsContainer.classList.remove('show');
                });
                resultsContainer.appendChild(resultDiv);
            });
        } catch (error) { console.error('Failed to fetch items:', error); }
    }

    function fillRowWithItemData(row, item) {
        const isInvoicePriceInclusive = document.getElementById('price-mode-checkbox').checked;
        const itemSalePrice = item.default_sale_price;
        const itemIsInclusive = item.inclusive_of_tax;
        const taxRate = (item.default_tax_rate || 0) / 100;
        let priceToFill;
    
        if (isInvoicePriceInclusive) {
            priceToFill = itemIsInclusive ? itemSalePrice : itemSalePrice * (1 + taxRate);
        } else {
            priceToFill = itemIsInclusive ? itemSalePrice / (1 + taxRate) : itemSalePrice;
        }
    
        row.querySelector('.item-search').value = item.name;
        row.querySelector('.hsn-code').value = item.hsn_code || '';
        row.querySelector('.mrp').value = item.default_mrp;
        row.querySelector('.price-per-unit').value = priceToFill.toFixed(2);
        row.querySelector('.unit-select').value = item.default_unit;
        row.querySelector('.tax-select').value = item.default_tax_rate || 0;
    
        calculateAllTotals();
        if (row === invoiceBody.querySelector('tr:last-child')) {
            addRow();
        }
    }

    // --- ROW & CALCULATION LOGIC ---
    function addRow() {
        const rowCount = invoiceBody.rows.length + 1;
        const newRow = invoiceBody.insertRow();
        const unitOptions = unitList.map(u => `<option value="${u}">${u}</option>`).join('');
        newRow.innerHTML = `
            <td>${rowCount}</td>
            <td class="item-cell">
                <div class="search-wrapper">
                    <input type="text" class="item-search" placeholder="Search Item" autocomplete="off"/>
                    <div class="search-results-list item-results"></div>
                </div>
            </td>
            <td><input type="text" class="hsn-code"/></td>
            <td><input type="number" class="mrp" min="0"/></td>
            <td><input type="number" class="qty" value="1" min="1"/></td>
            <td><input type="number" class="free-qty" value="0" min="0"/></td>
            <td><select class="unit-select">${unitOptions}</select></td>
            <td><input type="number" class="price-per-unit" min="0"/></td>
            <td><input type="number" class="discount-percent" placeholder="%" min="0" max="100"></td>
            <td><input type="number" class="discount-amount" placeholder="Amt" min="0"></td>
            <td><select class="tax-select">${GST_RATES.map(r => `<option value="${r}">${r}%</option>`).join('')}</select></td>
            <td><input type="text" class="total-amount" readonly/></td>
        `;
    }

    function calculateAllTotals() {
        const isPriceInclusive = document.getElementById('price-mode-checkbox').checked;
        let subTotal = 0, totalTaxable = 0;
        const taxBreakdown = {};

        // This loop calculates the totals before the final discount
        invoiceBody.querySelectorAll('tr').forEach(row => {
            const qty = parseFloat(row.querySelector('.qty').value) || 0;
            let price = parseFloat(row.querySelector('.price-per-unit').value) || 0;
            const taxPercent = parseFloat(row.querySelector('.tax-select').value) || 0;
            const taxRate = taxPercent / 100;

            if (qty === 0) {
                row.querySelector('.total-amount').value = '₹0.00';
                return;
            }

            let basePrice = isPriceInclusive ? price / (1 + taxRate) : price;
            const totalBaseAmount = qty * basePrice;
            const discountAmount = parseFloat(row.querySelector('.discount-amount').value) || 0;
            const finalTaxableAmount = totalBaseAmount - discountAmount;
            const taxAmount = finalTaxableAmount * taxRate;

            row.querySelector('.total-amount').value = `₹${(finalTaxableAmount + taxAmount).toFixed(2)}`;

            subTotal += totalBaseAmount;
            totalTaxable += finalTaxableAmount;

            if (taxPercent > 0) {
                if (!taxBreakdown[taxPercent]) taxBreakdown[taxPercent] = { taxable: 0 };
                taxBreakdown[taxPercent].taxable += finalTaxableAmount;
            }
        });

        const taxableTotalSpan = document.getElementById('taxable-total');
        taxableTotalSpan.dataset.preDiscountTotal = totalTaxable;

        const finalDiscountAmount = parseFloat(document.getElementById('final-discount-amount').value) || 0;
        const finalTaxableValue = totalTaxable - finalDiscountAmount;

        let finalTotalTax = 0;
        const discountRatio = totalTaxable > 0 ? finalDiscountAmount / totalTaxable : 0;
        const taxSummaryEl = document.getElementById('tax-summary');
        taxSummaryEl.innerHTML = '';

        for (const rate in taxBreakdown) {
            const originalSlabTaxable = taxBreakdown[rate].taxable;
            const slabDiscount = originalSlabTaxable * discountRatio;
            const newSlabTaxable = originalSlabTaxable - slabDiscount;
            const newSlabTax = newSlabTaxable * (parseFloat(rate) / 100);

            finalTotalTax += newSlabTax;

            taxSummaryEl.innerHTML += `
                <div class="tax-summary-item"><span>CGST @ ${rate/2}%:</span><span>₹${(newSlabTax/2).toFixed(2)}</span></div>
                <div class="tax-summary-item"><span>SGST @ ${rate/2}%:</span><span>₹${(newSlabTax/2).toFixed(2)}</span></div>
            `;
        }

        const exactGrandTotal = finalTaxableValue + finalTotalTax;

        // --- NEW: Rounding Logic ---
        const roundedGrandTotal = Math.round(exactGrandTotal);
        const roundOffAmount = roundedGrandTotal - exactGrandTotal;

        // Update the UI with the new values
        document.getElementById('sub-total').textContent = `₹${subTotal.toFixed(2)}`;
        taxableTotalSpan.textContent = `₹${finalTaxableValue.toFixed(2)}`;
        document.getElementById('round-off').textContent = `₹${roundOffAmount.toFixed(2)}`;
        document.getElementById('grand-total').textContent = `₹${roundedGrandTotal.toFixed(2)}`;
    }
    
    // --- ADD CUSTOMER MODAL LOGIC ---
    function showAddCustomerModal() {
        document.querySelectorAll('.search-results-list').forEach(list => list.classList.remove('show'));
        addCustomerForm.reset();
        document.getElementById('customer-form-error-message').style.display = 'none';
        newCustomerPos.innerHTML = '<option value="">Select State</option>' + Object.values(GST_STATE_CODES).map(state => `<option value="${state}">${state}</option>`).join('');
        addCustomerModal.style.display = 'flex';
        invoiceContainer.classList.add('blurred');
    }

    function hideAddCustomerModal() {
        addCustomerModal.style.display = 'none';
        invoiceContainer.classList.remove('blurred');
    }



    function handleGstinInput() {
        const gstin = newCustomerGstin.value.trim().substring(0, 2);
        if (gstin.length === 2 && GST_STATE_CODES[gstin]) {
            newCustomerPos.value = GST_STATE_CODES[gstin];
        }
    }

    async function handleSaveCustomer() {
        const name = document.getElementById('new-customer-name').value.trim();
        const address = document.getElementById('new-customer-address').value.trim();
        const phone = document.getElementById('new-customer-phone').value.trim();
        const gstin = document.getElementById('new-customer-gstin').value.trim();
        const pos = document.getElementById('new-customer-pos').value;
        const errorEl = document.getElementById('customer-form-error-message');
        
        if (!name || !address || !pos) {
            errorEl.textContent = 'Customer Name, Address, and Place of Supply are required.';
            errorEl.style.display = 'block';
            return;
        }
        
        const customerData = { name, address, phone, gstin, place_of_supply: pos };
    
        try {
            const response = await fetch(`${API_BASE_URL}/customers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(customerData)
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || `Server responded with status: ${response.status}`);
            }
            const newCustomer = await response.json();
            hideAddCustomerModal();
            document.getElementById('customer-search').value = newCustomer.name;
            document.getElementById('customer-address-display').textContent = newCustomer.address;
            showNotification(`Customer '${newCustomer.name}' created successfully.`, 'success');
        } catch (error) {
            errorEl.textContent = `Error: ${error.message}`;
            errorEl.style.display = 'block';
        }
    }

    // --- INVOICE SAVING LOGIC ---

    function gatherInvoiceData() {
        // This is a simplified data gathering function.
        // A real implementation would involve more robust validation.
        const customerName = document.getElementById('customer-search').value;
        // In a real app, you'd have a hidden input for customer_id filled when a customer is selected.
        // For this fix, we'll hardcode customer_id = 1 as a placeholder.

        const items = [];
        invoiceBody.querySelectorAll('tr').forEach(row => {
            const itemName = row.querySelector('.item-search').value;
            if (!itemName) return; // Skip empty rows

            const isPriceInclusive = document.getElementById('price-mode-checkbox').checked;
            const priceWithOrWithoutTax = parseFloat(row.querySelector('.price-per-unit').value) || 0;
            const taxPercent = parseFloat(row.querySelector('.tax-select').value) || 0;
            const taxRate = taxPercent / 100;
            const basePrice = isPriceInclusive ? priceWithOrWithoutTax / (1 + taxRate) : priceWithOrWithoutTax;
            const qty = parseFloat(row.querySelector('.qty').value) || 1;
            const discountAmount = parseFloat(row.querySelector('.discount-amount').value) || 0;

            const taxableAmount = (basePrice * qty) - discountAmount;
            const taxAmount = taxableAmount * taxRate;

            items.push({
                // item_id should be stored in a data attribute when an item is selected.
                // Hardcoding item_id = 1 for now as a placeholder.
                item_id: 1, 
                hsn_code: row.querySelector('.hsn-code').value,
                quantity: qty,
                free_quantity: parseFloat(row.querySelector('.free-qty').value) || 0,
                unit: row.querySelector('.unit-select').value,
                price_per_unit: basePrice,
                discount: discountAmount,
                gst_rate: taxPercent,
                cgst_amount: taxAmount / 2,
                sgst_amount: taxAmount / 2,
                total_amount: taxableAmount + taxAmount,
            });
        });

        const taxableTotalText = document.getElementById('taxable-total').textContent || '₹0.00';
        const totalTaxText = document.getElementById('tax-summary').textContent || '₹0.00'; // Simplified
        const grandTotalText = document.getElementById('grand-total').textContent || '₹0.00';

        const extractNumber = (str) => parseFloat(str.replace('₹', '').replace(/,/g, '')) || 0;

        const taxableValue = extractNumber(taxableTotalText);
        const totalTax = (extractNumber(document.getElementById('tax-summary').textContent.split('CGST @')[1]) * 2) || 0; // Simplified

        const invoiceData = {
            invoice_no: `${document.getElementById('invoice-prefix-select').value}${document.getElementById('invoice-number-suffix').value}`,
            date: document.getElementById('invoice-date').value,
            customer_id: 1, // Placeholder customer ID
            items: items,
            taxable_value: taxableValue,
            cgst: totalTax / 2,
            sgst: totalTax / 2,
            round_off: extractNumber(document.getElementById('round-off').textContent),
            total_value: extractNumber(grandTotalText),
            notes: document.querySelector('textarea[name="description"]').value
        };

        return invoiceData;
    }

    async function handleSaveAndPrint(isPrint) {
        // Step 1: Gather all data from the invoice form.
        const invoiceData = gatherInvoiceData();

        // Step 2: Basic validation to ensure the invoice is not empty.
        if (invoiceData.items.length === 0) {
            // Using a simple alert for immediate user feedback. A custom modal could also be used.
            alert('Cannot save an empty invoice. Please add at least one item.');
            return;
        }
        
        // Step 3: Determine the HTTP method and API endpoint.
        // If 'currentInvoiceId' has a value, we are editing an existing invoice.
        // Otherwise, we are creating a new one.
        const method = currentInvoiceId ? 'PUT' : 'POST';
        const url = currentInvoiceId ? `${API_BASE_URL}/invoices/${currentInvoiceId}` : `${API_BASE_URL}/invoices`;
        const actionText = currentInvoiceId ? 'updated' : 'saved';

        try {
            // Step 4: Send the data to the backend.
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(invoiceData)
            });

            // Step 5: Handle a failed response from the server.
            if (!response.ok) {
                const errData = await response.json();
                // Throw an error to be caught by the catch block below.
                throw new Error(errData.error || `Server responded with status: ${response.status}`);
            }

            // Step 6: Handle a successful response.
            const result = await response.json();
            const newInvoiceId = result.invoice_id;

            // Show a success message to the user.
            showNotification(`Invoice ${invoiceData.invoice_no} ${actionText} successfully!`, 'success');

            // Step 7: If the 'print' button was clicked, open the PDF in a new tab.
            if (isPrint) {
                const theme = localStorage.getItem('pdfTheme') || 'default';
                window.open(`${API_BASE_URL}/invoices/${newInvoiceId}/pdf?theme=${theme}`);
            }

            // Step 8: Redirect back to the main dashboard after a short delay.
            // This allows the user time to see the success notification.
            setTimeout(() => {
                window.location.href = 'index.html'; 
            }, 1500);

        } catch (error) {
            // Step 9: Catch any errors from the fetch call or the server response.
            alert(`Error ${actionText} invoice: ${error.message}`);
        }
    }

    // --- ADD ITEM MODAL LOGIC ---
    function showAddItemModal(targetRow) {
        activeRowForAddItem = targetRow; 
        document.querySelectorAll('.search-results-list').forEach(list => list.classList.remove('show'));
        addItemForm.reset();
        document.getElementById('item-form-error-message').style.display = 'none';
        
        document.getElementById('new-item-unit').innerHTML = unitList.map(u => `<option value="${u}">${u}</option>`).join('');
        document.getElementById('new-item-tax').innerHTML = GST_RATES.map(r => `<option value="${r}">${r}%</option>`).join('');

        addItemModal.style.display = 'flex';
        invoiceContainer.classList.add('blurred');
    }

    function hideAddItemModal() {
        addItemModal.style.display = 'none';
        invoiceContainer.classList.remove('blurred');
        activeRowForAddItem = null; 
    }

    // *** ADD THESE TWO NEW FUNCTIONS ***
    function showSaveConfirmationModal(isPrint) {
        if (isPrint) {
            saveModalTitle.textContent = 'Confirm Save & Print';
            saveModalMessage.textContent = 'This will save the invoice and open the PDF in a new tab. Do you want to continue?';
            confirmSaveBtn.textContent = 'Confirm & Print';
            actionToConfirm = () => handleSaveAndPrint(true);
        } else {
            saveModalTitle.textContent = 'Confirm Save';
            saveModalMessage.textContent = 'Are you sure you want to save this invoice?';
            confirmSaveBtn.textContent = 'Confirm & Save';
            actionToConfirm = () => handleSaveAndPrint(false);
        }
        saveConfirmationModal.style.display = 'flex';
        invoiceContainer.classList.add('blurred');
    }

    function hideSaveConfirmationModal() {
        saveConfirmationModal.style.display = 'none';
        invoiceContainer.classList.remove('blurred');
        actionToConfirm = null;
    }

    
    function showNotification(message, type = 'success') {
        const notification = document.getElementById('notification');
        if (!notification) return;

        notification.textContent = message;
        notification.className = `notification ${type}`;
        notification.classList.add('show');

        setTimeout(() => {
            notification.classList.remove('show');
        }, 4000); // Hide after 4 seconds
    }

    async function handleSaveItem() {
        const errorEl = document.getElementById('item-form-error-message');
        errorEl.style.display = 'none';

        if (!addItemForm.checkValidity()) {
            errorEl.textContent = 'Please fill out all required fields.';
            errorEl.style.display = 'block';
            return;
        }

        const itemData = {
            name: document.getElementById('new-item-name').value.trim(),
            hsn_code: document.getElementById('new-item-hsn').value.trim(),
            default_unit: document.getElementById('new-item-unit').value,
            default_mrp: parseFloat(document.getElementById('new-item-mrp').value),
            purchase_price: parseFloat(document.getElementById('new-item-purchase-price').value) || null,
            default_sale_price: parseFloat(document.getElementById('new-item-price').value),
            default_tax_rate: parseInt(document.getElementById('new-item-tax').value, 10),
            inclusive_of_tax: document.getElementById('new-item-inclusive').checked
        };

        try {
            const response = await fetch(`${API_BASE_URL}/items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(itemData)
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || `Server responded with status: ${response.status}`);
            }

            const newItem = await response.json();
            hideAddItemModal();

            if (activeRowForAddItem) {
                fillRowWithItemData(activeRowForAddItem, newItem);
            }
            showNotification(`Item '${newItem.name}' created successfully.`, 'success');

        } catch (error) {
            errorEl.textContent = `Error: ${error.message}`;
            errorEl.style.display = 'block';
        }


    }
});