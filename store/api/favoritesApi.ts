import { baseApi } from "./baseApi";

export type FavoriteItem = {
  _id: string;
  file: {
    _id: string;
    originalName: string;
    mimetype: string;
    size: number;
    url?: string;
    createdAt: string;
  };
  createdAt: string;
};

export const favoritesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getFavorites: builder.query<{ favorites: FavoriteItem[] }, void>({
      query: () => "/favorites",
      providesTags: ["Favorites"],
    }),
    addFavorite: builder.mutation<{ message: string }, string>({
      query: (fileId) => ({ url: "/favorites", method: "POST", body: { fileId } }),
      invalidatesTags: ["Favorites"],
    }),
    removeFavorite: builder.mutation<{ message: string }, string>({
      query: (fileId) => ({ url: `/favorites/${fileId}`, method: "DELETE" }),
      invalidatesTags: ["Favorites"],
    }),
  }),
});

export const { useGetFavoritesQuery, useAddFavoriteMutation, useRemoveFavoriteMutation } = favoritesApi;
