document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('userLoginForm');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            try {
                const response = await fetch('https://serverone-w2xc.onrender.com/api/user/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const data = await response.json();
                if (response.ok) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('username', email); // Using email as username for simplicity
                    localStorage.setItem('userType', 'user');
                    window.location.href = 'user-dashboard.html';
                } else {
                    alert(data.message || 'Error logging in');
                }
            } catch (error) {
                alert('Error logging in: ' + error.message);
            }
        });
    }

    // 🟢 Registration Logic
    const registerForm = document.getElementById('userRegisterForm');

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const username = document.getElementById('username').value.trim();
            const email = document.getElementById('email').value.trim();
            const phone = document.getElementById('phone').value.trim();
            const password = document.getElementById('password').value.trim();

            // Client-side validation
            if (!username || !email || !phone || !password) {
                return alert('Please fill in all fields.');
            }

            // Validate phone number format (10-15 digits, optional +)
            if (!/^\+?\d{10,15}$/.test(phone.replace(/[\s-]/g, ''))) {
                return alert('Please enter a valid phone number (10-15 digits, optional country code).');
            }

            // Validate password (minimum 8 characters, at least one number and one symbol)
            if (!/^(?=.*[0-9])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{8,}$/.test(password)) {
                return alert('Password must be at least 8 characters long and include a number and a symbol.');
            }

            try {
                const response = await fetch(' https://serverone-w2xc.onrender.com/api/user/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, email, phone, password })
                });

                const data = await response.json();

                if (response.ok) {
                    alert('Registration successful. Please log in.');
                    window.location.href = 'user-login.html';
                } else {
                    alert(data.message || 'Registration failed');
                }
            } catch (error) {
                alert('Error registering: ' + error.message);
            }
        });
    }

});

