/**
 * 封装带 JWT Token 的通用请求客户端
 */

export const apiClient = {
    getToken() {
        return localStorage.getItem('fund_token');
    },

    async request(url, options = {}) {
        const token = this.getToken();
        const headers = {
            ...options.headers
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        if (options.body && !(options.body instanceof FormData) && typeof options.body !== 'string') {
            options.body = JSON.stringify(options.body);
            headers['Content-Type'] = 'application/json';
        }

        const res = await fetch(url, { ...options, headers });
        
        if (res.status === 401) {
            localStorage.removeItem('fund_token');
            window.dispatchEvent(new Event('auth-expired'));
            throw new Error('登录已过期');
        }

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.detail || errData.error || '请求失败');
        }

        return res.json();
    },

    get(url) {
        return this.request(url, { method: 'GET' });
    },

    post(url, body) {
        return this.request(url, { method: 'POST', body });
    },

    put(url, body) {
        return this.request(url, { method: 'PUT', body });
    },

    delete(url) {
        return this.request(url, { method: 'DELETE' });
    }
};
