import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { logout as logoutAction, updateUser as updateUserAction, type User } from "@/store/authSlice";
import { useLoginMutation, useRegisterMutation } from "@/store/api/authApi";

// Shim giữ nguyên interface của AuthContext cũ để các component không cần đổi cách dùng,
// bên trong chuyển sang đọc/ghi Redux store (authSlice + RTK Query) thay vì Context.
export function useAuth() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const token = useAppSelector((s) => s.auth.token);
  const loading = useAppSelector((s) => s.auth.loading);

  const [loginMutation] = useLoginMutation();
  const [registerMutation] = useRegisterMutation();

  const login = async (email: string, password: string) => {
    try {
      await loginMutation({ email, password }).unwrap();
    } catch (err) {
      // Ném lại đúng shape { response: { data } } như lỗi axios cũ để không phải sửa UI đang bắt lỗi kiểu này
      throw { response: { data: (err as { data?: unknown }).data } };
    }
  };

  const register = async (username: string, email: string, password: string) => {
    try {
      await registerMutation({ username, email, password }).unwrap();
    } catch (err) {
      throw { response: { data: (err as { data?: unknown }).data } };
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    dispatch(logoutAction());
  };

  const updateUser = (updated: User) => {
    localStorage.setItem("user", JSON.stringify(updated));
    dispatch(updateUserAction(updated));
  };

  return { user, token, login, register, logout, updateUser, loading };
}
