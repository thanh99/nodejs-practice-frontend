import { baseApi } from "./baseApi";

export type ShareItem = {
  _id: string;
  file: {
    _id: string;
    originalName: string;
    mimetype: string;
    size: number;
    url?: string;
    createdAt: string;
  };
  sharedBy: { username: string; email: string };
  sharedTo: { username: string; email: string };
  createdAt: string;
};

export const sharesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getReceivedShares: builder.query<{ shares: ShareItem[] }, void>({
      query: () => "/shares/received",
      providesTags: ["Shares"],
    }),
    getSentShares: builder.query<{ shares: ShareItem[] }, void>({
      query: () => "/shares/sent",
      providesTags: ["Shares"],
    }),
    createShare: builder.mutation<{ message: string }, { fileId: string; identifier: string }>({
      query: (body) => ({ url: "/shares", method: "POST", body }),
      invalidatesTags: ["Shares"],
    }),
    revokeShare: builder.mutation<{ message: string }, string>({
      query: (shareId) => ({ url: `/shares/${shareId}`, method: "DELETE" }),
      invalidatesTags: ["Shares"],
    }),
  }),
});

export const {
  useGetReceivedSharesQuery,
  useGetSentSharesQuery,
  useCreateShareMutation,
  useRevokeShareMutation,
} = sharesApi;
