import { request } from './client';
import type { User } from './types';

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  mobile: string;
  country: string;
  nationalIdType: string;
  nationalId: string;
  referralCode?: string;
  position?: string;
}

export interface RegisterResult {
  success: boolean;
  username?: string;
  message: string;
}

export const authApi = {
  login: (username: string, password: string) =>
    request<{ user?: User; token?: string; message?: string }>('/api/v1/auth/login', {
      method: 'POST',
      auth: false,
      body: { username, password },
    }),

  async register(input: RegisterInput): Promise<RegisterResult> {
    // The API can answer 200 with an error in the body, and returns the generated
    // username as `message` on success — same handling as the website.
    const raw = await request<unknown>('/api/v1/auth/register', {
      method: 'POST',
      auth: false,
      responseType: 'text',
      body: {
        userPkId: null,
        versionId: null,
        about: null,
        referralCode: input.referralCode ?? '',
        position: input.position ?? 'Left',
        ...input,
      },
    });
    let body: Record<string, unknown> = {};
    try {
      body = raw ? JSON.parse(String(raw)) : {};
    } catch {
      body = { message: raw };
    }
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const statusText = String(body.status ?? body.statusCode ?? '').toUpperCase();
    const failed =
      body.success === false ||
      Boolean(body.error) ||
      /FAIL|ERROR|BAD_REQUEST|CONFLICT|^[45]\d\d$/.test(statusText);
    const looksLikeUsername = !!message && /^\S+$/.test(message);

    if (!failed && (looksLikeUsername || !message)) {
      return looksLikeUsername
        ? {
            success: true,
            username: message,
            message: `Registration successful! Your username is: ${message}`,
          }
        : { success: true, message: 'Registration successful!' };
    }
    return {
      success: false,
      message: message || String(body.error || '') || 'Registration failed. Please check your information.',
    };
  },

  /** Sign-up email OTP. The email doubles as the key because no node id exists yet. */
  sendEmailOtp: (email: string) =>
    request('/api/v1/auth/sendEmailOtp', {
      method: 'POST',
      auth: false,
      query: { email, userNodeId: email },
    }),

  async fetchIssuedOtp(email: string): Promise<string> {
    const res = await request<any>('/api/v1/auth/getOtpForVerification', {
      auth: false,
      query: { userNodeId: email },
    });
    const record = res?.response ?? res?.data?.[0] ?? res?.data ?? res;
    const otp =
      typeof record === 'object' && record !== null
        ? record.otp ?? record.oneTimePassword ?? record.id
        : record;
    return otp != null ? String(otp) : '';
  },
};
