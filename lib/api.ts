import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api",
});

// Interceptor: tự động gắn token vào mỗi request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor: nếu token hết hạn (401) thì tự logout
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // [SINGLE-SESSION] Bỏ comment để hiển thị thông báo khi bị kick
      // const code = error.response?.data?.code;
      // if (code === "SESSION_INVALIDATED") {
      //   sessionStorage.setItem("loginMessage", "Phiên đăng nhập đã hết hạn vì tài khoản được đăng nhập ở thiết bị khác.");
      // }
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
