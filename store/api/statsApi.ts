import { baseApi } from "./baseApi";

export type MyStats = {
  totalFiles: number;
  storageUsed: number;
  filesByDay: { _id: string; count: number }[];
};

export type AdminStats = {
  totalUsers: number;
  totalFiles: number;
  totalStorage: number;
  filesByDay: { _id: string; count: number; size: number }[];
  usersByDay: { _id: string; count: number }[];
};

export const statsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMyStats: builder.query<MyStats, void>({
      query: () => "/stats/me",
      providesTags: ["Stats"],
    }),
    getAdminStats: builder.query<AdminStats, void>({
      query: () => "/stats/admin",
      providesTags: ["Stats"],
    }),
  }),
});

export const { useGetMyStatsQuery, useGetAdminStatsQuery } = statsApi;
