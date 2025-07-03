document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    const userType = localStorage.getItem('userType');

    if (!token || !username || userType !== 'admin') {
        window.location.href = 'admin-login.html';
        return;
    }

    // Update UI with username
    const userElements = document.querySelectorAll('.font-medium');
    userElements.forEach(el => {
        if (el.textContent === 'Admin') {
            el.textContent = username;
        }
    });

// Sidebar toggle functionality
const toggleSidebar = document.getElementById('toggleSidebar');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');

if (toggleSidebar && sidebar && sidebarOverlay) {
    toggleSidebar.addEventListener('click', () => {
        sidebar.classList.toggle('active');
        sidebarOverlay.classList.toggle('active');
    });

    sidebarOverlay.addEventListener('click', () => {
        sidebar.classList.remove('active');
        sidebarOverlay.classList.remove('active');
    });
}

// Close sidebar when clicking on a nav item in mobile view
const navItems = document.querySelectorAll('.nav-item');
navItems.forEach(item => {
    item.addEventListener('click', () => {
        if (window.innerWidth < 768) {
            sidebar.classList.remove('active');
            sidebarOverlay.classList.remove('active');
        }
    });
});

    // Navigation tab switching
    const contentSections = {
        'dashboard': document.querySelector('main'),
        'ride-requests': createRideRequestsSection(),
        'drivers': createDriversSection(),
        'users': createUsersSection(),
        'analytics': createAnalyticsSection(),
        'live-tracking': createLiveTrackingSection(),
        'settings': createSettingsSection()
    };

    // Hide all sections except dashboard initially
    Object.keys(contentSections).forEach(key => {
        if (key !== 'dashboard') {
            contentSections[key].style.display = 'none';
        }
    });

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const target = item.querySelector('span').textContent.toLowerCase().replace(' ', '-');
            
            // Update active state
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // Show the corresponding section
            Object.keys(contentSections).forEach(key => {
                contentSections[key].style.display = key === target ? 'block' : 'none';
            });

            // Load data when tab is clicked
            if (target === 'ride-requests') fetchRideRequests();
            if (target === 'drivers') fetchAndDisplayDrivers();
            if (target === 'users') fetchAndDisplayUsers();
            if (target === 'analytics') fetchAnalyticsData();
            if (target === 'live-tracking') fetchLiveTrackingData();
            if (target === 'settings') fetchSystemSettings();
        });
    });

    // Add event listener for Add Driver button
    document.getElementById('addDriverBtn')?.addEventListener('click', showAddDriverModal);

    // Add event listener for Export Dashboard button
    document.getElementById('exportDashboard')?.addEventListener('click', async () => {
        try {
            showLoading();
            const response = await fetch('https://serverone-w2xc.onrender.com/api/admin/dashboard/export', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to export dashboard');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'dashboard-export.csv';
            a.click();
            window.URL.revokeObjectURL(url);
            showSuccessMessage('Dashboard exported successfully!');
        } catch (error) {
            console.error('Error exporting dashboard:', error);
            showErrorMessage('Failed to export dashboard. Please try again.');
        } finally {
            hideLoading();
        }
    });

    // Initial fetch for dashboard
    fetchDashboardData();

    // Loading state management
    function showLoading() {
        const loading = document.createElement('div');
        loading.id = 'loading-spinner';
        loading.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        loading.innerHTML = `
            <div class="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-600"></div>
        `;
        document.body.appendChild(loading);
    }

    function hideLoading() {
        const loading = document.getElementById('loading-spinner');
        if (loading) loading.remove();
    }

    // Dashboard data fetch
    async function fetchDashboardData() {
        showLoading();
        try {
            const [requestsRes, driversRes, usersRes] = await Promise.all([
                fetch('https://serverone-w2xc.onrender.com/api/admin/requests', {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch('https://serverone-w2xc.onrender.com/api/admin/drivers', {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch('https://serverone-w2xc.onrender.com/api/admin/users', {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);

            if (!requestsRes.ok || !driversRes.ok || !usersRes.ok) {
                if (requestsRes.status === 401 || driversRes.status === 401 || usersRes.status === 401) {
                    localStorage.clear();
                    window.location.href = 'admin-login.html';
                    return;
                }
                throw new Error(`HTTP error! Requests: ${requestsRes.status}, Drivers: ${driversRes.status}, Users: ${usersRes.status}`);
            }

            const [requests, drivers, users] = await Promise.all([
                requestsRes.json(),
                driversRes.json(),
                usersRes.json()
            ]);

            console.log('API Responses:', { requests, drivers, users });

            updateDashboardStats(requests.data || [], drivers.data || [], users.data || []);
            renderRecentRequests(requests.data ? requests.data.slice(0, 5) : []);
            renderDriversList(drivers.data || []);
            renderUsersList(users.data || []);
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            showErrorMessage('Failed to load dashboard data. Please try again.');
        } finally {
            hideLoading();
        }
    }

    function updateDashboardStats(requests, drivers, users) {
        const totalRides = document.querySelector('.card:nth-child(1) h3');
        const activeDrivers = document.querySelector('.card:nth-child(2) h3');
        const pendingRequests = document.querySelector('.card:nth-child(3) h3');
        const revenueAmount = document.querySelector('.card:nth-child(4) h3');
        const availableDrivers = document.querySelector('.card:nth-child(2) span');
        const revenueProgress = document.querySelector('.card:nth-child(4) .bg-purple-500');
        const revenueText = document.querySelector('.card:nth-child(4) p');

        if (totalRides) totalRides.textContent = requests.length || 0;
        if (activeDrivers) activeDrivers.textContent = drivers.filter(d => d.available).length || 0;
        if (pendingRequests) pendingRequests.textContent = requests.filter(r => r.status === 'PENDING').length || 0;
        if (revenueAmount) {
            const revenue = requests
                .filter(r => r.status === 'COMPLETED')
                .reduce((sum, r) => sum + (parseFloat(r.fare_amount) || 0), 0);
            revenueAmount.textContent = `$${revenue.toFixed(2)}`;
        }
        if (availableDrivers) availableDrivers.textContent = `${drivers.filter(d => d.available).length || 0} available`;
        if (revenueProgress && revenueText) {
            const monthlyTarget = 10000;
            const revenue = requests
                .filter(r => r.status === 'COMPLETED')
                .reduce((sum, r) => sum + (parseFloat(r.fare_amount) || 0), 0);
            const percentage = Math.min((revenue / monthlyTarget) * 100, 100);
            revenueProgress.style.width = `${percentage}%`;
            revenueText.textContent = `${percentage.toFixed(0)}% of monthly target`;
        }
    }

    function renderRecentRequests(requests) {
        const requestList = document.getElementById('requestList');
        if (!requestList) {
            console.error('Request list element not found');
            return;
        }

        requestList.innerHTML = requests.length ? requests.map(req => `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#${req.id || 'N/A'}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <img src="https://randomuser.me/api/portraits/${req.user_gender || 'men'}/${Math.floor(Math.random() * 100)}.jpg" 
                             class="w-8 h-8 rounded-full mr-2" alt="User avatar">
                        <span>${req.user_name || 'Unknown'}</span>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${req.pickup_location || 'N/A'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${req.dropoff_location || 'N/A'}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    ${req.driver_name && req.driver_name !== 'Not assigned' ? `
                        <div class="flex items-center">
                            <img src="https://randomuser.me/api/portraits/men/${Math.floor(Math.random() * 100)}.jpg" 
                                 class="w-8 h-8 rounded-full mr-2" alt="Driver avatar">
                            <span>${req.driver_name}</span>
                        </div>
                    ` : '<span class="text-gray-400">Not assigned</span>'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 py-1 text-xs font-medium rounded-full status-${(req.status || 'PENDING').toLowerCase()}">
                        ${req.status || 'PENDING'}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${req.status === 'PENDING' ? `
                        <button class="text-blue-600 hover:text-blue-900 mr-3 assign-driver" data-id="${req.id || ''}">
                            Assign
                        </button>
                    ` : `
                        <button class="text-blue-600 hover:text-blue-900 mr-3 track-ride" data-id="${req.id || ''}">
                            Track
                        </button>
                    `}
                    <button class="text-gray-600 hover:text-gray-900 view-details" data-id="${req.id || ''}">
                        Details
                    </button>
                </td>
            </tr>
        `).join('') : '<tr><td colspan="7" class="px-6 py-4 text-center text-gray-500">No requests available</td></tr>';

        document.querySelectorAll('.assign-driver').forEach(btn => {
            btn.addEventListener('click', () => showAssignDriverModal(btn.dataset.id));
        });
        document.querySelectorAll('.track-ride').forEach(btn => {
            btn.addEventListener('click', () => trackRide(btn.dataset.id));
        });
        document.querySelectorAll('.view-details').forEach(btn => {
            btn.addEventListener('click', () => viewRequestDetails(btn.dataset.id));
        });
    }

    async function renderDriversList(drivers) {
        const driversList = document.getElementById('driversList');
        if (!driversList) {
            console.error('Drivers list element not found');
            return;
        }

        const driverRequests = await Promise.all(drivers.map(async driver => {
            try {
                const response = await fetch(`https://serverone-w2xc.onrender.com/api/admin/drivers/${driver.id}/requests`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) throw new Error(`Failed to fetch requests for driver ${driver.id}: ${response.status}`);
                const { data } = await response.json();
                return { driverId: driver.id, requests: data || [] };
            } catch (error) {
                console.error(`Error fetching requests for driver ${driver.id}:`, error);
                return { driverId: driver.id, requests: [] };
            }
        }));

        driversList.innerHTML = drivers.length ? drivers.map(driver => {
            const assignedRequests = driverRequests.find(dr => dr.driverId === driver.id)?.requests || [];
            
            return `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap">${driver.id || 'N/A'}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <img src="https://randomuser.me/api/portraits/${driver.gender || 'men'}/${Math.floor(Math.random() * 100)}.jpg" 
                             class="w-8 h-8 rounded-full mr-2" alt="Driver avatar">
                        <span>${driver.name || 'Unknown'}</span>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${driver.phone || 'N/A'}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div>
                        <div class="font-medium">${driver.vehicle_type || 'N/A'}</div>
                        <div class="text-sm text-gray-500">${driver.vehicle_number || 'N/A'}</div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 py-1 text-xs font-medium rounded-full ${driver.available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                        ${driver.available ? 'Available' : 'On Trip'}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <button class="text-blue-600 hover:text-blue-900 mr-3 edit-driver" data-id="${driver.id}">
                        Edit
                    </button>
                    <button class="text-blue-600 hover:text-blue-900 mr-3 toggle-availability" data-id="${driver.id}" data-available="${driver.available}">
                        ${driver.available ? 'Mark Busy' : 'Mark Available'}
                    </button>
                    <button class="text-red-600 hover:text-red-900 delete-driver" data-id="${driver.id}">
                        Remove
                    </button>
                </td>
            </tr>
            ${assignedRequests.length > 0 ? `
            <tr>
                <td colspan="6" class="px-6 py-4">
                    <div class="ml-4">
                        <p class="text-sm font-medium text-gray-700">Assigned Requests:</p>
                        <div class="mt-2 space-y-2">
                            ${assignedRequests.map(req => `
                                <div class="flex items-center space-x-2">
                                    <span class="text-sm text-gray-600">Request #${req.id}</span>
                                    <span class="text-sm text-gray-600">Customer: ${req.user_name || 'N/A'}</span>
                                    <span class="text-sm text-gray-600">Status: ${req.status}</span>
                                    <button class="text-blue-600 hover:text-blue-900 text-sm view-request-details" data-id="${req.id}">
                                        View
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </td>
            </tr>
            ` : ''}
        `}).join('') : '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">No drivers available</td></tr>';

        document.querySelectorAll('.edit-driver').forEach(btn => {
            btn.addEventListener('click', () => showEditDriverModal(btn.dataset.id));
        });
        document.querySelectorAll('.toggle-availability').forEach(btn => {
            btn.addEventListener('click', () => toggleDriverAvailability(btn.dataset.id, btn.dataset.available === 'true'));
        });
        document.querySelectorAll('.delete-driver').forEach(btn => {
            btn.addEventListener('click', () => deleteDriver(btn.dataset.id));
        });
        document.querySelectorAll('.view-request-details').forEach(btn => {
            btn.addEventListener('click', () => viewRequestDetails(btn.dataset.id));
        });
    }

    function renderUsersList(users) {
        const usersList = document.getElementById('usersList');
        if (!usersList) {
            console.error('Users list element not found');
            return;
        }

        usersList.innerHTML = users.length ? users.map(user => `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap">${user.id || 'N/A'}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <img src="https://randomuser.me/api/portraits/${user.gender || 'men'}/${Math.floor(Math.random() * 100)}.jpg" 
                             class="w-8 h-8 rounded-full mr-2" alt="User avatar">
                        <span>${user.username || 'Unknown'}</span>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${user.email || 'N/A'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${user.phone || 'N/A'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <button class="text-blue-600 hover:text-blue-900 view-user" data-id="${user.id}">
                        View
                    </button>
                    <button class="text-red-600 hover:text-red-900 delete-user" data-id="${user.id}">
                        Delete
                    </button>
                </td>
            </tr>
        `).join('') : '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">No users available</td></tr>';

        document.querySelectorAll('.view-user').forEach(btn => {
            btn.addEventListener('click', () => viewUserDetails(btn.dataset.id));
        });
        document.querySelectorAll('.delete-user').forEach(btn => {
            btn.addEventListener('click', () => deleteUser(btn.dataset.id));
        });
    }

    async function toggleDriverAvailability(driverId, currentAvailability) {
        showLoading();
        try {
            const response = await fetch(`https://serverone-w2xc.onrender.com/api/admin/drivers/${driverId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    available: !currentAvailability
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to update driver availability');
            }

            showSuccessMessage(`Driver marked as ${currentAvailability ? 'busy' : 'available'} successfully!`);
            fetchDashboardData();
        } catch (error) {
            console.error('Error toggling driver availability:', error);
            showErrorMessage(error.message || 'Error updating driver availability. Please try again.');
        } finally {
            hideLoading();
        }
    }

    async function deleteDriver(driverId) {
        if (confirm('Are you sure you want to remove this driver? This action cannot be undone.')) {
            showLoading();
            try {
                const response = await fetch(`https://serverone-w2xc.onrender.com/api/admin/drivers/${driverId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || 'Failed to delete driver');
                }

                showSuccessMessage('Driver removed successfully!');
                fetchDashboardData();
            } catch (error) {
                console.error('Error deleting driver:', error);
                showErrorMessage(error.message || 'Error removing driver. Please try again.');
            } finally {
                hideLoading();
            }
        }
    }

    async function deleteUser(userId) {
        if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
            showLoading();
            try {
                const response = await fetch(`https://serverone-w2xc.onrender.com/api/admin/users/${userId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || 'Failed to delete user');
                }

                showSuccessMessage('User deleted successfully!');
                fetchDashboardData();
            } catch (error) {
                console.error('Error deleting user:', error);
                showErrorMessage(error.message || 'Error deleting user. Please try again.');
            } finally {
                hideLoading();
            }
        }
    }

    // Ride Requests Section
    function createRideRequestsSection() {
        const section = document.createElement('div');
        section.className = 'p-6';
        section.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold">Ride Requests Management</h2>
                <div class="flex space-x-3">
                    <button id="refreshRequests" class="btn-primary text-white py-2 px-4 rounded-lg font-medium">
                        <i class="fas fa-sync-alt mr-2"></i>Refresh
                    </button>
                    <button id="exportRequests" class="bg-white border border-gray-300 text-gray-700 py-2 px-4 rounded-lg font-medium">
                        <i class="fas fa-download mr-2"></i>Export
                    </button>
                </div>
            </div>
            <div class="bg-white rounded-xl border border-gray-100 p-6">
                <div class="overflow-x-auto">
                    <div id="rideRequestsTable"></div>
                </div>
            </div>
        `;
        document.querySelector('main').parentNode.appendChild(section);

        section.querySelector('#refreshRequests').addEventListener('click', fetchRideRequests);
        section.querySelector('#exportRequests').addEventListener('click', async () => {
            try {
                showLoading();
                const response = await fetch('https://serverone-w2xc.onrender.com/api/admin/requests/export', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) throw new Error('Failed to export requests');
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'requests-export.csv';
                a.click();
                window.URL.revokeObjectURL(url);
                showSuccessMessage('Requests exported successfully!');
            } catch (error) {
                console.error('Error exporting requests:', error);
                showErrorMessage('Failed to export requests. Please try again.');
            } finally {
                hideLoading();
            }
        });

        return section;
    }

    async function fetchRideRequests() {
        showLoading();
        try {
            const response = await fetch('https://serverone-w2xc.onrender.com/api/admin/requests', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.clear();
                    window.location.href = 'admin-login.html';
                    return;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const { data } = await response.json();
            renderRideRequestsTable(data || []);
        } catch (error) {
            console.error('Error fetching ride requests:', error);
            showErrorMessage('Failed to load ride requests. Please check your connection or try again.');
        } finally {
            hideLoading();
        }
    }

    function renderRideRequestsTable(requests) {
        const table = document.getElementById('rideRequestsTable');
        if (!table) {
            console.error('Ride requests table element not found');
            return;
        }

        table.innerHTML = requests.length ? `
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pickup</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dropoff</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Driver</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                    ${requests.map(req => `
                        <tr>
                            <td class="px-6 py-4 whitespace-nowrap">#${req.id || 'N/A'}</td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <div class="flex items-center">
                                    <img src="https://randomuser.me/api/portraits/${req.user_gender || 'men'}/${Math.floor(Math.random() * 100)}.jpg" 
                                         class="w-8 h-8 rounded-full mr-2" alt="User avatar">
                                    <span>${req.user_name || 'Unknown'}</span>
                                </div>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">${req.pickup_location || 'N/A'}</td>
                            <td class="px-6 py-4 whitespace-nowrap">${req.dropoff_location || 'N/A'}</td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                ${req.driver_name && req.driver_name !== 'Not assigned' ? `
                                    <div class="flex items-center">
                                        <img src="https://randomuser.me/api/portraits/men/${Math.floor(Math.random() * 100)}.jpg" 
                                             class="w-8 h-8 rounded-full mr-2" alt="Driver avatar">
                                        <span>${req.driver_name}</span>
                                    </div>
                                ` : '<span class="text-gray-400">Not assigned</span>'}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <span class="px-2 py-1 text-xs font-medium rounded-full status-${(req.status || 'PENDING').toLowerCase()}">
                                    ${req.status || 'PENDING'}
                                </span>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap space-x-2">
                                ${req.status === 'PENDING' ? `
                                    <button class="text-blue-600 hover:text-blue-900 assign-driver" data-id="${req.id || ''}">
                                        Assign
                                    </button>
                                ` : `
                                    <button class="text-blue-600 hover:text-blue-900 track-ride" data-id="${req.id || ''}">
                                        Track
                                    </button>
                                `}
                                <button class="text-gray-600 hover:text-gray-900 view-details" data-id="${req.id || ''}">
                                    Details
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        ` : '<div class="text-center text-gray-500 p-4">No ride requests available</div>';

        document.querySelectorAll('.assign-driver').forEach(btn => {
            btn.addEventListener('click', () => showAssignDriverModal(btn.dataset.id));
        });
        document.querySelectorAll('.track-ride').forEach(btn => {
            btn.addEventListener('click', () => trackRide(btn.dataset.id));
        });
        document.querySelectorAll('.view-details').forEach(btn => {
            btn.addEventListener('click', () => viewRequestDetails(btn.dataset.id));
        });
    }

    // Drivers Section
    function createDriversSection() {
        const section = document.createElement('div');
        section.className = 'p-6';
        section.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold">Drivers Management</h2>
                <button id="addDriverBtn" class="btn-primary text-white py-2 px-4 rounded-lg font-medium">
                    <i class="fas fa-plus mr-2"></i>Add Driver
                </button>
            </div>
            <div class="bg-white rounded-xl border border-gray-100 p-6">
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="driversList" class="bg-white divide-y divide-gray-200">
                            <!-- Populated dynamically -->
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        document.querySelector('main').parentNode.appendChild(section);

        section.querySelector('#addDriverBtn').addEventListener('click', showAddDriverModal);

        return section;
    }

    async function fetchAndDisplayDrivers() {
        showLoading();
        try {
            const response = await fetch('https://serverone-w2xc.onrender.com/api/admin/drivers', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.clear();
                    window.location.href = 'admin-login.html';
                    return;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const { data } = await response.json();
            renderDriversList(data || []);
        } catch (error) {
            console.error('Error fetching drivers:', error);
            showErrorMessage('Failed to load drivers. Please check your connection or try again.');
        } finally {
            hideLoading();
        }
    }

    // Users Section
    function createUsersSection() {
        const section = document.createElement('div');
        section.className = 'p-6';
        section.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold">Users Management</h2>
                <div class="flex space-x-3">
                    <button id="refreshUsers" class="btn-primary text-white py-2 px-4 rounded-lg font-medium">
                        <i class="fas fa-sync-alt mr-2"></i>Refresh
                    </button>
                    <button id="exportUsers" class="bg-white border border-gray-300 text-gray-700 py-2 px-4 rounded-lg font-medium">
                        <i class="fas fa-download mr-2"></i>Export
                    </button>
                </div>
            </div>
            <div class="bg-white rounded-xl border border-gray-100 p-6">
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="usersList" class="bg-white divide-y divide-gray-200">
                            <!-- Populated dynamically -->
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        document.querySelector('main').parentNode.appendChild(section);

        section.querySelector('#refreshUsers').addEventListener('click', fetchAndDisplayUsers);
        section.querySelector('#exportUsers').addEventListener('click', async () => {
            try {
                showLoading();
                const response = await fetch('https://serverone-w2xc.onrender.com/api/admin/users/export', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) throw new Error('Failed to export users');
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'users-export.csv';
                a.click();
                window.URL.revokeObjectURL(url);
                showSuccessMessage('Users exported successfully!');
            } catch (error) {
                console.error('Error exporting users:', error);
                showErrorMessage('Failed to export users. Please try again.');
            } finally {
                hideLoading();
            }
        });

        return section;
    }

    async function fetchAndDisplayUsers() {
        showLoading();
        try {
            const response = await fetch('https://serverone-w2xc.onrender.com/api/admin/users', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.clear();
                    window.location.href = 'admin-login.html';
                    return;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const { data } = await response.json();
            renderUsersList(data || []);
        } catch (error) {
            console.error('Error fetching users:', error);
            showErrorMessage('Failed to load users. Please check your connection or try again.');
        } finally {
            hideLoading();
        }
    }

    // Analytics Section
    function createAnalyticsSection() {
        const section = document.createElement('div');
        section.className = 'p-6';
        section.innerHTML = `
            <div class="mb-6">
                <h2 class="text-2xl font-bold">Analytics</h2>
                <p class="text-gray-500">View system performance metrics</p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="bg-white rounded-xl border border-gray-100 p-6">
                    <h3 class="text-lg font-semibold mb-4">Ride Requests Over Time</h3>
                    <canvas id="requestsChart"></canvas>
                </div>
                <div class="bg-white rounded-xl border border-gray-100 p-6">
                    <h3 class="text-lg font-semibold mb-4">Top Drivers by Trips</h3>
                    <canvas id="driversChart"></canvas>
                </div>
            </div>
        `;
        document.querySelector('main').parentNode.appendChild(section);
        return section;
    }

    // Live Tracking Section
    function createLiveTrackingSection() {
        const section = document.createElement('div');
        section.className = 'p-6';
        section.innerHTML = `
            <div class="mb-6">
                <h2 class="text-2xl font-bold">Live Tracking</h2>
                <p class="text-gray-500">Monitor active rides in real-time</p>
            </div>
            <div class="bg-white rounded-xl border border-gray-100 p-6">
                <div id="liveTrackingMap" class="h-96"></div>
                <div id="activeRidesList" class="mt-4"></div>
            </div>
        `;
        document.querySelector('main').parentNode.appendChild(section);
        return section;
    }

    // Settings Section
    function createSettingsSection() {
        const section = document.createElement('div');
        section.className = 'p-6';
        section.innerHTML = `
            <div class="mb-6">
                <h2 class="text-2xl font-bold">System Settings</h2>
                <p class="text-gray-500">Manage your application settings</p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="bg-white rounded-xl border border-gray-100 p-6">
                    <h3 class="text-lg font-semibold mb-4">Pricing</h3>
                    <form id="pricingSettingsForm">
                        <div class="mb-4">
                            <label class="block text-sm font-medium mb-1">Base Fare ($)</label>
                            <input type="number" name="baseFare" class="w-full px-3 py-2 border rounded" step="0.01" min="0" required>
                        </div>
                        <div class="mb-4">
                            <label class="block text-sm font-medium mb-1">Price per Mile ($)</label>
                            <input type="number" name="pricePerMile" class="w-full px-3 py-2 border rounded" step="0.01" min="0" required>
                        </div>
                        <div class="mb-4">
                            <label class="block text-sm font-medium mb-1">Price per Minute ($)</label>
                            <input type="number" name="pricePerMinute" class="w-full px-3 py-2 border rounded" step="0.01" min="0" required>
                        </div>
                        <button type="submit" class="btn-primary text-white py-2 px-4 rounded-lg font-medium">
                            Save Pricing
                        </button>
                    </form>
                </div>
                <div class="bg-white rounded-xl border border-gray-100 p-6">
                    <h3 class="text-lg font-semibold mb-4">System Configuration</h3>
                    <form id="systemSettingsForm">
                        <div class="mb-4 flex items-center justify-between">
                            <div>
                                <label class="block text-sm font-medium mb-1">Maintenance Mode</label>
                                <p class="text-xs text-gray-500">Disable booking during maintenance</p>
                            </div>
                            <label class="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" name="maintenanceMode" class="sr-only peer">
                                <div class="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>
                        <div class="mb-4 flex items-center justify-between">
                            <div>
                                <label class="block text-sm font-medium mb-1">Enable Notifications</label>
                                <p class="text-xs text-gray-500">System-wide notifications</p>
                            </div>
                            <label class="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" name="enableNotifications" class="sr-only peer" checked>
                                <div class="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>
                        <button type="submit" class="btn-primary text-white py-2 px-4 rounded-lg font-medium">
                            Save Configuration
                        </button>
                        <div class="mt-6">
                            <button id="logoutBtn" class="btn-primary bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg font-medium">
                                <i class="fas fa-sign-out-alt mr-2"></i>Logout
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.querySelector('main').parentNode.appendChild(section);

        section.querySelector('#logoutBtn').addEventListener('click', handleLogout);
        section.querySelector('#pricingSettingsForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            showLoading();
            const formData = new FormData(e.target);
            const settings = Object.fromEntries(formData.entries());
            try {
                const response = await fetch('https://serverone-w2xc.onrender.com/api/admin/settings/pricing', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        base_fare: parseFloat(settings.baseFare),
                        price_per_mile: parseFloat(settings.pricePerMile),
                        price_per_minute: parseFloat(settings.pricePerMinute)
                    })
                });
                if (!response.ok) throw new Error('Failed to update pricing settings');
                showSuccessMessage('Pricing settings updated successfully!');
            } catch (error) {
                console.error('Error updating pricing settings:', error);
                showErrorMessage('Failed to update pricing settings. Please try again.');
            } finally {
                hideLoading();
            }
        });
        section.querySelector('#systemSettingsForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            showLoading();
            const formData = new FormData(e.target);
            const settings = Object.fromEntries(formData.entries());
            try {
                const response = await fetch('https://serverone-w2xc.onrender.com/api/admin/settings/system', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        maintenance_mode: settings.maintenanceMode === 'on',
                        enable_notifications: settings.enableNotifications === 'on'
                    })
                });
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || 'Failed to update system settings');
                }
                showSuccessMessage('System settings updated successfully!');
            } catch (error) {
                console.error('Error updating system settings:', error);
                showErrorMessage(error.message || 'Failed to update system settings. Please try again.');
            } finally {
                hideLoading();
            }
        });

        return section;
    }

    async function fetchSystemSettings() {
        showLoading();
        try {
            const response = await fetch('https://serverone-w2xc.onrender.com/api/admin/settings', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.clear();
                    window.location.href = 'admin-login.html';
                    return;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const { data } = await response.json();
            const pricingForm = document.querySelector('#pricingSettingsForm');
            const systemForm = document.querySelector('#systemSettingsForm');
            if (pricingForm) {
                pricingForm.querySelector('input[name="baseFare"]').value = data.base_fare || 5.00;
                pricingForm.querySelector('input[name="pricePerMile"]').value = data.price_per_mile || 1.50;
                pricingForm.querySelector('input[name="pricePerMinute"]').value = data.price_per_minute || 0.50;
            }
            if (systemForm) {
                systemForm.querySelector('input[name="maintenanceMode"]').checked = data.maintenance_mode || false;
                systemForm.querySelector('input[name="enableNotifications"]').checked = data.enable_notifications !== false;
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
            showErrorMessage('Failed to load settings. Please try again.');
        } finally {
            hideLoading();
        }
    }

    async function fetchAnalyticsData() {
        showLoading();
        try {
            const response = await fetch('https://serverone-w2xc.onrender.com/api/admin/analytics', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.clear();
                    window.location.href = 'admin-login.html';
                    return;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const { data } = await response.json();
            renderAnalyticsCharts(data.requests || [], data.drivers || []);
        } catch (error) {
            console.error('Error fetching analytics:', error);
            showErrorMessage('Failed to load analytics data. Please try again.');
        } finally {
            hideLoading();
        }
    }

    function renderAnalyticsCharts(requests, drivers) {
        const requestsChart = document.getElementById('requestsChart');
        const driversChart = document.getElementById('driversChart');
        
        if (requestsChart && typeof Chart !== 'undefined') {
            new Chart(requestsChart, {
                type: 'line',
                data: {
                    labels: requests.map(r => new Date(r.date).toLocaleDateString()),
                    datasets: [{
                        label: 'Ride Requests',
                        data: requests.map(r => r.count),
                        borderColor: '#3B82F6',
                        fill: false
                    }, {
                        label: 'Revenue ($)',
                        data: requests.map(r => parseFloat(r.revenue || 0)),
                        borderColor: '#8B5CF6',
                        fill: false
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: { beginAtZero: true }
                    }
                }
            });
        }

        if (driversChart && typeof Chart !== 'undefined') {
            new Chart(driversChart, {
                type: 'bar',
                data: {
                    labels: drivers.map(d => d.name || 'Unknown'),
                    datasets: [{
                        label: 'Trips Completed',
                        data: drivers.map(d => d.trips),
                        backgroundColor: '#3B82F6'
                    }, {
                        label: 'Earnings ($)',
                        data: drivers.map(d => parseFloat(d.earnings || 0)),
                        backgroundColor: '#8B5CF6'
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: { beginAtZero: true }
                    }
                }
            });
        }
    }

    async function fetchLiveTrackingData() {
        showLoading();
        try {
            const response = await fetch('https://serverone-w2xc.onrender.com/api/admin/live-tracking', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.clear();
                    window.location.href = 'admin-login.html';
                    return;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const { data } = await response.json();
            renderLiveTracking(data || []);
        } catch (error) {
            console.error('Error fetching live tracking data:', error);
            showErrorMessage('Failed to load live tracking data. Please try again.');
        } finally {
            hideLoading();
        }
    }

    function renderLiveTracking(rides) {
        const activeRidesList = document.getElementById('activeRidesList');
        if (!activeRidesList) {
            console.error('Active rides list element not found');
            return;
        }

        activeRidesList.innerHTML = rides.length ? rides.map(ride => `
            <div class="flex items-center justify-between p-4 border-b">
                <div>
                    <p class="text-sm font-medium">Ride #${ride.id || 'N/A'}</p>
                    <p class="text-sm text-gray-500">User: ${ride.user_name || 'Unknown'}</p>
                    <p class="text-sm text-gray-500">Driver: ${ride.driver_name || 'Not assigned'}</p>
                    <p class="text-sm text-gray-500">Status: ${ride.status || 'N/A'}</p>
                </div>
                <button class="text-blue-600 hover:text-blue-900 track-ride" data-id="${ride.id || ''}">
                    Track
                </button>
            </div>
        `).join('') : '<div class="text-center text-gray-500 p-4">No active rides</div>';

        document.querySelectorAll('.track-ride').forEach(btn => {
            btn.addEventListener('click', () => trackRide(btn.dataset.id));
        });

        const mapElement = document.getElementById('liveTrackingMap');
        if (mapElement && typeof L !== 'undefined') {
            const map = L.map(mapElement).setView([51.505, -0.09], 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(map);

            rides.forEach(ride => {
                if (ride.current_location) {
                    const [lat, lng] = ride.current_location.split(',').map(Number);
                    if (!isNaN(lat) && !isNaN(lng)) {
                        L.marker([lat, lng])
                            .addTo(map)
                            .bindPopup(`Ride #${ride.id}<br>User: ${ride.user_name || 'Unknown'}<br>Driver: ${ride.driver_name || 'Not assigned'}`);
                    }
                }
            });
        }
    }

    async function showAssignDriverModal(requestId) {
        showLoading();
        try {
            const response = await fetch('https://serverone-w2xc.onrender.com/api/admin/drivers?available=true', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch available drivers');
            const { data: drivers } = await response.json();

            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
            modal.innerHTML = `
                <div class="bg-white rounded-lg p-6 w-full max-w-md">
                    <h3 class="text-lg font-semibold mb-4">Assign Driver to Request #${requestId}</h3>
                    <form id="assignDriverForm">
                        <div class="mb-4">
                            <label class="block text-sm font-medium mb-1">Select Driver</label>
                            <select name="driverId" class="w-full px-3 py-2 border rounded">
                                <option value="">Select a driver</option>
                                ${drivers.map(driver => `
                                    <option value="${driver.id}">${driver.name || 'Unknown'} (${driver.vehicle_type || 'N/A'} - ${driver.vehicle_number || 'N/A'})</option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="flex justify-end space-x-2">
                            <button type="button" class="px-4 py-2 bg-gray-200 rounded cancel-modal">Cancel</button>
                            <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded">Assign</button>
                        </div>
                    </form>
                </div>
            `;
            document.body.appendChild(modal);

            modal.querySelector('.cancel-modal').addEventListener('click', () => modal.remove());
            modal.querySelector('#assignDriverForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const driverId = e.target.querySelector('select[name="driverId"]').value;
                if (!driverId) {
                    showErrorMessage('Please select a driver');
                    return;
                }
                try {
                    const response = await fetch(`https://serverone-w2xc.onrender.com/api/admin/requests/${requestId}/assign`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ driver_id: parseInt(driverId) })
                    });
                    if (!response.ok) {
                        const error = await response.json();
                        throw new Error(error.message || 'Failed to assign driver');
                    }
                    modal.remove();
                    showSuccessMessage('Driver assigned successfully!');
                    fetchDashboardData();
                    if (document.querySelector('.nav-item.active span').textContent.toLowerCase() === 'ride-requests') {
                        fetchRideRequests();
                    }
                } catch (error) {
                    console.error('Error assigning driver:', error);
                    showErrorMessage(error.message || 'Failed to assign driver. Please try again.');
                }
            });
        } catch (error) {
            console.error('Error fetching available drivers:', error);
            showErrorMessage('Failed to load available drivers. Please try again.');
        } finally {
            hideLoading();
        }
    }

    function showAddDriverModal() {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-white rounded-lg p-6 w-full max-w-md">
                <h3 class="text-lg font-semibold mb-4">Add New Driver</h3>
                <form id="addDriverForm">
                    <div class="mb-4">
                        <label class="block text-sm font-medium mb-1">Name</label>
                        <input type="text" name="name" class="w-full px-3 py-2 border rounded" required>
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium mb-1">Email</label>
                        <input type="email" name="email" class="w-full px-3 py-2 border rounded" required>
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium mb-1">Phone</label>
                        <input type="tel" name="phone" class="w-full px-3 py-2 border rounded" required>
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium mb-1">Vehicle Type</label>
                        <input type="text" name="vehicleType" class="w-full px-3 py-2 border rounded" required>
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium mb-1">Vehicle Number</label>
                        <input type="text" name="vehicleNumber" class="w-full px-3 py-2 border rounded" required>
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium mb-1">Gender</label>
                        <select name="gender" class="w-full px-3 py-2 border rounded">
                            <option value="men">Men</option>
                            <option value="women">Women</option>
                            <option value="other">Other</option>
                        </select>
                    </div>
                    <div class="flex justify-end space-x-2">
                        <button type="button" class="px-4 py-2 bg-gray-200 rounded cancel-modal">Cancel</button>
                        <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded">Add Driver</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('.cancel-modal').addEventListener('click', () => modal.remove());
        modal.querySelector('#addDriverForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            showLoading();
            const formData = new FormData(e.target);
            const driverData = Object.fromEntries(formData.entries());
            try {
                const response = await fetch('https://serverone-w2xc.onrender.com/api/admin/drivers', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        name: driverData.name,
                        email: driverData.email,
                        phone: driverData.phone,
                        vehicle_type: driverData.vehicleType,
                        vehicle_number: driverData.vehicleNumber,
                        available: true,
                        gender: driverData.gender
                    })
                });
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || 'Failed to add driver');
                }
                modal.remove();
                showSuccessMessage('Driver added successfully!');
                fetchDashboardData();
                if (document.querySelector('.nav-item.active span').textContent.toLowerCase() === 'drivers') {
                    fetchAndDisplayDrivers();
                }
            } catch (error) {
                console.error('Error adding driver:', error);
                showErrorMessage(error.message || 'Failed to add driver. Please try again.');
            } finally {
                hideLoading();
            }
        });
    }

    async function showEditDriverModal(driverId) {
        showLoading();
        try {
            const response = await fetch(`https://serverone-w2xc.onrender.com/api/admin/drivers/${driverId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.clear();
                    window.location.href = 'admin-login.html';
                    return;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const { data } = await response.json();

            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
            modal.innerHTML = `
                <div class="bg-white rounded-lg p-6 w-full max-w-md">
                    <h3 class="text-lg font-semibold mb-4">Edit Driver #${driverId}</h3>
                    <form id="editDriverForm">
                        <div class="mb-4">
                            <label class="block text-sm font-medium mb-1">Name</label>
                            <input type="text" name="name" value="${data.name || ''}" class="w-full px-3 py-2 border rounded" required>
                        </div>
                        <div class="mb-4">
                            <label class="block text-sm font-medium mb-1">Email</label>
                            <input type="email" name="email" value="${data.email || ''}" class="w-full px-3 py-2 border rounded" required>
                        </div>
                        <div class="mb-4">
                            <label class="block text-sm font-medium mb-1">Phone</label>
                            <input type="tel" name="phone" value="${data.phone || ''}" class="w-full px-3 py-2 border rounded" required>
                        </div>
                        <div class="mb-4">
                            <label class="block text-sm font-medium mb-1">Vehicle Type</label>
                            <input type="text" name="vehicleType" value="${data.vehicle_type || ''}" class="w-full px-3 py-2 border rounded" required>
                        </div>
                        <div class="mb-4">
                            <label class="block text-sm font-medium mb-1">Vehicle Number</label>
                            <input type="text" name="vehicleNumber" value="${data.vehicle_number || ''}" class="w-full px-3 py-2 border rounded" required>
                        </div>
                        <div class="mb-4">
                            <label class="block text-sm font-medium mb-1">Gender</label>
                            <select name="gender" class="w-full px-3 py-2 border rounded">
                                <option value="men" ${data.gender === 'men' ? 'selected' : ''}>Men</option>
                                <option value="women" ${data.gender === 'women' ? 'selected' : ''}>Women</option>
                                <option value="other" ${data.gender === 'other' ? 'selected' : ''}>Other</option>
                            </select>
                        </div>
                        <div class="mb-4">
                            <label class="block text-sm font-medium mb-1">Availability</label>
                            <select name="available" class="w-full px-3 py-2 border rounded">
                                <option value="true" ${data.available ? 'selected' : ''}>Available</option>
                                <option value="false" ${!data.available ? 'selected' : ''}>Busy</option>
                            </select>
                        </div>
                        <div class="flex justify-end space-x-2">
                            <button type="button" class="px-4 py-2 bg-gray-200 rounded cancel-modal">Cancel</button>
                            <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
                        </div>
                    </form>
                </div>
            `;
            document.body.appendChild(modal);

            modal.querySelector('.cancel-modal').addEventListener('click', () => modal.remove());
            modal.querySelector('#editDriverForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                showLoading();
                const formData = new FormData(e.target);
                const driverData = Object.fromEntries(formData.entries());
                try {
                    const response = await fetch(`https://serverone-w2xc.onrender.com/api/admin/drivers/${driverId}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            name: driverData.name,
                            email: driverData.email,
                            phone: driverData.phone,
                            vehicle_type: driverData.vehicleType,
                            vehicle_number: driverData.vehicleNumber,
                            available: driverData.available === 'true',
                            gender: driverData.gender
                        })
                    });
                    if (!response.ok) {
                        const error = await response.json();
                        throw new Error(error.message || 'Failed to update driver');
                    }
                    modal.remove();
                    showSuccessMessage('Driver updated successfully!');
                    fetchDashboardData();
                    if (document.querySelector('.nav-item.active span').textContent.toLowerCase() === 'drivers') {
                        fetchAndDisplayDrivers();
                    }
                } catch (error) {
                    console.error('Error updating driver:', error);
                    showErrorMessage(error.message || 'Failed to update driver. Please try again.');
                } finally {
                    hideLoading();
                }
            });
        } catch (error) {
            console.error('Error fetching driver data:', error);
            showErrorMessage('Failed to load driver data. Please try again.');
        } finally {
            hideLoading();
        }
    }

    async function trackRide(requestId) {
        showLoading();
        try {
            const response = await fetch(`https://serverone-w2xc.onrender.com/api/admin/requests/${requestId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.clear();
                    window.location.href = 'admin-login.html';
                    return;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const { data } = await response.json();

            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
            modal.innerHTML = `
                <div class="bg-white rounded-lg p-6 w-full max-w-md">
                    <h3 class="text-lg font-semibold mb-4">Track Ride #${requestId}</h3>
                    <div id="trackMap" class="h-64 mb-4"></div>
                    <p><strong>User:</strong> ${data.user_name || 'Unknown'}</p>
                    <p><strong>Driver:</strong> ${data.driver_name || 'Not assigned'}</p>
                    <p><strong>Status:</strong> ${data.status || 'N/A'}</p>
                    <p><strong>Pickup:</strong> ${data.pickup_location || 'N/A'}</p>
                    <p><strong>Dropoff:</strong> ${data.dropoff_location || 'N/A'}</p>
                    <div class="flex justify-end mt-4">
                        <button class="px-4 py-2 bg-gray-200 rounded cancel-modal">Close</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            modal.querySelector('.cancel-modal').addEventListener('click', () => modal.remove());

            const mapElement = modal.querySelector('#trackMap');
            if (mapElement && typeof L !== 'undefined' && data.current_location) {
                const [lat, lng] = data.current_location.split(',').map(Number);
                if (!isNaN(lat) && !isNaN(lng)) {
                    const map = L.map(mapElement).setView([lat, lng], 15);
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: '&copy; OpenStreetMap contributors'
                    }).addTo(map);
                    L.marker([lat, lng])
                        .addTo(map)
                        .bindPopup(`Ride #${data.id}<br>User: ${data.user_name || 'Unknown'}<br>Driver: ${data.driver_name || 'Not assigned'}`);
                }
            }
        } catch (error) {
            console.error('Error tracking ride:', error);
            showErrorMessage('Failed to load ride tracking data. Please try again.');
        } finally {
            hideLoading();
        }
    }

    async function viewRequestDetails(requestId) {
        showLoading();
        try {
            const response = await fetch(`https://serverone-w2xc.onrender.com/api/admin/requests/${requestId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.clear();
                    window.location.href = 'admin-login.html';
                    return;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const { data } = await response.json();

            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
            modal.innerHTML = `
                <div class="bg-white rounded-lg p-6 w-full max-w-md">
                    <h3 class="text-lg font-semibold mb-4">Ride Request #${requestId}</h3>
                    <p><strong>User:</strong> ${data.user_name || 'Unknown'}</p>
                    <p><strong>Gender:</strong> ${data.user_gender || 'N/A'}</p>
                    <p><strong>Driver:</strong> ${data.driver_name || 'Not assigned'}</p>
                    <p><strong>Pickup:</strong> ${data.pickup_location || 'N/A'}</p>
                    <p><strong>Dropoff:</strong> ${data.dropoff_location || 'N/A'}</p>
                    <p><strong>Status:</strong> ${data.status || 'N/A'}</p>
                    <p><strong>Fare:</strong> $${parseFloat(data.fare_amount || 0).toFixed(2)}</p>
                    <p><strong>Created:</strong> ${data.created_at ? new Date(data.created_at).toLocaleString() : 'N/A'}</p>
                    <div class="flex justify-end mt-4 space-x-2">
                        ${data.status === 'PENDING' ? `
                            <button class="px-4 py-2 bg-blue-600 text-white rounded assign-driver" data-id="${requestId}">Assign Driver</button>
                        ` : ''}
                        <button class="px-4 py-2 bg-gray-200 rounded cancel-modal">Close</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            modal.querySelector('.cancel-modal').addEventListener('click', () => modal.remove());
            const assignBtn = modal.querySelector('.assign-driver');
            if (assignBtn) {
                assignBtn.addEventListener('click', () => {
                    modal.remove();
                    showAssignDriverModal(requestId);
                });
            }
        } catch (error) {
            console.error('Error fetching request details:', error);
            showErrorMessage('Failed to load request details. Please try again.');
        } finally {
            hideLoading();
        }
    }

    async function viewUserDetails(userId) {
        showLoading();
        try {
            const response = await fetch(`https://serverone-w2xc.onrender.com/api/admin/users/${userId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.clear();
                    window.location.href = 'admin-login.html';
                    return;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const { data } = await response.json();

            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
            modal.innerHTML = `
                <div class="bg-white rounded-lg p-6 w-full max-w-md">
                    <h3 class="text-lg font-semibold mb-4">User #${userId}</h3>
                    <p><strong>Username:</strong> ${data.username || 'Unknown'}</p>
                    <p><strong>Email:</strong> ${data.email || 'N/A'}</p>
                    <p><strong>Phone:</strong> ${data.phone || 'N/A'}</p>
                    <p><strong>Gender:</strong> ${data.gender || 'N/A'}</p>
                    <p><strong>Joined:</strong> ${data.created_at ? new Date(data.created_at).toLocaleString() : 'N/A'}</p>
                    <div class="flex justify-end mt-4 space-x-2">
                        <button class="px-4 py-2 bg-red-600 text-white rounded delete-user" data-id="${userId}">Delete</button>
                        <button class="px-4 py-2 bg-gray-200 rounded cancel-modal">Close</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            modal.querySelector('.cancel-modal').addEventListener('click', () => modal.remove());
            modal.querySelector('.delete-user').addEventListener('click', () => {
                modal.remove();
                deleteUser(userId);
            });
        } catch (error) {
            console.error('Error fetching user details:', error);
            showErrorMessage('Failed to load user details. Please try again.');
        } finally {
            hideLoading();
        }
    }

    function showSuccessMessage(message) {
        const toast = document.createElement('div');
        toast.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    function showErrorMessage(message) {
        const toast = document.createElement('div');
        toast.className = 'fixed bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 5000);
    }

    async function handleLogout() {
        showLoading();
        try {
            const response = await fetch('https://serverone-w2xc.onrender.com/api/admin/logout', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to logout');
            localStorage.clear();
            window.location.href = 'admin-login.html';
        } catch (error) {
            console.error('Error logging out:', error);
            showErrorMessage('Error logging out. Please try again.');
        } finally {
            hideLoading();
        }
    }
});