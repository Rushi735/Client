document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('adminLoginForm');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            try {
                const response = await fetch('https://serverone-w2xc.onrender.com/api/admin/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await response.json();
                if (response.ok) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('username', username);
                    localStorage.setItem('userType', 'admin');
                    window.location.href = 'admin-dashboard.html';
                } else {
                    alert(data.message || 'Error logging in');
                }
            } catch (error) {
                alert('Error logging in: ' + error.message);
            }
        });
    }
});