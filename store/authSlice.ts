import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type User = {
  id: string;
  username: string;
  email: string;
  role: "user" | "admin";
};

type AuthState = {
  user: User | null;
  token: string | null;
  // true cho tới khi đọc xong localStorage lần đầu (tránh render nhầm route trước khi session được khôi phục)
  loading: boolean;
};

const initialState: AuthState = {
  user: null,
  token: null,
  loading: true,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    hydrate(state, action: PayloadAction<{ user: User; token: string } | null>) {
      if (action.payload) {
        state.user = action.payload.user;
        state.token = action.payload.token;
      }
      state.loading = false;
    },
    setCredentials(state, action: PayloadAction<{ user: User; token: string }>) {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.loading = false;
    },
    updateUser(state, action: PayloadAction<User>) {
      state.user = action.payload;
    },
    logout(state) {
      state.user = null;
      state.token = null;
    },
  },
});

export const { hydrate, setCredentials, updateUser, logout } = authSlice.actions;
export default authSlice.reducer;
