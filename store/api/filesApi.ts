import { baseApi } from "./baseApi";

export type FileItem = {
  _id: string;
  originalName: string;
  filename: string;
  mimetype: string;
  size: number;
  url?: string;
  createdAt: string;
  owner: { username: string; email: string };
};

export type GetFilesArgs = {
  page: number;
  limit: number;
  search?: string;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
  all?: boolean;
};

type GetFilesResponse = {
  files: FileItem[];
  total: number;
  page: number;
  hasMore: boolean;
};

export const filesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Infinite-scroll: cache theo bộ filter (bỏ `page` khỏi cache key), gộp
    // (merge) các trang lại với nhau — pattern chuẩn của RTK Query cho danh
    // sách phân trang vô hạn. Xem: redux-toolkit.js.org/rtk-query/usage/pagination
    getFiles: builder.query<GetFilesResponse, GetFilesArgs>({
      query: ({ page, limit, search, type, dateFrom, dateTo, all }) => ({
        url: all ? "/files/all" : "/files",
        params: {
          page,
          limit,
          ...(search ? { search } : {}),
          ...(type && type !== "all" ? { type } : {}),
          ...(dateFrom ? { dateFrom } : {}),
          ...(dateTo ? { dateTo } : {}),
        },
      }),
      serializeQueryArgs: ({ queryArgs, endpointName }) => {
        const { limit, search, type, dateFrom, dateTo, all } = queryArgs;
        return `${endpointName}(${JSON.stringify({ limit, search, type, dateFrom, dateTo, all })})`;
      },
      merge: (currentCache, newData, { arg }) => {
        if (arg.page === 1) return newData;
        currentCache.files.push(...newData.files);
        currentCache.hasMore = newData.hasMore;
        currentCache.page = newData.page;
      },
      forceRefetch: ({ currentArg, previousArg }) => currentArg?.page !== previousArg?.page,
      providesTags: ["Files"],
    }),

    uploadFiles: builder.mutation<{ message: string; files: FileItem[] }, FormData>({
      query: (formData) => ({ url: "/files/upload", method: "POST", body: formData }),
      invalidatesTags: ["Files"],
    }),

    // Không dùng invalidatesTags cho delete/bulk-delete: cache getFiles có thể
    // đang ở trang > 1 (đã gộp nhiều trang), một refetch tự động do tag gây ra
    // sẽ merge lệch (nối chồng thêm dữ liệu thay vì xoá đúng item). Thay vào
    // đó component tự vá cache bằng filesApi.util.updateQueryData sau khi mutation thành công.
    deleteFile: builder.mutation<{ message: string }, string>({
      query: (id) => ({ url: `/files/${id}`, method: "DELETE" }),
    }),

    bulkDeleteFiles: builder.mutation<{ message: string; deletedCount: number }, string[]>({
      query: (ids) => ({ url: "/files/bulk", method: "DELETE", body: { ids } }),
    }),
  }),
});

export const {
  useGetFilesQuery,
  useUploadFilesMutation,
  useDeleteFileMutation,
  useBulkDeleteFilesMutation,
} = filesApi;
