import { baseApi } from "./baseApi";
import { setCredentials, type User } from "../authSlice";

type AuthResponse = { token: string; user: User };

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<AuthResponse, { email: string; password: string }>({
      query: (body) => ({ url: "/auth/login", method: "POST", body }),
      onQueryStarted: async (_arg, { dispatch, queryFulfilled }) => {
        const { data } = await queryFulfilled;
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        dispatch(setCredentials(data));
      },
    }),
    register: builder.mutation<AuthResponse, { username: string; email: string; password: string }>({
      query: (body) => ({ url: "/auth/register", method: "POST", body }),
      onQueryStarted: async (_arg, { dispatch, queryFulfilled }) => {
        const { data } = await queryFulfilled;
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        dispatch(setCredentials(data));
      },
    }),
  }),
});

export const { useLoginMutation, useRegisterMutation } = authApi;
