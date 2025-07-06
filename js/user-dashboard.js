document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    const userType = localStorage.getItem('userType');

    if (!token || !username || userType !== 'user') {
        window.location.href = 'user-login.html';
        return;
    }

    // DOM Elements
    const form = document.getElementById('cabRequestForm');
    const requestList = document.getElementById('requestList');
    const mainContent = document.querySelector('main');
    const dashboardTitle = document.querySelector('.mb-6 h1');
    const lastUpdated = document.querySelector('.mb-6 .text-sm');
    
    // State
    let currentView = 'dashboard'; // 'dashboard' or 'requests'
    let allRequests = [];
    let previousRequests = []; // For tracking driver assignments
    let notifiedAssignments = new Set(); // Track notified driver assignments

    // Initialize the dashboard
    initDashboard();

    function initDashboard() {
        // Update UI with username
        document.querySelectorAll('.font-medium').forEach(el => {
            if (el.textContent === 'John' || el.textContent === 'John Doe') {
                el.textContent = username.split('@')[0];
            }
        });

        // Setup event listeners
        setupEventListeners();
        
        // Load initial data
        fetchRequests();

        // Start auto-refresh
        setInterval(checkForDriverAssignment, 20000); // Check every 20 seconds
    }

    function setupEventListeners() {
        // Form submission
        form?.addEventListener('submit', handleRideRequest);

        // Desktop navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                const target = item.querySelector('span').textContent.toLowerCase();
                switchView(target);
            });
        });

        // Mobile bottom navigation
        document.querySelectorAll('[class*="fixed bottom-0"] a').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const target = item.querySelector('span').textContent.toLowerCase();
                switchView(target);
            });
        });

        // Mobile menu toggle
        document.getElementById('mobileMenuButton')?.addEventListener('click', () => {
            const sidebar = document.querySelector('.sidebar');
            sidebar.classList.toggle('hidden');
            sidebar.classList.toggle('active');
        });

        // Logout buttons
        document.getElementById('logoutDesktop')?.addEventListener('click', handleLogout);
        document.getElementById('logoutMobile')?.addEventListener('click', handleLogout);
    }

    function switchView(target) {
        switch(target) {
            case 'dashboard':
            case 'home':
                showDashboard();
                break;
            case 'book ride':
                showDashboard();
                break;
            case 'ride history':
            case 'rides':
            case 'history':
                showRideRequests();
                break;
            default:
                showDashboard();
        }
    }

    function showDashboard() {
        currentView = 'dashboard';
        dashboardTitle.textContent = 'Dashboard';
        lastUpdated.textContent = 'Last updated: Just now';
        
        mainContent.innerHTML = `
            <div class="mb-6 flex justify-between items-center">
                <h1 class="text-2xl font-bold text-gray-800">Dashboard</h1>
                <div class="text-sm text-gray-500">Last updated: Just now</div>
            </div>

            <!-- Stats Cards -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <div class="card bg-white p-6 rounded-xl border border-gray-100">
                    <div class="flex justify-between items-start">
                        <div>
                            <p class="text-sm font-medium text-gray-500">Total Rides</p>
                            <h3 class="text-2xl font-bold mt-1">${allRequests.length}</h3>
                        </div>
                        <div class="p-3 rounded-lg bg-blue-100 text-blue-600">
                            <i class="fas fa-car-side"></i>
                        </div>
                    </div>
                    <div class="mt-4 flex items-center text-sm text-green-500">
                        <i class="fas fa-arrow-up mr-1"></i>
                        <span>${allRequests.length > 0 ? Math.floor(Math.random() * 20) : 0}% from last month</span>
                    </div>
                </div>
                
                <div class="card bg-white p-6 rounded-xl border border-gray-100">
                    <div class="flex justify-between items-start">
                        <div>
                            <p class="text-sm font-medium text-gray-500">Pending Requests</p>
                            <h3 class="text-2xl font-bold mt-1">${
                                allRequests.filter(req => 
                                    req.status === 'PENDING' || req.status === 'ASSIGNED'
                                ).length
                            }</h3>
                        </div>
                        <div class="p-3 rounded-lg bg-yellow-100 text-yellow-600">
                            <i class="fas fa-clock"></i>
                        </div>
                    </div>
                    <div class="mt-4">
                        <span class="inline-block px-2 py-1 text-xs font-medium ride-status-pending rounded">Active</span>
                    </div>
                </div>
                
                <div class="card bg-white p-6 rounded-xl border border-gray-100">
                    <div class="flex justify-between items-start">
                        <div>
                            <p class="text-sm font-medium text-gray-500">Favorite Drivers</p>
                            <h3 class="text-2xl font-bold mt-1">5</h3>
                        </div>
                        <div class="p-3 rounded-lg bg-purple-100 text-purple-600">
                            <i class="fas fa-star"></i>
                        </div>
                    </div>
                    <div class="mt-4 flex items-center text-sm text-gray-500">
                        <i class="fas fa-user-friends mr-2"></i>
                        <span>3 available now</span>
                    </div>
                </div>
            </div>

            <!-- Quick Book Section -->
            <div class="card bg-white p-6 rounded-xl border border-gray-100">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-xl font-semibold">Book a Ride</h2>
                    <div class="flex space-x-2">
                        <button class="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg">Now</button>
                        <button class="px-3 py-1 text-sm border border-gray-300 rounded-lg">Later</button>
                    </div>
                </div>
                
                <form id="cabRequestForm" class="space-y-4">
                    <div>
                        <label for="pickupLocation" class="block text-sm font-medium text-gray-700 mb-1">Pickup Location</label>
                        <div class="relative">
                            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <i class="fas fa-map-marker-alt text-gray-400"></i>
                            </div>
                            <input type="text" id="pickupLocation" name="pickupLocation" 
                                   class="w-full pl-10 pr-3 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                                   placeholder="Enter pickup address" required>
                        </div>
                    </div>
                    
                    <div>
                        <label for="dropoffLocation" class="block text-sm font-medium text-gray-700 mb-1">Dropoff Location</label>
                        <div class="relative">
                            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <i class="fas fa-flag text-gray-400"></i>
                            </div>
                            <input type="text" id="dropoffLocation" name="dropoffLocation" 
                                   class="w-full pl-10 pr-3 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                                   placeholder="Where to?" required>
                        </div>
                    </div>
                    
                    <div>
                        <label for="requestTime" class="block text-sm font-medium text-gray-700 mb-1">Schedule</label>
                        <input type="datetime-local" id="requestTime" name="requestTime" 
                               class="w-full px-3 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                               required>
                    </div>
                    
                    <div class="pt-2">
                        <button type="submit" class="btn-primary w-full py-3 px-4 rounded-lg text-white font-medium flex items-center justify-center space-x-2">
                            <i class="fas fa-car"></i>
                            <span>Request Ride</span>
                        </button>
                    </div>
                </form>
            </div>

            <!-- Recent Requests Section -->
            <div class="card bg-white p-6 rounded-xl border border-gray-100 mt-8">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-xl font-semibold">Recent Requests</h2>
                    <a href="#" class="text-sm text-blue-600 hover:text-blue-800" id="viewAllRequests">View All</a>
                </div>
                
                <div class="table-responsive">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Request ID</th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date & Time</th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pickup</th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dropoff</th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Driver Name</th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Driver Phone</th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">View Location</th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                            </tr>
                        </thead>
                        <tbody id="requestList" class="bg-white divide-y divide-gray-200">
                            ${renderRecentRequests(allRequests.slice(0, 3))}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        // Reattach event listeners for elements in the new DOM
        document.getElementById('cabRequestForm')?.addEventListener('submit', handleRideRequest);
        document.getElementById('viewAllRequests')?.addEventListener('click', (e) => {
            e.preventDefault();
            showRideRequests();
        });
    }

    function showRideRequests() {
        currentView = 'requests';
        dashboardTitle.textContent = 'Ride History';
        lastUpdated.textContent = `Showing ${allRequests.length} requests`;
        
        mainContent.innerHTML = `
            <div class="mb-6 flex justify-between items-center">
                <h1 class="text-2xl font-bold text-gray-800">Ride History</h1>
                <div class="text-sm text-gray-500">Showing ${allRequests.length} requests</div>
            </div>

            <div class="card bg-white p-6 rounded-xl border border-gray-100">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-xl font-semibold">All Ride Requests</h2>
                    <div class="flex space-x-2">
                        <select id="filterStatus" class="px-3 py-1 text-sm border border-gray-300 rounded-lg">
                            <option value="all">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                        <button id="refreshRequests" class="p-2 rounded-lg bg-gray-100 hover:bg-gray-200">
                            <i class="fas fa-sync-alt"></i>
                        </button>
                    </div>
                </div>
                
                <div class="table-responsive">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Request ID</th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date & Time</th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pickup</th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dropoff</th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Driver Name</th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Driver Phone</th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">View Location</th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                            </tr>
                        </thead>
                        <tbody id="fullRequestList" class="bg-white divide-y divide-gray-200">
                            ${renderAllRequests(allRequests)}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        // Add event listeners for the new elements
        document.getElementById('filterStatus')?.addEventListener('change', (e) => {
            const filtered = filterRequestsByStatus(allRequests, e.target.value);
            document.getElementById('fullRequestList').innerHTML = renderAllRequests(filtered);
            addTableButtonListeners();
        });

        document.getElementById('refreshRequests')?.addEventListener('click', () => {
            fetchRequests();
        });

        addTableButtonListeners();
    }

    function renderRecentRequests(requests) {
        if (!requests || requests.length === 0) {
            return `
                <tr>
                    <td colspan="9" class="px-6 py-4 text-center text-gray-500">
                        No ride requests found. Book your first ride!
                    </td>
                </tr>
            `;
        }

        return requests.map(req => `
            <tr class="table-row">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 table-cell" data-label="Request ID">#RS-${req.id}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 table-cell" data-label="Date & Time">${formatDate(req.request_time)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 table-cell" data-label="Pickup">${req.pickup_location}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 table-cell" data-label="Dropoff">${req.dropoff_location}</td>
                <td class="px-6 py-4 whitespace-nowrap table-cell" data-label="Status">
                    <span class="px-2 py-1 text-xs font-medium ride-status-${req.status.toLowerCase()} rounded-full">
                        ${formatStatus(req.status)}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 table-cell" data-label="Driver Name">${req.driver ? req.driver.name : 'Not assigned'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 table-cell" data-label="Driver Phone">
                    ${req.driver && req.driver.phone 
                        ? `<a href="tel:${req.driver.phone}" class="text-blue-600 hover:text-blue-800">${req.driver.phone}</a>` 
                        : '-'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 table-cell" data-label="View Location">
                    ${req.driver && req.driver.latitude && req.driver.longitude 
                        ? `<a href="https://www.google.com/maps?q=${req.driver.latitude},${req.driver.longitude}" class="text-blue-600 hover:text-blue-800" target="_blank">View</a>` 
                        : 'N/A'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 table-cell" data-label="Action">
                    ${getActionButton(req)}
                </td>
            </tr>
        `).join('');
    }

    function renderAllRequests(requests) {
        if (!requests || requests.length === 0) {
            return `
                <tr>
                    <td colspan="9" class="px-6 py-4 text-center text-gray-500">
                        No ride requests found matching your criteria
                    </td>
                </tr>
            `;
        }

        return requests.map(req => `
            <tr class="table-row">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 table-cell" data-label="Request ID">#RS-${req.id}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 table-cell" data-label="Date & Time">${formatDate(req.request_time)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 table-cell" data-label="Pickup">${req.pickup_location}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 table-cell" data-label="Dropoff">${req.dropoff_location}</td>
                <td class="px-6 py-4 whitespace-nowrap table-cell" data-label="Status">
                    <span class="px-2 py-1 text-xs font-medium ride-status-${req.status.toLowerCase()} rounded-full">
                        ${formatStatus(req.status)}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 table-cell" data-label="Driver Name">${req.driver ? req.driver.name : 'Not assigned'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 table-cell" data-label="Driver Phone">
                    ${req.driver && req.driver.phone 
                        ? `<a href="tel:${req.driver.phone}" class="text-blue-600 hover:text-blue-800">${req.driver.phone}</a>` 
                        : '-'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 table-cell" data-label="View Location">
                    ${req.driver && req.driver.latitude && req.driver.longitude 
                        ? `<a href="https://www.google.com/maps?q=${req.driver.latitude},${req.driver.longitude}" class="text-blue-600 hover:text-blue-800" target="_blank">View</a>` 
                        : 'N/A'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 table-cell" data-label="Action">
                    ${getActionButton(req)}
                </td>
            </tr>
        `).join('');
    }

    function getActionButton(req) {
        if (req.status === 'CONFIRMED' || req.status === 'ASSIGNED') {
            return `<button class="text-blue-600 hover:text-blue-900 track-ride" data-id="${req.id}">Track</button>`;
        } else if (req.status === 'COMPLETED') {
            return `<button class="text-blue-600 hover:text-blue-900 view-details" data-id="${req.id}">Details</button>`;
        } else {
            return `<button class="text-blue-600 hover:text-blue-900 book-again" data-id="${req.id}">Book Again</button>`;
        }
    }

    function addTableButtonListeners() {
        // Track ride buttons
        document.querySelectorAll('.track-ride').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const requestId = e.target.getAttribute('data-id');
                trackRide(requestId);
            });
        });

        // View details buttons
        document.querySelectorAll('.view-details').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const requestId = e.target.getAttribute('data-id');
                viewRideDetails(requestId);
            });
        });

        // Book again buttons
        document.querySelectorAll('.book-again').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const requestId = e.target.getAttribute('data-id');
                bookAgain(requestId);
            });
        });
    }

    function filterRequestsByStatus(requests, status) {
        if (status === 'all') return requests;
        
        const statusMap = {
            'pending': ['PENDING', 'ASSIGNED'],
            'confirmed': ['CONFIRMED'],
            'completed': ['COMPLETED'],
            'cancelled': ['CANCELLED']
        };

        const statuses = statusMap[status] || [];
        return requests.filter(req => statuses.includes(req.status));
    }

    async function fetchRequests() {
        try {
            // Show loading state
            if (currentView === 'dashboard') {
                requestList.innerHTML = `
                    <tr>
                        <td colspan="9" class="px-6 py-4 text-center text-gray-500">
                            <div class="animate-pulse flex justify-center">
                                <div class="h-4 w-4 bg-blue-600 rounded-full mx-1"></div>
                                <div class="h-4 w-4 bg-blue-600 rounded-full mx-1"></div>
                                <div class="h-4 w-4 bg-blue-600 rounded-full mx-1"></div>
                            </div>
                        </td>
                    </tr>
                `;
            }

            const response = await fetch('https://serverone-w2xc.onrender.com/api/requests', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.status === 401) {
                localStorage.clear();
                window.location.href = 'user-login.html';
                return;
            }

            const { data } = await response.json();
            allRequests = data || [];
            
            // Update the current view with fresh data
            if (currentView === 'dashboard') {
                showDashboard();
            } else {
                showRideRequests();
            }
        } catch (error) {
            console.error('Error fetching requests:', error);
            alert('Error fetching requests');
        }
    }

    async function checkForDriverAssignment() {
        try {
            const response = await fetch('https://serverone-w2xc.onrender.com/api/requests', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.status === 401) {
                localStorage.clear();
                window.location.href = 'user-login.html';
                return;
            }

            const { data } = await response.json();
            const newRequests = data || [];

            // Check for newly assigned drivers
            newRequests.forEach(newReq => {
                const oldReq = previousRequests.find(req => req.id === newReq.id);
                if (oldReq && !oldReq.driver && newReq.driver && !notifiedAssignments.has(newReq.id)) {
                    alert(`Driver Assigned!\nRide #RS-${newReq.id}\nDriver: ${newReq.driver.name}\nPhone: ${newReq.driver.phone}\nVehicle: ${newReq.driver.vehicle_number}`);
                    notifiedAssignments.add(newReq.id); // Mark as notified
                }
            });

            // Update previous requests
            previousRequests = [...newRequests];
            
            // Update allRequests and refresh view
            allRequests = newRequests;
            if (currentView === 'dashboard') {
                showDashboard();
            } else {
                showRideRequests();
            }
        } catch (error) {
            console.error('Error checking driver assignments:', error);
            // Suppress alert to avoid spamming user on network errors
        }
    }

    async function handleRideRequest(e) {
        e.preventDefault();

        const pickupLocation = document.getElementById('pickupLocation').value;
        const dropoffLocation = document.getElementById('dropoffLocation').value;
        const requestTime = document.getElementById('requestTime').value;

        try {
            const response = await fetch('https://serverone-w2xc.onrender.com/api/requests', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    pickupLocation,
                    dropoffLocation,
                    requestTime
                })
            });

            const data = await response.json();

            if (response.ok) {
                alert('Request submitted successfully!');
                document.getElementById('cabRequestForm').reset();
                fetchRequests();
            } else {
                if (response.status === 401) {
                    localStorage.clear();
                    window.location.href = 'user-login.html';
                } else {
                    alert(data.message || 'Error submitting request');
                }
            }
        } catch (error) {
            console.error('Request error:', error);
            alert('Error submitting request');
        }
    }

    // Helper functions
    function formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        
        if (date.toDateString() === now.toDateString()) {
            return `Today, ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
        } else if (date.toDateString() === new Date(now.setDate(now.getDate() - 1)).toDateString()) {
            return `Yesterday, ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
        } else {
            return date.toLocaleString();
        }
    }

    function formatStatus(status) {
        const statusMap = {
            'PENDING': 'Pending',
            'ASSIGNED': 'Confirmed',
            'CONFIRMED': 'Confirmed',
            'COMPLETED': 'Completed',
            'CANCELLED': 'Cancelled'
        };
        return statusMap[status] || status;
    }

    async function trackRide(requestId) {
        try {
            const response = await fetch(`https://serverone-w2xc.onrender.com/api/requests/${requestId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const { data } = await response.json();
                const driverInfo = data.driver ? 
                    `Driver: ${data.driver.name}\nPhone: ${data.driver.phone}\nVehicle: ${data.driver.vehicle_number}` : 
                    'Driver: Not assigned yet';
                alert(`Tracking ride #RS-${requestId}\n${driverInfo}\nStatus: ${data.status}`);
            } else {
                alert('Error fetching ride details');
            }
        } catch (error) {
            console.error('Error tracking ride:', error);
            alert('Error tracking ride');
        }
    }

    async function viewRideDetails(requestId) {
        try {
            const response = await fetch(`https://serverone-w2xc.onrender.com/api/requests/${requestId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const { data } = await response.json();
                const driverInfo = data.driver ? 
                    `Driver: ${data.driver.name}\nPhone: ${data.driver.phone}\nVehicle: ${data.driver.vehicle_number}` : 
                    'Driver: Not assigned';
                alert(`Ride Details (#RS-${requestId})\n\n` +
                      `Pickup: ${data.pickup_location}\n` +
                      `Dropoff: ${data.dropoff_location}\n` +
                      `Date: ${new Date(data.request_time).toLocaleString()}\n` +
                      `Status: ${data.status}\n` +
                      `Fare: ${data.fare ? '$' + data.fare : 'Not available'}\n` +
                      `${driverInfo}`);
            } else {
                alert('Error fetching ride details');
            }
        } catch (error) {
            console.error('Error viewing ride details:', error);
            alert('Error viewing ride details');
        }
    }

    async function bookAgain(requestId) {
        try {
            const response = await fetch(`https://serverone-w2xc.onrender.com/api/requests/${requestId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const { data } = await response.json();
                // Fill the form with previous ride details
                document.getElementById('pickupLocation').value = data.pickup_location;
                document.getElementById('dropoffLocation').value = data.dropoff_location;
                
                // Switch to dashboard view with form pre-filled
                showDashboard();
                
                // Scroll to the form
                document.getElementById('cabRequestForm').scrollIntoView({ behavior: 'smooth' });
            } else {
                alert('Error fetching previous ride details');
            }
        } catch (error) {
            console.error('Error booking again:', error);
            alert('Error booking again');
        }
    }

    // Logout function
    function handleLogout(e) {
        e.preventDefault();
        localStorage.clear();
        window.location.href = 'user-login.html';
    }
});