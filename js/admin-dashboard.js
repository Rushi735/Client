document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    const userType = localStorage.getItem('userType');

    if (!token || !username || userType !== 'admin') {
        window.location.href = 'admin-login.html';
        return;
    }

    document.querySelectorAll('.font-medium').forEach(el => {
        if (el.textContent === 'Admin') el.textContent = username;
    });

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

    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            if (window.innerWidth < 768) {
                sidebar.classList.remove('active');
                sidebarOverlay.classList.remove('active');
            }
        });
    });

    // Add driver locations refresh interval variable
    let driverLocationsRefreshInterval = null;
    let map, currentMarker;
    const driverMarkers = new Map(); // To track driver markers for updates

    const contentSections = {
        'dashboard': document.querySelector('main'),
        'ride-requests': createRideRequestsSection(),
        'drivers': createDriversSection(),
        'driver-locations': createDriverLocationsSection(),
         'user-requests': createUserRequestsSection(), // NEW: Add this line
        'settings': createSettingsSection()
    };

    Object.keys(contentSections).forEach(key => {
        if (key !== 'dashboard') contentSections[key].style.display = 'none';
    });

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const target = item.querySelector('span').textContent.toLowerCase().replace(' ', '-');
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            Object.keys(contentSections).forEach(key => {
                contentSections[key].style.display = key === target ? 'block' : 'none';
            });
            
            // Clear any existing refresh interval
            if (driverLocationsRefreshInterval) {
                clearInterval(driverLocationsRefreshInterval);
                driverLocationsRefreshInterval = null;
            }
            
            if (target === 'ride-requests') fetchRideRequests();
            if (target === 'drivers') fetchAndDisplayDrivers();
            if (target === 'driver-locations') {
                initMap('map');
                loadDriverLocations();
                // Start auto-refresh only when on driver-locations section
                driverLocationsRefreshInterval = setInterval(loadDriverLocations, 100000); // Refresh every 10 seconds
            }
            if (target === 'settings') fetchSystemSettings();
                    if (target === 'user-requests') fetchPendingUsers(); // NEW: Add this line

        });
    });

    function initMap(containerId = 'map') {
        if (map) {
            map.remove();
            driverMarkers.clear();
        }
        
        map = L.map(containerId).setView([51.505, -0.09], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 18,
            minZoom: 3
        }).addTo(map);
        
        // Add scale control
        L.control.scale().addTo(map);
        
        // Add layer control
        const baseLayers = {
            "OpenStreetMap": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }),
            "Satellite": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
            })
        };
        
        L.control.layers(baseLayers).addTo(map);
    }

    fetchDashboardData();

    const toggleMapView = document.getElementById('toggleMapView');
    const mapContainer = document.getElementById('map');
    const locationsTable = document.getElementById('locationsTable');
    if (toggleMapView && mapContainer && locationsTable) {
        toggleMapView.addEventListener('click', () => {
            mapContainer.classList.toggle('hidden');
            locationsTable.classList.toggle('hidden');
            if (!mapContainer.classList.contains('hidden') && !map) {
                initMap();
                loadDriverLocations();
            }
        });
    }

    const viewLocationsBtn = document.getElementById('viewLocationsBtn');
    if (viewLocationsBtn) {
        viewLocationsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('locationsSection').scrollIntoView({ behavior: 'smooth' });
            navItems.forEach(nav => {
                if (nav.querySelector('span').textContent.toLowerCase() === 'driver locations') {
                    nav.click();
                }
            });
        });
    }

    const refreshLocations = document.getElementById('refreshLocations');
    if (refreshLocations) refreshLocations.addEventListener('click', loadDriverLocations);

    const exportDashboard = document.getElementById('exportDashboard');
    if (exportDashboard) exportDashboard.addEventListener('click', exportDashboardData);

    const refreshDashboard = document.getElementById('refreshDashboard');
    if (refreshDashboard) refreshDashboard.addEventListener('click', fetchDashboardData);

    // Add cleanup for the interval when leaving the page
    window.addEventListener('beforeunload', () => {
        if (driverLocationsRefreshInterval) {
            clearInterval(driverLocationsRefreshInterval);
        }
    });

    function showLoading() {
        const loading = document.createElement('div');
        loading.id = 'loading-spinner';
        loading.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        loading.innerHTML = '<div class="animate-spin rounded-full h-16 w-16 border-t-4 border-black"></div>';
        document.body.appendChild(loading);
    }

    function hideLoading() {
        const loading = document.getElementById('loading-spinner');
        if (loading) loading.remove();
    }

    function showSuccessMessage(message) {
        const notificationContainer = document.getElementById('notificationContainer');
        const notificationMessage = document.getElementById('notificationMessage');
        const notificationIcon = document.getElementById('notificationIcon');
        if (notificationContainer && notificationMessage && notificationIcon) {
            notificationMessage.textContent = message;
            notificationIcon.className = 'fas fa-check-circle text-green-500';
            notificationContainer.classList.remove('hidden', 'bg-red-100');
            notificationContainer.classList.add('bg-green-100');
            setTimeout(() => {
                notificationContainer.classList.add('hidden');
                notificationContainer.classList.remove('bg-green-100');
            }, 3000);
        }
    }

    function showErrorMessage(message) {
        const notificationContainer = document.getElementById('notificationContainer');
        const notificationMessage = document.getElementById('notificationMessage');
        const notificationIcon = document.getElementById('notificationIcon');
        if (notificationContainer && notificationMessage && notificationIcon) {
            notificationMessage.textContent = message;
            notificationIcon.className = 'fas fa-exclamation-circle text-red-500';
            notificationContainer.classList.remove('hidden', 'bg-green-100');
            notificationContainer.classList.add('bg-red-100');
            setTimeout(() => {
                notificationContainer.classList.add('hidden');
                notificationContainer.classList.remove('bg-red-100');
            }, 5000);
        }
    }

    async function fetchDashboardData() {
        showLoading();
        try {
            const [requestsRes, driversRes] = await Promise.all([
                fetch('https://serverone-w2xc.onrender.com/api/admin/requests', {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch('https://serverone-w2xc.onrender.com/api/admin/drivers', {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);
            if (!requestsRes.ok || !driversRes.ok) {
                if (requestsRes.status === 401 || driversRes.status === 401) {
                    localStorage.clear();
                    window.location.href = 'admin-login.html';
                    return;
                }
                throw new Error(`HTTP error! Requests: ${requestsRes.status}, Drivers: ${driversRes.status}`);
            }
            const [requests, drivers] = await Promise.all([requestsRes.json(), driversRes.json()]);
            updateDashboardStats(requests.data || [], drivers.data || []);
            renderRecentRequests(requests.data ? requests.data.slice(0, 5) : []);
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            showErrorMessage('Failed to load dashboard data. Please try again.');
        } finally {
            hideLoading();
        }
    }

    function updateDashboardStats(requests, drivers) {
        const totalRides = document.getElementById('totalRides');
        const activeDrivers = document.getElementById('activeDrivers');
        const pendingRequests = document.getElementById('pendingRequests');
        const onlineDrivers = document.getElementById('onlineDrivers');
        const availableDrivers = document.getElementById('availableDrivers');
        const ridesChange = document.getElementById('ridesChange');
        const newRequests = document.getElementById('newRequests');
        if (totalRides) totalRides.textContent = requests.length || 0;
        if (activeDrivers) activeDrivers.textContent = drivers.filter(d => d.available).length || 0;
        if (pendingRequests) pendingRequests.textContent = requests.filter(r => r.status === 'PENDING').length || 0;
        if (onlineDrivers) onlineDrivers.textContent = drivers.length || 0;
        if (availableDrivers) availableDrivers.textContent = `${drivers.filter(d => d.available).length || 0} available`;
        if (ridesChange) ridesChange.innerHTML = `<i class="fas fa-arrow-up mr-1 text-green-500"></i><span class="text-green-500">0% from last week</span>`;
        if (newRequests) newRequests.innerHTML = `<i class="fas fa-arrow-up mr-1 text-red-500"></i><span class="text-red-500">0 new in last hour</span>`;
    }

    function formatTime(timestamp) {
        if (!timestamp) return 'N/A';
        const date = new Date(timestamp);
        return date.toLocaleString('en-US', {
            hour: 'numeric',
            minute: 'numeric',
            hour12: true,
            month: 'short',
            day: 'numeric'
        });
    }

    async function loadDriverLocations() {
        showLoading();
        const locationsList = document.getElementById('driverLocationsList');
        const locationsEmpty = document.getElementById('locationsEmpty');
        const locationsLoading = document.getElementById('locationsLoading');

        if (locationsList) locationsList.innerHTML = '';
        if (locationsEmpty) locationsEmpty.classList.add('hidden');
        if (locationsLoading) locationsLoading.classList.remove('hidden');

        try {
            const response = await fetch('https://serverone-w2xc.onrender.com/api/admin/drivers/locations', {
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

            const { data: drivers } = await response.json();

            if (locationsLoading) locationsLoading.classList.add('hidden');
            if (drivers.length === 0) {
                if (locationsEmpty) locationsEmpty.classList.remove('hidden');
                return;
            }

            // Clear existing markers if any
            if (map) {
                driverMarkers.forEach(marker => map.removeLayer(marker));
                driverMarkers.clear();
            }

            // Create a feature group to hold all markers
            const markersGroup = L.featureGroup().addTo(map);
            
            // Add new markers for each driver
            drivers.forEach(driver => {
                const row = document.createElement('tr');
                row.className = 'hover:bg-gray-50';
                row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="flex items-center">
                            <div class="flex-shrink-0 h-10 w-10">
                                <img class="h-10 w-10 rounded-full" src="https://randomuser.me/api/portraits/men/${Math.floor(Math.random() * 100)}.jpg" alt="${driver.name || 'Unknown'}">
                            </div>
                            <div class="ml-4">
                                <div class="text-sm font-medium text-gray-900">${driver.name || 'Unknown'}</div>
                                <div class="text-sm text-gray-500">${driver.vehicle_type || 'N/A'} - ${driver.vehicle_number || 'N/A'}</div>
                            </div>
                        </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusClass(driver.status)}">
                            ${driver.status || 'Unknown'}
                        </span>
                        <span class="ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${driver.online_status === 'Online' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
                            ${driver.online_status || 'Offline'}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatTime(driver.lastUpdate)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${driver.location || 'N/A'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        ${driver.lat && driver.lng ? `
                            <button class="text-black hover:text-gray-600 view-on-map" data-lat="${driver.lat}" data-lng="${driver.lng}" data-name="${driver.name || 'Driver'}">View on Map</button>
                        ` : 'N/A'}
                    </td>
                `;
                if (locationsList) locationsList.appendChild(row);

                // Add marker to map if available
                if (map && driver.lat && driver.lng) {
                    const lat = parseFloat(driver.lat);
                    const lng = parseFloat(driver.lng);
                    
                    // Create custom icon based on driver status
                    const icon = L.divIcon({
                        className: 'driver-marker',
                        html: `<div class="driver-icon ${driver.available ? 'available' : 'busy'}">
                                 <i class="fas fa-car"></i>
                               </div>`,
                        iconSize: [30, 30],
                        iconAnchor: [15, 15]
                    });
                    
                    const marker = L.marker([lat, lng], { icon }).addTo(map)
                        .bindPopup(`<b>${driver.name || 'Driver'}</b><br>
                                   ${driver.vehicle_type || ''} ${driver.vehicle_number || ''}<br>
                                   Status: ${driver.status || 'Unknown'}<br>
                                   Last update: ${formatTime(driver.lastUpdate)}`);
                    
                    // Add marker to feature group
                    markersGroup.addLayer(marker);
                    
                    // Store marker reference for future updates
                    driverMarkers.set(driver.id, marker);
                }
            });

            // Fit map to show all markers
            if (map && driverMarkers.size > 0) {
                map.fitBounds(markersGroup.getBounds(), { padding: [50, 50] });
            }

            // Set up click handlers for view-on-map buttons
            document.querySelectorAll('.view-on-map').forEach(button => {
                button.addEventListener('click', () => {
                    const lat = parseFloat(button.getAttribute('data-lat'));
                    const lng = parseFloat(button.getAttribute('data-lng'));
                    const name = button.getAttribute('data-name');

                    if (mapContainer.classList.contains('hidden')) {
                        mapContainer.classList.remove('hidden');
                        locationsTable.classList.add('hidden');
                        if (!map) initMap();
                    }

                    if (map) {
                        map.setView([lat, lng], 15);
                        // Clear existing current marker if any
                        if (currentMarker) map.removeLayer(currentMarker);
                        currentMarker = L.marker([lat, lng]).addTo(map)
                            .bindPopup(`<b>${name}</b>`)
                            .openPopup();
                    }
                });
            });

        } catch (error) {
            console.error('Error loading driver locations:', error);
            showErrorMessage('Failed to load driver locations. Please try again.');
            if (locationsLoading) locationsLoading.classList.add('hidden');
            if (locationsEmpty) locationsEmpty.classList.remove('hidden');
        } finally {
            hideLoading();
        }
    }

    function renderRecentRequests(requests) {
        const requestList = document.getElementById('requestList');
        const requestsLoading = document.getElementById('requestsLoading');
        const requestsEmpty = document.getElementById('requestsEmpty');
        if (requestList) requestList.innerHTML = '';
        if (requestsLoading) requestsLoading.classList.add('hidden');
        if (requestsEmpty) requestsEmpty.classList.add('hidden');
        if (!requests.length) {
            if (requestsEmpty) requestsEmpty.classList.remove('hidden');
            return;
        }
        requests.forEach(req => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50';
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#${req.id || 'N/A'}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <img src="https://randomuser.me/api/portraits/${req.user_gender || 'men'}/${Math.floor(Math.random() * 100)}.jpg" 
                             class="w-8 h-8 rounded-full mr-2" alt="User avatar">
                        <span>${req.user_name || 'Unknown'}</span>
                    </div>
                </td>
                <td class="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-500">${req.pickup_location || 'N/A'}</td>
                <td class="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-500">${req.dropoff_location || 'N/A'}</td>
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
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    ${req.status === 'PENDING' ? `
                        <button class="text-black hover:text-gray-600 assign-driver" data-id="${req.id || ''}">
                            Assign
                        </button>
                    ` : `
                        <button class="text-black hover:text-gray-600 track-ride" data-id="${req.id || ''}">
                            Track
                        </button>
                    `}
                    <button class="text-black hover:text-gray-600 view-details" data-id="${req.id || ''}">
                        Details
                    </button>
                </td>
            `;
            requestList.appendChild(row);
        });
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

    async function exportDashboardData() {
        showLoading();
        try {
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
    }

    function createRideRequestsSection() {
        const section = document.createElement('div');
        section.className = 'p-6';
        section.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <h2 class="text-2xl font-bold text-black">Ride Requests Management</h2>
            <div class="flex space-x-3">
                <button id="refreshRequests" class="btn-primary bg-black text-white py-2 px-4 rounded-lg font-medium hover:bg-gray-800">
                    <i class="fas fa-sync-alt mr-2"></i>Refresh
                </button>
                <button id="exportRequests" class="bg-white border border-gray-300 text-black py-2 px-4 rounded-lg font-medium hover:bg-gray-50">
                    <i class="fas fa-download mr-2"></i>Export
                </button>
            </div>
        </div>
        <div class="bg-white rounded-xl border border-gray-100 p-6">
            <div class="max-h-[500px] overflow-y-auto">
                <table class="w-full divide-y divide-gray-200 table-fixed">
                    <thead class="bg-gray-50 sticky top-0 z-10">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">ID</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[15%]">User</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">Gender</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[25%]">Pickup</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[25%]">Dropoff</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[15%]">Driver</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[15%]">Status</th>
                        </tr>
                    </thead>
                    <tbody id="rideRequestsTable" class="bg-white divide-y divide-gray-200">
                        <tr id="requestsLoading">
                            <td colspan="7" class="px-6 py-4 text-center text-gray-500">
                                <div class="flex justify-center items-center space-x-2">
                                    <i class="fas fa-circle-notch fa-spin text-black"></i>
                                    <span>Loading ride requests...</span>
                                </div>
                            </td>
                        </tr>
                        <tr id="requestsEmpty" class="hidden">
                            <td colspan="7" class="px-6 py-8 text-center">
                                <div class="flex flex-col items-center justify-center text-gray-400">
                                    <i class="fas fa-taxi text-4xl mb-2"></i>
                                    <h4 class="font-medium text-gray-500">No recent requests</h4>
                                    <p class="text-sm mt-1">No ride requests have been made recently</p>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
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
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(`Failed to export requests: ${errorData.message || 'Unknown error'}`);
                }
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
        const table = document.getElementById('rideRequestsTable');
        const requestsLoading = document.getElementById('requestsLoading');
        const requestsEmpty = document.getElementById('requestsEmpty');
        if (table) table.innerHTML = '';
        if (requestsLoading) requestsLoading.classList.remove('hidden');
        if (requestsEmpty) requestsEmpty.classList.add('hidden');
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
            showErrorMessage('Failed to load ride requests. Please try again.');
            if (requestsLoading) requestsLoading.classList.add('hidden');
            if (requestsEmpty) requestsEmpty.classList.remove('hidden');
        } finally {
            hideLoading();
        }
    }

    function renderRideRequestsTable(requests) {
        const table = document.getElementById('rideRequestsTable');
        if (!table) return;
        const requestsLoading = document.getElementById('requestsLoading');
        const requestsEmpty = document.getElementById('requestsEmpty');
        if (requestsLoading) requestsLoading.classList.add('hidden');
        if (requestsEmpty) requestsEmpty.classList.add('hidden');
        table.innerHTML = requests.length ? `
            ${requests.map(req => `
                <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#${req.id || 'N/A'}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="flex items-center">
                            <img src="https://randomuser.me/api/portraits/${req.user_gender || 'men'}/${Math.floor(Math.random() * 100)}.jpg" 
                                 class="w-8 h-8 rounded-full mr-2" alt="User avatar">
                            <span>${req.user_name || 'Unknown'}</span>
                        </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${req.user_gender || 'N/A'}</td>
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
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        ${req.status === 'PENDING' ? `
                            <button class="text-black hover:text-gray-600 assign-driver" data-id="${req.id || ''}">
                                Assign
                            </button>
                        ` : `
                            <button class="text-black hover:text-gray-600 track-ride" data-id="${req.id || ''}">
                                Track
                            </button>
                        `}
                        <button class="text-black hover:text-gray-600 view-details" data-id="${req.id || ''}">
                            Details
                        </button>
                    </td>
                </tr>
            `).join('')}
        ` : `
            <tr>
                <td colspan="7" class="px-6 py-8 text-center">
                    <div class="flex flex-col items-center justify-center text-gray-400">
                        <i class="fas fa-taxi text-4xl mb-2"></i>
                        <h4 class="font-medium text-gray-500">No recent requests</h4>
                        <p class="text-sm mt-1">No ride requests have been made recently</p>
                    </div>
                </td>
            </tr>
        `;
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

    function createDriversSection() {
        const section = document.createElement('div');
        section.className = 'p-6';
        section.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <h2 class="text-2xl font-bold text-gray-900">Drivers Management</h2>
            <button id="addDriverBtn" class="btn-primary bg-gradient-to-r from-gray-800 to-black text-white py-2 px-4 rounded-lg font-semibold hover:bg-gradient-to-r hover:from-gray-900 hover:to-black hover:scale-105 transition transform duration-200">
                <i class="fas fa-plus mr-2"></i>Add Driver
            </button>
        </div>
        <div class="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
            <div class="max-h-[500px] overflow-y-auto">
                <table class="w-full table-fixed border-collapse">
                    <thead class="bg-gray-50 sticky top-0 z-10">
                        <tr>
                            <th class="px-4 py-3 text-left text-base font-semibold text-gray-600 uppercase tracking-wider w-[10%]">ID</th>
                            <th class="px-4 py-3 text-left text-base font-semibold text-gray-600 uppercase tracking-wider w-[20%]">Name</th>
                            <th class="px-4 py-3 text-left text-base font-semibold text-gray-600 uppercase tracking-wider w-[20%]">Phone</th>
                            <th class="px-4 py-3 text-left text-base font-semibold text-gray-600 uppercase tracking-wider w-[20%]">Vehicle</th>
                            <th class="px-4 py-3 text-left text-base font-semibold text-gray-600 uppercase tracking-wider w-[20%]">Status</th>
                            <th class="px-4 py-3 text-left text-base font-semibold text-gray-600 uppercase tracking-wider w-[15%]">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="driversList" class="bg-white">
                        <tr id="driversLoading">
                            <td colspan="6" class="px-4 py-4 text-center text-gray-600">
                                <div class="flex justify-center items-center space-x-2 bg-gray-50 rounded-lg p-4">
                                    <i class="fas fa-circle-notch fa-spin text-gray-600"></i>
                                    <span class="text-sm font-medium">Loading drivers...</span>
                                </div>
                            </td>
                        </tr>
                        <tr id="driversEmpty" class="hidden">
                            <td colspan="6" class="px-4 py-8 text-center">
                                <div class="flex flex-col items-center justify-center text-gray-600 bg-gray-50 rounded-lg p-6">
                                    <i class="fas fa-users text-4xl mb-2 text-gray-400"></i>
                                    <h4 class="font-semibold text-gray-600">No drivers available</h4>
                                    <p class="text-sm mt-1 text-gray-500">No drivers have been added yet</p>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;
        document.querySelector('main').parentNode.appendChild(section);
        section.querySelector('#addDriverBtn').addEventListener('click', showAddDriverModal);
        return section;
    }


    function createUserRequestsSection() {
    const section = document.createElement('div');
    section.className = 'p-6';
    section.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <h2 class="text-2xl font-bold text-black">User Registration Requests</h2>
            <button id="refreshUserRequests" class="btn-primary bg-black text-white py-2 px-4 rounded-lg font-medium hover:bg-gray-800">
                <i class="fas fa-sync-alt mr-2"></i>Refresh
            </button>
        </div>
        <div class="bg-white rounded-xl border border-gray-100 p-6">
            <div class="max-h-[500px] overflow-y-auto">
                <table class="w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50 sticky top-0 z-10">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Request Date</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="userRequestsList">
                        <tr id="userRequestsLoading">
                            <td colspan="6" class="px-6 py-4 text-center text-gray-500">
                                <div class="flex justify-center items-center space-x-2">
                                    <i class="fas fa-circle-notch fa-spin text-black"></i>
                                    <span>Loading user requests...</span>
                                </div>
                            </td>
                        </tr>
                        <tr id="userRequestsEmpty" class="hidden">
                            <td colspan="6" class="px-6 py-8 text-center">
                                <div class="flex flex-col items-center justify-center text-gray-400">
                                    <i class="fas fa-user-plus text-4xl mb-2"></i>
                                    <h4 class="font-medium text-gray-500">No pending requests</h4>
                                    <p class="text-sm mt-1">All user registration requests have been processed</p>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;
    document.querySelector('main').parentNode.appendChild(section);
    section.querySelector('#refreshUserRequests').addEventListener('click', fetchPendingUsers);
    return section;
}
    async function fetchAndDisplayDrivers() {
        showLoading();
        const driversList = document.getElementById('driversList');
        const driversLoading = document.getElementById('driversLoading');
        const driversEmpty = document.getElementById('driversEmpty');
        if (driversList) driversList.innerHTML = '';
        if (driversLoading) driversLoading.classList.remove('hidden');
        if (driversEmpty) driversEmpty.classList.add('hidden');
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
            showErrorMessage('Failed to load drivers. Please try again.');
            if (driversLoading) driversLoading.classList.add('hidden');
            if (driversEmpty) driversEmpty.classList.remove('hidden');
        } finally {
            hideLoading();
        }
    }

    // In the fetchPendingUsers function, make sure the URL is correct:
async function fetchPendingUsers() {
    try {
        showLoading(true);
        const token = localStorage.getItem('adminToken');
        if (!token) {
            showErrorMessage('No auth token found. Please log in.');
            window.location.href = '/admin-login.html';
            return;
        }
        const response = await fetch('https://serverone-w2xc.onrender.com/api/admin/pending_users', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            if (response.status === 404) {
                showErrorMessage('Pending users endpoint not found. Contact server admin.');
                return;
            }
            if (response.status === 401) {
                showErrorMessage('Session expired. Please log in again.');
                window.location.href = '/admin-login.html';
                return;
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const { data, message } = await response.json();
        renderUserRequests(data);
        showSuccessMessage(message);
    } catch (error) {
        console.error('Error fetching pending users:', error);
        showErrorMessage('Failed to fetch pending users. Please try again.');
    } finally {
        showLoading(false);
    }
}
    
    async function renderDriversList(drivers) {
        const driversList = document.getElementById('driversList');
        if (!driversList) return;
        const driversLoading = document.getElementById('driversLoading');
        const driversEmpty = document.getElementById('driversEmpty');
        if (driversLoading) driversLoading.classList.add('hidden');
        if (driversEmpty) driversEmpty.classList.add('hidden');
        if (!drivers.length) {
            if (driversEmpty) driversEmpty.classList.remove('hidden');
            return;
        }
        const driverRequests = await Promise.all(drivers.map(async driver => {
            try {
                const response = await fetch(`https://serverone-w2xc.onrender.com/api/admin/drivers/${driver.id}/requests`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) throw new Error(`Failed to fetch requests for driver ${driver.id}`);
                const { data } = await response.json();
                return { driverId: driver.id, requests: data || [] };
            } catch (error) {
                console.error(`Error fetching requests for driver ${driver.id}:`, error);
                return { driverId: driver.id, requests: [] };
            }
        }));
        driversList.innerHTML = drivers.map(driver => {
            const assignedRequests = driverRequests.find(dr => dr.driverId === driver.id)?.requests || [];
            return `
                <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4 whitespace-nowrap">${driver.id || 'N/A'}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="flex items-center">
                            <img src="${driver.avatar || `https://randomuser.me/api/portraits/${driver.gender || 'men'}/${Math.floor(Math.random() * 100)}.jpg`}" 
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
                        <span class="px-2 py-1 text-xs font-medium rounded-full ${driver.available ? 'status-confirmed' : 'status-in_progress'}">
                            ${driver.available ? 'Available' : 'On Trip'}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button class="text-black hover:text-gray-600 edit-driver" data-id="${driver.id}">
                            Edit
                        </button>
                        <button class="text-black hover:text-gray-600 toggle-availability" data-id="${driver.id}" data-available="${driver.available}">
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
                                            <span class="text-sm text-gray-600">Customer: ${req.username || 'N/A'}</span>
                                            <span class="text-sm text-gray-600">Status: ${req.status}</span>
                                            <button class="text-black hover:text-gray-600 text-sm view-request-details" data-id="${req.id}">
                                                View
                                            </button>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </td>
                    </tr>
                ` : ''}
            `}).join('');
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


    function renderUserRequests(users) {
    const userRequestsList = document.getElementById('userRequestsList');
    const userRequestsLoading = document.getElementById('userRequestsLoading');
    const userRequestsEmpty = document.getElementById('userRequestsEmpty');
    
    if (userRequestsLoading) userRequestsLoading.classList.add('hidden');
    if (userRequestsEmpty) users.length === 0 ? userRequestsEmpty.classList.remove('hidden') : userRequestsEmpty.classList.add('hidden');
    
    if (users.length === 0) return;
    
    userRequestsList.innerHTML = users.map(user => `
        <tr class="hover:bg-gray-50">
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#${user.id}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${user.username}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${user.email}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${user.phone || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatTime(user.created_at)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                <button class="text-green-600 hover:text-green-900 approve-user" data-id="${user.id}">
                    Approve
                </button>
                <button class="text-red-600 hover:text-red-900 reject-user" data-id="${user.id}">
                    Reject
                </button>
            </td>
        </tr>
    `).join('');
    
    // Add event listeners
    document.querySelectorAll('.approve-user').forEach(btn => {
        btn.addEventListener('click', () => approveUser(btn.dataset.id));
    });
    
    document.querySelectorAll('.reject-user').forEach(btn => {
        btn.addEventListener('click', () => rejectUser(btn.dataset.id));
    });
}
    

    function createDriverLocationsSection() {
        const section = document.createElement('div');
        section.className = 'p-6';
        section.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-black">Driver Locations</h2>
                <div class="flex space-x-2">
                    <button id="refreshLocationsSection" class="text-sm bg-gray-100 hover:bg-gray-200 text-black px-3 py-1.5 rounded-lg flex items-center focus:outline-none">
                        <i class="fas fa-sync-alt mr-1"></i> Refresh
                    </button>
                    <button id="toggleMapViewSection" class="text-sm bg-black text-white hover:bg-gray-800 px-3 py-1.5 rounded-lg flex items-center focus:outline-none">
                        <i class="fas fa-map mr-1"></i> Map View
                    </button>
                </div>
            </div>
            <div class="bg-white rounded-xl border border-gray-100 p-6">
                <div id="map" class="hidden rounded-xl overflow-hidden border border-gray-200"></div>
                <div class="table-responsive" id="locationsTable">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Driver</th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Update</th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                            </tr>
                        </thead>
                        <tbody id="driverLocationsList" class="bg-white divide-y divide-gray-200">
                            <tr id="locationsLoading">
                                <td colspan="5" class="px-6 py-4 text-center text-gray-500">
                                    <div class="flex justify-center items-center space-x-2">
                                        <i class="fas fa-circle-notch fa-spin text-black"></i>
                                        <span>Loading driver locations...</span>
                                    </div>
                                </td>
                            </tr>
                            <tr id="locationsEmpty" class="hidden">
                                <td colspan="5" class="px-6 py-8 text-center">
                                    <div class="flex flex-col items-center justify-center text-gray-400">
                                        <i class="fas fa-map-marker-alt text-4xl mb-2"></i>
                                        <h4 class="font-medium text-gray-500">No active drivers</h4>
                                        <p class="text-sm mt-1">Currently there are no drivers online</p>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        document.querySelector('main').parentNode.appendChild(section);
        section.querySelector('#refreshLocationsSection').addEventListener('click', loadDriverLocations);
        section.querySelector('#toggleMapViewSection').addEventListener('click', () => {
            const mapContainer = document.getElementById('map');
            const locationsTable = document.getElementById('locationsTable');
            mapContainer.classList.toggle('hidden');
            locationsTable.classList.toggle('hidden');
            if (!mapContainer.classList.contains('hidden') && !map) {
                initMap('map');
                loadDriverLocations();
            }
        });
        return section;
    }

    function createSettingsSection() {
        const section = document.createElement('div');
        section.className = 'p-6';
        section.innerHTML = `
            <div class="mb-6">
                <h2 class="text-2xl font-bold text-black">System Settings</h2>
                <p class="text-gray-500">Manage your application settings</p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="bg-white rounded-xl border border-gray-100 p-6">
                    <h3 class="text-lg font-semibold text-black mb-4">Pricing</h3>
                    <form id="pricingSettingsForm">
                        <div class="mb-4">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Base Fare ($)</label>
                            <input type="number" name="baseFare" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black" step="0.01" min="0" required>
                        </div>
                        <div class="mb-4">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Price per Mile ($)</label>
                            <input type="number" name="pricePerMile" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black" step="0.01" min="0" required>
                        </div>
                        <div class="mb-4">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Price per Minute ($)</label>
                            <input type="number" name="pricePerMinute" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black" step="0.01" min="0" required>
                        </div>
                        <button type="submit" class="btn-primary bg-black text-white py-2 px-4 rounded-lg font-medium hover:bg-gray-800">
                            Save Pricing
                        </button>
                    </form>
                </div>
                <div class="bg-white rounded-xl border border-gray-100 p-6">
                    <h3 class="text-lg font-semibold text-black mb-4">System Configuration</h3>
                    <form id="systemSettingsForm">
                        <div class="mb-4 flex items-center justify-between">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Maintenance Mode</label>
                                <p class="text-xs text-gray-500">Disable booking during maintenance</p>
                            </div>
                            <label class="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" name="maintenanceMode" class="sr-only peer">
                                <div class="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
                            </label>
                        </div>
                        <div class="mb-4 flex items-center justify-between">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Enable Notifications</label>
                                <p class="text-xs text-gray-500">System-wide notifications</p>
                            </div>
                            <label class="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" name="enableNotifications" class="sr-only peer" checked>
                                <div class="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
                            </label>
                        </div>
                        <button type="submit" class="btn-primary bg-black text-white py-2 px-4 rounded-lg font-medium hover:bg-gray-800">
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
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
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
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
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


    async function approveUser(userId) {
    if (!confirm('Are you sure you want to approve this user registration?')) return;
    
    showLoading();
    try {
        const response = await fetch(`https://serverone-w2xc.onrender.com/api/admin/pending_users/${userId}/approve`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to approve user');
        }
        
        showSuccessMessage('User approved successfully!');
        fetchPendingUsers(); // Refresh the list
    } catch (error) {
        console.error('Error approving user:', error);
        showErrorMessage(error.message || 'Failed to approve user. Please try again.');
    } finally {
        hideLoading();
    }
}

async function rejectUser(userId) {
    if (!confirm('Are you sure you want to reject this user registration?')) return;
    
    showLoading();
    try {
        const response = await fetch(`https://serverone-w2xc.onrender.com/api/admin/pending_users/${userId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to reject user');
        }
        
        showSuccessMessage('User registration request rejected successfully!');
        fetchPendingUsers(); // Refresh the list
    } catch (error) {
        console.error('Error rejecting user:', error);
        showErrorMessage(error.message || 'Failed to reject user. Please try again.');
    } finally {
        hideLoading();
    }
}
    async function showAssignDriverModal(requestId) {
        showLoading();
        try {
            const response = await fetch('https://serverone-w2xc.onrender.com/api/admin/drivers', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to fetch drivers');
            }
            const { data: drivers } = await response.json();

            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
            modal.innerHTML = `
            <div class="bg-white rounded-xl p-6 w-full max-w-md shadow-lg">
                <h3 class="text-lg font-semibold text-gray-900 mb-4">Assign Driver to Request #${requestId}</h3>
                <form id="assignDriverForm">
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-1">Select Driver</label>
                        <select name="driverId" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="">Select a driver</option>
                            ${drivers.map(driver => `
                                <option value="${driver.id}">${driver.name || 'Unknown'} (${driver.vehicle_type || 'N/A'} - ${driver.vehicle_number || 'N/A'})</option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="flex justify-end space-x-2">
                        <button type="button" class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors duration-150 cancel-modal">Cancel</button>
                        <button type="submit" class="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 hover:scale-105 transition transform duration-200">Assign</button>
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
                    if (document.querySelector('.nav-item.active span')?.textContent.toLowerCase() === 'ride-requests') {
                        fetchRideRequests();
                    }
                } catch (error) {
                    console.error('Error assigning driver:', error);
                    showErrorMessage(error.message || 'Failed to assign driver. Please try again.');
                }
            });
        } catch (error) {
            console.error('Error fetching drivers:', error);
            showErrorMessage(error.message || 'Failed to load drivers. Please try again.');
        } finally {
            hideLoading();
        }
    }

    function showAddDriverModal() {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-white rounded-lg p-6 w-full max-w-md">
                <h3 class="text-lg font-semibold text-black mb-4">Add New Driver</h3>
                <form id="addDriverForm">
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
                        <input type="text" name="name" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black" required>
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input type="email" name="email" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black" required>
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                        <input type="tel" name="phone" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black" required>
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-1">Vehicle Type</label>
                        <input type="text" name="vehicleType" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black" required>
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-1">Vehicle Number</label>
                        <input type="text" name="vehicleNumber" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black" required>
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                        <select name="gender" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black">
                            <option value="men">Men</option>
                            <option value="women">Women</option>
                            <option value="other">Other</option>
                        </select>
                    </div>
                    <div class="flex justify-end space-x-2">
                        <button type="button" class="px-4 py-2 bg-gray-200 rounded-lg cancel-modal">Cancel</button>
                        <button type="submit" class="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800">Add Driver</button>
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
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
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
                    <h3 class="text-lg font-semibold text-black mb-4">Edit Driver #${driverId}</h3>
                    <form id="editDriverForm">
                        <div class="mb-4">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
                            <input type="text" name="name" value="${data.name || ''}" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black" required>
                        </div>
                        <div class="mb-4">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <input type="email" name="email" value="${data.email || ''}" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black" required>
                        </div>
                        <div class="mb-4">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                            <input type="tel" name="phone" value="${data.phone || ''}" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black" required>
                        </div>
                        <div class="mb-4">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Vehicle Type</label>
                            <input type="text" name="vehicleType" value="${data.vehicle_type || ''}" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black" required>
                        </div>
                        <div class="mb-4">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Vehicle Number</label>
                            <input type="text" name="vehicleNumber" value="${data.vehicle_number || ''}" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black" required>
                        </div>
                        <div class="mb-4">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                            <select name="gender" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black">
                                <option value="men" ${data.gender === 'men' ? 'selected' : ''}>Men</option>
                                <option value="women" ${data.gender === 'women' ? 'selected' : ''}>Women</option>
                                <option value="other" ${data.gender === 'other' ? 'selected' : ''}>Other</option>
                            </select>
                        </div>
                        <div class="mb-4">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Availability</label>
                            <select name="available" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black">
                                <option value="true" ${data.available ? 'selected' : ''}>Available</option>
                                <option value="false" ${!data.available ? 'selected' : ''}>Busy</option>
                            </select>
                        </div>
                        <div class="flex justify-end space-x-2">
                            <button type="button" class="px-4 py-2 bg-gray-200 rounded-lg cancel-modal">Cancel</button>
                            <button type="submit" class="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800">Save</button>
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
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
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

    async function toggleDriverAvailability(driverId, currentAvailability) {
        showLoading();
        try {
            const response = await fetch(`https://serverone-w2xc.onrender.com/api/admin/drivers/${driverId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ available: !currentAvailability })
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to update driver availability');
            }
            showSuccessMessage(`Driver marked as ${currentAvailability ? 'busy' : 'available'} successfully!`);
            fetchDashboardData();
            if (document.querySelector('.nav-item.active span').textContent.toLowerCase() === 'drivers') {
                fetchAndDisplayDrivers();
            }
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
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || 'Failed to delete driver');
                }
                showSuccessMessage('Driver removed successfully!');
                fetchDashboardData();
                if (document.querySelector('.nav-item.active span').textContent.toLowerCase() === 'drivers') {
                    fetchAndDisplayDrivers();
                }
            } catch (error) {
                console.error('Error deleting driver:', error);
                showErrorMessage(error.message || 'Error removing driver. Please try again.');
            } finally {
                hideLoading();
            }
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
                    <h3 class="text-lg font-semibold text-black mb-4">Track Ride #${requestId}</h3>
                    <div id="trackMap" class="h-64 mb-4 rounded-xl border border-gray-200"></div>
                    <p><strong>User:</strong> ${data.username || 'Unknown'}</p>
                    <p><strong>Driver:</strong> ${data.driver_name || 'Not assigned'}</p>
                    <p><strong>Status:</strong> ${data.status || 'N/A'}</p>
                    <p><strong>Pickup:</strong> ${data.pickup_location || 'N/A'}</p>
                    <p><strong>Dropoff:</strong> ${data.dropoff_location || 'N/A'}</p>
                    <div class="flex justify-end mt-4">
                        <button class="px-4 py-2 bg-gray-200 rounded-lg cancel-modal">Close</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            modal.querySelector('.cancel-modal').addEventListener('click', () => modal.remove());
            const mapElement = modal.querySelector('#trackMap');
            if (mapElement && typeof L !== 'undefined' && data.current_location) {
                const [lat, lng] = data.current_location.split(',').map(Number);
                if (!isNaN(lat) && !isNaN(lng)) {
                    const trackMap = L.map(mapElement).setView([lat, lng], 15);
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: '© OpenStreetMap contributors'
                    }).addTo(trackMap);
                    L.marker([lat, lng])
                        .addTo(trackMap)
                        .bindPopup(`Ride #${data.id}<br>User: ${data.username || 'Unknown'}<br>Driver: ${data.driver_name || 'Not assigned'}`)
                        .openPopup();
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
                    <h3 class="text-lg font-semibold text-black mb-4">Ride Request #${requestId}</h3>
                    <p><strong>User:</strong> ${data.username || 'Unknown'}</p>
                    <p><strong>Gender:</strong> ${data.user_gender || 'N/A'}</p>
                    <p><strong>Driver:</strong> ${data.driver_name || 'Not assigned'}</p>
                    <p><strong>Pickup:</strong> ${data.pickup_location || 'N/A'}</p>
                    <p><strong>Dropoff:</strong> ${data.dropoff_location || 'N/A'}</p>
                    <p><strong>Status:</strong> ${data.status || 'N/A'}</p>
                    <p><strong>Fare:</strong> $${parseFloat(data.fare_amount || 0).toFixed(2)}</p>
                    <p><strong>Created:</strong> ${data.created_at ? new Date(data.created_at).toLocaleString() : 'N/A'}</p>
                    <div class="flex justify-end mt-4 space-x-2">
                        ${data.status === 'PENDING' ? `
                            <button class="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 assign-driver" data-id="${requestId}">Assign Driver</button>
                        ` : ''}
                        <button class="px-4 py-2 bg-gray-200 rounded-lg cancel-modal">Close</button>
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
            showErrorMessage('Failed to logout. Please try again.');
        } finally {
            hideLoading();
        }
    }

    function getStatusClass(status) {
        switch (status?.toLowerCase()) {
            case 'available':
                return 'bg-green-100 text-green-800';
            case 'on trip':
                return 'bg-blue-100 text-blue-800';
            case 'offline':
            case 'inactive':
                return 'bg-gray-100 text-gray-800';
            case 'pending':
                return 'bg-yellow-100 text-yellow-800';
            case 'confirmed':
                return 'bg-green-100 text-green-800';
            case 'in_progress':
                return 'bg-blue-100 text-blue-800';
            case 'completed':
                return 'bg-gray-100 text-gray-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    }
});



