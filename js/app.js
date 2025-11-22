// Constants
const CONFIG = {
    PAGINATION: {
        ITEMS_PER_PAGE: 20,
        MAX_PAGE_BUTTONS: 5
    },
    VALIDATION: {
        MAX_GUESTS: 20,
        MAX_BOOKING_DAYS: 90,
        MIN_BOOKING_DAYS: 1,
        MAX_DISCOUNT: 100,
        MAX_GST: 50,
        MAX_TAX_WITHHOLD: 50
    },
    TOAST: {
        DURATION: 3000,
        LONG_DURATION: 5000
    },
    MODAL: {
        SCROLL_THRESHOLD: 500,
        ANIMATION_DURATION: 300
    },
    RATE_LIMIT: {
        CSRF_REFRESH_INTERVAL: 1800000 // 30 minutes
    }
};

// Main App
class App {
    constructor() {
        this.currentPage = 'home';
        this.csrfToken = null;
        this.currentPageNumber = 1;
        this.csrfRefreshTimer = null;
        this.init();
    }

    async init() {
        // Check authentication
        const auth = await this.checkAuth();
        if (!auth) {
            window.location.href = 'admin-login.html';
            return;
        }

        // Render UI
        this.renderApp();
        this.setupEventListeners();
        
        // Load last page or default to home
        const savedPage = sessionStorage.getItem('currentPage') || 'home';
        this.loadPage(savedPage);
        this.loadNotifications();
    }

    async checkAuth() {
        try {
            const response = await fetch('api/auth.php?action=check');
            const data = await response.json();
            if (data.authenticated && data.csrf_token) {
                this.csrfToken = data.csrf_token;
                this.startCSRFRefresh();
            }
            return data.authenticated;
        } catch (error) {
            return false;
        }
    }

    startCSRFRefresh() {
        // Clear existing timer
        if (this.csrfRefreshTimer) {
            clearInterval(this.csrfRefreshTimer);
        }
        
        // Refresh CSRF token every 30 minutes
        this.csrfRefreshTimer = setInterval(async () => {
            try {
                const response = await fetch('api/auth.php?action=check');
                const data = await response.json();
                if (data.authenticated && data.csrf_token) {
                    this.csrfToken = data.csrf_token;
                }
            } catch (error) {
                console.error('Failed to refresh CSRF token:', error);
            }
        }, CONFIG.RATE_LIMIT.CSRF_REFRESH_INTERVAL);
    }

    renderApp() {
        const app = document.getElementById('app');
        app.innerHTML = `
            <header class="header">
                <div class="header-content">
                    <div class="logo">Homeland Stay</div>
                    <nav class="desktop-nav">
                        <a href="#" data-page="home" class="nav-link active">Home</a>
                        <a href="#" data-page="calendar" class="nav-link">Calendar</a>
                        <a href="#" data-page="bookings" class="nav-link">Bookings</a>
                        <a href="#" data-page="reports" class="nav-link">Reports</a>
                        <a href="#" data-page="settings" class="nav-link">Settings</a>
                        <a href="db-admin.html" class="nav-link" target="_blank" style="color: var(--warning);">🗄️ DB Admin</a>
                    </nav>
                    <div class="header-actions">
                        <button class="notification-btn" id="notificationBtn">
                            🔔
                            <span class="notification-badge hidden" id="notificationBadge">0</span>
                        </button>
                        <button class="btn btn-secondary desktop-logout-btn" id="desktopLogoutBtn" style="display: none;">Logout</button>
                        <button class="hamburger" id="hamburgerBtn">
                            <span></span>
                            <span></span>
                            <span></span>
                        </button>
                    </div>
                </div>
            </header>

            <div class="sidebar" id="sidebar">
                <div class="sidebar-header">
                    <div class="sidebar-title">Menu</div>
                    <button class="close-btn" id="closeSidebar">✕</button>
                </div>
                <ul class="sidebar-nav">
                    <li><a href="#" data-page="home" class="active">Home</a></li>
                    <li><a href="#" data-page="calendar">Calendar</a></li>
                    <li><a href="#" data-page="bookings">Bookings</a></li>
                    <li><a href="#" data-page="reports">Reports</a></li>
                    <li><a href="#" data-page="settings">Settings</a></li>
                    <li><a href="db-admin.html" target="_blank" style="color: var(--warning);">🗄️ DB Admin</a></li>
                    <li><a href="#" id="logoutBtn">Logout</a></li>
                </ul>
            </div>

            <div class="notification-panel" id="notificationPanel">
                <div class="sidebar-header">
                    <div class="sidebar-title">Notifications</div>
                    <button class="close-btn" id="closeNotifications">✕</button>
                </div>
                <div id="notificationsList"></div>
            </div>

            <div class="overlay" id="overlay"></div>

            <main class="main-content" id="mainContent"></main>
            
            <div id="pageLoader" class="page-loader" style="display: none;">
                <div class="spinner"></div>
            </div>
            
            <div id="toastContainer" class="toast-container"></div>
        `;
    }

    setupEventListeners() {
        // Hamburger menu
        document.getElementById('hamburgerBtn').addEventListener('click', () => this.toggleSidebar());
        document.getElementById('closeSidebar').addEventListener('click', () => this.toggleSidebar());
        
        // Notifications
        document.getElementById('notificationBtn').addEventListener('click', () => this.toggleNotifications());
        document.getElementById('closeNotifications').addEventListener('click', () => this.toggleNotifications());
        
        // Overlay
        document.getElementById('overlay').addEventListener('click', () => {
            this.closeSidebar();
            this.closeNotifications();
        });

        // Navigation - Desktop
        document.querySelectorAll('.desktop-nav .nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                const page = e.target.dataset.page;
                if (page) {
                    e.preventDefault();
                    this.loadPage(page);
                }
            });
        });
        
        // Navigation - Mobile Sidebar
        document.querySelectorAll('.sidebar-nav a[data-page]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = e.target.dataset.page;
                this.loadPage(page);
                this.closeSidebar();
            });
        });

        // Logout
        document.getElementById('logoutBtn').addEventListener('click', async (e) => {
            e.preventDefault();
            await fetch('api/auth.php?action=logout', { method: 'POST' });
            window.location.href = 'admin-login.html';
        });

        // Desktop Logout
        document.getElementById('desktopLogoutBtn').addEventListener('click', async (e) => {
            e.preventDefault();
            await fetch('api/auth.php?action=logout', { method: 'POST' });
            window.location.href = 'admin-login.html';
        });
    }

    showToast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const icon = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ⓘ'
        }[type] || 'ⓘ';
        
        toast.innerHTML = `
            <span class="toast-icon">${icon}</span>
            <span class="toast-message">${message}</span>
        `;
        
        container.appendChild(toast);
        
        // Trigger animation
        setTimeout(() => toast.classList.add('show'), 10);
        
        // Auto remove
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    showLoading() {
        const loader = document.getElementById('pageLoader');
        if (loader) {
            loader.style.display = 'flex';
        }
    }

    hideLoading() {
        const loader = document.getElementById('pageLoader');
        if (loader) {
            loader.style.display = 'none';
        }
    }

    toggleSidebar() {
        document.getElementById('sidebar').classList.toggle('active');
        document.getElementById('overlay').classList.toggle('active');
    }

    closeSidebar() {
        document.getElementById('sidebar').classList.remove('active');
        document.getElementById('overlay').classList.remove('active');
    }

    toggleNotifications() {
        document.getElementById('notificationsPanel').classList.toggle('active');
        document.getElementById('overlay').classList.toggle('active');
    }

    closeNotifications() {
        document.getElementById('notificationsPanel').classList.remove('active');
        document.getElementById('overlay').classList.remove('active');
        
        // Auto remove
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    showConfirm(message, onConfirm, onCancel = null) {
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 400px;">
                <div class="modal-header">
                    <h2>Confirm Action</h2>
                </div>
                <div class="modal-body">
                    <p style="font-size: 16px; margin: 20px 0;">${message}</p>
                </div>
                <div class="modal-footer" style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button class="btn btn-secondary" id="confirmCancel">Cancel</button>
                    <button class="btn btn-danger" id="confirmOk">Confirm</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('confirmOk').addEventListener('click', () => {
            modal.remove();
            if (onConfirm) onConfirm();
        });
        
        document.getElementById('confirmCancel').addEventListener('click', () => {
            modal.remove();
            if (onCancel) onCancel();
        });
        
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
                if (onCancel) onCancel();
            }
        });
    }

    toggleSidebar() {
        document.getElementById('sidebar').classList.toggle('active');
        document.getElementById('overlay').classList.toggle('active');
    }

    closeSidebar() {
        document.getElementById('sidebar').classList.remove('active');
        document.getElementById('overlay').classList.remove('active');
    }

    toggleNotifications() {
        document.getElementById('notificationPanel').classList.toggle('active');
        document.getElementById('overlay').classList.toggle('active');
    }

    closeNotifications() {
        document.getElementById('notificationPanel').classList.remove('active');
        document.getElementById('overlay').classList.remove('active');
    }

    async loadPage(page) {
        this.currentPage = page;
        sessionStorage.setItem('currentPage', page);
        
        // Show loading indicator
        this.showLoading();
        
        // Update active nav - both desktop and mobile
        document.querySelectorAll('.sidebar-nav a, .desktop-nav .nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.dataset.page === page) {
                link.classList.add('active');
            }
        });

        const mainContent = document.getElementById('mainContent');
        
        switch(page) {
            case 'home':
                mainContent.innerHTML = await this.renderHomePage();
                this.setupHomeEvents();
                break;
            case 'calendar':
                mainContent.innerHTML = await this.renderCalendarPage();
                this.setupCalendarEvents();
                break;
            case 'bookings':
                mainContent.innerHTML = await this.renderBookingsPage();
                this.setupBookingsEvents();
                break;
            case 'reports':
                mainContent.innerHTML = await this.renderReportsPage();
                this.setupReportsEvents();
                break;
            case 'settings':
                mainContent.innerHTML = await this.renderSettingsPage();
                this.setupSettingsEvents();
                break;
        }
        
        // Hide loading indicator
        this.hideLoading();
    }

    async renderHomePage() {
        try {
            const response = await fetch('api/bookings.php?action=dashboard');
            const data = await response.json();
            
            if (!data.success) {
                return '<p>Error loading dashboard</p>';
            }

            const { stats, pendingRequests, upcomingBookings, pendingPayments } = data;

            return `
                <h1 class="page-title">Dashboard</h1>

                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-value">${stats.occupancyRate}%</div>
                        <div class="stat-label">Occupancy Rate</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">₹${stats.avgBookingValue.toLocaleString()}</div>
                        <div class="stat-label">Avg Booking Value</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">₹${stats.monthRevenue.toLocaleString()}</div>
                        <div class="stat-label">Revenue This Month</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${stats.pendingPayments}</div>
                        <div class="stat-label">Pending Payments</div>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header" style="flex-wrap: wrap;">
                        <h2 class="card-title" style="width: 100%;">Pending Requests</h2>
                        <p class="text-secondary" style="width: 100%; margin: 0.25rem 0 0 0; font-size: 0.85rem; font-weight: 400;">New inquiries and draft bookings awaiting confirmation or quotes</p>
                        <button class="btn btn-primary" id="addBookingBtn" style="position: absolute; right: 1rem; top: 1rem;">+ Add Booking</button>
                    </div>
                    ${pendingRequests.length === 0 ? 
                        '<p class="text-secondary">No pending requests</p>' : 
                        this.renderPendingTable(pendingRequests)
                    }
                </div>

                <div class="card">
                    <div class="card-header" style="flex-wrap: wrap;">
                        <h2 class="card-title" style="width: 100%;">Pending Payments</h2>
                        <p class="text-secondary" style="width: 100%; margin: 0.25rem 0 0 0; font-size: 0.85rem; font-weight: 400;">Confirmed bookings with pending or partial payments that require follow-up</p>
                    </div>
                    ${pendingPayments.length === 0 ? 
                        '<p class="text-secondary">No pending payments</p>' : 
                        this.renderPendingPaymentsTable(pendingPayments)
                    }
                </div>

                <div class="card">
                    <div class="card-header" style="flex-wrap: wrap;">
                        <h2 class="card-title" style="width: 100%;">Upcoming Bookings This Month</h2>
                        <p class="text-secondary" style="width: 100%; margin: 0.25rem 0 0 0; font-size: 0.85rem; font-weight: 400;">Confirmed reservations with check-in dates scheduled for this month</p>
                    </div>
                    ${upcomingBookings.length === 0 ? 
                        '<p class="text-secondary">No upcoming bookings</p>' : 
                        this.renderUpcomingTable(upcomingBookings)
                    }
                </div>
            `;
        } catch (error) {
            return '<p>Error loading dashboard</p>';
        }
    }

    renderPendingTable(requests) {
        return `
            <div class="table-container desktop-only">
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Check-in</th>
                            <th>Check-out</th>
                            <th>Guests</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${requests.map(r => `
                            <tr>
                                <td>${r.customer_name}</td>
                                <td>${new Date(r.check_in_date).toLocaleDateString()}</td>
                                <td>${new Date(r.check_out_date).toLocaleDateString()}</td>
                                <td>${r.num_adults + r.num_kids} (${r.num_adults}A, ${r.num_kids}K)</td>
                                <td><button class="btn btn-sm btn-primary view-request" data-id="${r.id}">View</button></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div class="card-list mobile-only">
                ${requests.map(r => `
                    <div class="list-card">
                        <div class="list-card-header">
                            <h3 class="list-card-title">${r.customer_name}</h3>
                            <span class="badge badge-warning">Inquiry</span>
                        </div>
                        <div class="list-card-body">
                            <div class="list-card-row">
                                <span class="list-card-label">Check-in:</span>
                                <span class="list-card-value">${new Date(r.check_in_date).toLocaleDateString()}</span>
                            </div>
                            <div class="list-card-row">
                                <span class="list-card-label">Check-out:</span>
                                <span class="list-card-value">${new Date(r.check_out_date).toLocaleDateString()}</span>
                            </div>
                            <div class="list-card-row">
                                <span class="list-card-label">Guests:</span>
                                <span class="list-card-value">${r.num_adults + r.num_kids} (${r.num_adults}A, ${r.num_kids}K)</span>
                            </div>
                        </div>
                        <div class="list-card-footer">
                            <button class="btn btn-primary btn-block view-request" data-id="${r.id}">View Request</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderUpcomingTable(bookings) {
        return `
            <div class="table-container desktop-only">
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Check-in</th>
                            <th>Check-out</th>
                            <th>Guests</th>
                            <th>Payment</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${bookings.map(b => {
                            const isPaid = b.payment_status === 'Paid';
                            const paymentColor = this.getPaymentColor(b.payment_status);
                            return `
                            <tr>
                                <td>${b.customer_name}</td>
                                <td>${new Date(b.check_in_date).toLocaleDateString()}</td>
                                <td>${new Date(b.check_out_date).toLocaleDateString()}</td>
                                <td>${b.num_adults + b.num_kids} (${b.num_adults}A, ${b.num_kids}K)</td>
                                <td><span class="badge" style="background: ${paymentColor};">${b.payment_status || 'Pending'}</span></td>
                                <td>
                                    <button class="btn btn-sm btn-primary view-upcoming-booking" data-id="${b.id}">View</button>
                                    ${isPaid ? `<button class="btn btn-sm btn-secondary show-invoice-btn" data-id="${b.id}">📄 Invoice</button>` : ''}
                                </td>
                            </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            <div class="card-list mobile-only">
                ${bookings.map(b => {
                    const isPaid = b.payment_status === 'Paid';
                    const paymentColor = this.getPaymentColor(b.payment_status);
                    return `
                    <div class="list-card">
                        <div class="list-card-header">
                            <h3 class="list-card-title">${b.customer_name}</h3>
                            <span class="badge" style="background: ${paymentColor};">${b.payment_status || 'Pending'}</span>
                        </div>
                        <div class="list-card-body">
                            <div class="list-card-row">
                                <span class="list-card-label">Check-in:</span>
                                <span class="list-card-value">${new Date(b.check_in_date).toLocaleDateString()}</span>
                            </div>
                            <div class="list-card-row">
                                <span class="list-card-label">Check-out:</span>
                                <span class="list-card-value">${new Date(b.check_out_date).toLocaleDateString()}</span>
                            </div>
                            <div class="list-card-row">
                                <span class="list-card-label">Guests:</span>
                                <span class="list-card-value">${b.num_adults + b.num_kids} (${b.num_adults}A, ${b.num_kids}K)</span>
                            </div>
                        </div>
                        <div class="list-card-footer">
                            <button class="btn btn-primary btn-block view-upcoming-booking" data-id="${b.id}">View Details</button>
                            ${isPaid ? `<button class="btn btn-secondary btn-block show-invoice-btn" data-id="${b.id}" style="margin-top: 0.5rem;">📄 View Invoice</button>` : ''}
                        </div>
                    </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    renderPendingPaymentsTable(bookings) {
        return `
            <div class="table-container desktop-only">
                <table>
                    <thead>
                        <tr>
                            <th>Customer</th>
                            <th>Check-in</th>
                            <th>Total Amount</th>
                            <th>Paid</th>
                            <th>Pending</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${bookings.map(b => {
                            const paid = parseFloat(b.amount_paid || 0);
                            const total = parseFloat(b.total_amount || 0);
                            const pending = total - paid;
                            const isPaid = b.payment_status === 'Paid';
                            const isPartialPaid = b.payment_status === 'Partial Paid';
                            const showInvoice = isPaid || isPartialPaid;
                            return `
                                <tr>
                                    <td>${b.customer_name}</td>
                                    <td>${new Date(b.check_in_date).toLocaleDateString()}</td>
                                    <td>₹${total.toLocaleString()}</td>
                                    <td>₹${paid.toLocaleString()}</td>
                                    <td><strong style="color: #ef4444;">₹${pending.toLocaleString()}</strong></td>
                                    <td>
                                        <button class="btn btn-sm btn-primary view-payment" data-id="${b.id}">Take Payment</button>
                                        ${showInvoice ? `<button class="btn btn-sm btn-secondary show-invoice-btn" data-id="${b.id}">📄 Invoice</button>` : ''}
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            <div class="card-list mobile-only">
                ${bookings.map(b => {
                    const paid = parseFloat(b.amount_paid || 0);
                    const total = parseFloat(b.total_amount || 0);
                    const pending = total - paid;
                    const isPaid = b.payment_status === 'Paid';
                    const isPartialPaid = b.payment_status === 'Partial Paid';
                    const showInvoice = isPaid || isPartialPaid;
                    return `
                        <div class="list-card">
                            <div class="list-card-header">
                                <h3 class="list-card-title">${b.customer_name}</h3>
                                <span class="badge" style="background: #ef4444;">Payment Due</span>
                            </div>
                            <div class="list-card-body">
                                <div class="list-card-row">
                                    <span class="list-card-label">📅 Check-in:</span>
                                    <span class="list-card-value">${new Date(b.check_in_date).toLocaleDateString()}</span>
                                </div>
                                <div class="list-card-row">
                                    <span class="list-card-label">💰 Total:</span>
                                    <span class="list-card-value">₹${total.toLocaleString()}</span>
                                </div>
                                <div class="list-card-row">
                                    <span class="list-card-label">✅ Paid:</span>
                                    <span class="list-card-value">₹${paid.toLocaleString()}</span>
                                </div>
                                <div class="list-card-row">
                                    <span class="list-card-label">⚠️ Pending:</span>
                                    <span class="list-card-value"><strong style="color: #ef4444;">₹${pending.toLocaleString()}</strong></span>
                                </div>
                            </div>
                            <div class="list-card-footer">
                                <button class="btn btn-primary btn-block view-payment" data-id="${b.id}">View & Take Payment</button>
                                ${showInvoice ? `<button class="btn btn-secondary btn-block show-invoice-btn" data-id="${b.id}" style="margin-top: 0.5rem;">📄 View Invoice</button>` : ''}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    setupHomeEvents() {
        document.getElementById('addBookingBtn')?.addEventListener('click', () => {
            this.showAddBookingModal();
        });

        document.querySelectorAll('.view-request').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.dataset.id;
                await this.showViewRequestModal(id);
            });
        });

        document.querySelectorAll('.view-upcoming-booking').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.dataset.id;
                await this.showViewRequestModal(id);
            });
        });

        document.querySelectorAll('.view-payment').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.dataset.id;
                await this.showPaymentModal(id);
            });
        });
        
        // Invoice buttons - universal handler
        document.querySelectorAll('.show-invoice-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.dataset.id;
                await this.showInvoiceFromDB(id);
            });
        });
    }

    async showAddBookingModal() {
        const partnersResponse = await fetch('api/partners.php?action=list');
        const partnersData = await partnersResponse.json();
        const partners = partnersData.success ? partnersData.partners : [];
        
        const propertiesResponse = await fetch('api/properties.php?action=list');
        const propertiesData = await propertiesResponse.json();
        const properties = propertiesData.success ? propertiesData.properties : [];
        
        console.log('Loaded properties:', properties);

        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2 class="modal-title">Add New Booking</h2>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">✕</button>
                </div>
                <div class="modal-body">
                    <form id="addBookingForm">
                        <div class="form-group">
                            <label>Booking Status *</label>
                            <select id="bookingStatus" required>
                                <option value="Inquiry">Inquiry</option>
                                <option value="Confirmed">Confirmed</option>
                                <option value="Cancelled">Cancelled</option>
                                <option value="Personal">Personal</option>
                                <option value="Not confirmed">Not confirmed</option>
                            </select>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label>Property *</label>
                                <select id="propertyId" required>
                                    <option value="">Select Property</option>
                                    ${properties.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                                </select>
                                <small class="text-secondary">Property selection is required</small>
                            </div>
                            <div class="form-group">
                                <label>Partner *</label>
                                <select id="partnerId" required>
                                    <option value="">Select Partner</option>
                                    ${partners.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                                </select>
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Booking Reference</label>
                            <input type="text" id="bookingRef">
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label>Name *</label>
                                <input type="text" id="customerName" required>
                            </div>
                            <div class="form-group">
                                <label>Phone *</label>
                                <input type="tel" id="customerPhone" placeholder="+91 98765 43210 or +1 (555) 123-4567" required>
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Email</label>
                            <input type="email" id="customerEmail">
                        </div>

                        <div class="form-group">
                            <label>State and city</label>
                            <input type="text" id="customerState" placeholder="e.g., Maharashtra, Mumbai or California, Los Angeles">
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label>Check-in Date *</label>
                                <input type="date" id="checkIn" required>
                                <small class="text-secondary" id="checkInDay" style="display: block; margin-top: 0.25rem;"></small>
                            </div>
                            <div class="form-group">
                                <label>Check-out Date *</label>
                                <input type="date" id="checkOut" required>
                                <small class="text-secondary" id="checkOutDay" style="display: block; margin-top: 0.25rem;"></small>
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label>Adults *</label>
                                <input type="number" id="adults" min="1" value="1" required>
                                <small class="text-secondary">1 primary + additional extras</small>
                            </div>
                            <div class="form-group">
                                <label>Kids</label>
                                <input type="number" id="kids" min="0" value="0">
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Message</label>
                            <textarea id="message" rows="3"></textarea>
                        </div>

                        <h3 style="margin: 1.5rem 0 1rem; color: var(--primary);">Pricing Details</h3>
                        
                        <div class="form-group">
                            <label>Per Kid Cost (₹)</label>
                            <input type="number" id="perKidCost" step="0.01" min="0" value="0" placeholder="Auto-filled from property">
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label>Primary Adult Cost (₹)</label>
                                <input type="number" id="primaryAdultCost" step="0.01" min="0" value="0" placeholder="For first adult">
                                <small class="text-secondary">For first adult</small>
                            </div>
                            <div class="form-group">
                                <label>Extra Adult Cost (₹)</label>
                                <input type="number" id="extraAdultCost" step="0.01" min="0" value="0" placeholder="Per additional adult">
                                <small class="text-secondary">Per additional adult</small>
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label>Discount</label>
                                <div style="display: flex; gap: 0.5rem;">
                                    <input type="number" id="addDiscount" step="0.01" min="0" value="0" style="flex: 1;">
                                    <select id="addDiscountType" style="width: 80px;">
                                        <option value="percentage">%</option>
                                        <option value="fixed">₹</option>
                                    </select>
                                </div>
                                <small class="text-secondary">Percentage deduction</small>
                            </div>
                            <div class="form-group">
                                <label>GST</label>
                                <div style="display: flex; gap: 0.5rem;">
                                    <select id="addGSTOperation" style="width: 60px;">
                                        <option value="add">+</option>
                                        <option value="subtract">-</option>
                                    </select>
                                    <input type="number" id="addGST" step="0.01" min="0" value="0" style="flex: 1;">
                                    <select id="addGSTType" style="width: 80px;">
                                        <option value="percentage">%</option>
                                        <option value="fixed">₹</option>
                                    </select>
                                </div>
                                <small class="text-secondary">Add or subtract GST</small>
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Tax Withhold</label>
                            <div style="display: flex; gap: 0.5rem;">
                                <input type="number" id="addTaxWithhold" step="0.01" min="0" value="0" style="flex: 1;">
                                <select id="addTaxWithholdType" style="width: 80px;">
                                    <option value="percentage">%</option>
                                    <option value="fixed">₹</option>
                                </select>
                            </div>
                            <small class="text-secondary">Percentage deduction</small>
                        </div>

                        <div id="addPricingBreakdown" style="background: var(--bg-secondary); padding: 1rem; border-radius: 8px; margin-top: 1rem; display: none;">
                            <div id="addBreakdownContent"></div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center;">
                    <div id="addTotalDisplay" style="font-size: 1.25rem; font-weight: 600; color: var(--primary);"></div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button type="button" class="btn btn-secondary" id="saveAsDraftBtn">Save as Draft</button>
                        <button type="button" class="btn btn-primary" id="sendQuoteBtn" style="display: none;">Send Quote</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Auto-populate pricing when property is selected
        const propertySelect = document.getElementById('propertyId');
        propertySelect.addEventListener('change', (e) => {
            const selectedPropertyId = e.target.value;
            if (selectedPropertyId) {
                const property = properties.find(p => p.id == selectedPropertyId);
                if (property) {
                    // Parse values as floats to handle decimal numbers correctly
                    const perAdultCost = parseFloat(property.per_adult_cost) || 0;
                    const extraAdultCost = parseFloat(property.extra_adult_cost) || 0;
                    const perKidCost = parseFloat(property.per_kid_cost) || 0;
                    
                    document.getElementById('primaryAdultCost').value = perAdultCost;
                    document.getElementById('extraAdultCost').value = extraAdultCost;
                    document.getElementById('perKidCost').value = perKidCost;
                    
                    console.log('Auto-populated pricing from property:', {
                        perAdultCost,
                        extraAdultCost,
                        perKidCost
                    });
                } else {
                    console.warn('Property not found with ID:', selectedPropertyId);
                }
            }
        });

        // Auto-generate booking reference when Direct Booking is selected
        const partnerSelect = document.getElementById('partnerId');
        const bookingRefInput = document.getElementById('bookingRef');
        
        const generateBookingReference = () => {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            return `HS${year}${month}${day}${hours}${minutes}${seconds}`;
        };
        
        partnerSelect.addEventListener('change', (e) => {
            // Partner ID 1 is "Direct Booking"
            if (e.target.value === '1') {
                bookingRefInput.value = generateBookingReference();
            }
        });

        // Calculate total and update UI
        const calculateAddBookingTotal = () => {
            const checkIn = document.getElementById('checkIn').value;
            const checkOut = document.getElementById('checkOut').value;
            const numAdults = parseInt(document.getElementById('adults').value) || 1;
            const numKids = parseInt(document.getElementById('kids').value) || 0;
            const primaryAdultCost = parseFloat(document.getElementById('primaryAdultCost').value) || 0;
            const extraAdultCost = parseFloat(document.getElementById('extraAdultCost').value) || 0;
            const perKidCost = parseFloat(document.getElementById('perKidCost').value) || 0;
            const discount = parseFloat(document.getElementById('addDiscount').value) || 0;
            const discountType = document.getElementById('addDiscountType').value;
            const gst = parseFloat(document.getElementById('addGST').value) || 0;
            const gstType = document.getElementById('addGSTType').value;
            const gstOperation = document.getElementById('addGSTOperation').value;
            const taxWithhold = parseFloat(document.getElementById('addTaxWithhold').value) || 0;
            const taxWithholdType = document.getElementById('addTaxWithholdType').value;

            if (!checkIn || !checkOut) {
                document.getElementById('addPricingBreakdown').style.display = 'none';
                document.getElementById('addTotalDisplay').textContent = '';
                document.getElementById('sendQuoteBtn').style.display = 'none';
                document.getElementById('checkInDay').textContent = '';
                document.getElementById('checkOutDay').textContent = '';
                return null;
            }

            const checkInDate = new Date(checkIn);
            const checkOutDate = new Date(checkOut);
            const nights = Math.max(0, Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24)));

            // Show day names
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            document.getElementById('checkInDay').textContent = `📅 Day: ${days[checkInDate.getDay()]}`;
            document.getElementById('checkOutDay').textContent = `📅 Day: ${days[checkOutDate.getDay()]}`;

            if (nights <= 0) {
                document.getElementById('addPricingBreakdown').style.display = 'none';
                document.getElementById('addTotalDisplay').textContent = '';
                document.getElementById('sendQuoteBtn').style.display = 'none';
                return null;
            }

            const extraAdults = Math.max(0, numAdults - 1);

            const primaryAdultTotal = nights * primaryAdultCost;
            const extraAdultsTotal = nights * extraAdults * extraAdultCost;
            const kidsTotal = nights * numKids * perKidCost;

            const subtotal = primaryAdultTotal + extraAdultsTotal + kidsTotal;

            const discountAmount = discountType === 'percentage' 
                ? (subtotal * discount / 100)
                : discount;

            const afterDiscount = subtotal - discountAmount;

            const gstAmount = gstType === 'percentage'
                ? (afterDiscount * gst / 100)
                : gst;

            const taxWithholdAmount = taxWithholdType === 'percentage'
                ? (afterDiscount * taxWithhold / 100)
                : taxWithhold;

            const total = gstOperation === 'add' 
                ? (afterDiscount + gstAmount - taxWithholdAmount)
                : (afterDiscount - gstAmount - taxWithholdAmount);

            // Update breakdown display
            const breakdownHTML = `
                <div style="font-size: 0.9rem; line-height: 1.8;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span style="font-weight: 600;">Nights:</span>
                        <span>${nights}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span>Primary Adult (${nights} × ₹${primaryAdultCost.toFixed(2)}):</span>
                        <span>₹${primaryAdultTotal.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span>Extra Adults (${nights} × ${extraAdults} × ₹${extraAdultCost.toFixed(2)}):</span>
                        <span>₹${extraAdultsTotal.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span>Kids (${nights} × ${numKids} × ₹${perKidCost.toFixed(2)}):</span>
                        <span>₹${kidsTotal.toFixed(2)}</span>
                    </div>
                    <div style="border-top: 1px solid var(--border); margin: 0.5rem 0; padding-top: 0.5rem;"></div>
                    <div style="display: flex; justify-content: space-between; font-weight: 600;">
                        <span>Subtotal:</span>
                        <span>₹${subtotal.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; color: var(--success);">
                        <span>Discount (${discount}${discountType === 'percentage' ? '%' : '₹'}):</span>
                        <span>- ₹${discountAmount.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-weight: 600;">
                        <span>After Discount:</span>
                        <span>₹${afterDiscount.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span>GST (${gst}${gstType === 'percentage' ? '%' : '₹'}):</span>
                        <span>${gstOperation === 'add' ? '+' : '-'} ₹${gstAmount.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; color: var(--danger);">
                        <span>Tax Withhold ${taxWithhold}${taxWithholdType === 'percentage' ? '%' : '₹'}:</span>
                        <span>- ₹${taxWithholdAmount.toFixed(2)}</span>
                    </div>
                    <div style="border-top: 2px solid var(--primary); margin: 0.5rem 0; padding-top: 0.5rem;"></div>
                    <div style="display: flex; justify-content: space-between; font-size: 1.1rem; font-weight: 700; color: var(--primary);">
                        <span>Total Amount:</span>
                        <span>₹${total.toFixed(2)}</span>
                    </div>
                </div>
            `;

            document.getElementById('addBreakdownContent').innerHTML = breakdownHTML;
            document.getElementById('addPricingBreakdown').style.display = 'block';
            document.getElementById('addTotalDisplay').innerHTML = `<div>Total: ₹${total.toFixed(2)}</div><div style="font-size: 0.9rem; font-weight: 400; color: var(--text-secondary);">${nights} night${nights !== 1 ? 's' : ''}</div>`;
            document.getElementById('sendQuoteBtn').style.display = 'inline-block';

            return {
                nights,
                subtotal,
                discount: discountAmount,
                gst: gstAmount,
                taxWithhold: taxWithholdAmount,
                total
            };
        };

        // Add change listeners to recalculate
        ['checkIn', 'checkOut', 'adults', 'kids', 'primaryAdultCost', 'extraAdultCost', 'perKidCost', 'addDiscount', 'addDiscountType', 'addGST', 'addGSTType', 'addGSTOperation', 'addTaxWithhold', 'addTaxWithholdType'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', calculateAddBookingTotal);
                element.addEventListener('input', calculateAddBookingTotal);
            }
        });

        // Save as Draft button
        document.getElementById('saveAsDraftBtn').addEventListener('click', async () => {
            await this.saveNewBooking(modal, false);
        });

        // Send Quote button
        document.getElementById('sendQuoteBtn').addEventListener('click', async () => {
            await this.saveNewBooking(modal, true);
        });
    }

    async saveNewBooking(modal, sendQuote = false) {
            const saveBtn = sendQuote ? document.getElementById('sendQuoteBtn') : document.getElementById('saveAsDraftBtn');
            const propertyId = document.getElementById('propertyId').value;
            const checkIn = document.getElementById('checkIn').value;
            const checkOut = document.getElementById('checkOut').value;
            const numAdults = parseInt(document.getElementById('adults').value);
            const numKids = parseInt(document.getElementById('kids').value);
            
            // Validate property selection
            if (!propertyId) {
                this.showToast('Please select a property', 'error');
                return;
            }
            
            // Validate dates
            if (!checkIn || !checkOut) {
                this.showToast('Please select check-in and check-out dates', 'error');
                return;
            }
            
            const checkInDate = new Date(checkIn);
            const checkOutDate = new Date(checkOut);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            if (checkOutDate <= checkInDate) {
                this.showToast('Check-out date must be after check-in date', 'error');
                return;
            }
            
            const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
            if (nights < CONFIG.VALIDATION.MIN_BOOKING_DAYS) {
                this.showToast(`Minimum ${CONFIG.VALIDATION.MIN_BOOKING_DAYS} night(s) required`, 'error');
                return;
            }
            
            if (nights > CONFIG.VALIDATION.MAX_BOOKING_DAYS) {
                this.showToast(`Maximum ${CONFIG.VALIDATION.MAX_BOOKING_DAYS} nights allowed`, 'error');
                return;
            }
            
            // Validate guest count
            if (numAdults + numKids > CONFIG.VALIDATION.MAX_GUESTS) {
                this.showToast(`Maximum ${CONFIG.VALIDATION.MAX_GUESTS} guests allowed`, 'error');
                return;
            }

            // Calculate total
            const primaryAdultCost = parseFloat(document.getElementById('primaryAdultCost').value) || 0;
            const extraAdultCost = parseFloat(document.getElementById('extraAdultCost').value) || 0;
            const perKidCost = parseFloat(document.getElementById('perKidCost').value) || 0;
            const extraAdults = Math.max(0, numAdults - 1);
            
            const primaryAdultTotal = nights * primaryAdultCost;
            const extraAdultsTotal = nights * extraAdults * extraAdultCost;
            const kidsTotal = nights * numKids * perKidCost;
            const subtotal = primaryAdultTotal + extraAdultsTotal + kidsTotal;

            const discount = parseFloat(document.getElementById('addDiscount').value) || 0;
            const discountType = document.getElementById('addDiscountType').value;
            const gst = parseFloat(document.getElementById('addGST').value) || 0;
            const gstType = document.getElementById('addGSTType').value;
            const gstOperation = document.getElementById('addGSTOperation').value;
            const taxWithhold = parseFloat(document.getElementById('addTaxWithhold').value) || 0;
            const taxWithholdType = document.getElementById('addTaxWithholdType').value;

            const discountAmount = discountType === 'percentage' ? (subtotal * discount / 100) : discount;
            const afterDiscount = subtotal - discountAmount;
            const gstAmount = gstType === 'percentage' ? (afterDiscount * gst / 100) : gst;
            const taxWithholdAmount = taxWithholdType === 'percentage' ? (afterDiscount * taxWithhold / 100) : taxWithhold;
            const total = gstOperation === 'add' 
                ? (afterDiscount + gstAmount - taxWithholdAmount)
                : (afterDiscount - gstAmount - taxWithholdAmount);
            
            // Show loading state
            saveBtn.disabled = true;
            const originalText = saveBtn.textContent;
            saveBtn.textContent = 'Saving...';
            
            const bookingData = {
                status: document.getElementById('bookingStatus').value,
                property_id: parseInt(propertyId),
                partner_id: document.getElementById('partnerId').value,
                booking_reference: document.getElementById('bookingRef').value,
                customer_name: document.getElementById('customerName').value,
                customer_phone: document.getElementById('customerPhone').value,
                customer_email: document.getElementById('customerEmail').value,
                customer_state: document.getElementById('customerState').value,
                check_in_date: checkIn,
                check_out_date: checkOut,
                num_adults: numAdults,
                num_kids: numKids,
                per_adult_cost: primaryAdultCost,
                extra_adult_cost: extraAdultCost,
                per_kid_cost: perKidCost,
                discount: discount,
                discount_type: discountType,
                gst: gst,
                gst_type: gstType,
                gst_operation: gstOperation,
                tax_withhold: taxWithhold,
                tax_withhold_type: taxWithholdType,
                total_amount: total,
                message: document.getElementById('message').value,
                csrf_token: this.csrfToken
            };

            try {
                const response = await fetch('api/bookings.php?action=create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(bookingData)
                });

                const data = await response.json();
                if (data.success) {
                    if (sendQuote) {
                        modal.remove();
                        // Show delivery method selection with the newly created booking ID
                        await this.showInvoiceDeliveryModal(data.booking_id);
                    } else {
                        modal.remove();
                        this.showToast('Booking created successfully!', 'success');
                        this.loadPage('home');
                        this.loadNotifications();
                    }
                } else {
                    this.showToast(data.message || 'Error creating booking', 'error');
                    saveBtn.disabled = false;
                    saveBtn.textContent = originalText;
                }
            } catch (error) {
                this.showToast('Connection error. Please try again.', 'error');
                saveBtn.disabled = false;
                saveBtn.textContent = originalText;
            }
    }

    async showViewRequestModal(id) {
        const response = await fetch(`api/bookings.php?action=get&id=${id}`);
        const data = await response.json();
        
        if (!data.success) {
            this.showToast('Error loading booking details', 'error');
            return;
        }

        const booking = data.booking;
        
        console.log('Booking data:', booking);
        
        // Fetch property data to auto-populate pricing if needed
        let propertyPricing = null;
        if (booking.property_id) {
            try {
                const propResponse = await fetch('api/properties.php?action=list');
                const propData = await propResponse.json();
                console.log('Properties data:', propData);
                if (propData.success) {
                    const property = propData.properties.find(p => p.id == booking.property_id);
                    console.log('Found property:', property);
                    if (property) {
                        propertyPricing = {
                            per_adult_cost: parseFloat(property.per_adult_cost) || 0,
                            extra_adult_cost: parseFloat(property.extra_adult_cost) || 0,
                            per_kid_cost: parseFloat(property.per_kid_cost) || 0
                        };
                        console.log('Property pricing:', propertyPricing);
                    }
                }
            } catch (error) {
                console.error('Error fetching property pricing:', error);
            }
        } else {
            console.warn('No property_id in booking');
        }
        
        // Use property pricing if booking pricing is not set (0 or null)
        // Need to check for 0 values properly since '0.00' is truthy
        const perAdultCost = (booking.per_adult_cost && parseFloat(booking.per_adult_cost) > 0) 
            ? parseFloat(booking.per_adult_cost) 
            : (propertyPricing?.per_adult_cost || 0);
        const extraAdultCost = (booking.extra_adult_cost && parseFloat(booking.extra_adult_cost) > 0) 
            ? parseFloat(booking.extra_adult_cost) 
            : (propertyPricing?.extra_adult_cost || 0);
        const perKidCost = (booking.per_kid_cost && parseFloat(booking.per_kid_cost) > 0) 
            ? parseFloat(booking.per_kid_cost)
            : (propertyPricing?.per_kid_cost || 0);
        
        console.log('Final pricing values:', { perAdultCost, extraAdultCost, perKidCost });        const nights = Math.ceil((new Date(booking.check_out_date) - new Date(booking.check_in_date)) / (1000 * 60 * 60 * 24));
        
        // Calculate primary and extra adults
        const primaryAdults = booking.num_adults > 0 ? 1 : 0;
        const extraAdults = booking.num_adults > 1 ? booking.num_adults - 1 : 0;

        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px;">
                <div class="modal-header">
                    <h2 class="modal-title">Booking Details - ${booking.customer_name}</h2>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">✕</button>
                </div>
                <div class="modal-body">
                    <form id="bookingDetailsForm">
                        <h3 style="margin-bottom: 1rem; color: var(--primary);">Customer Information</h3>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Name *</label>
                                <input type="text" id="editCustomerName" value="${booking.customer_name}" required>
                            </div>
                            <div class="form-group">
                                <label>Phone *</label>
                                <input type="tel" id="editCustomerPhone" value="${booking.customer_phone}" placeholder="+91 98765 43210 or +1 (555) 123-4567" required>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Email</label>
                            <input type="email" id="editCustomerEmail" value="${booking.customer_email}">
                        </div>

                        <div class="form-group">
                            <label>State</label>
                            <input type="text" id="editCustomerState" value="${booking.customer_state || ''}" placeholder="e.g., Maharashtra">
                        </div>
                        
                        <h3 style="margin: 1.5rem 0 1rem; color: var(--primary);">Booking Details</h3>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Status</label>
                                <select id="editStatus">
                                    <option value="Inquiry" ${booking.status === 'Inquiry' ? 'selected' : ''}>Inquiry</option>
                                    <option value="Confirmed" ${booking.status === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
                                    <option value="Cancelled" ${booking.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                                    <option value="Personal" ${booking.status === 'Personal' ? 'selected' : ''}>Personal</option>
                                    <option value="Not confirmed" ${booking.status === 'Not confirmed' ? 'selected' : ''}>Not confirmed</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Booking Reference</label>
                                <input type="text" id="editBookingRef" value="${booking.booking_reference || ''}">
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label>Check-in Date *</label>
                                <input type="date" id="editCheckIn" value="${booking.check_in_date}" required>
                                <small class="text-secondary" id="editCheckInDay" style="display: block; margin-top: 0.25rem;"></small>
                            </div>
                            <div class="form-group">
                                <label>Check-out Date *</label>
                                <input type="date" id="editCheckOut" value="${booking.check_out_date}" required>
                                <small class="text-secondary" id="editCheckOutDay" style="display: block; margin-top: 0.25rem;"></small>
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label>Total Adults *</label>
                                <input type="number" id="editAdults" value="${booking.num_adults}" min="1" required>
                                <small class="text-secondary">Primary: 1, Extra: <span id="extraAdultsCalc">${extraAdults}</span></small>
                            </div>
                            <div class="form-group">
                                <label>Kids</label>
                                <input type="number" id="editKids" value="${booking.num_kids}" min="0">
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label>Message</label>
                            <textarea id="editMessage" rows="2">${booking.message || ''}</textarea>
                        </div>
                        
                        <hr style="margin: 1.5rem 0;">
                        <h3 style="margin-bottom: 1rem; color: var(--primary);">Pricing Details</h3>
                        <div class="form-group">
                            <label>Per Kid Cost (₹) *</label>
                            <input type="number" id="editPerKid" value="${perKidCost}" step="0.01" min="0" required>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Primary Adult Cost (₹) *</label>
                                <input type="number" id="editPrimaryAdult" value="${perAdultCost}" step="0.01" min="0" required>
                                <small class="text-secondary">For first adult</small>
                            </div>
                            <div class="form-group">
                                <label>Extra Adult Cost (₹) *</label>
                                <input type="number" id="editExtraAdult" value="${extraAdultCost}" step="0.01" min="0" required>
                                <small class="text-secondary">Per additional adult</small>
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label style="display: flex; align-items: center; gap: 0.5rem;">
                                    Discount
                                    <select id="editDiscountType" style="width: auto; padding: 0.25rem 0.5rem; font-size: 0.9rem;">
                                        <option value="fixed" ${(booking.discount_type || 'fixed') === 'fixed' ? 'selected' : ''}>₹</option>
                                        <option value="percentage" ${booking.discount_type === 'percentage' ? 'selected' : ''}>%</option>
                                    </select>
                                </label>
                                <input type="number" id="editDiscount" min="0" value="${booking.discount || 0}">
                                <small class="text-secondary" id="discountHint">Fixed amount deduction</small>
                            </div>
                            <div class="form-group">
                                <label style="display: flex; align-items: center; gap: 0.5rem;">
                                    GST
                                    <select id="editGstType" style="width: auto; padding: 0.25rem 0.5rem; font-size: 0.9rem;">
                                        <option value="fixed" ${(booking.gst_type || 'fixed') === 'fixed' ? 'selected' : ''}>₹</option>
                                        <option value="percentage" ${booking.gst_type === 'percentage' ? 'selected' : ''}>%</option>
                                    </select>
                                </label>
                                <input type="number" id="editGst" value="${booking.gst || 0}">
                                <small class="text-secondary" id="gstHint">Fixed amount</small>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label style="display: flex; align-items: center; gap: 0.5rem;">
                                    Tax Withhold
                                    <select id="editTaxWithholdType" style="width: auto; padding: 0.25rem 0.5rem; font-size: 0.9rem;">
                                        <option value="fixed" ${(booking.tax_withhold_type || 'fixed') === 'fixed' ? 'selected' : ''}>₹</option>
                                        <option value="percentage" ${booking.tax_withhold_type === 'percentage' ? 'selected' : ''}>%</option>
                                    </select>
                                </label>
                                <input type="number" id="editTaxWithhold" value="${booking.tax_withhold || 0}">
                                <small class="text-secondary" id="taxWithholdHint">Fixed amount deduction</small>
                            </div>
                        </div>
                        
                        <div style="margin: 1rem 0; padding: 1rem; background: var(--bg-secondary); border-radius: 8px;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                                <span>Nights:</span>
                                <strong><span id="calcNights">${nights}</span></strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                                <span>Primary Adult (1 × ₹<span id="primaryAdultDisplay">0</span>):</span>
                                <strong>₹<span id="calcPrimaryAdult">0</span></strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                                <span>Extra Adults (<span id="calcExtraAdultsCount">${extraAdults}</span> × ₹<span id="extraAdultDisplay">0</span>):</span>
                                <strong>₹<span id="calcExtraAdults">0</span></strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                                <span>Kids (<span id="calcKidsCount">${booking.num_kids}</span> × ₹<span id="perKidDisplay">0</span>):</span>
                                <strong>₹<span id="calcKids">0</span></strong>
                            </div>
                            <hr style="margin: 0.5rem 0; border-color: var(--text-secondary);">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                                <span>Subtotal:</span>
                                <strong>₹<span id="calcSubtotal">0</span></strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; color: var(--success);">
                                <span>Discount (<span id="discountPercent">0</span>%):</span>
                                <strong>- ₹<span id="calcDiscountAmount">0</span></strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                                <span>After Discount:</span>
                                <strong>₹<span id="calcAfterDiscount">0</span></strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                                <span>GST (<span id="gstPercent">0</span>%):</span>
                                <strong>+ ₹<span id="calcGstAmount">0</span></strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; color: var(--error);">
                                <span>Tax Withhold <span id="taxWithholdDisplay">0%</span>:</span>
                                <strong>- ₹<span id="calcTaxWithholdAmount">0</span></strong>
                            </div>
                            <hr style="margin: 0.5rem 0;">
                            <div style="display: flex; justify-content: space-between; font-size: 1.1rem; color: var(--primary); font-weight: 700;">
                                <span>Total Amount:</span>
                                <span>₹<span id="calcTotal">0</span></span>
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label>Payment Status *</label>
                                <select id="editPaymentStatus">
                                    <option value="Quote" ${booking.payment_status === 'Quote' ? 'selected' : ''}>Quote (Valid 3 days)</option>
                                    <option value="Pending" ${booking.payment_status === 'Pending' ? 'selected' : ''}>Pending</option>
                                    <option value="Partial Paid" ${booking.payment_status === 'Partial Paid' ? 'selected' : ''}>Partial Paid</option>
                                    <option value="Paid" ${booking.payment_status === 'Paid' ? 'selected' : ''}>Paid</option>
                                </select>
                            </div>
                            <div class="form-group" id="paymentMethodGroup">
                                <label>Payment Method</label>
                                <select id="editPaymentMethod">
                                    <option value="">Select...</option>
                                    <option value="Cash" ${booking.payment_method === 'Cash' ? 'selected' : ''}>Cash</option>
                                    <option value="UPI" ${booking.payment_method === 'UPI' ? 'selected' : ''}>UPI</option>
                                    <option value="Bank Transfer" ${booking.payment_method === 'Bank Transfer' ? 'selected' : ''}>Bank Transfer</option>
                                    <option value="Card" ${booking.payment_method === 'Card' ? 'selected' : ''}>Card</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group" id="amountPaidGroup" style="display: none;">
                            <label>Amount Paid (₹) *</label>
                            <input type="number" id="editAmountPaid" value="${booking.amount_paid || 0}" min="0">
                            <small class="text-secondary">Remaining: ₹<span id="remainingAmount">0</span></small>
                        </div>
                    </form>
                </div>
                <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                    <div id="totalDisplay" style="font-size: 1.2rem; font-weight: 700; color: var(--primary);"></div>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        ${booking.payment_status === 'Paid' ? `
                            <button type="button" class="btn btn-secondary" id="viewInvoiceBtn">📄 View Invoice</button>
                        ` : ''}
                        ${(booking.status === 'Inquiry' || booking.status === 'Enquiry') ? `
                            <button type="button" class="btn btn-secondary" id="saveDraftBtn">Save as Draft</button>
                            ${booking.customer_email ? `<button type="button" class="btn btn-primary" id="sendOfferBtn">Send Quote</button>` : '<button type="button" class="btn btn-primary" id="saveBookingChanges">Save Changes</button>'}
                        ` : booking.status === 'Confirmed' ? `
                            ${booking.customer_email ? `<button type="button" class="btn btn-secondary" id="sendUpdatedInvoiceBtn" style="display: none;">Send Updated Invoice</button>` : ''}
                            <button type="button" class="btn btn-primary" id="saveBookingChanges">Save Changes</button>
                        ` : `
                            <button type="button" class="btn btn-primary" id="saveBookingChanges">Save Changes</button>
                        `}
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        
        // Store original values for change detection
        const originalData = {
            customer_name: booking.customer_name,
            customer_phone: booking.customer_phone,
            customer_email: booking.customer_email,
            customer_state: booking.customer_state || '',
            check_in_date: booking.check_in_date,
            check_out_date: booking.check_out_date,
            num_adults: booking.num_adults,
            num_kids: booking.num_kids,
            per_adult_cost: booking.per_adult_cost,
            extra_adult_cost: booking.extra_adult_cost,
            per_kid_cost: booking.per_kid_cost,
            discount: booking.discount,
            gst: booking.gst,
            tax_withhold: booking.tax_withhold,
            tax_withhold_type: booking.tax_withhold_type,
            payment_status: booking.payment_status,
            payment_method: booking.payment_method,
            amount_paid: booking.amount_paid || 0
        };
        
        // Change detection function
        const detectChanges = () => {
            if (booking.status !== 'Confirmed') return false;
            
            const hasChanges = 
                document.getElementById('editCustomerName').value !== originalData.customer_name ||
                document.getElementById('editCustomerPhone').value !== originalData.customer_phone ||
                document.getElementById('editCustomerEmail').value !== originalData.customer_email ||
                document.getElementById('editCustomerState').value !== originalData.customer_state ||
                document.getElementById('editCheckIn').value !== originalData.check_in_date ||
                document.getElementById('editCheckOut').value !== originalData.check_out_date ||
                parseInt(document.getElementById('editAdults').value) !== parseInt(originalData.num_adults) ||
                parseInt(document.getElementById('editKids').value) !== parseInt(originalData.num_kids) ||
                parseFloat(document.getElementById('editPrimaryAdult')?.value || 0) !== parseFloat(originalData.per_adult_cost || 0) ||
                parseFloat(document.getElementById('editExtraAdult')?.value || 0) !== parseFloat(originalData.extra_adult_cost || 0) ||
                parseFloat(document.getElementById('editPerKid')?.value || 0) !== parseFloat(originalData.per_kid_cost || 0) ||
                parseFloat(document.getElementById('editDiscount')?.value || 0) !== parseFloat(originalData.discount || 0) ||
                document.getElementById('editDiscountType')?.value !== (originalData.discount_type || 'fixed') ||
                parseFloat(document.getElementById('editGst')?.value || 0) !== parseFloat(originalData.gst || 0) ||
                document.getElementById('editGstType')?.value !== (originalData.gst_type || 'fixed') ||
                parseFloat(document.getElementById('editTaxWithhold')?.value || 0) !== parseFloat(originalData.tax_withhold || 0) ||
                document.getElementById('editTaxWithholdType')?.value !== (originalData.tax_withhold_type || 'fixed') ||
                document.getElementById('editPaymentStatus')?.value !== originalData.payment_status ||
                document.getElementById('editPaymentMethod')?.value !== originalData.payment_method ||
                parseFloat(document.getElementById('editAmountPaid')?.value || 0) !== parseFloat(originalData.amount_paid);
            
            const sendBtn = document.getElementById('sendUpdatedInvoiceBtn');
            const currentEmail = document.getElementById('editCustomerEmail').value.trim();
            
            // Only show send invoice button if there are changes AND email exists
            if (sendBtn) {
                sendBtn.style.display = (hasChanges && currentEmail) ? 'inline-block' : 'none';
            }
            
            return hasChanges;
        };
        
        // Auto-calculate pricing
        const calculateTotal = () => {
            const checkIn = document.getElementById('editCheckIn').value;
            const checkOut = document.getElementById('editCheckOut').value;
            
            if (!checkIn || !checkOut) {
                document.getElementById('editCheckInDay').textContent = '';
                document.getElementById('editCheckOutDay').textContent = '';
                return 0;
            }
            
            const checkInDate = new Date(checkIn);
            const checkOutDate = new Date(checkOut);
            const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
            
            // Show day names
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            document.getElementById('editCheckInDay').textContent = `📅 Day: ${days[checkInDate.getDay()]}`;
            document.getElementById('editCheckOutDay').textContent = `📅 Day: ${days[checkOutDate.getDay()]}`;
            
            const totalAdults = parseInt(document.getElementById('editAdults').value) || 0;
            const primaryAdults = totalAdults > 0 ? 1 : 0;
            const extraAdultsCount = totalAdults > 1 ? totalAdults - 1 : 0;
            const kids = parseInt(document.getElementById('editKids').value) || 0;
            
            const primaryAdultCost = parseFloat(document.getElementById('editPrimaryAdult')?.value) || 0;
            const extraAdultCost = parseFloat(document.getElementById('editExtraAdult')?.value) || 0;
            const perKid = parseFloat(document.getElementById('editPerKid')?.value) || 0;
            
            console.log('Calculate Total - Kids:', kids, 'Per Kid Cost:', perKid, 'Kids Total:', perKid * kids);
            const discount = parseFloat(document.getElementById('editDiscount')?.value) || 0;
            const discountType = document.getElementById('editDiscountType')?.value || 'fixed';
            const gst = parseFloat(document.getElementById('editGst')?.value) || 0;
            const gstType = document.getElementById('editGstType')?.value || 'fixed';
            const taxWithhold = parseFloat(document.getElementById('editTaxWithhold')?.value) || 0;
            const taxWithholdType = document.getElementById('editTaxWithholdType')?.value || 'fixed';
            
            console.log('Edit Modal Calculation:', {
                discount, discountType,
                gst, gstType,
                taxWithhold, taxWithholdType,
                subtotal
            });
            
            // Update displays
            document.getElementById('extraAdultsCalc').textContent = extraAdultsCount;
            document.getElementById('calcNights').textContent = nights;
            document.getElementById('calcExtraAdultsCount').textContent = extraAdultsCount;
            document.getElementById('calcKidsCount').textContent = kids;
            document.getElementById('primaryAdultDisplay').textContent = primaryAdultCost.toFixed(0);
            document.getElementById('extraAdultDisplay').textContent = extraAdultCost.toFixed(0);
            document.getElementById('perKidDisplay').textContent = perKid.toFixed(0);
            
            // Calculate line items (multiply by nights)
            const primaryAdultTotal = primaryAdultCost * primaryAdults * nights;
            const extraAdultsTotal = extraAdultCost * extraAdultsCount * nights;
            const kidsTotal = perKid * kids * nights;
            
            document.getElementById('calcPrimaryAdult').textContent = primaryAdultTotal.toFixed(0);
            document.getElementById('calcExtraAdults').textContent = extraAdultsTotal.toFixed(0);
            document.getElementById('calcKids').textContent = kidsTotal.toFixed(0);
            
            // Calculate subtotal
            const subtotal = primaryAdultTotal + extraAdultsTotal + kidsTotal;
            document.getElementById('calcSubtotal').textContent = subtotal.toFixed(0);
            
            // Calculate discount
            let discountAmount = 0;
            if (discountType === 'percentage') {
                discountAmount = subtotal * discount / 100;
                document.getElementById('discountPercent').textContent = discount + '%';
            } else {
                discountAmount = discount;
                document.getElementById('discountPercent').textContent = '(Fixed)';
            }
            document.getElementById('calcDiscountAmount').textContent = discountAmount.toFixed(0);
            
            // After discount
            const afterDiscount = subtotal - discountAmount;
            document.getElementById('calcAfterDiscount').textContent = afterDiscount.toFixed(0);
            
            // Calculate GST
            let gstAmount = 0;
            if (gstType === 'percentage') {
                gstAmount = afterDiscount * gst / 100;
                document.getElementById('gstPercent').textContent = gst + '%';
            } else {
                gstAmount = gst;
                document.getElementById('gstPercent').textContent = '(Fixed)';
            }
            document.getElementById('calcGstAmount').textContent = gstAmount.toFixed(0);
            
            // Calculate tax withhold
            let taxWithholdAmount = 0;
            if (taxWithholdType === 'percentage') {
                taxWithholdAmount = (afterDiscount + gstAmount) * taxWithhold / 100;
                document.getElementById('taxWithholdDisplay').textContent = taxWithhold + '%';
            } else {
                taxWithholdAmount = taxWithhold;
                document.getElementById('taxWithholdDisplay').textContent = '(Fixed)';
            }
            document.getElementById('calcTaxWithholdAmount').textContent = taxWithholdAmount.toFixed(0);
            
            // Calculate total
            const total = afterDiscount + gstAmount - taxWithholdAmount;
            document.getElementById('calcTotal').textContent = total.toFixed(0);
            document.getElementById('totalDisplay').innerHTML = `<div>Total: ₹${total.toFixed(0)}</div><div style="font-size: 0.9rem; font-weight: 400; color: var(--text-secondary);">${nights} night${nights !== 1 ? 's' : ''}</div>`;
            
            // Update remaining amount if partial paid
            const amountPaid = parseFloat(document.getElementById('editAmountPaid')?.value) || 0;
            const remaining = total - amountPaid;
            if (document.getElementById('remainingAmount')) {
                document.getElementById('remainingAmount').textContent = remaining.toFixed(0);
            }
            
            // Detect changes for updated invoice button
            detectChanges();
            
            return total;
        };
        
        // Discount type toggle
        const updateDiscountHint = () => {
            const type = document.getElementById('editDiscountType')?.value;
            const hint = document.getElementById('discountHint');
            if (hint) {
                hint.textContent = type === 'percentage' ? 'Percentage deduction' : 'Fixed amount deduction';
            }
            calculateTotal();
        };
        
        // GST type toggle
        const updateGstHint = () => {
            const type = document.getElementById('editGstType')?.value;
            const hint = document.getElementById('gstHint');
            if (hint) {
                hint.textContent = type === 'percentage' ? 'Percentage amount' : 'Fixed amount';
            }
            calculateTotal();
        };
        
        // Tax withhold type toggle
        const updateTaxWithholdHint = () => {
            const type = document.getElementById('editTaxWithholdType')?.value;
            const hint = document.getElementById('taxWithholdHint');
            if (hint) {
                hint.textContent = type === 'percentage' ? 'Percentage deduction' : 'Fixed amount deduction';
            }
            calculateTotal();
        };
        
        // Payment method visibility toggle
        const togglePaymentMethod = () => {
            const paymentStatus = document.getElementById('editPaymentStatus')?.value;
            const paymentMethodGroup = document.getElementById('paymentMethodGroup');
            const amountPaidGroup = document.getElementById('amountPaidGroup');
            
            if (paymentMethodGroup) {
                if (paymentStatus === 'Quote' || paymentStatus === 'Pending') {
                    paymentMethodGroup.style.display = 'none';
                } else {
                    paymentMethodGroup.style.display = 'block';
                }
            }
            
            if (amountPaidGroup) {
                if (paymentStatus === 'Partial Paid') {
                    amountPaidGroup.style.display = 'block';
                } else {
                    amountPaidGroup.style.display = 'none';
                }
            }
            
            calculateTotal();
        };
        
        // Add event listeners for auto-calculation and change detection
        ['editCustomerName', 'editCustomerPhone', 'editCustomerEmail', 'editCheckIn', 'editCheckOut', 'editAdults', 'editKids', 'editPrimaryAdult', 'editExtraAdult', 'editPerKid', 'editDiscount', 'editGst', 'editTaxWithhold', 'editAmountPaid'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', () => {
                calculateTotal();
                detectChanges();
            });
        });
        
        document.getElementById('editPaymentStatus')?.addEventListener('change', () => {
            togglePaymentMethod();
            detectChanges();
        });
        document.getElementById('editPaymentMethod')?.addEventListener('change', detectChanges);
        document.getElementById('editDiscountType')?.addEventListener('change', () => {
            updateDiscountHint();
            detectChanges();
        });
        document.getElementById('editGstType')?.addEventListener('change', () => {
            updateGstHint();
            detectChanges();
        });
        document.getElementById('editTaxWithholdType')?.addEventListener('change', () => {
            updateTaxWithholdHint();
            detectChanges();
        });
        
        // Initial calculation and setup
        updateDiscountHint();
        updateGstHint();
        updateTaxWithholdHint();
        calculateTotal();
        togglePaymentMethod();

        // Save changes handler
        document.getElementById('saveBookingChanges')?.addEventListener('click', async () => {
            await this.saveBookingData(booking, modal, calculateTotal);
        });
        
        // View Invoice button handler (for paid bookings)
        document.getElementById('viewInvoiceBtn')?.addEventListener('click', async () => {
            // Close current modal and show invoice with fresh data
            modal.remove();
            await this.showInvoiceFromDB(booking.id);
        });

        // Save as draft handler (for Inquiry status)
        document.getElementById('saveDraftBtn')?.addEventListener('click', async () => {
            await this.saveBookingData(booking, modal, calculateTotal, false);
        });

        // Send offer handler (for Inquiry status)
        document.getElementById('sendOfferBtn')?.addEventListener('click', async () => {
            await this.saveBookingData(booking, modal, calculateTotal, true);
        });
        
        // Send updated invoice handler (for Confirmed status)
        document.getElementById('sendUpdatedInvoiceBtn')?.addEventListener('click', async () => {
            await this.saveBookingData(booking, modal, calculateTotal, true);
        });
    }

    async saveBookingData(booking, modal, calculateTotal, sendOffer = false) {
        const total = calculateTotal();
        
        const updatedData = {
            id: booking.id,
            customer_name: document.getElementById('editCustomerName').value,
            customer_phone: document.getElementById('editCustomerPhone').value,
            customer_email: document.getElementById('editCustomerEmail').value,
            customer_state: document.getElementById('editCustomerState').value,
            status: document.getElementById('editStatus').value,
            booking_reference: document.getElementById('editBookingRef').value,
            check_in_date: document.getElementById('editCheckIn').value,
            check_out_date: document.getElementById('editCheckOut').value,
            num_adults: document.getElementById('editAdults').value,
            num_kids: document.getElementById('editKids').value,
            message: document.getElementById('editMessage').value
        };
        
        if (booking.status === 'Inquiry' || booking.status === 'Enquiry' || booking.status === 'Confirmed') {
            updatedData.per_adult_cost = document.getElementById('editPrimaryAdult').value;
            updatedData.extra_adult_cost = document.getElementById('editExtraAdult').value;
            updatedData.per_kid_cost = document.getElementById('editPerKid').value;
            updatedData.discount = document.getElementById('editDiscount').value;
            updatedData.discount_type = document.getElementById('editDiscountType').value;
            updatedData.gst = document.getElementById('editGst').value;
            updatedData.gst_type = document.getElementById('editGstType').value;
            updatedData.tax_withhold = document.getElementById('editTaxWithhold').value;
            updatedData.tax_withhold_type = document.getElementById('editTaxWithholdType').value;
            updatedData.total_amount = total;
            updatedData.payment_status = document.getElementById('editPaymentStatus').value;
            updatedData.payment_method = document.getElementById('editPaymentMethod').value;
            updatedData.amount_paid = parseFloat(document.getElementById('editAmountPaid')?.value) || 0;
        }
        
        updatedData.csrf_token = this.csrfToken;
        
        const response = await fetch('api/bookings.php?action=update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server error:', errorText);
            this.showToast('Server error: Check console for details', 'error');
            return;
        }

        const result = await response.json();
        if (result.success) {
            if (sendOffer) {
                modal.remove();
                // Show delivery method selection
                await this.showInvoiceDeliveryModal(booking.id);
            } else {
                modal.remove();
                this.showToast('Booking updated successfully!', 'success');
                this.loadPage(this.currentPage);
                this.loadNotifications();
            }
        } else {
            this.showToast(result.message || 'Error updating booking', 'error');
        }
    }

    async showInvoiceDeliveryModal(bookingId) {
        // Fetch updated booking data with property information
        const response = await fetch(`api/bookings.php?action=get&id=${bookingId}`);
        const data = await response.json();
        
        if (!data.success) {
            this.showToast('Error loading booking details', 'error');
            return;
        }

        const booking = data.booking;
        
        // Generate invoice HTML
        const invoiceHTML = await this.generateInvoiceHTML(booking);
        
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px; max-height: 90vh; display: flex; flex-direction: column;">
                <div class="modal-header">
                    <h2 class="modal-title">Send Invoice/Quote</h2>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">✕</button>
                </div>
                <div class="modal-body" style="flex: 1; overflow-y: auto;">
                    <div style="margin-bottom: 1.5rem;">
                        <p style="margin-bottom: 1rem;">Choose how you'd like to send the invoice to <strong>${booking.customer_name}</strong>:</p>
                        
                        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                            <button class="delivery-option-btn" id="sendViaWhatsApp" style="display: flex; align-items: center; gap: 1rem; padding: 1rem; border: 2px solid var(--border); border-radius: 8px; background: var(--bg-secondary); cursor: pointer; transition: all 0.3s;">
                                <div style="font-size: 2rem;">📱</div>
                                <div style="text-align: left; flex: 1;">
                                    <div style="font-weight: 600; margin-bottom: 0.25rem;">WhatsApp</div>
                                    <div style="font-size: 0.9rem; color: var(--text-secondary);">Send invoice via WhatsApp to ${booking.customer_phone}</div>
                                </div>
                            </button>
                            
                            <button class="delivery-option-btn" id="sendViaEmail" style="display: flex; align-items: center; gap: 1rem; padding: 1rem; border: 2px solid var(--border); border-radius: 8px; background: var(--bg-secondary); cursor: pointer; transition: all 0.3s;">
                                <div style="font-size: 2rem;">📧</div>
                                <div style="text-align: left; flex: 1;">
                                    <div style="font-weight: 600; margin-bottom: 0.25rem;">Email</div>
                                    <div style="font-size: 0.9rem; color: var(--text-secondary);">Send invoice via email to ${booking.customer_email}</div>
                                </div>
                            </button>
                            
                            <button class="delivery-option-btn" id="downloadOnly" style="display: flex; align-items: center; gap: 1rem; padding: 1rem; border: 2px solid var(--border); border-radius: 8px; background: var(--bg-secondary); cursor: pointer; transition: all 0.3s;">
                                <div style="font-size: 2rem;">💾</div>
                                <div style="text-align: left; flex: 1;">
                                    <div style="font-weight: 600; margin-bottom: 0.25rem;">Download Only</div>
                                    <div style="font-size: 0.9rem; color: var(--text-secondary);">Download invoice as image</div>
                                </div>
                            </button>
                        </div>
                    </div>
                    
                    <div id="invoicePreview" style="margin-top: 1.5rem; padding: 1.5rem; background: #f8f9fa; border-radius: 8px; border: 1px solid var(--border);">
                        <h4 style="margin-bottom: 1rem; color: var(--primary);">Invoice Preview</h4>
                        <div id="previewContent" style="background: white; padding: 20px; border-radius: 8px; max-height: 500px; overflow-y: auto;">
                            ${invoiceHTML}
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Add hover effects
        const buttons = modal.querySelectorAll('.delivery-option-btn');
        buttons.forEach(btn => {
            btn.addEventListener('mouseenter', () => {
                btn.style.borderColor = 'var(--primary)';
                btn.style.transform = 'translateX(5px)';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.borderColor = 'var(--border)';
                btn.style.transform = 'translateX(0)';
            });
        });

        // WhatsApp handler
        document.getElementById('sendViaWhatsApp').addEventListener('click', async () => {
            await this.sendInvoiceViaWhatsApp(booking);
            modal.remove();
            this.loadPage(this.currentPage);
            this.loadNotifications();
        });

        // Email handler
        document.getElementById('sendViaEmail').addEventListener('click', async () => {
            await this.sendInvoiceViaEmail(booking);
            modal.remove();
            this.loadPage(this.currentPage);
            this.loadNotifications();
        });

        // Download handler
        document.getElementById('downloadOnly').addEventListener('click', async () => {
            await this.generateAndDownloadInvoice(booking);
            modal.remove();
            this.loadPage(this.currentPage);
            this.loadNotifications();
        });
    }

    async generateInvoiceHTML(booking) {
        const nights = Math.ceil((new Date(booking.check_out_date) - new Date(booking.check_in_date)) / (1000 * 60 * 60 * 24));
        const primaryAdults = booking.num_adults > 0 ? 1 : 0;
        const extraAdults = booking.num_adults > 1 ? booking.num_adults - 1 : 0;

        // Use property data from database if available, otherwise fall back to booking data
        const propertyName = booking.property_name || 'Property Name Not Set';
        const propertyAddress = booking.property_address || 'Address Not Set';
        const ownerName = booking.property_owner_name;
        const ownerMobile = booking.property_owner_mobile;
        const ownerEmail = booking.property_owner_email;
        
        // Format address to preserve newlines
        const formattedAddress = propertyAddress.replace(/\n/g, '<br>');
        
        // Calculate pricing - prefer property rates from DB
        const primaryAdultCost = parseFloat(booking.per_adult_cost || booking.property_per_adult_cost) || 0;
        const extraAdultCost = parseFloat(booking.extra_adult_cost || booking.property_extra_adult_cost || booking.per_adult_cost) || 0;
        const perKid = parseFloat(booking.per_kid_cost || booking.property_per_kid_cost) || 0;
        const discount = parseFloat(booking.discount) || 0;
        const gst = parseFloat(booking.gst) || 0;
        const taxWithhold = parseFloat(booking.tax_withhold) || 0;
        const taxWithholdType = booking.tax_withhold_type || 'percentage';

        const primaryAdultTotal = primaryAdultCost * primaryAdults;
        const extraAdultsTotal = extraAdultCost * extraAdults;
        const kidsTotal = perKid * booking.num_kids;
        const subtotal = primaryAdultTotal + extraAdultsTotal + kidsTotal;
        const discountAmount = subtotal * discount / 100;
        const afterDiscount = subtotal - discountAmount;
        const gstAmount = afterDiscount * gst / 100;
        const taxWithholdAmount = taxWithholdType === 'percentage' ? (afterDiscount + gstAmount) * taxWithhold / 100 : taxWithhold;
        const total = afterDiscount + gstAmount - taxWithholdAmount;

        const checkInDate = new Date(booking.check_in_date);
        const checkOutDate = new Date(booking.check_out_date);
        const quoteValidUntil = new Date();
        quoteValidUntil.setDate(quoteValidUntil.getDate() + 3);
        
        // Determine payment stamp based on payment status
        const isPaid = booking.payment_status === 'Paid';
        const isPartialPaid = booking.payment_status === 'Partial Paid';
        const isPending = booking.payment_status === 'Pending' || booking.payment_status === 'Quote';
        const stampImage = isPaid ? 'assets/images/Paid.png' : 'assets/images/Pending.png';
        const showStamp = isPaid || isPartialPaid || isPending;

        return `
            <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; background: white; color: #333; position: relative;">
                ${showStamp ? `
                <!-- Payment Stamp -->
                <div style="position: absolute; top: 120px; right: 50px; z-index: 10; opacity: 0.7;">
                    <img src="${stampImage}" alt="${isPaid ? 'Paid' : 'Pending'}" style="width: 150px; height: auto; transform: rotate(-15deg);">
                </div>
                ` : ''}
                
                <!-- Header -->
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 30px; border-bottom: 3px solid #2c5f7d; padding-bottom: 20px;">
                    <div>
                        <h1 style="margin: 0; color: #2c5f7d; font-size: 28px; text-transform: uppercase;">${propertyName}</h1>
                        <p style="margin: 5px 0; color: #666;">Luxury Property Rental</p>
                        <p style="margin: 5px 0; font-size: 14px; color: #666; line-height: 1.5;">${formattedAddress}</p>
                        ${ownerMobile ? `<p style="margin: 5px 0; font-size: 14px; color: #666;">Phone: ${ownerMobile}</p>` : ''}
                        ${ownerEmail ? `<p style="margin: 5px 0; font-size: 14px; color: #666;">Email: ${ownerEmail}</p>` : ''}
                        ${ownerName ? `<p style="margin: 5px 0; font-size: 13px; color: #888; font-style: italic;">Owner: ${ownerName}</p>` : ''}
                    </div>
                    <div style="text-align: right;">
                        <h2 style="margin: 0; color: #2c5f7d; font-size: 32px;">${(booking.status === 'Inquiry' || booking.payment_status === 'Quote' || booking.payment_status === 'Pending') ? 'QUOTE' : 'INVOICE'}</h2>
                        <p style="margin: 10px 0; font-size: 14px;">Ref: ${booking.booking_reference || (booking.status === 'Inquiry' ? 'QB-' : 'INV-') + booking.id}</p>
                        <p style="margin: 5px 0; font-size: 14px;">Date: ${new Date().toLocaleDateString('en-IN')}</p>
                        ${(booking.status === 'Inquiry' || booking.payment_status === 'Quote' || booking.payment_status === 'Pending') ? `<p style="margin: 5px 0; font-size: 14px; font-weight: bold; color: #e74c3c;">Valid Until: ${quoteValidUntil.toLocaleDateString('en-IN')}</p>` : ''}
                    </div>
                </div>

                <!-- Customer Info -->
                <div style="margin-bottom: 30px;">
                    <h3 style="color: #2c5f7d; margin-bottom: 10px;">GUEST DETAILS</h3>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                        <p style="margin: 5px 0;"><strong>Name:</strong> ${booking.customer_name}</p>
                        <p style="margin: 5px 0;"><strong>Phone:</strong> ${booking.customer_phone}</p>
                        <p style="margin: 5px 0;"><strong>Email:</strong> ${booking.customer_email}</p>
                    </div>
                </div>

                <!-- Booking Details -->
                <div style="margin-bottom: 30px;">
                    <h3 style="color: #2c5f7d; margin-bottom: 10px;">BOOKING DETAILS</h3>
                    <table style="width: 100%; border-collapse: collapse; background: #f8f9fa;">
                        ${booking.property_name ? `
                        <tr>
                            <td style="padding: 12px; border: 1px solid #dee2e6;"><strong>Property:</strong></td>
                            <td style="padding: 12px; border: 1px solid #dee2e6;">${booking.property_name}</td>
                        </tr>
                        ` : ''}
                        <tr>
                            <td style="padding: 12px; border: 1px solid #dee2e6;"><strong>Check-in:</strong></td>
                            <td style="padding: 12px; border: 1px solid #dee2e6;">${checkInDate.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} at 2:00 PM</td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border: 1px solid #dee2e6;"><strong>Check-out:</strong></td>
                            <td style="padding: 12px; border: 1px solid #dee2e6;">${checkOutDate.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} at 11:00 AM</td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border: 1px solid #dee2e6;"><strong>Duration:</strong></td>
                            <td style="padding: 12px; border: 1px solid #dee2e6;">${nights} Night${nights > 1 ? 's' : ''}</td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border: 1px solid #dee2e6;"><strong>Guests:</strong></td>
                            <td style="padding: 12px; border: 1px solid #dee2e6;">${booking.num_adults} Adult${booking.num_adults > 1 ? 's' : ''}${booking.num_kids > 0 ? ', ' + booking.num_kids + ' Kid' + (booking.num_kids > 1 ? 's' : '') : ''}</td>
                        </tr>
                    </table>
                </div>

                <!-- Pricing Breakdown -->
                <div style="margin-bottom: 30px;">
                    <h3 style="color: #2c5f7d; margin-bottom: 10px;">PRICING BREAKDOWN</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #34495e; color: white;">
                                <th style="padding: 14px; text-align: left; border: 1px solid #bdc3c7; font-weight: 600;">Description</th>
                                <th style="padding: 14px; text-align: center; border: 1px solid #bdc3c7; font-weight: 600;">Qty</th>
                                <th style="padding: 14px; text-align: right; border: 1px solid #bdc3c7; font-weight: 600;">Rate</th>
                                <th style="padding: 14px; text-align: right; border: 1px solid #bdc3c7; font-weight: 600;">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style="padding: 12px; border: 1px solid #dee2e6;">Primary Adult</td>
                                <td style="padding: 12px; text-align: center; border: 1px solid #dee2e6;">${primaryAdults}</td>
                                <td style="padding: 12px; text-align: right; border: 1px solid #dee2e6;">₹${primaryAdultCost.toFixed(0)}</td>
                                <td style="padding: 12px; text-align: right; border: 1px solid #dee2e6;">₹${primaryAdultTotal.toFixed(0)}</td>
                            </tr>
                            ${extraAdults > 0 ? `
                            <tr>
                                <td style="padding: 12px; border: 1px solid #dee2e6;">Extra Adult${extraAdults > 1 ? 's' : ''}</td>
                                <td style="padding: 12px; text-align: center; border: 1px solid #dee2e6;">${extraAdults}</td>
                                <td style="padding: 12px; text-align: right; border: 1px solid #dee2e6;">₹${extraAdultCost.toFixed(0)}</td>
                                <td style="padding: 12px; text-align: right; border: 1px solid #dee2e6;">₹${extraAdultsTotal.toFixed(0)}</td>
                            </tr>
                            ` : ''}
                            ${booking.num_kids > 0 ? `
                            <tr>
                                <td style="padding: 12px; border: 1px solid #dee2e6;">Kid${booking.num_kids > 1 ? 's' : ''}</td>
                                <td style="padding: 12px; text-align: center; border: 1px solid #dee2e6;">${booking.num_kids}</td>
                                <td style="padding: 12px; text-align: right; border: 1px solid #dee2e6;">₹${perKid.toFixed(0)}</td>
                                <td style="padding: 12px; text-align: right; border: 1px solid #dee2e6;">₹${kidsTotal.toFixed(0)}</td>
                            </tr>
                            ` : ''}
                            <tr style="background: #f8f9fa;">
                                <td colspan="3" style="padding: 12px; text-align: right; border: 1px solid #dee2e6; font-weight: bold;">Subtotal:</td>
                                <td style="padding: 12px; text-align: right; border: 1px solid #dee2e6; font-weight: bold;">₹${subtotal.toFixed(0)}</td>
                            </tr>
                            ${discount > 0 ? `
                            <tr style="color: #27ae60;">
                                <td colspan="3" style="padding: 12px; text-align: right; border: 1px solid #dee2e6;">Discount (${discount}%):</td>
                                <td style="padding: 12px; text-align: right; border: 1px solid #dee2e6;">- ₹${discountAmount.toFixed(0)}</td>
                            </tr>
                            <tr style="background: #f8f9fa;">
                                <td colspan="3" style="padding: 12px; text-align: right; border: 1px solid #dee2e6; font-weight: bold;">After Discount:</td>
                                <td style="padding: 12px; text-align: right; border: 1px solid #dee2e6; font-weight: bold;">₹${afterDiscount.toFixed(0)}</td>
                            </tr>
                            ` : ''}
                            <tr>
                                <td colspan="3" style="padding: 12px; text-align: right; border: 1px solid #dee2e6;">GST (${gst}%):</td>
                                <td style="padding: 12px; text-align: right; border: 1px solid #dee2e6;">₹${gstAmount.toFixed(0)}</td>
                            </tr>
                            ${taxWithhold > 0 ? `
                            <tr style="color: #e74c3c;">
                                <td colspan="3" style="padding: 12px; text-align: right; border: 1px solid #dee2e6;">Tax Withhold ${taxWithholdType === 'percentage' ? '(' + taxWithhold + '%)' : '(Fixed)'}:</td>
                                <td style="padding: 12px; text-align: right; border: 1px solid #dee2e6;">- ₹${taxWithholdAmount.toFixed(0)}</td>
                            </tr>
                            ` : ''}
                            <tr style="background: #2c5f7d; color: white; font-size: 18px;">
                                <td colspan="3" style="padding: 15px; text-align: right; border: 1px solid #dee2e6; font-weight: bold;">TOTAL AMOUNT:</td>
                                <td style="padding: 15px; text-align: right; border: 1px solid #dee2e6; font-weight: bold;">₹${total.toFixed(0)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- Payment Status -->
                ${(isPaid || isPartialPaid) && booking.payment_method ? `
                <div style="margin-bottom: 30px;">
                    <h3 style="color: #2c5f7d; margin-bottom: 10px;">PAYMENT STATUS</h3>
                    <table style="width: 100%; border-collapse: collapse; background: #f8f9fa;">
                        <tr>
                            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">Status:</td>
                            <td style="padding: 12px; border: 1px solid #dee2e6;">
                                <span style="background: ${isPaid ? '#27ae60' : '#f39c12'}; color: white; padding: 4px 12px; border-radius: 4px; font-weight: bold;">
                                    ${booking.payment_status}
                                </span>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">Payment Method:</td>
                            <td style="padding: 12px; border: 1px solid #dee2e6;">${booking.payment_method}</td>
                        </tr>
                        ${isPartialPaid ? `
                        <tr>
                            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">Amount Paid:</td>
                            <td style="padding: 12px; border: 1px solid #dee2e6; color: #27ae60; font-weight: bold;">₹${parseFloat(booking.amount_paid || 0).toFixed(0)}</td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">Pending Amount:</td>
                            <td style="padding: 12px; border: 1px solid #dee2e6; color: #e74c3c; font-weight: bold;">₹${(total - parseFloat(booking.amount_paid || 0)).toFixed(0)}</td>
                        </tr>
                        ` : ''}
                        ${isPaid ? `
                        <tr>
                            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">Amount Paid:</td>
                            <td style="padding: 12px; border: 1px solid #dee2e6; color: #27ae60; font-weight: bold;">₹${parseFloat(booking.amount_paid || total).toFixed(0)}</td>
                        </tr>
                        ` : ''}
                    </table>
                </div>
                ` : ''}

                <!-- Terms & Conditions -->
                <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #dee2e6;">
                    <h3 style="color: #2c5f7d; margin-bottom: 10px;">TERMS & CONDITIONS</h3>
                    ${(booking.status === 'Inquiry' || booking.payment_status === 'Quote' || booking.payment_status === 'Pending') ? `
                    <ul style="font-size: 13px; line-height: 1.8; color: #666; padding-left: 20px;">
                        <li>This quote is valid for 3 days from the date of issue</li>
                        <li>Check-in Time: 13:00, Check-out: 10:00</li>
                        <li>50% advance payment required to confirm booking</li>
                        <li>Cancellation Policy:
                            <ul style="margin-top: 5px; margin-bottom: 5px;">
                                <li>Before 21 days of check-in date - 100% refund (minus processing fee)</li>
                                <li>Before 14 days of check-in date - 50% refund</li>
                                <li>No refund from check-in date to 14 days</li>
                            </ul>
                        </li>
                        <li>No Party, No Event, No meeting, Not allow Unmarried-Local couple</li>
                        <li>No Smoking inside premises, No Pets are allowed - without approval</li>
                        <li>Valid Photo ID with address proof required as per statutory requirements</li>
                        <li>Making payment for booking - assume that you have read and agree to follow all house policy & expectation as mentioned on our website <a href="https://homelandstay.com/homeland-stay-policies-and-expectations/" style="color: #2c5f7d; text-decoration: none;">https://homelandstay.com/homeland-stay-policies-and-expectations/</a></li>
                    </ul>
                    ` : `
                    <ul style="font-size: 13px; line-height: 1.6; color: #666; padding-left: 20px;">
                        <li>Check-in Time: 13:00, Check-out: 10:00</li>
                        <li>Smoking is strictly prohibited inside the property</li>
                        <li>Pets are not allowed without prior approval</li>
                        <li>Valid Photo ID with address proof required at check-in as per statutory requirements</li>
                        <li>Guests must follow all house policies as mentioned on our website</li>
                    </ul>
                    `}
                </div>

                <!-- Footer -->
                <div style="margin-top: 30px; text-align: center; padding-top: 20px; border-top: 1px solid #dee2e6;">
                    <p style="font-size: 12px; color: #666; margin: 5px 0;">Thank you for choosing ${propertyName}!</p>
                    ${ownerEmail || ownerMobile ? `<p style="font-size: 12px; color: #666; margin: 5px 0;">For any queries, please contact us${ownerEmail ? ' at ' + ownerEmail : ''}${ownerEmail && ownerMobile ? ' or' : ''}${ownerMobile ? ' call ' + ownerMobile : ''}</p>` : ''}
                </div>
            </div>
        `;
    }

    async sendInvoiceViaWhatsApp(booking) {
        const invoiceHTML = await this.generateInvoiceHTML(booking);
        
        const propertyName = booking.property_name || 'Our Property';
        
        // Generate WhatsApp message
        const message = `Hello ${booking.customer_name},\n\nThank you for your interest in ${propertyName}!\n\nHere's your booking quote:\n\n📅 Check-in: ${new Date(booking.check_in_date).toLocaleDateString('en-IN')}\n📅 Check-out: ${new Date(booking.check_out_date).toLocaleDateString('en-IN')}\n👥 Guests: ${booking.num_adults} Adult(s)${booking.num_kids > 0 ? ', ' + booking.num_kids + ' Kid(s)' : ''}\n💰 Total: ₹${booking.total_amount}\n\n✅ Quote valid for 3 days\n\nTo confirm your booking, please reply to this message or call us.\n\nDetailed invoice has been sent separately.`;
        
        // Create WhatsApp link
        const phoneNumber = booking.customer_phone.replace(/[^0-9]/g, '');
        const whatsappNumber = phoneNumber.startsWith('91') ? phoneNumber : '91' + phoneNumber;
        const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
        
        // Open WhatsApp
        window.open(whatsappUrl, '_blank');
        
        this.showToast('WhatsApp opened! Consider downloading the invoice to send the full details.', 'info', 5000);
    }

    async sendInvoiceViaEmail(booking) {
        const invoiceHTML = await this.generateInvoiceHTML(booking);
        
        // Send email via API
        const response = await fetch('api/send_invoice.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                booking_id: booking.id,
                email: booking.customer_email,
                customer_name: booking.customer_name,
                invoice_html: invoiceHTML,
                csrf_token: this.csrfToken
            })
        });

        const result = await response.json();
        if (result.success) {
            this.showToast('Invoice sent successfully via email!', 'success');
        } else {
            this.showToast('Error sending email: ' + (result.message || 'Unknown error'), 'error');
        }
    }

    async generateAndDownloadInvoice(booking) {
        const invoiceHTML = await this.generateInvoiceHTML(booking);
        
        // Create a temporary container
        const container = document.createElement('div');
        container.innerHTML = invoiceHTML;
        container.style.position = 'fixed';
        container.style.left = '-9999px';
        document.body.appendChild(container);
        
        // Use html2canvas to convert to image
        try {
            const canvas = await html2canvas(container.firstElementChild, {
                scale: 2,
                backgroundColor: '#ffffff',
                logging: false
            });
            
            // Download as image
            const link = document.createElement('a');
            link.download = `Invoice_${booking.booking_reference || 'QB-' + booking.id}_${booking.customer_name.replace(/\s+/g, '_')}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            
            this.showToast('Invoice downloaded successfully!', 'success');
        } catch (error) {
            console.error('Error generating invoice:', error);
            this.showToast('Error generating invoice. Please try again.', 'error');
        } finally {
            document.body.removeChild(container);
        }
    }

    async renderCalendarPage() {
        try {
            const response = await fetch('api/bookings.php?action=calendar');
            const data = await response.json();
            const bookings = data.success ? data.bookings : [];

            // Get current month/year or from session
            const now = new Date();
            const savedMonth = sessionStorage.getItem('calendarMonth');
            const savedYear = sessionStorage.getItem('calendarYear');
            
            let year = now.getFullYear();
            let month = now.getMonth();
            
            // Only use saved values if they're valid numbers
            if (savedYear && !isNaN(parseInt(savedYear))) {
                year = parseInt(savedYear);
            }
            if (savedMonth && !isNaN(parseInt(savedMonth))) {
                month = parseInt(savedMonth);
            }
            
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            
            // Calculate previous and next month
            const prevMonth = month === 0 ? 11 : month - 1;
            const prevYear = month === 0 ? year - 1 : year;
            const nextMonth = month === 11 ? 0 : month + 1;
            const nextYear = month === 11 ? year + 1 : year;
            
            // Calculate month statistics
            const firstDayOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-01`;
            const lastDayOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-${new Date(year, month + 1, 0).getDate()}`;
            
            const monthBookings = bookings.filter(b => 
                b.status === 'Confirmed' && 
                (b.check_in_date >= firstDayOfMonth && b.check_in_date <= lastDayOfMonth)
            );
            
            const totalBookings = monthBookings.length;
            const totalRevenue = monthBookings.reduce((sum, b) => sum + (parseFloat(b.total_amount) || 0), 0);
            
            return `
                <h1 class="page-title">Calendar</h1>
                
                <div class="calendar-header-card">
                    <div class="calendar-navigation">
                        <button class="calendar-nav-btn" id="prevMonth" data-year="${prevYear}" data-month="${prevMonth}">
                            <span class="calendar-nav-icon">‹</span>
                        </button>
                        <div class="calendar-month-year">
                            <div class="calendar-month">${monthNames[month]}</div>
                            <div class="calendar-year">${year}</div>
                        </div>
                        <button class="calendar-nav-btn" id="nextMonth" data-year="${nextYear}" data-month="${nextMonth}">
                            <span class="calendar-nav-icon">›</span>
                        </button>
                    </div>
                </div>
                
                <div class="calendar-stats-container">
                    <div class="calendar-stat-card">
                        <div class="calendar-stat-icon">📅</div>
                        <div class="calendar-stat-content">
                            <div class="calendar-stat-label">Total Bookings</div>
                            <div class="calendar-stat-value">${totalBookings}</div>
                        </div>
                    </div>
                    <div class="calendar-stat-card">
                        <div class="calendar-stat-icon">💰</div>
                        <div class="calendar-stat-content">
                            <div class="calendar-stat-label">Total Revenue</div>
                            <div class="calendar-stat-value">₹${totalRevenue.toLocaleString('en-IN')}</div>
                        </div>
                    </div>
                </div>
                
                <div class="card calendar-card">
                    ${this.renderCalendar(year, month, bookings)}
                </div>
            `;
        } catch (error) {
            console.error('Calendar error:', error);
            return `
                <h1 class="page-title">Calendar</h1>
                <div class="card">
                    <p class="text-secondary">Error loading calendar. Please refresh the page.</p>
                </div>
            `;
        }
    }

    renderCalendar(year, month, bookings) {
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startDay = firstDay.getDay();

        let html = `
            <div class="calendar-grid">
                ${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => 
                    `<div class="calendar-header">${day}</div>`
                ).join('')}
        `;

        // Empty cells before first day
        for (let i = 0; i < startDay; i++) {
            html += '<div class="calendar-day calendar-day-empty"></div>';
        }

        // Calendar days
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const confirmedBookings = bookings.filter(b => 
                dateStr >= b.check_in_date && dateStr <= b.check_out_date && b.status === 'Confirmed'
            );
            const enquiries = bookings.filter(b => 
                dateStr >= b.check_in_date && dateStr <= b.check_out_date && b.status === 'Inquiry'
            );
            const personalBookings = bookings.filter(b => 
                dateStr >= b.check_in_date && dateStr <= b.check_out_date && b.status === 'Personal'
            );
            // Exclude "Not confirmed" and "Cancelled" status from calendar view

            const today = new Date().toISOString().split('T')[0];
            const isToday = dateStr === today;
            const hasAnyBooking = confirmedBookings.length > 0 || enquiries.length > 0 || personalBookings.length > 0;

            html += `
                <div class="calendar-day ${hasAnyBooking ? 'has-booking' : ''} ${isToday ? 'today' : ''}">
                    <div class="calendar-day-number">${day}</div>
                    ${confirmedBookings.map(b => {
                        const isCheckIn = dateStr === b.check_in_date;
                        const isCheckOut = dateStr === b.check_out_date;
                        const isBothDays = isCheckIn && isCheckOut;
                        
                        let dayLabel = '';
                        let labelClass = '';
                        if (isBothDays) {
                            dayLabel = '<span class="calendar-day-label same-day">IN/OUT</span>';
                            labelClass = 'same-day-booking';
                        } else if (isCheckIn) {
                            dayLabel = '<span class="calendar-day-label check-in">IN</span>';
                            labelClass = 'check-in-booking';
                        } else if (isCheckOut) {
                            dayLabel = '<span class="calendar-day-label check-out">OUT</span>';
                            labelClass = 'check-out-booking';
                        }
                        
                        return `
                        <div class="calendar-booking calendar-booking-clickable ${labelClass}" data-booking-id="${b.id}" title="Confirmed - ${isCheckIn ? 'Check-in' : isCheckOut ? 'Check-out' : 'Staying'} - Click to view details">
                            <div class="calendar-booking-header">
                                <div class="calendar-booking-name">${b.customer_name}</div>
                                ${dayLabel}
                            </div>
                            <div class="calendar-booking-info">
                                ${b.num_adults + b.num_kids} guests
                            </div>
                        </div>
                    `;}).join('')}
                    ${enquiries.map(b => {
                        const isCheckIn = dateStr === b.check_in_date;
                        const isCheckOut = dateStr === b.check_out_date;
                        const isBothDays = isCheckIn && isCheckOut;
                        
                        let dayLabel = '';
                        if (isBothDays) {
                            dayLabel = '<span class="calendar-day-label same-day">IN/OUT</span>';
                        } else if (isCheckIn) {
                            dayLabel = '<span class="calendar-day-label check-in">IN</span>';
                        } else if (isCheckOut) {
                            dayLabel = '<span class="calendar-day-label check-out">OUT</span>';
                        }
                        
                        return `
                        <div class="calendar-booking calendar-booking-clickable inquiry-booking" data-booking-id="${b.id}" title="Pending Inquiry - ${isCheckIn ? 'Check-in' : isCheckOut ? 'Check-out' : 'Staying'} - Click to view details">
                            <div class="calendar-booking-header">
                                <div class="calendar-booking-name">${b.customer_name}</div>
                                ${dayLabel}
                            </div>
                            <div class="calendar-booking-info">
                                ${b.num_adults + b.num_kids} guests
                            </div>
                        </div>
                    `;}).join('')}
                    ${personalBookings.map(b => {
                        const isCheckIn = dateStr === b.check_in_date;
                        const isCheckOut = dateStr === b.check_out_date;
                        const isBothDays = isCheckIn && isCheckOut;
                        
                        let dayLabel = '';
                        if (isBothDays) {
                            dayLabel = '<span class="calendar-day-label same-day">IN/OUT</span>';
                        } else if (isCheckIn) {
                            dayLabel = '<span class="calendar-day-label check-in">IN</span>';
                        } else if (isCheckOut) {
                            dayLabel = '<span class="calendar-day-label check-out">OUT</span>';
                        }
                        
                        return `
                        <div class="calendar-booking calendar-booking-clickable personal-booking" data-booking-id="${b.id}" title="Personal Booking - ${isCheckIn ? 'Check-in' : isCheckOut ? 'Check-out' : 'Staying'} - Click to view details">
                            <div class="calendar-booking-header">
                                <div class="calendar-booking-name">${b.customer_name}</div>
                                ${dayLabel}
                            </div>
                            <div class="calendar-booking-info">
                                ${b.num_adults + b.num_kids} guests
                            </div>
                        </div>
                    `;}).join('')}
                </div>
            `;
        }

        html += '</div>';
        return html;
    }

    setupCalendarEvents() {
        const prevBtn = document.getElementById('prevMonth');
        const nextBtn = document.getElementById('nextMonth');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', async () => {
                const year = parseInt(prevBtn.getAttribute('data-year'));
                const month = parseInt(prevBtn.getAttribute('data-month'));
                
                if (!isNaN(year) && !isNaN(month) && month >= 0 && month <= 11) {
                    sessionStorage.setItem('calendarYear', year.toString());
                    sessionStorage.setItem('calendarMonth', month.toString());
                    await this.loadPage('calendar');
                } else {
                    console.error('Invalid calendar navigation values:', { year, month });
                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', async () => {
                const year = parseInt(nextBtn.getAttribute('data-year'));
                const month = parseInt(nextBtn.getAttribute('data-month'));
                
                if (!isNaN(year) && !isNaN(month) && month >= 0 && month <= 11) {
                    sessionStorage.setItem('calendarYear', year.toString());
                    sessionStorage.setItem('calendarMonth', month.toString());
                    await this.loadPage('calendar');
                } else {
                    console.error('Invalid calendar navigation values:', { year, month });
                }
            });
        }

        // Add click handlers to calendar bookings
        document.querySelectorAll('.calendar-booking-clickable').forEach(booking => {
            booking.addEventListener('click', async (e) => {
                e.stopPropagation();
                const bookingId = e.currentTarget.dataset.bookingId;
                await this.showViewRequestModal(bookingId);
            });
        });
    }

    async renderBookingsPage() {
        const response = await fetch('api/bookings.php?action=list');
        const data = await response.json();
        const bookings = data.success ? data.bookings : [];

        return `
            <h1 class="page-title">Bookings</h1>
            
            <div class="card">
                <div class="card-header" style="flex-direction: column; align-items: stretch; gap: 1rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <h2 class="card-title">All Bookings</h2>
                    </div>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <input type="text" id="searchBooking" placeholder="Search..." style="flex: 1; min-width: 200px; padding: 0.75rem; border: 1px solid var(--border); border-radius: 6px; font-size: 1rem;">
                        <select id="filterStatus" style="min-width: 150px; padding: 0.75rem; border: 1px solid var(--border); border-radius: 6px; font-size: 1rem;">
                            <option value="">All Status</option>
                            <option value="Inquiry">Inquiry</option>
                            <option value="Confirmed">Confirmed</option>
                            <option value="Cancelled">Cancelled</option>
                            <option value="Personal">Personal</option>
                            <option value="Not confirmed">Not confirmed</option>
                        </select>
                        <select id="filterPayment" style="min-width: 150px; padding: 0.75rem; border: 1px solid var(--border); border-radius: 6px; font-size: 1rem;">
                            <option value="">All Payments</option>
                            <option value="Paid">Paid</option>
                            <option value="Partial Paid">Partial Paid</option>
                            <option value="Pending">Pending</option>
                            <option value="Quote">Quote</option>
                        </select>
                        <input type="date" id="filterFromDate" placeholder="From Date" style="min-width: 150px; padding: 0.75rem; border: 1px solid var(--border); border-radius: 6px; font-size: 1rem;">
                        <input type="date" id="filterToDate" placeholder="To Date" style="min-width: 150px; padding: 0.75rem; border: 1px solid var(--border); border-radius: 6px; font-size: 1rem;">
                    </div>
                </div>
                <div class="table-container desktop-only">
                    <table id="bookingsTable">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Status</th>
                                <th>Customer</th>
                                <th>Phone</th>
                                <th>Check-in</th>
                                <th>Check-out</th>
                                <th>Guests</th>
                                <th>Total</th>
                                <th>Payment</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${bookings.map(b => `
                                <tr data-booking='${JSON.stringify(b).replace(/'/g, "&apos;")}'>
                                    <td>${b.id}</td>
                                    <td><span class="badge" style="background: ${this.getStatusColor(b.status)};">${b.status}</span></td>
                                    <td>${b.customer_name}</td>
                                    <td>${b.customer_phone}</td>
                                    <td>${new Date(b.check_in_date).toLocaleDateString()}</td>
                                    <td>${new Date(b.check_out_date).toLocaleDateString()}</td>
                                    <td>${b.num_adults + b.num_kids}</td>
                                    <td>₹${b.total_amount || 0}</td>
                                    <td><span class="badge" style="background: ${this.getPaymentColor(b.payment_status)};">${b.payment_status || 'N/A'}</span></td>
                                    <td>
                                        <button class="btn btn-sm btn-primary view-booking-detail" data-id="${b.id}">View</button>
                                        ${b.payment_status === 'Paid' ? `<button class="btn btn-sm btn-secondary view-invoice-btn" data-id="${b.id}" style="margin-left: 0.25rem;">Invoice</button>` : ''}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="card-list mobile-only" id="bookingsCardList">
                    ${bookings.map(b => `
                        <div class="list-card" data-booking='${JSON.stringify(b).replace(/'/g, "&apos;")}'>
                            <div class="list-card-header">
                                <div>
                                    <div class="list-card-id">#${b.id}</div>
                                    <h3 class="list-card-title">${b.customer_name}</h3>
                                </div>
                                <span class="badge" style="background: ${this.getStatusColor(b.status)};">${b.status}</span>
                            </div>
                            <div class="list-card-body">
                                <div class="list-card-row">
                                    <span class="list-card-label">📞 Phone:</span>
                                    <span class="list-card-value">${b.customer_phone}</span>
                                </div>
                                <div class="list-card-row">
                                    <span class="list-card-label">📅 Check-in:</span>
                                    <span class="list-card-value">${new Date(b.check_in_date).toLocaleDateString()}</span>
                                </div>
                                <div class="list-card-row">
                                    <span class="list-card-label">📅 Check-out:</span>
                                    <span class="list-card-value">${new Date(b.check_out_date).toLocaleDateString()}</span>
                                </div>
                                <div class="list-card-row">
                                    <span class="list-card-label">👥 Guests:</span>
                                    <span class="list-card-value">${b.num_adults + b.num_kids}</span>
                                </div>
                                <div class="list-card-row">
                                    <span class="list-card-label">💰 Total:</span>
                                    <span class="list-card-value"><strong>₹${b.total_amount || 0}</strong></span>
                                </div>
                                <div class="list-card-row">
                                    <span class="list-card-label">💳 Payment:</span>
                                    <span class="list-card-value"><span class="badge" style="background: ${this.getPaymentColor(b.payment_status)};">${b.payment_status || 'N/A'}</span></span>
                                </div>
                            </div>
                            <div class="list-card-footer">
                                <button class="btn btn-primary btn-block view-booking-detail" data-id="${b.id}">View Details</button>
                                ${b.payment_status === 'Paid' ? `<button class="btn btn-secondary btn-block view-invoice-btn" data-id="${b.id}" style="margin-top: 0.5rem;">View Invoice</button>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    getStatusColor(status) {
        const colors = {
            'Inquiry': '#f59e0b',
            'Confirmed': '#10b981',
            'Cancelled': '#ef4444',
            'Personal': '#8b5cf6',
            'Not confirmed': '#64748b'
        };
        return colors[status] || '#64748b';
    }

    getPaymentColor(payment) {
        const colors = {
            'Paid': '#10b981',
            'Partial Paid': '#f59e0b',
            'Pending': '#ef4444',
            'Quote': '#64748b'
        };
        return colors[payment] || '#64748b';
    }

    setupBookingsEvents() {
        document.getElementById('searchBooking')?.addEventListener('input', () => {
            this.filterBookings();
        });

        document.getElementById('filterStatus')?.addEventListener('change', () => {
            this.filterBookings();
        });

        document.getElementById('filterPayment')?.addEventListener('change', () => {
            this.filterBookings();
        });

        document.getElementById('filterFromDate')?.addEventListener('change', () => {
            this.filterBookings();
        });

        document.getElementById('filterToDate')?.addEventListener('change', () => {
            this.filterBookings();
        });

        document.querySelectorAll('.view-booking-detail').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.dataset.id;
                await this.showViewRequestModal(id);
            });
        });

        // Use universal invoice function for consistent data
        document.querySelectorAll('.view-invoice-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.dataset.id;
                await this.showInvoiceFromDB(id);
            });
        });
    }

    filterBookings() {
        const searchTerm = document.getElementById('searchBooking')?.value.toLowerCase() || '';
        const filterStatus = document.getElementById('filterStatus')?.value || '';
        const filterPayment = document.getElementById('filterPayment')?.value || '';
        const fromDate = document.getElementById('filterFromDate')?.value;
        const toDate = document.getElementById('filterToDate')?.value;
        
        const rows = document.querySelectorAll('#bookingsTable tbody tr');
        const cards = document.querySelectorAll('#bookingsCardList .list-card');
        
        rows.forEach(row => {
            const bookingData = JSON.parse(row.getAttribute('data-booking').replace(/&apos;/g, "'"));
            const matchesSearch = !searchTerm || row.textContent.toLowerCase().includes(searchTerm);
            const matchesStatus = !filterStatus || bookingData.status === filterStatus;
            const matchesPayment = !filterPayment || bookingData.payment_status === filterPayment;
            const matchesDateRange = this.isInDateRange(bookingData.check_in_date, fromDate, toDate);
            row.style.display = (matchesSearch && matchesStatus && matchesPayment && matchesDateRange) ? '' : 'none';
        });
        
        cards.forEach(card => {
            const bookingData = JSON.parse(card.getAttribute('data-booking').replace(/&apos;/g, "'"));
            const matchesSearch = !searchTerm || card.textContent.toLowerCase().includes(searchTerm);
            const matchesStatus = !filterStatus || bookingData.status === filterStatus;
            const matchesPayment = !filterPayment || bookingData.payment_status === filterPayment;
            const matchesDateRange = this.isInDateRange(bookingData.check_in_date, fromDate, toDate);
            card.style.display = (matchesSearch && matchesStatus && matchesPayment && matchesDateRange) ? '' : 'none';
        });
    }

    isInDateRange(dateStr, fromDate, toDate) {
        if (!fromDate && !toDate) return true;
        const date = new Date(dateStr);
        if (fromDate && date < new Date(fromDate)) return false;
        if (toDate && date > new Date(toDate)) return false;
        return true;
    }

    async renderReportsPage() {
        // Fetch YTD stats
        const currentYear = new Date().getFullYear();
        const ytdStart = `${currentYear}-01`;
        const ytdEnd = new Date().toISOString().slice(0, 7);
        
        let ytdStats = {
            totalRevenue: 0,
            avgBookingValue: 0,
            topPartner: 'N/A'
        };
        
        try {
            const response = await fetch('api/reports.php?action=generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'monthly',
                    period: ytdEnd,
                    format: 'json',
                    csrf_token: this.csrfToken
                })
            });
            
            const data = await response.json();
            if (data.success && data.report) {
                ytdStats.totalRevenue = data.report.summary?.total_revenue || 0;
                ytdStats.avgBookingValue = data.report.summary?.average_booking_value || 0;
                
                // Find top partner
                if (data.report.partner_breakdown && data.report.partner_breakdown.length > 0) {
                    const topPartner = data.report.partner_breakdown.reduce((max, p) => 
                        p.revenue > max.revenue ? p : max
                    );
                    ytdStats.topPartner = topPartner.name;
                }
            }
        } catch (error) {
            console.error('Failed to fetch YTD stats:', error);
        }
        
        return `
            <h1 class="page-title">Reports</h1>
            <div class="card">
                <h2 class="card-title">Revenue Analytics</h2>
                <p class="text-secondary" style="margin-bottom: 1.5rem;">Generate detailed reports for revenue analysis, partner performance, and booking statistics.</p>
                
                <div class="form-row">
                    <div class="form-group">
                        <label>Report Type</label>
                        <select id="reportType">
                            <option value="monthly">Monthly Revenue Report</option>
                            <option value="partner">Revenue by Partner</option>
                            <option value="booking">Booking Analysis</option>
                            <option value="custom">Custom Date Range</option>
                        </select>
                    </div>
                    <div class="form-group" id="monthFieldGroup">
                        <label>Month</label>
                        <input type="month" id="reportMonth" value="${new Date().toISOString().slice(0, 7)}">
                    </div>
                    <div class="form-group" id="customDateRangeGroup" style="display: none;">
                        <label>From Date</label>
                        <input type="date" id="reportFromDate">
                    </div>
                    <div class="form-group" id="customDateRangeToGroup" style="display: none;">
                        <label>To Date</label>
                        <input type="date" id="reportToDate">
                    </div>
                    <div class="form-group">
                        <label>Export Format</label>
                        <select id="exportFormat">
                            <option value="pdf">PDF</option>
                            <option value="excel">Excel</option>
                            <option value="csv">CSV</option>
                        </select>
                    </div>
                </div>
                <button class="btn btn-primary" id="generateReport">
                    <span style="margin-right: 0.5rem;">📊</span> Generate Report
                </button>
                <div id="reportResults" style="margin-top: 2rem;"></div>
            </div>

            <div class="card">
                <h2 class="card-title">Quick Stats</h2>
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-value">₹${ytdStats.totalRevenue.toLocaleString()}</div>
                        <div class="stat-label">Total Revenue (YTD)</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">₹${ytdStats.avgBookingValue.toLocaleString()}</div>
                        <div class="stat-label">Average Booking Value</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${ytdStats.topPartner}</div>
                        <div class="stat-label">Top Performing Partner</div>
                    </div>
                </div>
            </div>
        `;
    }

    setupReportsEvents() {
        // Toggle date fields based on report type
        document.getElementById('reportType')?.addEventListener('change', (e) => {
            const isCustom = e.target.value === 'custom';
            document.getElementById('monthFieldGroup').style.display = isCustom ? 'none' : 'block';
            document.getElementById('customDateRangeGroup').style.display = isCustom ? 'block' : 'none';
            document.getElementById('customDateRangeToGroup').style.display = isCustom ? 'block' : 'none';
        });

        document.getElementById('generateReport')?.addEventListener('click', async () => {
            const reportType = document.getElementById('reportType').value;
            const format = document.getElementById('exportFormat').value;
            
            let requestData = {
                type: reportType,
                format: format,
                csrf_token: this.csrfToken
            };
            
            // Add appropriate date parameters based on report type
            if (reportType === 'custom') {
                const fromDate = document.getElementById('reportFromDate').value;
                const toDate = document.getElementById('reportToDate').value;
                
                if (!fromDate || !toDate) {
                    this.showToast('Please select both From and To dates', 'warning');
                    return;
                }
                
                if (new Date(fromDate) > new Date(toDate)) {
                    this.showToast('From date must be before To date', 'warning');
                    return;
                }
                
                requestData.start_date = fromDate;
                requestData.end_date = toDate;
            } else {
                requestData.period = document.getElementById('reportMonth').value;
            }
            
            const resultsDiv = document.getElementById('reportResults');
            resultsDiv.innerHTML = '<div style="text-align: center; padding: 2rem;"><div class="spinner"></div><p>Generating report...</p></div>';
            
            try {
                const response = await fetch('api/reports.php?action=generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestData)
                });
                
                const data = await response.json();
                
                if (data.success) {
                    this.displayReport(data.report, reportType, format);
                } else {
                    this.showToast(data.message || 'Failed to generate report', 'error');
                    resultsDiv.innerHTML = '';
                }
            } catch (error) {
                console.error('Report generation error:', error);
                this.showToast('Failed to generate report', 'error');
                resultsDiv.innerHTML = '';
            }
        });
    }
    
    displayReport(report, type, format) {
        const resultsDiv = document.getElementById('reportResults');
        
        let html = `
            <div class="card" style="background: var(--bg-secondary);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h3>📊 ${this.getReportTitle(type)}</h3>
                    <button class="btn btn-primary" onclick="app.exportReportPDF('${type}')">
                        📄 Export to PDF
                    </button>
                </div>
                <p class="text-secondary" style="margin-bottom: 1.5rem;">Period: <strong>${report.period}</strong></p>
        `;
        
        if (type === 'monthly' || type === 'custom') {
            html += this.generateMonthlyReportHTML(report);
        } else if (type === 'partner') {
            html += this.generatePartnerReportHTML(report);
        } else if (type === 'booking') {
            html += this.generateBookingReportHTML(report);
        }
        
        html += '</div>';
        resultsDiv.innerHTML = html;
        
        // Store report data for PDF export
        this.currentReport = { data: report, type: type };
    }
    
    getReportTitle(type) {
        const titles = {
            'monthly': 'Monthly Revenue Report',
            'partner': 'Revenue by Partner',
            'booking': 'Booking Analysis',
            'custom': 'Custom Date Range Report'
        };
        return titles[type] || 'Report';
    }
    
    generateMonthlyReportHTML(report) {
        const summary = report.summary;
        
        let html = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
                <div class="stat-card">
                    <div class="stat-value">₹${summary.total_revenue.toLocaleString()}</div>
                    <div class="stat-label">Total Revenue</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">₹${summary.net_revenue.toLocaleString()}</div>
                    <div class="stat-label">Net Revenue</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${summary.total_bookings}</div>
                    <div class="stat-label">Total Bookings</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">₹${summary.average_booking_value.toLocaleString()}</div>
                    <div class="stat-label">Avg Booking Value</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">₹${summary.total_commission.toLocaleString()}</div>
                    <div class="stat-label">Total Commission</div>
                </div>
            </div>
        `;
        
        // Partner breakdown
        if (report.partner_breakdown && report.partner_breakdown.length > 0) {
            html += `
                <h4 style="margin-top: 2rem; margin-bottom: 1rem;">Revenue by Partner</h4>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Partner</th>
                                <th>Bookings</th>
                                <th>Revenue</th>
                                <th>Commission</th>
                                <th>Net</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            report.partner_breakdown.forEach(partner => {
                const net = partner.revenue - partner.commission;
                html += `
                    <tr>
                        <td>${partner.name}</td>
                        <td>${partner.bookings}</td>
                        <td>₹${partner.revenue.toLocaleString()}</td>
                        <td>₹${partner.commission.toLocaleString()}</td>
                        <td>₹${net.toLocaleString()}</td>
                    </tr>
                `;
            });
            
            html += `
                        </tbody>
                    </table>
                </div>
            `;
        }
        
        // Property breakdown
        if (report.property_breakdown && report.property_breakdown.length > 0) {
            html += `
                <h4 style="margin-top: 2rem; margin-bottom: 1rem;">Revenue by Property</h4>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Property</th>
                                <th>Bookings</th>
                                <th>Revenue</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            report.property_breakdown.forEach(property => {
                html += `
                    <tr>
                        <td>${property.name}</td>
                        <td>${property.bookings}</td>
                        <td>₹${property.revenue.toLocaleString()}</td>
                    </tr>
                `;
            });
            
            html += `
                        </tbody>
                    </table>
                </div>
            `;
        }
        
        return html;
    }
    
    generatePartnerReportHTML(report) {
        let html = `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Partner</th>
                            <th>Commission %</th>
                            <th>Bookings</th>
                            <th>Total Revenue</th>
                            <th>Total Commission</th>
                            <th>Net Revenue</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        report.partners.forEach(partner => {
            const revenue = parseFloat(partner.total_revenue) || 0;
            const commission = parseFloat(partner.total_commission) || 0;
            const net = revenue - commission;
            
            html += `
                <tr>
                    <td>${partner.name}</td>
                    <td>${partner.commission}%</td>
                    <td>${partner.booking_count}</td>
                    <td>₹${revenue.toLocaleString()}</td>
                    <td>₹${commission.toLocaleString()}</td>
                    <td>₹${net.toLocaleString()}</td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
        
        return html;
    }
    
    generateBookingReportHTML(report) {
        let html = `
            <h4 style="margin-bottom: 1rem;">Bookings by Status</h4>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Status</th>
                            <th>Count</th>
                            <th>Revenue</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        report.status_breakdown.forEach(status => {
            html += `
                <tr>
                    <td><span class="badge status-${status.status.toLowerCase()}">${status.status}</span></td>
                    <td>${status.count}</td>
                    <td>₹${(parseFloat(status.revenue) || 0).toLocaleString()}</td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
        
        return html;
    }
    
    async exportReportPDF(type) {
        if (!this.currentReport) {
            this.showToast('No report to export', 'warning');
            return;
        }
        
        const report = this.currentReport.data;
        const reportElement = document.getElementById('reportResults');
        
        try {
            this.showToast('Generating PDF...', 'info');
            
            // Use html2canvas to capture the report
            const canvas = await html2canvas(reportElement, {
                scale: 2,
                logging: false,
                backgroundColor: '#ffffff'
            });
            
            // Access jsPDF from global scope
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            
            const imgData = canvas.toDataURL('image/png');
            const imgWidth = 190;
            const pageHeight = 277;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let heightLeft = imgHeight;
            let position = 10;
            
            // Add first page
            pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
            
            // Add additional pages if needed
            while (heightLeft > 0) {
                position = heightLeft - imgHeight + 10;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }
            
            // Generate filename
            const filename = `${type}_report_${report.year || 'custom'}_${report.month || Date.now()}.pdf`;
            
            // Save PDF
            pdf.save(filename);
            
            this.showToast('PDF exported successfully!', 'success');
        } catch (error) {
            console.error('PDF export error:', error);
            this.showToast('Failed to export PDF', 'error');
        }
    }

    async renderSettingsPage() {
        // Fetch properties and partners
        const propsResponse = await fetch('api/properties.php?action=list');
        const propsData = await propsResponse.json();
        const properties = propsData.success ? propsData.properties : [];

        const partnersResponse = await fetch('api/partners.php?action=list');
        const partnersData = await partnersResponse.json();
        const partners = partnersData.success ? partnersData.partners : [];

        return `
            <h1 class="page-title">Settings</h1>
            
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">Properties</h2>
                    <button class="btn btn-primary" id="addPropertyBtn">+ Add Property</button>
                </div>
                ${properties.length === 0 ? '<p class="text-secondary">No properties added yet</p>' : `
                    <div class="table-container desktop-only">
                        <table>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Address</th>
                                    <th>Primary Adult Cost</th>
                                    <th>Extra Adult Cost</th>
                                    <th>Per Kid Cost</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${properties.map(p => `
                                    <tr>
                                        <td>${p.name}</td>
                                        <td>${p.address || 'N/A'}</td>
                                        <td>₹${p.per_adult_cost || 0}</td>
                                        <td>₹${p.extra_adult_cost || p.per_adult_cost || 0}</td>
                                        <td>₹${p.per_kid_cost || 0}</td>
                                        <td>
                                            <button class="btn btn-sm btn-primary edit-property" data-id="${p.id}">Edit</button>
                                            <button class="btn btn-sm btn-danger delete-property" data-id="${p.id}">Delete</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    <div class="card-list mobile-only">
                        ${properties.map(p => `
                            <div class="list-card">
                                <div class="list-card-header">
                                    <h3 class="list-card-title">${p.name}</h3>
                                </div>
                                <div class="list-card-body">
                                    <div class="list-card-row">
                                        <span class="list-card-label">📍 Address:</span>
                                        <span class="list-card-value">${p.address || 'N/A'}</span>
                                    </div>
                                    <div class="list-card-row">
                                        <span class="list-card-label">👤 Primary Adult:</span>
                                        <span class="list-card-value">₹${p.per_adult_cost || 0}</span>
                                    </div>
                                    <div class="list-card-row">
                                        <span class="list-card-label">👥 Extra Adult:</span>
                                        <span class="list-card-value">₹${p.extra_adult_cost || p.per_adult_cost || 0}</span>
                                    </div>
                                    <div class="list-card-row">
                                        <span class="list-card-label">👶 Per Kid:</span>
                                        <span class="list-card-value">₹${p.per_kid_cost || 0}</span>
                                    </div>
                                </div>
                                <div class="list-card-footer" style="display: flex; gap: 0.5rem;">
                                    <button class="btn btn-primary edit-property" data-id="${p.id}" style="flex: 1;">Edit</button>
                                    <button class="btn btn-danger delete-property" data-id="${p.id}" style="flex: 1;">Delete</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `}
            </div>

            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">Booking Partners</h2>
                    <button class="btn btn-primary" id="addPartnerBtn">+ Add Partner</button>
                </div>
                ${partners.length === 0 ? '<p class="text-secondary">No partners added yet</p>' : `
                    <div class="table-container desktop-only">
                        <table>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Commission (%)</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${partners.map(p => `
                                    <tr>
                                        <td>${p.name}</td>
                                        <td>${p.commission}%</td>
                                        <td>
                                            <button class="btn btn-sm btn-primary edit-partner" data-id="${p.id}">Edit</button>
                                            <button class="btn btn-sm btn-danger delete-partner" data-id="${p.id}">Delete</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    <div class="card-list mobile-only">
                        ${partners.map(p => `
                            <div class="list-card">
                                <div class="list-card-header">
                                    <h3 class="list-card-title">${p.name}</h3>
                                </div>
                                <div class="list-card-body">
                                    <div class="list-card-row">
                                        <span class="list-card-label">💼 Commission:</span>
                                        <span class="list-card-value"><strong>${p.commission}%</strong></span>
                                    </div>
                                </div>
                                <div class="list-card-footer" style="display: flex; gap: 0.5rem;">
                                    <button class="btn btn-primary edit-partner" data-id="${p.id}" style="flex: 1;">Edit</button>
                                    <button class="btn btn-danger delete-partner" data-id="${p.id}" style="flex: 1;">Delete</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `}
            </div>
            
            <div class="card">
                <h2 class="card-title">Change Password</h2>
                <form id="changePasswordForm">
                    <div class="form-group">
                        <label>Current Password</label>
                        <input type="password" id="currentPassword" required>
                    </div>
                    <div class="form-group">
                        <label>New Password</label>
                        <input type="password" id="newPassword" required minlength="6">
                    </div>
                    <button type="submit" class="btn btn-primary">Change Password</button>
                </form>
                <div id="passwordMessage" class="hidden"></div>
            </div>

            <div class="card" style="border: 2px solid #ef4444;">
                <h2 class="card-title" style="color: #ef4444;">⚠️ Danger Zone</h2>
                <p style="color: #6b7280; margin-bottom: 1rem;">
                    <strong>Warning:</strong> This action will permanently delete all data including bookings, properties, partners, and users. This action cannot be undone.
                </p>
                <button type="button" class="btn btn-danger" id="uninstallBtn">Uninstall Application</button>
            </div>
        `;
    }

    setupSettingsEvents() {
        // Add Property button
        document.getElementById('addPropertyBtn')?.addEventListener('click', () => {
            this.showPropertyModal();
        });

        // Edit Property buttons
        document.querySelectorAll('.edit-property').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.dataset.id;
                const response = await fetch(`api/properties.php?action=list`);
                const data = await response.json();
                const property = data.properties.find(p => p.id == id);
                if (property) {
                    this.showPropertyModal(property);
                }
            });
        });

        // Delete Property buttons
        document.querySelectorAll('.delete-property').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const id = parseInt(e.target.dataset.id);
                
                if (!id) {
                    this.showToast('Invalid property ID', 'error');
                    return;
                }
                
                this.showConfirm('Are you sure you want to delete this property?', async () => {
                    try {
                        const response = await fetch('api/properties.php?action=delete', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: id, csrf_token: this.csrfToken })
                        });
                        
                        const result = await response.json();
                        if (result.success) {
                            this.showToast('Property deleted successfully!', 'success');
                            this.loadPage('settings');
                        } else {
                            this.showToast(result.message || 'Error deleting property', 'error');
                        }
                    } catch (error) {
                        console.error('Delete error:', error);
                        this.showToast('Error deleting property', 'error');
                    }
                });
            });
        });

        // Add Partner button
        document.getElementById('addPartnerBtn')?.addEventListener('click', () => {
            this.showPartnerModal();
        });

        // Edit Partner buttons
        document.querySelectorAll('.edit-partner').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.dataset.id;
                const response = await fetch(`api/partners.php?action=list`);
                const data = await response.json();
                const partner = data.partners.find(p => p.id == id);
                if (partner) {
                    this.showPartnerModal(partner);
                }
            });
        });

        // Delete Partner buttons
        document.querySelectorAll('.delete-partner').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const id = parseInt(e.target.dataset.id);
                
                if (!id) {
                    this.showToast('Invalid partner ID', 'error');
                    return;
                }
                
                this.showConfirm('Are you sure you want to delete this partner?', async () => {
                    try {
                        const response = await fetch('api/partners.php?action=delete', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: id, csrf_token: this.csrfToken })
                        });
                        
                        const result = await response.json();
                        if (result.success) {
                            this.showToast('Partner deleted successfully!', 'success');
                            this.loadPage('settings');
                        } else {
                            this.showToast(result.message || 'Error deleting partner', 'error');
                        }
                    } catch (error) {
                        console.error('Delete error:', error);
                        this.showToast('Error deleting partner', 'error');
                    }
                });
            });
        });

        // Change Password form
        document.getElementById('changePasswordForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const currentPassword = document.getElementById('currentPassword').value;
            const newPassword = document.getElementById('newPassword').value;
            
            try {
                const response = await fetch('api/auth.php?action=change-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ currentPassword, newPassword, csrf_token: this.csrfToken })
                });
                
                const data = await response.json();
                const messageDiv = document.getElementById('passwordMessage');
                
                messageDiv.textContent = data.message;
                messageDiv.className = data.success ? 'success-message' : 'error-message';
                messageDiv.classList.remove('hidden');
                
                if (data.success) {
                    document.getElementById('changePasswordForm').reset();
                }
            } catch (error) {
                this.showToast('Error changing password', 'error');
            }
        });

        // Uninstall button
        document.getElementById('uninstallBtn')?.addEventListener('click', () => {
            const confirmModal = document.createElement('div');
            confirmModal.className = 'modal active';
            confirmModal.innerHTML = `
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header" style="border-bottom: 2px solid #ef4444;">
                        <h2 class="modal-title" style="color: #ef4444;">⚠️ Confirm Uninstallation</h2>
                        <button class="close-btn" onclick="this.closest('.modal').remove()">✕</button>
                    </div>
                    <div class="modal-body">
                        <p style="margin-bottom: 1rem; color: #6b7280;">
                            <strong style="color: #ef4444;">This action cannot be undone!</strong><br><br>
                            All data including bookings, properties, partners, and users will be permanently deleted.<br><br>
                            Type <strong>DELETE ALL DATA</strong> below to confirm:
                        </p>
                        <div class="form-group">
                            <input type="text" id="confirmationText" placeholder="DELETE ALL DATA" style="font-family: monospace;">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                        <button type="button" class="btn btn-danger" id="confirmUninstallBtn">Uninstall</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(confirmModal);
            
            document.getElementById('confirmUninstallBtn').addEventListener('click', async () => {
                const confirmationText = document.getElementById('confirmationText').value;
                
                try {
                    const response = await fetch('api/uninstall.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ confirmation: confirmationText })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        confirmModal.remove();
                        this.showToast('Application uninstalled successfully. Redirecting...', 'success');
                        setTimeout(() => {
                            window.location.href = 'install.php';
                        }, 2000);
                    } else {
                        this.showToast(data.message || 'Failed to uninstall', 'error');
                    }
                } catch (error) {
                    this.showToast('Error during uninstallation', 'error');
                }
            });
        });
    }

    showPropertyModal(property = null) {
        const isEdit = property !== null;
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px;">
                <div class="modal-header">
                    <h2 class="modal-title">${isEdit ? 'Edit' : 'Add'} Property</h2>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">✕</button>
                </div>
                <div class="modal-body">
                    <form id="propertyForm">
                        <h3 style="color: var(--primary); margin-bottom: 1rem; font-size: 1.1rem;">Property Information</h3>
                        <div class="form-group">
                            <label>Property Name *</label>
                            <input type="text" id="propName" value="${property?.name || ''}" required>
                        </div>
                        <div class="form-group">
                            <label>Address</label>
                            <textarea id="propAddress" rows="2">${property?.address || ''}</textarea>
                        </div>
                        
                        <h3 style="color: var(--primary); margin: 1.5rem 0 1rem; font-size: 1.1rem;">Owner Details</h3>
                        <div class="form-group">
                            <label>Owner Name</label>
                            <input type="text" id="propOwnerName" value="${property?.owner_name || ''}" placeholder="Full name of property owner">
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Owner Mobile</label>
                                <input type="tel" id="propOwnerMobile" value="${property?.owner_mobile || ''}" placeholder="+91 98765 43210">
                            </div>
                            <div class="form-group">
                                <label>Owner Email</label>
                                <input type="email" id="propOwnerEmail" value="${property?.owner_email || ''}" placeholder="owner@example.com">
                            </div>
                        </div>
                        
                        <h3 style="color: var(--primary); margin: 1.5rem 0 1rem; font-size: 1.1rem;">Pricing</h3>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Primary Adult Cost (₹)</label>
                                <input type="number" id="propPerAdult" value="${property?.per_adult_cost || 0}" min="0">
                            </div>
                            <div class="form-group">
                                <label>Extra Adult Cost (₹)</label>
                                <input type="number" id="propExtraAdult" value="${property?.extra_adult_cost || property?.per_adult_cost || 0}" min="0">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Per Kid Cost (₹)</label>
                            <input type="number" id="propPerKid" value="${property?.per_kid_cost || 0}" min="0">
                        </div>
                        <div class="form-group">
                            <label>Logo URL</label>
                            <input type="text" id="propLogo" value="${property?.logo || ''}" placeholder="https://...">
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-primary" id="savePropertyBtn">${isEdit ? 'Update' : 'Add'} Property</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        document.getElementById('savePropertyBtn').addEventListener('click', async () => {
            const data = {
                name: document.getElementById('propName').value,
                address: document.getElementById('propAddress').value,
                owner_name: document.getElementById('propOwnerName').value,
                owner_mobile: document.getElementById('propOwnerMobile').value,
                owner_email: document.getElementById('propOwnerEmail').value,
                per_adult_cost: parseFloat(document.getElementById('propPerAdult').value) || 0,
                extra_adult_cost: parseFloat(document.getElementById('propExtraAdult').value) || 0,
                per_kid_cost: parseFloat(document.getElementById('propPerKid').value) || 0,
                logo: document.getElementById('propLogo').value
            };

            if (!data.name) {
                this.showToast('Property name is required', 'warning');
                return;
            }

            if (isEdit) {
                data.id = property.id;
            }

            data.csrf_token = this.csrfToken;

            const action = isEdit ? 'update' : 'add';
            const response = await fetch(`api/properties.php?action=${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await response.json();
            if (result.success) {
                modal.remove();
                this.showToast(isEdit ? 'Property updated successfully!' : 'Property added successfully!', 'success');
                this.loadPage('settings');
            } else {
                this.showToast(result.message || 'Error saving property', 'error');
            }
        });
    }

    showPartnerModal(partner = null) {
        const isEdit = partner !== null;
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2 class="modal-title">${isEdit ? 'Edit' : 'Add'} Partner</h2>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">✕</button>
                </div>
                <div class="modal-body">
                    <form id="partnerForm">
                        <div class="form-group">
                            <label>Partner Name *</label>
                            <input type="text" id="partnerName" value="${partner?.name || ''}" required placeholder="e.g., Airbnb, Booking.com, Direct">
                        </div>
                        <div class="form-group">
                            <label>Commission (%)</label>
                            <input type="number" id="partnerCommission" value="${partner?.commission || 0}" min="0" max="100" step="0.1">
                            <small class="text-secondary">Percentage commission charged by this partner</small>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-primary" id="savePartnerBtn">${isEdit ? 'Update' : 'Add'} Partner</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        document.getElementById('savePartnerBtn').addEventListener('click', async () => {
            const data = {
                name: document.getElementById('partnerName').value,
                commission: parseFloat(document.getElementById('partnerCommission').value) || 0
            };

            if (!data.name) {
                this.showToast('Partner name is required', 'warning');
                return;
            }

            if (isEdit) {
                data.id = partner.id;
            }

            data.csrf_token = this.csrfToken;

            const action = isEdit ? 'update' : 'add';
            const response = await fetch(`api/partners.php?action=${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await response.json();
            if (result.success) {
                modal.remove();
                this.showToast(isEdit ? 'Partner updated successfully!' : 'Partner added successfully!', 'success');
                this.loadPage('settings');
            } else {
                this.showToast(result.message || 'Error saving partner', 'error');
            }
        });
    }

    showComingSoonModal(title, description) {
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2 class="modal-title">🚀 ${title}</h2>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">✕</button>
                </div>
                <div class="modal-body">
                    <p style="font-size: 1.1rem; margin-bottom: 1rem;">${description}</p>
                    <div style="padding: 1rem; background: var(--bg-secondary); border-radius: 6px; border-left: 4px solid var(--primary);">
                        <p style="font-weight: 600; margin-bottom: 0.5rem;">Coming Soon!</p>
                        <p class="text-secondary" style="font-size: 0.9rem;">
                            This feature is under development and will be available in a future update.
                        </p>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-primary" onclick="this.closest('.modal').remove()">Got It</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    async loadNotifications() {
        try {
            const response = await fetch('api/notifications.php?action=list');
            const data = await response.json();
            
            if (data.success) {
                const unreadCount = data.notifications.filter(n => !n.read).length;
                const badge = document.getElementById('notificationBadge');
                
                if (unreadCount > 0) {
                    badge.textContent = unreadCount;
                    badge.classList.remove('hidden');
                } else {
                    badge.classList.add('hidden');
                }

                const listDiv = document.getElementById('notificationsList');
                if (data.notifications.length === 0) {
                    listDiv.innerHTML = '<p class="text-center text-secondary" style="padding: 2rem;">No notifications</p>';
                } else {
                    listDiv.innerHTML = data.notifications.map(n => `
                        <div class="notification-item ${n.read ? '' : 'unread'}" style="cursor: pointer;" data-notification='${JSON.stringify(n)}'>
                            <strong>${n.title}</strong>
                            <p class="text-secondary">${n.message}</p>
                            <small class="text-muted">${new Date(n.created_at).toLocaleString()}</small>
                        </div>
                    `).join('');
                    
                    // Add click handlers
                    document.querySelectorAll('.notification-item').forEach(item => {
                        item.addEventListener('click', async (e) => {
                            const notification = JSON.parse(e.currentTarget.dataset.notification);
                            await this.handleNotificationClick(notification);
                        });
                    });
                }
            }
        } catch (error) {
            console.error('Error loading notifications:', error);
        }
    }

    async handleNotificationClick(notification) {
        try {
            // Mark as read
            if (!notification.read) {
                await fetch('api/notifications.php?action=mark-read', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: notification.id, csrf_token: this.csrfToken })
                });
            }

            // Close notification panel and overlay
            this.closeNotifications();

            // Handle based on type
            if (notification.booking_id) {
                const bookingId = parseInt(notification.booking_id);
                
                if (notification.type === 'invoice_sent') {
                    // Show invoice preview directly
                    await this.showInvoicePreview(bookingId);
                } else if (notification.type === 'pending_payment') {
                    // Show payment modal with invoice
                    await this.showPaymentModal(bookingId);
                } else {
                    // All other notification types show the booking details modal
                    // Types: pending_request, confirmed, upcoming_checkin
                    await this.showViewRequestModal(bookingId);
                }
            }

            // Reload notifications to update badge
            this.loadNotifications();
        } catch (error) {
            console.error('Error handling notification click:', error);
            this.showToast('Error opening notification', 'error');
        }
    }

    async showInvoicePreview(bookingId) {
        // Use universal invoice function for consistency
        await this.showInvoiceFromDB(bookingId);
    }

    // Universal invoice display function - ALWAYS fetches fresh data from DB
    async showInvoiceFromDB(bookingId) {
        const loading = this.showLoading('Loading latest invoice data...');
        
        try {
            // Fetch fresh booking data from database
            const response = await fetch(`api/bookings.php?action=get&id=${bookingId}`);
            const data = await response.json();
            
            if (!data.success) {
                this.showToast('Error loading booking details', 'error');
                return;
            }

            const booking = data.booking;
            
            // Verify payment status
            if (booking.payment_status !== 'Paid' && booking.payment_status !== 'Partial Paid') {
                this.showToast('Invoice not available for bookings with pending payment', 'warning');
                return;
            }
            
            // Generate invoice with fresh data
            const invoiceHTML = await this.generateInvoiceHTML(booking);
            
            const modal = document.createElement('div');
            modal.className = 'modal active';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 900px;">
                    <div class="modal-header">
                        <h2 class="modal-title">Invoice - ${booking.customer_name}</h2>
                        <button class="close-btn" onclick="this.closest('.modal').remove()">✕</button>
                    </div>
                    <div class="modal-body">
                        <div style="background: white; padding: 20px; border-radius: 8px; max-height: 70vh; overflow-y: auto;">
                            ${invoiceHTML}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
                        <button type="button" class="btn btn-primary" id="downloadInvoiceBtn">Download PDF</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            
            // Setup download handler
            document.getElementById('downloadInvoiceBtn').addEventListener('click', async () => {
                await this.downloadInvoice(booking);
            });
            
        } catch (error) {
            console.error('Error displaying invoice:', error);
            this.showToast('Error loading invoice', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async showPaymentModal(bookingId) {
        // Fetch booking data
        const response = await fetch(`api/bookings.php?action=get&id=${bookingId}`);
        const data = await response.json();
        
        if (!data.success) {
            this.showToast('Error loading booking details', 'error');
            return;
        }

        const booking = data.booking;
        const total = parseFloat(booking.total_amount || 0);
        const paid = parseFloat(booking.amount_paid || 0);
        const pending = total - paid;
        
        const invoiceHTML = await this.generateInvoiceHTML(booking);
        
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px;">
                <div class="modal-header">
                    <h2 class="modal-title">Payment - ${booking.customer_name}</h2>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">✕</button>
                </div>
                <div class="modal-body">
                    <div style="background: #fef2f2; padding: 1rem; border-radius: 8px; border: 1px solid #fca5a5; margin-bottom: 1.5rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                            <span style="font-weight: 600; color: #991b1b;">Total Amount:</span>
                            <span style="font-size: 1.25rem; font-weight: 700; color: #991b1b;">₹${total.toLocaleString()}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                            <span style="color: #059669;">Amount Paid:</span>
                            <span style="font-weight: 600; color: #059669;">₹${paid.toLocaleString()}</span>
                        </div>
                        <hr style="margin: 0.5rem 0; border-color: #fca5a5;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-weight: 700; font-size: 1.1rem; color: #dc2626;">Pending Amount:</span>
                            <span style="font-size: 1.5rem; font-weight: 700; color: #dc2626;">₹${pending.toLocaleString()}</span>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 1.5rem;">
                        <h3 style="margin-bottom: 1rem; color: var(--primary);">Update Payment</h3>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Payment Status</label>
                                <select id="paymentStatus">
                                    <option value="Pending" ${booking.payment_status === 'Pending' ? 'selected' : ''}>Pending</option>
                                    <option value="Partial Paid" ${booking.payment_status === 'Partial Paid' ? 'selected' : ''}>Partial Paid</option>
                                    <option value="Paid" ${booking.payment_status === 'Paid' ? 'selected' : ''}>Paid</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Payment Method</label>
                                <select id="paymentMethod">
                                    <option value="">Not Set</option>
                                    <option value="Cash" ${booking.payment_method === 'Cash' ? 'selected' : ''}>Cash</option>
                                    <option value="UPI" ${booking.payment_method === 'UPI' ? 'selected' : ''}>UPI</option>
                                    <option value="Bank Transfer" ${booking.payment_method === 'Bank Transfer' ? 'selected' : ''}>Bank Transfer</option>
                                    <option value="Card" ${booking.payment_method === 'Card' ? 'selected' : ''}>Card</option>
                                    <option value="Credit Card" ${booking.payment_method === 'Credit Card' ? 'selected' : ''}>Credit Card</option>
                                    <option value="Debit Card" ${booking.payment_method === 'Debit Card' ? 'selected' : ''}>Debit Card</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Amount Paid (₹)</label>
                            <input type="number" id="amountPaid" value="${paid}" min="0" max="${total}" step="0.01">
                            <small class="text-secondary">Remaining: ₹<span id="remainingPayment">${pending.toLocaleString()}</span></small>
                        </div>
                    </div>
                    
                    <div style="margin-top: 1.5rem;">
                        <h4 style="margin-bottom: 1rem; color: var(--primary);">Invoice Preview</h4>
                        <div style="background: white; padding: 20px; border-radius: 8px; max-height: 400px; overflow-y: auto;">
                            ${invoiceHTML}
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-primary" id="updatePaymentBtn">Update Payment</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        
        // Update remaining amount on input change
        document.getElementById('amountPaid').addEventListener('input', (e) => {
            const amountPaid = parseFloat(e.target.value) || 0;
            const remaining = total - amountPaid;
            document.getElementById('remainingPayment').textContent = remaining.toLocaleString();
        });
        
        // Update payment handler
        document.getElementById('updatePaymentBtn').addEventListener('click', async () => {
            const updateBtn = document.getElementById('updatePaymentBtn');
            const amountPaid = parseFloat(document.getElementById('amountPaid').value) || 0;
            const paymentStatus = document.getElementById('paymentStatus').value;
            const paymentMethod = document.getElementById('paymentMethod').value;
            
            // Validate payment amount
            if (amountPaid < 0) {
                this.showToast('Payment amount cannot be negative', 'error');
                return;
            }
            
            if (amountPaid > total) {
                this.showToast('Payment amount cannot exceed total amount', 'error');
                return;
            }
            
            // Validate payment method for paid/partial paid
            if ((paymentStatus === 'Paid' || paymentStatus === 'Partial Paid') && !paymentMethod) {
                this.showToast('Please select a payment method', 'error');
                return;
            }
            
            // Validate amount matches status
            if (paymentStatus === 'Paid' && amountPaid < total) {
                const confirmed = await this.showConfirmDialog(
                    'Amount Mismatch',
                    `Status is "Paid" but amount (₹${amountPaid.toLocaleString()}) is less than total (₹${total.toLocaleString()}). Continue anyway?`
                );
                if (!confirmed) return;
            }
            
            if (paymentStatus === 'Partial Paid' && (amountPaid <= 0 || amountPaid >= total)) {
                this.showToast('For partial payment, amount must be between 0 and total', 'error');
                return;
            }
            
            // Show loading state
            updateBtn.disabled = true;
            updateBtn.textContent = 'Updating...';
            
            const updatedData = {
                id: booking.id,
                payment_status: paymentStatus,
                payment_method: paymentMethod,
                amount_paid: amountPaid,
                csrf_token: this.csrfToken
            };
            
            try {
                const response = await fetch('api/bookings.php?action=update', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedData)
                });
                
                const result = await response.json();
                if (result.success) {
                    modal.remove();
                    this.showToast('Payment updated successfully!', 'success');
                    this.loadPage(this.currentPage);
                } else {
                    this.showToast(result.message || 'Error updating payment', 'error');
                    updateBtn.disabled = false;
                    updateBtn.textContent = 'Update Payment';
                }
            } catch (error) {
                this.showToast('Connection error. Please try again.', 'error');
                updateBtn.disabled = false;
                updateBtn.textContent = 'Update Payment';
            }
        });
    }
    
    showConfirmDialog(title, message) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal active';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <h2 class="modal-title">${title}</h2>
                        <button class="close-btn" onclick="this.closest('.modal').remove()">✕</button>
                    </div>
                    <div class="modal-body">
                        <p style="font-size: 1rem; line-height: 1.6;">${message}</p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" id="cancelBtn">Cancel</button>
                        <button type="button" class="btn btn-primary" id="confirmBtn">Confirm</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            const cleanup = (result) => {
                modal.remove();
                resolve(result);
            };
            
            modal.querySelector('#confirmBtn').addEventListener('click', () => cleanup(true));
            modal.querySelector('#cancelBtn').addEventListener('click', () => cleanup(false));
            modal.querySelector('.close-btn').addEventListener('click', () => cleanup(false));
        });
    }
    
    showLoading(message = 'Loading...') {
        const loading = document.createElement('div');
        loading.id = 'loadingOverlay';
        loading.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        loading.innerHTML = `
            <div style="background: white; padding: 2rem 3rem; border-radius: 12px; text-align: center;">
                <div class="spinner" style="width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid var(--primary); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1rem;"></div>
                <p style="margin: 0; font-size: 1rem; color: #333;">${message}</p>
            </div>
        `;
        document.body.appendChild(loading);
        return loading;
    }
    
    hideLoading() {
        const loading = document.getElementById('loadingOverlay');
        if (loading) {
            loading.remove();
        }
    }
}

// Initialize app
new App();
