// document.addEventListener('DOMContentLoaded', () => {
//     const loginForm = document.getElementById('userLoginForm');

//     if (loginForm) {
//         loginForm.addEventListener('submit', async (e) => {
//             e.preventDefault();
//             const email = document.getElementById('email').value;
//             const password = document.getElementById('password').value;

//             try {
//                 const response = await fetch('https://vpmgt267-3000.inc1.devtunnels.ms/api/user/login', {
//                     method: 'POST',
//                     headers: { 'Content-Type': 'application/json' },
//                     body: JSON.stringify({ email, password })
//                 });
//                 const data = await response.json();
//                 if (response.ok) {
//                     localStorage.setItem('token', data.token);
//                     localStorage.setItem('username', email); // Using email as username for simplicity
//                     localStorage.setItem('userType', 'user');
//                     window.location.href = 'user-dashboard.html';
//                 } else {
//                     alert(data.message || 'Error logging in');
//                 }
//             } catch (error) {
//                 alert('Error logging in: ' + error.message);
//             }
//         });
//     }
// });

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
            const password = document.getElementById('password').value.trim();

            if (!username || !email || !password) {
                return alert('Please fill in all fields.');
            }

            try {
                const response = await fetch('https://serverone-w2xc.onrender.com/api/user/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, email, password })
                });

                const data = await response.json();

                if (response.ok) {
                    alert('Registration successful. Please log in.');
                    // window.location.href = 'user-login.html'; // Change if your login page is named differently
                } else {
                    alert(data.message || 'Registration failed');
                }
            } catch (error) {
                alert('Error registering: ' + error.message);
            }
        });
    }
});                