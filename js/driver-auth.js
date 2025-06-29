const API_BASE_URL = 'https://serverone-w2xc.onrender.com/api/drivers';

async function handleApiResponse(response) {
    const text = await response.text();
    
    try {
        const data = JSON.parse(text);
        if (!response.ok) {
            console.error('API Error:', {
                status: response.status,
                errorData: data
            });
            throw new Error(data.message || `Request failed with status ${response.status}`);
        }
        return data;
    } catch {
        throw new Error(text || 'Request failed');
    }
}

window.driverAuth = {
    async register(driverData) {
        try {
            const response = await fetch(`${API_BASE_URL}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(driverData)
            });

            const data = await handleApiResponse(response);
            return { success: true, data };
        } catch (error) {
            console.error('Registration failed:', error);
            return {
                success: false,
                message: error.message.includes('already exists') 
                    ? 'Email already registered. Please login.'
                    : error.message || 'Registration failed'
            };
        }
    },

    async login(credentials) {
        try {
            const response = await fetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(credentials)
            });

            const data = await handleApiResponse(response);
            
            localStorage.setItem('driverToken', data.token);
            localStorage.setItem('driverData', JSON.stringify(data.driver));
            
            return { 
                success: true,
                data: {
                    id: data.driver.id,
                    name: data.driver.name,
                    email: data.driver.email,
                    phone: data.driver.phone,
                    vehicle_type: data.driver.vehicle_type,
                    vehicle_number: data.driver.vehicle_number,
                    role: 'driver'
                }
            };
        } catch (error) {
            console.error('Login failed:', error);
            return {
                success: false,
                message: error.message.includes('credentials') 
                    ? 'Invalid email or password'
                    : error.message || 'Login failed'
            };
        }
    },

    logout() {
        localStorage.removeItem('driverToken');
        localStorage.removeItem('driverData');
    },

    getCurrentDriver() {
        const data = localStorage.getItem('driverData');
        return data ? JSON.parse(data) : null;
    },

    async getProfile() {
        try {
            const token = localStorage.getItem('driverToken');
            const response = await fetch(`${API_BASE_URL}/profile`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });

            const data = await handleApiResponse(response);
            localStorage.setItem('driverData', JSON.stringify(data.driver));
            return data.driver;
        } catch (error) {
            console.error('Failed to fetch profile:', error);
            throw error;
        }
    },

    async getAssignedRequests() {
        try {
            const token = localStorage.getItem('driverToken');
            const response = await fetch(`${API_BASE_URL}/assigned-requests`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });

            const data = await handleApiResponse(response);
            return data.requests;
        } catch (error) {
            console.error('Failed to fetch assigned requests:', error);
            throw error;
        }
    },

    async completeRequest(requestId) {
        try {
            const token = localStorage.getItem('driverToken');
            const response = await fetch(`${API_BASE_URL}/complete-request`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ requestId })
            });

            return await handleApiResponse(response);
        } catch (error) {
            console.error('Failed to complete request:', error);
            throw error;
        }
    },

    async getRecentRequests() {
        try {
            const token = localStorage.getItem('driverToken');
            const response = await fetch(`${API_BASE_URL}/recent-requests`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });

            const data = await handleApiResponse(response);
            return data.requests;
        } catch (error) {
            console.error('Failed to fetch recent requests:', error);
            throw error;
        }
    },

    async getPastRides() {
        try {
            const token = localStorage.getItem('driverToken');
            const response = await fetch(`${API_BASE_URL}/past-rides`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });

            const data = await handleApiResponse(response);
            return data.rides;
        } catch (error) {
            console.error('Failed to fetch past rides:', error);
            throw error;
        }
    },

    async acceptRequest(requestId) {
        try {
            const token = localStorage.getItem('driverToken');
            const response = await fetch(`${API_BASE_URL}/accept-request`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ requestId })
            });

            return await handleApiResponse(response);
        } catch (error) {
            console.error('Failed to accept request:', error);
            throw error;
        }
    }
};