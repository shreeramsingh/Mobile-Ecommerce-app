import { request, unwrapList, unwrapFirst, filePart } from './client';
import type { SubscriptionDefinition, SupportTicket, User } from './types';
import type { PickedFile } from '../lib/validation';

// Simple in-memory cache for nodeId → display name lookups (products only carry sellerId).
const nameCache = new Map<string, Promise<string | null>>();

export const usersApi = {
  /** All users with this status. Fetches once, and again with the full count if there are more. */
  async list(filterBy: 'ACTIVE' | 'INACTIVE' = 'ACTIVE', size = 100): Promise<User[]> {
    const get = (n: number) =>
      request<{ data?: User[]; count?: number }>('/api/users/getUser', {
        query: { page: 0, size: n, filterBy, inputPkId: null, inputFkId: null },
      });
    const first = await get(size);
    const users = unwrapList<User>(first);
    const total = Number(first?.count ?? 0);
    if (total > users.length) return unwrapList<User>(await get(total));
    return users;
  },

  getById: (userPkId: number) =>
    request('/api/users/getUser', {
      query: { page: 0, size: 25, filterBy: 'ACTIVE', inputPkId: userPkId, inputFkId: null },
    }).then((r) => unwrapList<User>(r)[0] ?? null),

  /** Public lookup — a failure here must not sign the viewer out. */
  nameByNodeId(nodeId: string): Promise<string | null> {
    const hit = nameCache.get(nodeId);
    if (hit) return hit;
    const p = request('/api/users/getUser', {
      auth: false,
      query: { page: 0, size: 1, filterBy: 'ACTIVE', inputPkId: null, inputFkId: nodeId },
    })
      .then((r) => unwrapList<User>(r).find((u) => u.nodeId === nodeId)?.name || null)
      .catch(() => {
        nameCache.delete(nodeId);
        return null;
      });
    nameCache.set(nodeId, p);
    return p;
  },

  updateStatus: (userPkId: number, activeStatusCode: 'ACTIVE' | 'INACTIVE') =>
    request(`/api/users/updateUserStatus/${userPkId}/${activeStatusCode}`, { method: 'PUT' }),

  updateProfile: (body: {
    userName: string | null;
    email: string | null;
    country: string | null;
    mobile: string | null;
    userNodeId: string | null;
  }) => request('/api/users/updateUserProfile', { method: 'PUT', body }),

  uploadProfileImage: (userNodeId: string, file: PickedFile) => {
    const form = new FormData();
    form.append('file', filePart(file));
    return request<Record<string, any>>('/api/image/uploadUserImage', {
      method: 'POST',
      body: form,
      query: { userNodeId },
      timeoutMs: 60_000,
    });
  },

  /** Generic image upload (product photos). Returns the stored image record. */
  uploadImage: (userNodeId: string, file: PickedFile) => {
    const form = new FormData();
    form.append('file', filePart(file));
    return request<Record<string, any>>('/api/image/upload', {
      method: 'POST',
      body: form,
      query: { userNodeId },
      timeoutMs: 60_000,
    });
  },
};

export const subscriptionApi = {
  list: () =>
    request('/api/users/getSubscriptionDefinition', {
      query: { page: 0, size: 200, filterBy: 'ACTIVE', inputPkId: null, inputFkId: null },
    }).then((r) => unwrapList<SubscriptionDefinition>(r)),
  add: (subscriptionName: string, subscriptionAmount: number) =>
    request('/api/users/addSubscriptionDefinition', {
      method: 'POST',
      body: { subscriptionDefinitionPkId: null, subscriptionName, subscriptionAmount },
    }).then(unwrapFirst),
  update: (id: number, subscriptionName: string, subscriptionAmount: number) =>
    request(`/api/users/updateSubscriptionDefinition/${id}`, {
      method: 'PUT',
      body: { subscriptionName, subscriptionAmount },
    }).then(unwrapFirst),
  remove: (id: number) =>
    request(`/api/users/deleteSubscriptionDefinition/${id}`, { method: 'DELETE', responseType: 'none' }),
};

export const supportApi = {
  list: (userNodeId: string | null) =>
    request('/api/users/getSupportTicket', {
      query: { page: 0, size: 100, filterBy: 'ACTIVE', inputPkId: null, inputFkId: userNodeId },
    }).then((r) => unwrapList<SupportTicket>(r)),
  add: (body: Omit<SupportTicket, 'supportTicketPkId' | 'updatedAtDateTime'> & Record<string, unknown>) =>
    request('/api/users/addSupportTicket', {
      method: 'POST',
      body: { supportTicketPkId: null, updatedAtDateTime: null, ...body },
    }).then(unwrapFirst),
};
