import { request, unwrapList, unwrapFirst } from './client';
import type { Favorite, Review } from './types';

export const favoritesApi = {
  byUser: (userFkId: string) =>
    request('/api/users/getFavorites', { query: { userFkId } }).then((r) => unwrapList<Favorite>(r)),

  add: (userFkId: string, productFkId: number) =>
    request('/api/users/addFavorite', {
      method: 'POST',
      body: { userFkId, productFkId, createdAt: '' },
    }).then((r) => unwrapFirst<Favorite>(r)),

  remove: (favoritePkId: number) =>
    request('/api/users/deleteFavorites', {
      method: 'DELETE',
      query: { favoritePkId },
      responseType: 'none',
    }),
};

export const reviewsApi = {
  byProduct: (productFkId: number) =>
    request('/api/users/getUserReview', {
      query: { userReviewPkId: null, userFkId: null, productFkId },
    }).then((r) => unwrapList<Review>(r)),

  post: (payload: { productFkId: number; userFkId: string; rating: number; comment: string }) =>
    request('/api/users/postUserReview', { method: 'POST', body: payload }).then((r) =>
      unwrapFirst<Review>(r),
    ),
};

export const viewsApi = {
  record: (userFkId: string | undefined, productFkId: number) =>
    request('/api/users/postUserVisit', { method: 'POST', body: { userFkId, productFkId } }),

  count: (productFkId: number) =>
    request('/api/users/getUserVisit', {
      query: { userVisitPkId: null, userFkId: null, productFkId },
    }).then((r) => unwrapList(r).length),
};
