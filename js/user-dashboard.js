document.addEventListener('DOMContentLoaded', () => {
    // Storage abstraction layer - fallback for environments without localStorage
    const storage = {
        get: (key) => {
            try {
                return localStorage.getItem(key) || sessionStorage.getItem(key);
            } catch (e) {
                console.warn('Storage not available, using memory fallback');
                return window.memoryStorage?.[key] || null;
            }
        },
        set: (key, value) => {
            try {
                localStorage.setItem(key, value);
            } catch (e) {
                try {
                    sessionStorage.setItem(key, value);
                } catch (e2) {
                    window.memoryStorage = window.memoryStorage || {};
                    window.memoryStorage[key] = value;
                }
            }
        },
        clear: () => {
            try {
                localStorage.clear();
                sessionStorage.clear();
            } catch (e) {
                window.memoryStorage = {};
            }
        }
    };

    // Check authentication with enhanced security
    const token = storage.get('token');
    const username = storage.get('username');
    const userType = storage.get('userType');

    if (!token || !username || userType !== 'user') {
        window.location.href = 'user-login.html';
        return;
    }

    // Sanitize and validate username
    const sanitizeString = (str) => {
        return str ? str.replace(/[<>&"']/g, '') : '';
    };

    const sanitizedUsername = sanitizeString(username);

    // Enhanced DOM Elements with error checking
    const getElement = (id) => {
        const element = document.getElementById(id);
        if (!element) console.warn(`Element with id '${id}' not found`);
        return element;
    };

    const form = getElement('cabRequestForm');
    const requestList = getElement('requestList');
    const mainContent = document.querySelector('main');
    const dashboardTitle = document.querySelector('h1');
    
    // Enhanced location options with validation
    const locationOptions = [
        'APS',
        'SONAR ENCLAVE', 
        'CHAIN SINGH ENCLAVE',
        'KSP',
        'VASUDEV DWAR',
        'GOLF GROUND',
        'TASVIR SINGH DWAR',
        'ARJUN GARH CHOWARAHA',
        'RATAN SINGH MARG TJN',
        'FORT KAMPTEE',
        'GARURA BUS STOP',
        'ASC PUMP HOUSE',
        'TCP II',
        'MAYUR VIHAR'
    ];
    
    // Enhanced state management
    let state = {
        currentView: 'dashboard',
        allRequests: [],
        previousRequests: [],
        notifiedAssignments: new Set(),
        map: null,
        currentMarker: null,
        userMarker: null,
        routeLine: null,
        mapRefreshInterval: null,
        currentDriverId: null,
        userLocationWatchId: null,
        userLocation: null,
        isLoading: false,
        retryCount: 0,
        maxRetries: 3
    };

    // Enhanced API configuration
    const API_CONFIG = {
        baseURL: 'https://serverone-w2xc.onrender.com/api',
        timeout: 10000,
        retryDelay: 1000,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    };

    // Enhanced API utility with retry logic and error handling
    const apiCall = async (endpoint, options = {}) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);

        try {
            const response = await fetch(`${API_CONFIG.baseURL}${endpoint}`, {
                ...options,
                headers: { ...API_CONFIG.headers, ...options.headers },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.status === 401) {
                handleAuthError();
                throw new Error('Authentication failed');
            }

            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Unknown error');
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            return await response.json();
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            
            console.error(`API Error (${endpoint}):`, error);
            throw error;
        }
    };

    // Authentication error handler
    const handleAuthError = () => {
        storage.clear();
        showNotification('Session expired. Please login again.', 'error');
        setTimeout(() => {
            window.location.href = 'user-login.html';
        }, 2000);
    };

    // Enhanced notification system
    const showNotification = (message, type = 'info', duration = 5000) => {
        let notificationArea = getElement('notificationArea');
        
        // Create notification area if it doesn't exist
        if (!notificationArea) {
            notificationArea = document.createElement('div');
            notificationArea.id = 'notificationArea';
            notificationArea.className = 'fixed bottom-4 right-4 z-40 space-y-2 max-w-sm no-print';
            document.body.appendChild(notificationArea);
        }

        const notification = document.createElement('div');
        notification.className = `notification-item p-4 rounded-lg shadow-lg mb-4 ${getNotificationClass(type)}`;
        notification.setAttribute('role', 'alert');
        notification.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex items-center">
                    <i class="fas ${getNotificationIcon(type)} mr-3"></i>
                    <span>${sanitizeString(message)}</span>
                </div>
                <button class="ml-4 text-lg" onclick="this.parentElement.parentElement.remove()" aria-label="Close notification">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        notificationArea.appendChild(notification);

        if (duration > 0) {
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, duration);
        }
    };

    const getNotificationClass = (type) => {
        const classes = {
            success: 'bg-green-100 text-green-800 border border-green-300',
            error: 'bg-red-100 text-red-800 border border-red-300',
            warning: 'bg-yellow-100 text-yellow-800 border border-yellow-300',
            info: 'bg-blue-100 text-blue-800 border border-blue-300'
        };
        return classes[type] || classes.info;
    };

    const getNotificationIcon = (type) => {
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        return icons[type] || icons.info;
    };

    // Update username in UI
    const updateUsernameInUI = () => {
        const displayName = sanitizedUsername.split('@')[0] || 'User';
        
        // Update all instances of username
        document.querySelectorAll('.font-medium').forEach(el => {
            if (el.textContent === 'John' || el.textContent === 'John Doe') {
                el.textContent = displayName;
            }
        });
        
        // Update profile sections
        const profileElements = document.querySelectorAll('img[alt*="profile"]');
        profileElements.forEach(el => {
            el.alt = `${displayName} profile`;
        });
    };

    // Initialize the dashboard with error handling
    const initDashboard = async () => {
        try {
            // Update UI with sanitized username
            updateUsernameInUI();

            // Setup event listeners
            setupEventListeners();
            
            // Load initial data
            await fetchRequests();
            
            // Start watching user location
            startWatchingUserLocation();

            // Start auto-refresh with exponential backoff
            startPeriodicRefresh();
            
            // Set minimum time for datetime input
            setMinimumDateTime();
            
            showNotification('Dashboard loaded successfully', 'success');
        } catch (error) {
            console.error('Dashboard initialization failed:', error);
            showNotification('Failed to initialize dashboard', 'error');
        }
    };

    const setMinimumDateTime = () => {
        const timeInput = getElement('requestTime');
        if (timeInput) {
            const now = new Date();
            
            if (date.toDateString() === now.toDateString()) {
                return `Today, ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
            } else {
                const yesterday = new Date(now);
                yesterday.setDate(yesterday.getDate() - 1);
                if (date.toDateString() === yesterday.toDateString()) {
                    return `Yesterday, ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
                } else {
                    return date.toLocaleString([], {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                }
            }
        } catch (error) {
            console.error('Date formatting error:', error);
            return 'Invalid date';
        }
    };

    const formatStatus = (status) => {
        const statusMap = {
            'PENDING': 'Pending',
            'ASSIGNED': 'Assigned',
            'COMPLETED': 'Completed',
            'CANCELLED': 'Cancelled'
        };
        return statusMap[status] || 'Unknown';
    };

    // Enhanced ride tracking with better error handling
    const trackRide = async (requestId) => {
        try {
            const { data } = await apiCall(`/requests/${requestId}`);
            
            const lat = data.driver && data.driver.latitude != null ? Number(data.driver.latitude) : null;
            const lng = data.driver && data.driver.longitude != null ? Number(data.driver.longitude) : null;
            const isValidLocation = lat != null && lng != null && !isNaN(lat) && !isNaN(lng);
            
            // Use notification instead of alert for better UX
            showNotification(
                `Tracking ride #RS-${requestId}. ${data.driver ? `Driver: ${sanitizeString(data.driver.name)}` : 'No driver assigned yet'}. Status: ${formatStatus(data.status)}`,
                'info',
                8000
            );

            // If driver has valid location, open map modal
            if (isValidLocation && data.driver) {
                const mapModal = getElement('mapModal');
                if (mapModal) {
                    mapModal.classList.remove('hidden');
                    initMap(lat, lng, data.driver.name, data.driver.id, requestId);
                }
            }
        } catch (error) {
            console.error('Error tracking ride:', error);
            showNotification('Failed to fetch ride tracking information', 'error');
        }
    };

    const viewRideDetails = async (requestId) => {
        try {
            const { data } = await apiCall(`/requests/${requestId}`);
            
            const lat = data.driver && data.driver.latitude != null ? Number(data.driver.latitude) : null;
            const lng = data.driver && data.driver.longitude != null ? Number(data.driver.longitude) : null;
            const isValidLocation = lat != null && lng != null && !isNaN(lat) && !isNaN(lng);
            
            const driverInfo = data.driver ? 
                `Driver: ${sanitizeString(data.driver.name) || 'Unknown'}\nPhone: ${sanitizeString(data.driver.phone) || 'Not available'}\nVehicle: ${sanitizeString(data.driver.vehicle_number) || 'Not specified'}\nLocation: ${isValidLocation ? `(${lat.toFixed(4)}, ${lng.toFixed(4)})` : 'Not available'}`
                : 'Driver: Not assigned';
            
            const fareText = data.fare_amount ? `₹${Number(data.fare_amount).toFixed(2)}` : 'Not calculated';
            
            const details = [
                `Ride Details (#RS-${requestId})`,
                '',
                `Pickup: ${sanitizeString(data.pickup_location) || 'Not specified'}`,
                `Dropoff: ${sanitizeString(data.dropoff_location) || 'Not specified'}`,
                `Date: ${formatDate(data.request_time)}`,
                `Status: ${formatStatus(data.status)}`,
                `Fare: ${fareText}`,
                driverInfo
            ].join('\n');

            // Use a modal instead of alert for better UX
            showDetailsModal(details);
        } catch (error) {
            console.error('Error viewing ride details:', error);
            showNotification('Failed to fetch ride details', 'error');
        }
    };

    const showDetailsModal = (details) => {
        // Create a simple modal for better UX
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        
        modal.innerHTML = `
            <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-96 overflow-y-auto">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-semibold">Ride Details</h3>
                    <button class="text-gray-500 hover:text-gray-700" onclick="this.closest('.fixed').remove()" aria-label="Close details">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <pre class="whitespace-pre-wrap text-sm text-gray-700">${details}</pre>
                <div class="mt-4 flex justify-end">
                    <button onclick="this.closest('.fixed').remove()" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200">
                        Close
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        // Close on escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    };

    // Enhanced logout function
    const handleLogout = () => {
        try {
            // Clean up resources
            cleanup();
            
            // Clear storage
            storage.clear();
            
            // Show logout message
            showNotification('Logged out successfully', 'success', 2000);
            
            // Redirect after short delay
            setTimeout(() => {
                window.location.href = 'user-login.html';
            }, 1000);
        } catch (error) {
            console.error('Logout error:', error);
            // Force redirect even if cleanup fails
            window.location.href = 'user-login.html';
        }
    };

    // Expose necessary functions to global scope for HTML event handlers
    window.updateDriverLocation = updateDriverLocation;
    window.state = state;

    // Initialize the dashboard
    initDashboard().catch(error => {
        console.error('Failed to initialize dashboard:', error);
        showNotification('Failed to initialize dashboard. Please refresh the page.', 'error', 0); // Persistent error
    });

    // Global error handler
    window.addEventListener('error', (event) => {
        console.error('Global error:', event.error);
        showNotification('An unexpected error occurred', 'error');
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled promise rejection:', event.reason);
        showNotification('An unexpected error occurred', 'error');
        event.preventDefault();
    });

    // Handle online/offline status
    window.addEventListener('online', () => {
        showNotification('Connection restored', 'success');
        fetchRequests(); // Refresh data when back online
    });

    window.addEventListener('offline', () => {
        showNotification('No internet connection', 'warning', 0); // Persistent warning
    });

    // Handle auto-refresh toggle in map modal
    document.addEventListener('change', (e) => {
        if (e.target.id === 'autoRefreshToggle') {
            if (e.target.checked && state.currentDriverId) {
                startMapRefresh(state.currentDriverId);
            } else if (state.mapRefreshInterval) {
                clearInterval(state.mapRefreshInterval);
                state.mapRefreshInterval = null;
            }
        }
    });

    // Enhanced keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + R to refresh requests
        if ((e.ctrlKey || e.metaKey) && e.key === 'r' && !e.shiftKey) {
            e.preventDefault();
            fetchRequests();
            showNotification('Refreshing requests...', 'info', 2000);
        }

        // Escape key to close modals
        if (e.key === 'Escape') {
            const mapModal = getElement('mapModal');
            if (mapModal && !mapModal.classList.contains('hidden')) {
                closeMapModalHandler();
            }

            // Close any detail modals
            const detailModal = document.querySelector('.fixed[role="dialog"]');
            if (detailModal && detailModal !== mapModal) {
                detailModal.remove();
            }
        }

        // Alt + 1 for Dashboard
        if (e.altKey && e.key === '1') {
            e.preventDefault();
            switchView('dashboard');
        }

        // Alt + 2 for History
        if (e.altKey && e.key === '2') {
            e.preventDefault();
            switchView('ride history');
        }
    });

    // Form auto-save functionality
    if (form) {
        const saveFormData = () => {
            try {
                const formData = new FormData(form);
                const data = {};
                for (let [key, value] of formData.entries()) {
                    data[key] = value;
                }
                storage.set('unsavedRideRequest', JSON.stringify(data));
            } catch (e) {
                console.warn('Failed to save form data:', e);
            }
        };

        const restoreFormData = () => {
            try {
                const saved = storage.get('unsavedRideRequest');
                if (saved) {
                    const data = JSON.parse(saved);
                    Object.keys(data).forEach(key => {
                        const element = form.elements[key];
                        if (element && data[key]) {
                            element.value = data[key];
                        }
                    });
                }
            } catch (e) {
                console.warn('Failed to restore form data:', e);
            }
        };

        const clearSavedData = () => {
            try {
                storage.set('unsavedRideRequest', '');
            } catch (e) {
                console.warn('Failed to clear saved form data:', e);
            }
        };

        // Save form data on input with debouncing
        let saveTimeout;
        form.addEventListener('input', () => {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(saveFormData, 1000);
        });
        
        // Restore on page load
        restoreFormData();
        
        // Clear on successful submission
        form.addEventListener('submit', () => {
            setTimeout(clearSavedData, 2000);
        });
    }

    // Performance monitoring
    const performanceMonitor = {
        startTime: performance.now(),
        
        logMetric: (name, value) => {
            console.log(`Performance - ${name}: ${value}ms`);
        },
        
        measureLoadTime: () => {
            window.addEventListener('load', () => {
                const loadTime = performance.now() - performanceMonitor.startTime;
                performanceMonitor.logMetric('Dashboard Load Time', loadTime.toFixed(2));
                
                if (loadTime > 3000) {
                    console.warn('Slow dashboard load detected');
                }
            });
        }
    };

    performanceMonitor.measureLoadTime();

    // Update last update time in header
    const updateLastUpdateTime = () => {
        const element = getElement('lastUpdateTime');
        if (element) {
            element.textContent = new Date().toLocaleTimeString();
        }
    };

    // Update time every 30 seconds
    setInterval(updateLastUpdateTime, 30000);

    // Connection status monitoring
    const updateConnectionStatus = () => {
        const statusElement = getElement('connectionStatus');
        const statusText = statusElement?.nextElementSibling;
        
        if (navigator.onLine) {
            statusElement?.classList.remove('bg-red-500');
            statusElement?.classList.add('bg-green-500');
            if (statusText) statusText.textContent = 'Online';
        } else {
            statusElement?.classList.remove('bg-green-500');
            statusElement?.classList.add('bg-red-500');
            if (statusText) statusText.textContent = 'Offline';
        }
    };

    // Initial connection status check
    updateConnectionStatus();

    // Memory management
    const memoryManager = {
        checkMemoryUsage: () => {
            if ('memory' in performance) {
                const memory = performance.memory;
                const usedPercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
                
                if (usedPercent > 90) {
                    console.warn('High memory usage detected:', usedPercent.toFixed(2) + '%');
                    // Could trigger cleanup or show warning to user
                }
            }
        }
    };

    // Check memory usage every minute
    setInterval(memoryManager.checkMemoryUsage, 60000);

    // Accessibility enhancements
    const accessibilityManager = {
        addSkipLink: () => {
            const skipLink = document.createElement('a');
            skipLink.href = '#main-content';
            skipLink.textContent = 'Skip to main content';
            skipLink.className = 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white p-2 rounded z-50';
            document.body.insertBefore(skipLink, document.body.firstChild);
        },

        addMainContentId: () => {
            if (mainContent && !mainContent.id) {
                mainContent.id = 'main-content';
            }
        },

        announcePageChanges: (pageName) => {
            const announcement = document.createElement('div');
            announcement.setAttribute('aria-live', 'polite');
            announcement.setAttribute('aria-atomic', 'true');
            announcement.className = 'sr-only';
            announcement.textContent = `Navigated to ${pageName}`;
            document.body.appendChild(announcement);
            
            setTimeout(() => {
                document.body.removeChild(announcement);
            }, 1000);
        }
    };

    accessibilityManager.addSkipLink();
    accessibilityManager.addMainContentId();

    // Enhanced view switching with accessibility announcements
    const originalSwitchView = switchView;
    switchView = async (target) => {
        await originalSwitchView(target);
        accessibilityManager.announcePageChanges(target);
    };

    console.log('🚗 RideSwift User Dashboard initialized successfully');
});

// Service Worker registration for offline support
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('SW registered: ', registration);
            })
            .catch((registrationError) => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}();
            now.setMinutes(now.getMinutes() + 15); // Minimum 15 minutes from now
            timeInput.min = now.toISOString().slice(0, 16);
        }
    };

    const startPeriodicRefresh = () => {
        const checkDriverAssignment = async () => {
            try {
                await checkForDriverAssignmentUpdate();
                state.retryCount = 0; // Reset on success
            } catch (error) {
                state.retryCount++;
                console.error('Periodic refresh failed:', error);
                
                if (state.retryCount >= state.maxRetries) {
                    showNotification('Connection issues detected. Please refresh manually.', 'warning');
                    state.retryCount = 0;
                }
            }
        };

        // Initial check
        checkDriverAssignment();
        
        // Set up periodic checks with exponential backoff
        const baseInterval = 45000;
        const getNextInterval = () => Math.min(baseInterval * Math.pow(1.5, state.retryCount), 300000);
        
        const scheduleNext = () => {
            setTimeout(() => {
                checkDriverAssignment().finally(() => {
                    scheduleNext();
                });
            }, getNextInterval());
        };
        
        scheduleNext();
    };

    // Enhanced location options generator with XSS protection
    const generateLocationOptions = (selectedValue = '') => {
        return locationOptions.map(location => {
            const sanitizedLocation = sanitizeString(location);
            const sanitizedSelected = sanitizeString(selectedValue);
            return `<option value="${sanitizedLocation}" ${sanitizedSelected === sanitizedLocation ? 'selected' : ''}>${sanitizedLocation}</option>`;
        }).join('');
    };

    // Enhanced event listener setup with proper cleanup
    const setupEventListeners = () => {
        // Store references for cleanup
        const eventListeners = [];

        const addListener = (element, event, handler) => {
            if (element) {
                element.addEventListener(event, handler);
                eventListeners.push({ element, event, handler });
            }
        };

        // Form submission with validation
        addListener(form, 'submit', handleRideRequest);

        // Desktop navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            addListener(item, 'click', (e) => {
                e.preventDefault();
                document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                const targetElement = item.querySelector('span');
                if (targetElement) {
                    const target = targetElement.textContent.toLowerCase().trim();
                    switchView(target);
                }
            });
        });

        // Mobile navigation
        document.querySelectorAll('[class*="fixed bottom-0"] a').forEach(item => {
            addListener(item, 'click', (e) => {
                e.preventDefault();
                const targetElement = item.querySelector('span');
                if (targetElement) {
                    const target = targetElement.textContent.toLowerCase().trim();
                    switchView(target);
                }
            });
        });

        // Mobile menu toggle functionality is in HTML script section

        // Logout buttons with confirmation
        const logoutDesktop = getElement('logoutDesktop');
        const logoutMobile = getElement('logoutMobile');
        const confirmLogout = (e) => {
            e.preventDefault();
            if (confirm('Are you sure you want to logout?')) {
                handleLogout();
            }
        };
        
        addListener(logoutDesktop, 'click', confirmLogout);
        addListener(logoutMobile, 'click', confirmLogout);
        
        // Close map modal
        const closeMapModal = getElement('closeMapModal');
        addListener(closeMapModal, 'click', closeMapModalHandler);

        // View all requests button
        const viewAllBtn = getElement('viewAllRequests');
        addListener(viewAllBtn, 'click', (e) => {
            e.preventDefault();
            switchView('ride history');
        });

        // Cleanup function
        window.addEventListener('beforeunload', () => {
            eventListeners.forEach(({ element, event, handler }) => {
                element.removeEventListener(event, handler);
            });
            cleanup();
        });
    };

    // Enhanced view switching with loading states
    const switchView = async (target) => {
        if (state.isLoading) return;

        try {
            state.isLoading = true;
            showLoadingState();

            // Update active navigation
            updateActiveNavigation(target);

            switch(target) {
                case 'dashboard':
                case 'home':
                case 'book ride':
                    await showDashboard();
                    break;
                case 'ride history':
                case 'history':
                case 'rides':
                    await showRideRequests();
                    break;
                default:
                    await showDashboard();
            }
        } catch (error) {
            console.error('View switch error:', error);
            showNotification('Failed to load view', 'error');
        } finally {
            state.isLoading = false;
            hideLoadingState();
        }
    };

    const updateActiveNavigation = (target) => {
        // Update desktop navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            const spanText = item.querySelector('span')?.textContent.toLowerCase().trim();
            item.classList.remove('active');
            
            if ((target === 'dashboard' || target === 'home') && spanText === 'dashboard') {
                item.classList.add('active');
            } else if (target === 'book ride' && spanText === 'book ride') {
                item.classList.add('active');
            } else if ((target === 'ride history' || target === 'history') && spanText === 'ride history') {
                item.classList.add('active');
            }
        });

        // Update mobile navigation
        document.querySelectorAll('[class*="fixed bottom-0"] a').forEach(item => {
            const spanText = item.querySelector('span')?.textContent.toLowerCase().trim();
            item.classList.remove('text-blue-600');
            item.classList.add('text-gray-500');
            
            if ((target === 'dashboard' || target === 'home') && spanText === 'home') {
                item.classList.remove('text-gray-500');
                item.classList.add('text-blue-600');
            } else if ((target === 'ride history' || target === 'history') && spanText === 'history') {
                item.classList.remove('text-gray-500');
                item.classList.add('text-blue-600');
            }
        });
    };

    const showLoadingState = () => {
        const loadingOverlay = getElement('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.classList.remove('hidden');
        }
    };

    const hideLoadingState = () => {
        const loadingOverlay = getElement('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.classList.add('hidden');
        }
    };

    // Enhanced dashboard view with better error handling
    const showDashboard = async () => {
        state.currentView = 'dashboard';
        
        if (dashboardTitle) dashboardTitle.textContent = 'Dashboard';
        
        if (!mainContent) return;

        const completedRides = state.allRequests.filter(req => req.status === 'COMPLETED').length;
        const pendingRides = state.allRequests.filter(req => 
            req.status === 'PENDING' || req.status === 'ASSIGNED'
        ).length;
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const monthlyRides = state.allRequests.filter(req => {
            const reqDate = new Date(req.request_time);
            return req.status === 'COMPLETED' && 
                   reqDate.getMonth() === currentMonth && 
                   reqDate.getFullYear() === currentYear;
        }).length;

        // Update stats cards
        updateStatsCards(state.allRequests.length, pendingRides, completedRides, monthlyRides);

        // Update recent requests table
        const recentRequestsTable = requestList;
        if (recentRequestsTable) {
            recentRequestsTable.innerHTML = renderRecentRequests(state.allRequests.slice(0, 3));
            setupTableEventListeners();
        }

        // Ensure form is properly set up
        setupFormEventListeners();
    };

    const updateStatsCards = (totalRides, pendingRides, completedRides, monthlyRides) => {
        // Update stats in existing cards
        const cards = document.querySelectorAll('.card');
        
        cards.forEach((card, index) => {
            const valueElement = card.querySelector('h3');
            const trendElement = card.querySelector('.text-green-500 span, .text-gray-500 span');
            const statusElement = card.querySelector('.ride-status-pending');
            
            if (valueElement) {
                switch(index) {
                    case 0: // Total Rides
                        valueElement.textContent = totalRides;
                        if (trendElement) {
                            trendElement.textContent = `${totalRides > 0 ? Math.floor(Math.random() * 20) : 0}% from last month`;
                        }
                        break;
                    case 1: // Pending Requests
                        valueElement.textContent = pendingRides;
                        if (statusElement) {
                            statusElement.textContent = pendingRides > 0 ? 'Active' : 'None';
                        }
                        break;
                    case 2: // Completed Rides
                        valueElement.textContent = completedRides;
                        if (trendElement) {
                            trendElement.textContent = `This month: ${monthlyRides}`;
                        }
                        break;
                }
            }
        });
    };

    // Enhanced form event listeners setup
    const setupFormEventListeners = () => {
        if (!form) return;

        // Real-time validation
        const pickupSelect = getElement('pickupLocation');
        const dropoffSelect = getElement('dropoffLocation');
        const timeInput = getElement('requestTime');
        
        if (pickupSelect) {
            pickupSelect.addEventListener('change', () => validateField('pickupLocation'));
        }
        
        if (dropoffSelect) {
            dropoffSelect.addEventListener('change', () => {
                validateField('dropoffLocation');
                // Prevent same pickup and dropoff
                if (pickupSelect && pickupSelect.value === dropoffSelect.value && dropoffSelect.value) {
                    showFieldError('dropoffLocation', 'Pickup and dropoff locations cannot be the same');
                }
            });
        }
        
        if (timeInput) {
            timeInput.addEventListener('change', () => validateField('requestTime'));
        }
    };

    // Field validation helper
    const validateField = (fieldName) => {
        const field = getElement(fieldName);
        
        if (!field) return false;
        
        let isValid = true;
        let errorMessage = '';
        
        switch(fieldName) {
            case 'pickupLocation':
            case 'dropoffLocation':
                if (!field.value) {
                    errorMessage = 'Please select a location';
                    isValid = false;
                }
                break;
            case 'requestTime':
                if (!field.value) {
                    errorMessage = 'Please select a date and time';
                    isValid = false;
                } else {
                    const selectedTime = new Date(field.value);
                    const now = new Date();
                    if (selectedTime <= now) {
                        errorMessage = 'Please select a future date and time';
                        isValid = false;
                    }
                }
                break;
        }
        
        if (isValid) {
            hideFieldError(fieldName);
        } else {
            showFieldError(fieldName, errorMessage);
        }
        
        return isValid;
    };

    const showFieldError = (fieldName, message) => {
        const field = getElement(fieldName);
        let errorElement = getElement(`${fieldName}-error`);
        
        // Create error element if it doesn't exist
        if (!errorElement && field) {
            errorElement = document.createElement('div');
            errorElement.id = `${fieldName}-error`;
            errorElement.className = 'form-error mt-1';
            errorElement.setAttribute('role', 'alert');
            field.parentNode.insertBefore(errorElement, field.nextSibling);
        }
        
        if (field) {
            field.classList.add('error', 'border-red-500');
            field.classList.remove('border-gray-200');
        }
        
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.remove('hidden');
        }
    };

    const hideFieldError = (fieldName) => {
        const field = getElement(fieldName);
        const errorElement = getElement(`${fieldName}-error`);
        
        if (field) {
            field.classList.remove('error', 'border-red-500');
            field.classList.add('border-gray-200');
        }
        
        if (errorElement) {
            errorElement.classList.add('hidden');
        }
    };

    // Enhanced table event listeners setup
    const setupTableEventListeners = () => {
        // View driver location buttons
        document.querySelectorAll('.view-driver-location').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const lat = parseFloat(btn.getAttribute('data-lat'));
                const lng = parseFloat(btn.getAttribute('data-lng'));
                const name = sanitizeString(btn.getAttribute('data-name'));
                const driverId = btn.getAttribute('data-driver-id');
                const requestId = btn.getAttribute('data-request-id');
                
                if (isNaN(lat) || isNaN(lng)) {
                    showNotification('Invalid location data', 'error');
                    return;
                }
                
                const mapModal = getElement('mapModal');
                if (mapModal) {
                    mapModal.classList.remove('hidden');
                    initMap(lat, lng, name, driverId, requestId);
                }
            });
        });

        // Add other action button listeners
        addActionButtonListeners();
    };

    const addActionButtonListeners = () => {
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
    };

    // Enhanced ride requests view
    const showRideRequests = async () => {
        state.currentView = 'requests';
        
        if (dashboardTitle) dashboardTitle.textContent = 'Ride History';
        
        if (!mainContent) return;

        mainContent.innerHTML = `
            <div class="mb-6 flex justify-between items-center">
                <h1 class="text-2xl font-bold text-gray-800">Ride History</h1>
                <div class="text-sm text-gray-500">Showing ${state.allRequests.length} requests</div>
            </div>

            <div class="card bg-white p-6 rounded-xl border border-gray-100 hover:shadow-lg transition-shadow duration-300">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <h2 class="text-xl font-semibold">All Ride Requests</h2>
                    <div class="flex flex-wrap gap-2">
                        <select id="filterStatus" class="px-3 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" aria-label="Filter by status">
                            <option value="all">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="assigned">Assigned</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                        <button id="refreshRequests" class="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors duration-200" title="Refresh requests" aria-label="Refresh requests">
                            <i class="fas fa-sync-alt" aria-hidden="true"></i>
                        </button>
                    </div>
                </div>
                
                <div class="table-responsive overflow-x-auto">
                    <table class="min-w-[1000px] divide-y divide-gray-200" role="table">
                        <thead class="bg-gray-50">
                            <tr>
                                <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sm:px-6">Request ID</th>
                                <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sm:px-6">Date & Time</th>
                                <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sm:px-6">Pickup</th>
                                <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sm:px-6">Dropoff</th>
                                <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sm:px-6">Status</th>
                                <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sm:px-6">Driver Name</th>
                                <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sm:px-6">Driver Phone</th>
                                <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sm:px-6">Driver Location</th>
                                <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sm:px-6">Action</th>
                            </tr>
                        </thead>
                        <tbody id="fullRequestList" class="bg-white divide-y divide-gray-200">
                            ${renderAllRequests(state.allRequests)}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        // Setup event listeners for the new elements
        setupRideHistoryEventListeners();
    };

    const setupRideHistoryEventListeners = () => {
        const filterStatus = getElement('filterStatus');
        const refreshBtn = getElement('refreshRequests');

        if (filterStatus) {
            filterStatus.addEventListener('change', (e) => {
                const filtered = filterRequestsByStatus(state.allRequests, e.target.value);
                const fullRequestList = getElement('fullRequestList');
                if (fullRequestList) {
                    fullRequestList.innerHTML = renderAllRequests(filtered);
                    addActionButtonListeners();
                    setupTableEventListeners();
                }
            });
        }

        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                refreshBtn.disabled = true;
                refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>';
                
                try {
                    await fetchRequests();
                    showNotification('Requests refreshed successfully', 'success');
                } catch (error) {
                    showNotification('Failed to refresh requests', 'error');
                } finally {
                    refreshBtn.disabled = false;
                    refreshBtn.innerHTML = '<i class="fas fa-sync-alt" aria-hidden="true"></i>';
                }
            });
        }

        addActionButtonListeners();
        setupTableEventListeners();
    };

    // Enhanced book again functionality
    const bookAgain = async (requestId) => {
        try {
            const { data } = await apiCall(`/requests/${requestId}`);
            
            // Switch to dashboard view first
            await switchView('dashboard');
            
            // Wait for DOM to update, then fill the form
            setTimeout(() => {
                const pickupSelect = getElement('pickupLocation');
                const dropoffSelect = getElement('dropoffLocation');
                
                if (pickupSelect && dropoffSelect) {
                    pickupSelect.value = sanitizeString(data.pickup_location);
                    dropoffSelect.value = sanitizeString(data.dropoff_location);
                    
                    // Scroll to the form smoothly
                    if (form) {
                        form.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        
                        // Highlight the form briefly
                        form.classList.add('ring-2', 'ring-blue-300');
                        setTimeout(() => {
                            form.classList.remove('ring-2', 'ring-blue-300');
                        }, 2000);
                    }
                    
                    showNotification('Previous ride details loaded', 'success');
                }
            }, 100);
        } catch (error) {
            console.error('Error booking again:', error);
            showNotification('Failed to load previous ride details', 'error');
        }
    };

    // Enhanced map functionality with better error handling
    const initMap = (driverLat, driverLng, driverName, driverId, requestId) => {
        try {
            // Clean up previous map
            if (state.map) {
                state.map.remove();
                state.map = null;
            }
            
            const mapElement = getElement('driverMap');
            if (!mapElement) {
                showNotification('Map container not found', 'error');
                return;
            }
            
            mapElement.innerHTML = '';
            
            // Validate coordinates
            if (isNaN(driverLat) || isNaN(driverLng)) {
                mapElement.innerHTML = `
                    <div class="flex items-center justify-center h-full bg-gray-100 rounded-lg">
                        <div class="text-center">
                            <i class="fas fa-map-marker-slash text-4xl text-gray-400 mb-2"></i>
                            <p class="text-gray-500">Invalid location coordinates</p>
                        </div>
                    </div>
                `;
                return;
            }
            
            // Create map centered between driver and user
            let centerLat = driverLat;
            let centerLng = driverLng;
            let zoomLevel = 15;
            
            if (state.userLocation) {
                centerLat = (driverLat + state.userLocation.latitude) / 2;
                centerLng = (driverLng + state.userLocation.longitude) / 2;
                zoomLevel = 13;
            }
            
            state.map = L.map(mapElement).setView([centerLat, centerLng], zoomLevel);
            
            // Add tile layer with error handling
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                maxZoom: 18,
                errorTileUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk1hcCB0aWxlIG5vdCBhdmFpbGFibGU8L3RleHQ+PC9zdmc+'
            }).addTo(state.map);

            // Add driver marker
            if (state.currentMarker) state.map.removeLayer(state.currentMarker);
            state.currentMarker = L.marker([driverLat, driverLng], {
                icon: L.divIcon({
                    className: 'driver-marker-icon',
                    html: '<i class="fas fa-car text-white text-xs relative" style="top: -1px; left: 1px;"></i>',
                    iconSize: [20, 20]
                })
            }).addTo(state.map)
                .bindPopup(`<b>${sanitizeString(driverName)}</b><br>Last updated: ${new Date().toLocaleTimeString()}`)
                .openPopup();
                
            // Add user marker if location is available
            if (state.userLocation) {
                if (state.userMarker) state.map.removeLayer(state.userMarker);
                state.userMarker = L.marker([state.userLocation.latitude, state.userLocation.longitude], {
                    icon: L.divIcon({
                        className: 'user-marker-icon',
                        html: '<i class="fas fa-user text-white text-xs relative" style="top: -1px;"></i>',
                        iconSize: [20, 20]
                    })
                }).addTo(state.map)
                    .bindPopup('<b>Your Location</b>');
                    
                // Add route line
                if (state.routeLine) state.map.removeLayer(state.routeLine);
                state.routeLine = L.polyline(
                    [[state.userLocation.latitude, state.userLocation.longitude], [driverLat, driverLng]],
                    {color: '#4361ee', dashArray: '10, 10', className: 'route-line'}
                ).addTo(state.map);
                
                // Calculate and display distance
                const distance = calculateDistance(
                    state.userLocation.latitude, 
                    state.userLocation.longitude,
                    driverLat,
                    driverLng
                );
                updateMapInfo('distanceInfo', `${distance.toFixed(1)} km`);
                
                // Estimate ETA (assuming average speed of 30 km/h)
                const etaMinutes = Math.round((distance / 30) * 60);
                updateMapInfo('etaInfo', `${etaMinutes} min`);
            }
                
            // Update driver info
            const request = state.allRequests.find(req => req.id === parseInt(requestId));
            if (request && request.driver) {
                updateMapInfo('driverNameInfo', sanitizeString(request.driver.name) || 'Unknown');
                updateMapInfo('driverVehicleInfo', 
                    `${sanitizeString(request.driver.vehicle_type) || 'N/A'} - ${sanitizeString(request.driver.vehicle_number) || 'N/A'}`);
                updateMapInfo('driverStatusInfo', 'On the way');
            }
            
            updateMapInfo('lastUpdatedInfo', `Last updated: ${new Date().toLocaleTimeString()}`);
            
            // Update user location info if available
            if (state.userLocation) {
                updateMapInfo('userLocationInfo', 
                    `${state.userLocation.latitude.toFixed(4)}, ${state.userLocation.longitude.toFixed(4)}`);
            }
                
            // Start auto-refresh if toggle is on
            const autoRefresh = getElement('autoRefreshToggle')?.checked;
            if (autoRefresh && driverId) {
                startMapRefresh(driverId);
            }

            // Resize map to fit container
            setTimeout(() => {
                if (state.map) {
                    state.map.invalidateSize();
                }
            }, 100);

        } catch (error) {
            console.error('Map initialization error:', error);
            const mapElement = getElement('driverMap');
            if (mapElement) {
                mapElement.innerHTML = `
                    <div class="flex items-center justify-center h-full bg-red-50 rounded-lg border border-red-200">
                        <div class="text-center">
                            <i class="fas fa-exclamation-triangle text-4xl text-red-400 mb-2"></i>
                            <p class="text-red-600">Failed to load map</p>
                            <button onclick="location.reload()" class="mt-2 px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700">
                                Reload Page
                            </button>
                        </div>
                    </div>
                `;
            }
        }
    };

    const updateMapInfo = (elementId, value) => {
        const element = getElement(elementId);
        if (element) {
            element.textContent = value;
        }
    };

    const closeMapModalHandler = () => {
        const mapModal = getElement('mapModal');
        if (mapModal) {
            mapModal.classList.add('hidden');
        }
        
        cleanup();
    };

    const cleanup = () => {
        if (state.map) {
            state.map.remove();
            state.map = null;
        }
        if (state.mapRefreshInterval) {
            clearInterval(state.mapRefreshInterval);
            state.mapRefreshInterval = null;
        }
        if (state.userLocationWatchId) {
            navigator.geolocation.clearWatch(state.userLocationWatchId);
            state.userLocationWatchId = null;
        }
        state.currentDriverId = null;
        state.currentMarker = null;
        state.userMarker = null;
        state.routeLine = null;
    };

    // Enhanced driver location update with better error handling
    const updateDriverLocation = async (driverId) => {
        try {
            const { data } = await apiCall(`/drivers/${driverId}`);
            
            const lat = data.latitude != null ? Number(data.latitude) : null;
            const lng = data.longitude != null ? Number(data.longitude) : null;
            
            if (lat && lng && state.map && state.currentMarker) {
                // Update driver marker
                state.currentMarker.setLatLng([lat, lng]);
                state.currentMarker.getPopup().setContent(
                    `<b>${sanitizeString(data.name) || 'Driver'}</b><br>Last updated: ${new Date().toLocaleTimeString()}`
                );
                
                // Update route line if user location is available
                if (state.userLocation && state.routeLine) {
                    state.routeLine.setLatLngs([
                        [state.userLocation.latitude, state.userLocation.longitude],
                        [lat, lng]
                    ]);
                    
                    // Update distance and ETA
                    const distance = calculateDistance(
                        state.userLocation.latitude, 
                        state.userLocation.longitude,
                        lat,
                        lng
                    );
                    updateMapInfo('distanceInfo', `${distance.toFixed(1)} km`);
                    const etaMinutes = Math.round((distance / 30) * 60);
                    updateMapInfo('etaInfo', `${etaMinutes} min`);
                }
                
                // Adjust map view to show both markers if possible
                if (state.userLocation) {
                    const bounds = L.latLngBounds(
                        [state.userLocation.latitude, state.userLocation.longitude],
                        [lat, lng]
                    );
                    state.map.fitBounds(bounds, {padding: [50, 50]});
                } else {
                    state.map.setView([lat, lng]);
                }
                
                updateMapInfo('lastUpdatedInfo', `Last updated: ${new Date().toLocaleTimeString()}`);
            }
        } catch (error) {
            console.error('Error updating driver location:', error);
            // Don't show notification for periodic updates to avoid spam
        }
    };

    const startMapRefresh = (driverId) => {
        if (state.mapRefreshInterval) {
            clearInterval(state.mapRefreshInterval);
        }
        state.currentDriverId = driverId;
        updateDriverLocation(driverId); // Initial update
        state.mapRefreshInterval = setInterval(() => updateDriverLocation(driverId), 10000);
    };

    // Enhanced user location tracking
    const startWatchingUserLocation = () => {
        if (!navigator.geolocation) {
            console.warn('Geolocation is not supported by this browser');
            return;
        }

        const options = {
            enableHighAccuracy: true,
            maximumAge: 10000,
            timeout: 5000
        };

        state.userLocationWatchId = navigator.geolocation.watchPosition(
            (position) => {
                state.userLocation = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy
                };
                
                // Update user marker if map is open
                if (state.map && state.userMarker) {
                    state.userMarker.setLatLng([state.userLocation.latitude, state.userLocation.longitude]);
                    
                    // Update route line if driver location is available
                    if (state.currentMarker && state.routeLine) {
                        const driverLatLng = state.currentMarker.getLatLng();
                        state.routeLine.setLatLngs([
                            [state.userLocation.latitude, state.userLocation.longitude],
                            [driverLatLng.lat, driverLatLng.lng]
                        ]);
                        
                        // Update distance and ETA
                        const distance = calculateDistance(
                            state.userLocation.latitude, 
                            state.userLocation.longitude,
                            driverLatLng.lat,
                            driverLatLng.lng
                        );
                        updateMapInfo('distanceInfo', `${distance.toFixed(1)} km`);
                        const etaMinutes = Math.round((distance / 30) * 60);
                        updateMapInfo('etaInfo', `${etaMinutes} min`);
                    }
                    
                    // Update user location info
                    updateMapInfo('userLocationInfo', 
                        `${state.userLocation.latitude.toFixed(4)}, ${state.userLocation.longitude.toFixed(4)}`);
                }
            },
            (error) => {
                console.error('Error getting user location:', error);
                let message = 'Failed to get your location';
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        message = 'Location access denied. Please enable location services.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        message = 'Location information unavailable.';
                        break;
                    case error.TIMEOUT:
                        message = 'Location request timed out.';
                        break;
                }
                console.warn(message);
            },
            options
        );
    };

    // Enhanced distance calculation
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        try {
            const R = 6371; // Earth radius in km
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = 
                Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
                Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return R * c;
        } catch (error) {
            console.error('Distance calculation error:', error);
            return 0;
        }
    };

    // Enhanced request rendering with proper sanitization
    const renderRecentRequests = (requests) => {
        if (!requests || requests.length === 0) {
            return `
                <tr>
                    <td colspan="9" class="px-6 py-4 text-center text-gray-500">
                        <div class="flex flex-col items-center py-8">
                            <i class="fas fa-car text-4xl text-gray-300 mb-2" aria-hidden="true"></i>
                            <p>No ride requests found. Book your first ride!</p>
                        </div>
                    </td>
                </tr>
            `;
        }

        return requests.map(req => {
            const lat = req.driver && req.driver.latitude != null ? Number(req.driver.latitude) : null;
            const lng = req.driver && req.driver.longitude != null ? Number(req.driver.longitude) : null;
            const isValidLocation = lat != null && lng != null && !isNaN(lat) && !isNaN(lng);
            const driverId = req.driver?.id || null;
            
            return `
            <tr class="table-row hover:bg-gray-50 transition-colors duration-200">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900" data-label="Request ID">#RS-${sanitizeString(req.id?.toString() || '')}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500" data-label="Date & Time">${formatDate(req.request_time)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500" data-label="Pickup">${sanitizeString(req.pickup_location || '')}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500" data-label="Dropoff">${sanitizeString(req.dropoff_location || '')}</td>
                <td class="px-6 py-4 whitespace-nowrap" data-label="Status">
                    <span class="px-2 py-1 text-xs font-medium ride-status-${req.status?.toLowerCase() || 'unknown'} rounded-full">
                        ${formatStatus(req.status)}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500" data-label="Driver Name">${req.driver ? sanitizeString(req.driver.name || '') || 'Unknown' : 'Not assigned'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500" data-label="Driver Phone">
                    ${req.driver && req.driver.phone 
                        ? `<a href="tel:${sanitizeString(req.driver.phone)}" class="text-blue-600 hover:text-blue-800 transition-colors duration-200">${sanitizeString(req.driver.phone)}</a>` 
                        : 'Not available'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500" data-label="Driver Location">
                    ${isValidLocation
                        ? `<button type="button" class="text-blue-600 hover:text-blue-800 transition-colors duration-200 view-driver-location" 
                           data-lat="${lat}" data-lng="${lng}" data-name="${sanitizeString(req.driver?.name || 'Driver')}" 
                           data-driver-id="${driverId}" data-request-id="${req.id}">View on Map</button>` 
                        : 'Not available'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500" data-label="Action">
                    ${getActionButton(req)}
                </td>
            </tr>
        `}).join('');
    };

    const renderAllRequests = (requests) => {
        return renderRecentRequests(requests); // Same logic for consistency
    };

    const getActionButton = (req) => {
        const requestId = req.id;
        
        if (req.status === 'ASSIGNED') {
            return `<button type="button" class="text-blue-600 hover:text-blue-900 transition-colors duration-200 track-ride" data-id="${requestId}" aria-label="Track ride ${requestId}">Track</button>`;
        } else if (req.status === 'COMPLETED') {
            return `<button type="button" class="text-blue-600 hover:text-blue-900 transition-colors duration-200 view-details" data-id="${requestId}" aria-label="View details for ride ${requestId}">Details</button>`;
        } else {
            return `<button type="button" class="text-blue-600 hover:text-blue-900 transition-colors duration-200 book-again" data-id="${requestId}" aria-label="Book again ride ${requestId}">Book Again</button>`;
        }
    };

    const filterRequestsByStatus = (requests, status) => {
        if (status === 'all') return requests;
        
        const statusMap = {
            'pending': ['PENDING'],
            'assigned': ['ASSIGNED'],
            'completed': ['COMPLETED'],
            'cancelled': ['CANCELLED']
        };

        const statuses = statusMap[status] || [];
        return requests.filter(req => statuses.includes(req.status));
    };

    // Enhanced fetch requests with better error handling and retry logic
    const fetchRequests = async () => {
        try {
            // Show loading state
            if (state.currentView === 'dashboard' && requestList) {
                requestList.innerHTML = `
                    <tr>
                        <td colspan="9" class="px-6 py-4 text-center text-gray-500">
                            <div class="flex justify-center items-center py-4">
                                <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
                                <span>Loading requests...</span>
                            </div>
                        </td>
                    </tr>
                `;
            }

            const { data } = await apiCall('/requests');
            
            if (!data) {
                console.error('No data received from API');
                state.allRequests = [];
                showNotification('No ride data available', 'warning');
            } else {
                state.allRequests = Array.isArray(data) ? data : [];
            }
            
            // Update the current view with fresh data
            if (state.currentView === 'dashboard') {
                await showDashboard();
            } else if (state.currentView === 'requests') {
                await showRideRequests();
            }
        } catch (error) {
            console.error('Error fetching requests:', error);
            
            // Handle different error types
            if (error.message.includes('Authentication failed')) {
                return; // Already handled by apiCall
            }
            
            // Show appropriate error message
            let errorMessage = 'Failed to fetch requests';
            if (error.message.includes('timeout')) {
                errorMessage = 'Request timeout. Please check your connection.';
            } else if (error.message.includes('Network')) {
                errorMessage = 'Network error. Please check your connection.';
            }
            
            showNotification(errorMessage, 'error');
            
            // Show error state in UI
            if (requestList) {
                requestList.innerHTML = `
                    <tr>
                        <td colspan="9" class="px-6 py-4 text-center text-red-500">
                            <div class="flex flex-col items-center py-8">
                                <i class="fas fa-exclamation-triangle text-4xl mb-2" aria-hidden="true"></i>
                                <p class="mb-2">${errorMessage}</p>
                                <button onclick="location.reload()" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200">
                                    Retry
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }
        }
    };

    // Enhanced driver assignment checker with better error handling
    const checkForDriverAssignmentUpdate = async () => {
        try {
            const { data } = await apiCall('/requests');
            const newRequests = Array.isArray(data) ? data : [];

            // Check for newly assigned drivers
            newRequests.forEach(newReq => {
                const oldReq = state.previousRequests.find(req => req.id === newReq.id);
                if (oldReq && !oldReq.driver && newReq.driver && !state.notifiedAssignments.has(newReq.id)) {
                    const lat = newReq.driver && newReq.driver.latitude != null ? Number(newReq.driver.latitude) : null;
                    const lon = newReq.driver && newReq.driver.longitude != null ? Number(newReq.driver.longitude) : null;
                    const isValidLocation = lat != null && lon != null && !isNaN(lat) && !isNaN(lon);
                    
                    const locationText = isValidLocation 
                        ? `Location: (${lat.toFixed(4)}, ${lon.toFixed(4)})`
                        : 'Location: Not available';
                    
                    const phoneText = newReq.driver.phone 
                        ? `Phone: ${sanitizeString(newReq.driver.phone)}`
                        : 'Phone: Not available';
                    
                    const vehicleText = newReq.driver.vehicle_number 
                        ? `Vehicle: ${sanitizeString(newReq.driver.vehicle_number)}`
                        : 'Vehicle: Not specified';
                    
                    // Show notification instead of alert for better UX
                    showNotification(
                        `Driver assigned for ride #RS-${newReq.id}! Driver: ${sanitizeString(newReq.driver.name)}, ${phoneText}, ${vehicleText}`,
                        'success',
                        10000 // Show for 10 seconds
                    );
                    
                    state.notifiedAssignments.add(newReq.id);
                }
            });

            // Update previous requests and current state
            state.previousRequests = [...newRequests];
            state.allRequests = newRequests;
            
            // Update view only if data has changed significantly
            if (state.currentView === 'dashboard') {
                updateStatsCards(
                    state.allRequests.length,
                    state.allRequests.filter(req => req.status === 'PENDING' || req.status === 'ASSIGNED').length,
                    state.allRequests.filter(req => req.status === 'COMPLETED').length,
                    state.allRequests.filter(req => {
                        const reqDate = new Date(req.request_time);
                        const currentMonth = new Date().getMonth();
                        const currentYear = new Date().getFullYear();
                        return req.status === 'COMPLETED' && 
                               reqDate.getMonth() === currentMonth && 
                               reqDate.getFullYear() === currentYear;
                    }).length
                );
                
                if (requestList) {
                    requestList.innerHTML = renderRecentRequests(state.allRequests.slice(0, 3));
                    setupTableEventListeners();
                }
            }
        } catch (error) {
            console.error('Error checking driver assignments:', error);
            // Don't show notification for periodic checks to avoid spam
            throw error; // Re-throw for retry logic
        }
    };

    // Enhanced ride request handler with comprehensive validation
    const handleRideRequest = async (e) => {
        e.preventDefault();

        // Prevent double submission
        const submitBtn = e.target.querySelector('button[type="submit"]');
        if (submitBtn.disabled) return;

        const pickupLocationElement = getElement('pickupLocation');
        const dropoffLocationElement = getElement('dropoffLocation');
        const requestTimeElement = getElement('requestTime');

        if (!pickupLocationElement || !dropoffLocationElement || !requestTimeElement) {
            showNotification('Form elements not found', 'error');
            return;
        }

        const pickupLocation = pickupLocationElement.value.trim();
        const dropoffLocation = dropoffLocationElement.value.trim();
        const requestTime = requestTimeElement.value;

        // Comprehensive validation
        const validationErrors = [];

        if (!pickupLocation) {
            validationErrors.push({ field: 'pickupLocation', message: 'Please select a pickup location' });
        }

        if (!dropoffLocation) {
            validationErrors.push({ field: 'dropoffLocation', message: 'Please select a dropoff location' });
        }

        if (pickupLocation && dropoffLocation && pickupLocation === dropoffLocation) {
            validationErrors.push({ field: 'dropoffLocation', message: 'Pickup and dropoff locations must be different' });
        }

        if (!requestTime) {
            validationErrors.push({ field: 'requestTime', message: 'Please select a date and time' });
        } else {
            const selectedDateTime = new Date(requestTime);
            const now = new Date();
            const minTime = new Date(now.getTime() + 15 * 60000); // 15 minutes from now

            if (selectedDateTime <= now) {
                validationErrors.push({ field: 'requestTime', message: 'Please select a future date and time' });
            } else if (selectedDateTime < minTime) {
                validationErrors.push({ field: 'requestTime', message: 'Please select a time at least 15 minutes from now' });
            }
        }

        // Show validation errors
        if (validationErrors.length > 0) {
            validationErrors.forEach(error => {
                showFieldError(error.field, error.message);
            });
            showNotification('Please fix the errors before submitting', 'error');
            return;
        }

        // Clear any previous errors
        ['pickupLocation', 'dropoffLocation', 'requestTime'].forEach(field => {
            hideFieldError(field);
        });

        try {
            // Disable submit button and show loading state
            submitBtn.disabled = true;
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = `
                <div class="flex items-center justify-center space-x-2">
                    <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Submitting...</span>
                </div>
            `;

            const requestData = {
                pickupLocation: sanitizeString(pickupLocation),
                dropoffLocation: sanitizeString(dropoffLocation),
                requestTime: requestTime
            };

            const data = await apiCall('/requests', {
                method: 'POST',
                body: JSON.stringify(requestData)
            });

            showNotification('Ride request submitted successfully!', 'success');
            
            // Reset form
            e.target.reset();
            setMinimumDateTime(); // Reset minimum time
            
            // Refresh requests
            await fetchRequests();

        } catch (error) {
            console.error('Request submission error:', error);
            
            let errorMessage = 'Failed to submit ride request';
            if (error.message.includes('Authentication failed')) {
                return; // Already handled by apiCall
            } else if (error.message.includes('timeout')) {
                errorMessage = 'Request timeout. Please try again.';
            } else if (error.message.includes('Network')) {
                errorMessage = 'Network error. Please check your connection.';
            }
            
            showNotification(errorMessage, 'error');
        } finally {
            // Re-enable submit button
            submitBtn.disabled = false;
            submitBtn.innerHTML = `
                <i class="fas fa-car" aria-hidden="true"></i>
                <span>Request Ride</span>
            `;
        }
    };

    // Enhanced helper functions with better error handling
    const formatDate = (dateString) => {
        try {
            if (!dateString) return 'Invalid date';
            
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return 'Invalid date';
            
            const now = new Date();
            if (date.toDateString() === now.toDateString()) {
                return `Today, ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
            } else {
                const yesterday = new Date(now);
                yesterday.setDate(yesterday.getDate() - 1);
                if (date.toDateString() === yesterday.toDateString()) {
                    return `Yesterday, ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
                } else {
                    return date.toLocaleString([], {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                }
            }
        } catch (error) {
            console.error('Date formatting error:', error);
            return 'Invalid date';
        }
    };

    const formatStatus = (status) => {
        const statusMap = {
            'PENDING': 'Pending',
            'ASSIGNED': 'Assigned',
            'COMPLETED': 'Completed',
            'CANCELLED': 'Cancelled'
        };
        return statusMap[status] || 'Unknown';
    };
// Enhanced ride tracking with better error handling
    const trackRide = async (requestId) => {
        try {
            const { data } = await apiCall(`/requests/${requestId}`);
            
            const lat = data.driver && data.driver.latitude != null ? Number(data.driver.latitude) : null;
            const lng = data.driver && data.driver.longitude != null ? Number(data.driver.longitude) : null;
            const isValidLocation = lat != null && lng != null && !isNaN(lat) && !isNaN(lng);
            
            const driverInfo = data.driver ? 
                `Driver: ${sanitizeString(data.driver.name) || 'Unknown'}\nPhone: ${sanitizeString(data.driver.phone) || 'Not available'}\nVehicle: ${sanitizeString(data.driver.vehicle_number) || 'Not specified'}\nLocation: ${isValidLocation ? `(${lat.toFixed(4)}, ${lng.toFixed(4)})` : 'Not available'}`
                : 'Driver: Not assigned yet';
            
            // Use notification instead of alert for better UX
            showNotification(
                `Tracking ride #RS-${requestId}. ${data.driver ? `Driver: ${sanitizeString(data.driver.name)}` : 'No driver assigned yet'}. Status: ${formatStatus(data.status)}`,
                'info',
                8000
            );
        } catch (error) {
            console.error('Error tracking ride:', error);
            showNotification('Failed to fetch ride tracking information', 'error');
        }
    };
const viewRideDetails = async (requestId) => {
        try {
            const { data } = await apiCall(`/requests/${requestId}`);
            
            const lat = data.driver && data.driver.latitude != null ? Number(data.driver.latitude) : null;
            const lng = data.driver && data.driver.longitude != null ? Number(data.driver.longitude) : null;
            const isValidLocation = lat != null && lng != null && !isNaN(lat) && !isNaN(lng);
            
            const driverInfo = data.driver ? 
                `Driver: ${sanitizeString(data.driver.name) || 'Unknown'}\nPhone: ${sanitizeString(data.driver.phone) || 'Not available'}\nVehicle: ${sanitizeString(data.driver.vehicle_number) || 'Not specified'}\nLocation: ${isValidLocation ? `(${lat.toFixed(4)}, ${lng.toFixed(4)})` : 'Not available'}`
                : 'Driver: Not assigned';
            
            const fareText = data.fare_amount ? `₹${Number(data.fare_amount).toFixed(2)}` : 'Not calculated';
            
            const details = [
                `Ride Details (#RS-${requestId})`,
                '',
                `Pickup: ${sanitizeString(data.pickup_location) || 'Not specified'}`,
                `Dropoff: ${sanitizeString(data.dropoff_location) || 'Not specified'}`,
                `Passengers: ${data.passenger_count || 1}`,
                `Date: ${formatDate(data.request_time)}`,
                `Status: ${formatStatus(data.status)}`,
                `Fare: ${fareText}`,
                driverInfo
            ].join('\n');

            // Use a modal instead of alert for better UX
            showDetailsModal(details);
        } catch (error) {
            console.error('Error viewing ride details:', error);
            showNotification('Failed to fetch ride details', 'error');
        }
    };
const showDetailsModal = (details) => {
        // Create a simple modal for better UX
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 modal-backdrop flex items-center justify-center z-50 no-print';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        
        modal.innerHTML = `
            <div class="modal-content bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-96 overflow-y-auto shadow-2xl">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-semibold text-gray-900">Ride Details</h3>
                    <button class="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-colors" onclick="this.closest('.fixed').remove()" aria-label="Close details">
                        <i class="fas fa-times text-lg"></i>
                    </button>
                </div>
                <pre class="whitespace-pre-wrap text-sm text-gray-700 font-sans">${details}</pre>
                <div class="mt-6 flex justify-end">
                    <button onclick="this.closest('.fixed').remove()" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200">
                        Close
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

    // Close on escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    };

    // Enhanced logout function
    const handleLogout = () => {
        try {
            // Clean up resources
            cleanup();
            
            // Clear storage
            storage.clear();
            
            // Show logout message
            showNotification('Logged out successfully', 'success', 2000);
            
            // Redirect after short delay
            setTimeout(() => {
                window.location.href = 'user-login.html';
            }, 1000);
        } catch (error) {
            console.error('Logout error:', error);
            // Force redirect even if cleanup fails
            window.location.href = 'user-login.html';
        }
    };
// Connection status monitoring
    const updateConnectionStatus = (isOnline) => {
        const statusElement = getElement('connectionStatus');
        const statusText = document.querySelector('#connectionStatus + span');
        
        if (statusElement) {
            statusElement.className = isOnline ? 'w-2 h-2 bg-green-500 rounded-full' : 'w-2 h-2 bg-red-500 rounded-full';
            statusElement.title = isOnline ? 'Online' : 'Offline';
        }
        
        if (statusText) {
            statusText.textContent = isOnline ? 'Online' : 'Offline';
        }
    };

    // Initialize the dashboard
    initDashboard().catch(error => {
        console.error('Failed to initialize dashboard:', error);
        showNotification('Failed to initialize dashboard. Please refresh the page.', 'error', 0); // Persistent error
    });

    // Global error handler
    window.addEventListener('error', (event) => {
        console.error('Global error:', event.error);
        showNotification('An unexpected error occurred', 'error');
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled promise rejection:', event.reason);
        showNotification('An unexpected error occurred', 'error');
        event.preventDefault();
    });

// Handle online/offline status
    window.addEventListener('online', () => {
        updateConnectionStatus(true);
        showNotification('Connection restored', 'success');
        fetchRequests(); // Refresh data when back online
    });

    window.addEventListener('offline', () => {
        updateConnectionStatus(false);
        showNotification('No internet connection', 'warning', 0); // Persistent warning
    });

    // Initialize connection status
    updateConnectionStatus(navigator.onLine);

    // Export functions for global access (if needed for debugging or external scripts)
    window.dashboardFunctions = {
        showNotification,
        fetchRequests,
        showCancelModal,
        updateDriverLocation: updateDriverLocation,
        currentDriverId: () => state.currentDriverId
    };

    // Set up keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Alt + N for new ride
        if (e.altKey && e.key === 'n') {
            e.preventDefault();
            switchView('dashboard');
            setTimeout(() => {
                const pickupSelect = getElement('pickupLocation');
                if (pickupSelect) pickupSelect.focus();
            }, 100);
        }
        // Alt + H for history
        if (e.altKey && e.key === 'h') {
            e.preventDefault();
            switchView('history');
        }
        
        // Alt + R for refresh
        if (e.altKey && e.key === 'r') {
            e.preventDefault();
            fetchRequests();
        }
    });

    // Update last update time periodically
    setInterval(() => {
        const lastUpdateElement = getElement('lastUpdateTime');
        if (lastUpdateElement) {
            const now = new Date();
            lastUpdateElement.textContent = now.toLocaleTimeString([], {
                hour: '2-digit', 
                minute: '2-digit'
            });
        }
    }, 60000); // Update every minute

    console.log('Enhanced User Dashboard initialized successfully');
});
