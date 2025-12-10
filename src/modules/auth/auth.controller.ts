import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { config } from '@/config/env';
import { AppError } from '@/shared/errors/errorHandler';
import { AuthService } from './auth.service';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './auth.schema';

export class AuthController {
  constructor(private authService: AuthService) {}

  // Register
  async register(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = registerSchema.parse(request.body);
      
      const result = await this.authService.register(data);
      
      // Set refresh token as HTTP-only cookie
      reply.setCookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env['NODE_ENV'] === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
      });

      return reply.status(201).send({
        data: {
          user: result.user,
          accessToken: result.tokens.accessToken,
        },
      });
    } catch (error) {
      console.error('Register error:', error);
      throw error;
    }
  }

  // Login
  async login(request: FastifyRequest, reply: FastifyReply) {
    const data = loginSchema.parse(request.body);
    
    const result = await this.authService.login(data);
    
    // Set refresh token as HTTP-only cookie
    reply.setCookie('refreshToken', result.tokens.refreshToken, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });

    return reply.send({
      data: {
        user: result.user,
        accessToken: result.tokens.accessToken,
      },
    });
  }

  // Refresh token
  async refreshToken(request: FastifyRequest, reply: FastifyReply) {
    const refreshToken = request.cookies['refreshToken'];
    
    if (!refreshToken) {
      return reply.status(401).send({
        error: {
          code: 'REFRESH_TOKEN_MISSING',
          message: 'Không tìm thấy refresh token',
        },
      });
    }

    const data = refreshTokenSchema.parse({ refreshToken });
    const result = await this.authService.refreshToken(data);
    
    // Update refresh token cookie
    reply.setCookie('refreshToken', result.tokens.refreshToken, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });

    return reply.send({
      data: {
        accessToken: result.tokens.accessToken,
      },
    });
  }

  // Logout
  async logout(_request: FastifyRequest, reply: FastifyReply) {
    // Clear refresh token cookie
    reply.clearCookie('refreshToken', {
      path: '/',
    });

    return reply.send({
      data: {
        message: 'Đăng xuất thành công',
      },
    });
  }

  // Change password
  async changePassword(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const data = changePasswordSchema.parse(request.body);
    
    await this.authService.changePassword(userId, data);
    
    return reply.send({
      data: {
        message: 'Đổi mật khẩu thành công',
      },
    });
  }

  // ---- Social login helpers ----

  // Google OAuth - start
  async googleStart(request: FastifyRequest, reply: FastifyReply) {
    if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_CLIENT_SECRET) {
      throw new AppError('Google OAuth chưa được cấu hình', 500, 'GOOGLE_OAUTH_NOT_CONFIGURED');
    }

    const query = request.query as any;
    const mode = query.mode ?? 'popup';
    const action = query.action; // 'login' | 'link'
    const auth_token = query.auth_token;
    
    let userId: string | undefined;

    if (action === 'link') {
        if (!auth_token) {
             throw new AppError('Token bắt buộc để liên kết tài khoản', 401, 'MISSING_AUTH_TOKEN');
        }
        try {
            const payload = jwt.verify(auth_token, config.JWT_SECRET) as any;
            userId = payload.userId;
        } catch {
            throw new AppError('Phiên đăng nhập không hợp lệ', 401, 'INVALID_AUTH_TOKEN');
        }
    }

    const nonce = randomUUID();

    const state = jwt.sign(
      {
        mode,
        nonce,
        provider: 'google',
        action,
        userId
      },
      config.JWT_SECRET,
      { expiresIn: '10m' },
    );

    const params = new URLSearchParams({
      client_id: config.GOOGLE_CLIENT_ID,
      redirect_uri: `${config.API_PUBLIC_URL}/api/auth/google/callback`,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'offline',
      prompt: 'consent',
    });

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    reply.redirect(url);
  }

  // Google OAuth - callback
  async googleCallback(request: FastifyRequest, reply: FastifyReply) {
    const { code, state } = request.query as { code?: string; state?: string };

    if (!code || !state) {
      return reply.redirect(`${config.FRONTEND_ORIGIN}/social-callback?success=false&provider=google&message=${encodeURIComponent('Thiếu mã xác thực từ Google')}`);
    }

    let decoded: any;
    try {
      decoded = jwt.verify(state, config.JWT_SECRET) as any;
    } catch {
      return reply.redirect(`${config.FRONTEND_ORIGIN}/social-callback?success=false&provider=google&message=${encodeURIComponent('Trạng thái đăng nhập không hợp lệ hoặc đã hết hạn')}`);
    }

    if (decoded.provider !== 'google') {
      return reply.redirect(`${config.FRONTEND_ORIGIN}/social-callback?success=false&provider=google&message=${encodeURIComponent('Trạng thái đăng nhập không hợp lệ')}`);
    }

    // Use global fetch (Node 18+)
    const httpFetch: any = (globalThis as any).fetch;

    try {
      // Exchange code for tokens
      const tokenRes = await httpFetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: config.GOOGLE_CLIENT_ID!,
          client_secret: config.GOOGLE_CLIENT_SECRET!,
          code,
          grant_type: 'authorization_code',
          redirect_uri: `${config.API_PUBLIC_URL}/api/auth/google/callback`,
        }).toString(),
      });

      const tokenJson: any = await tokenRes.json();
      if (!tokenRes.ok) {
        throw new Error(tokenJson.error_description || 'Không thể xác thực với Google');
      }

      const idToken = tokenJson.id_token;
      const payload: any = jwt.decode(idToken);

      if (!payload || !payload.email) {
        throw new Error('Google không cung cấp email');
      }

      if (!payload.email_verified) {
        throw new Error('Email Google chưa được xác minh. Vui lòng xác minh email trước khi đăng nhập.');
      }

      if (payload.aud !== config.GOOGLE_CLIENT_ID) {
        throw new Error('Mã xác thực không hợp lệ cho ứng dụng này');
      }

      // Handle Link Account
      if (decoded.action === 'link') {
        if (!decoded.userId) throw new Error('Thông tin người dùng không hợp lệ');
        
        try {
            await this.authService.linkSocialAccount(decoded.userId, {
                provider: 'google',
                providerId: payload.sub as string,
                email: (payload.email as string) || null
            });
            return reply.redirect(`${config.FRONTEND_ORIGIN}/social-callback?success=true&provider=google&action=link`);
        } catch (err: any) {
             return reply.redirect(`${config.FRONTEND_ORIGIN}/social-callback?success=false&provider=google&action=link&message=${encodeURIComponent(err?.message || 'Liên kết thất bại')}`);
        }
      }

      const result = await this.authService.loginOrRegisterSocialUser({
        provider: 'google',
        providerId: payload.sub as string,
        email: payload.email as string,
        emailVerified: true,
        name: (payload.name as string) || null,
        emailFromProvider: true,
      });

      // Set refresh token cookie
      reply.setCookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env['NODE_ENV'] === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
      });

      return reply.redirect(`${config.FRONTEND_ORIGIN}/social-callback?success=true&provider=google`);
    } catch (err: any) {
      return reply.redirect(`${config.FRONTEND_ORIGIN}/social-callback?success=false&provider=google&message=${encodeURIComponent(err?.message || 'Đăng nhập Google thất bại')}`);
    }
  }

  // Facebook OAuth - start
  async facebookStart(request: FastifyRequest, reply: FastifyReply) {
    if (!config.FACEBOOK_CLIENT_ID || !config.FACEBOOK_CLIENT_SECRET) {
      throw new AppError('Facebook OAuth chưa được cấu hình', 500, 'FACEBOOK_OAUTH_NOT_CONFIGURED');
    }

    const mode = (request.query as any)?.mode ?? 'popup';
    const nonce = randomUUID();

    const state = jwt.sign(
      {
        mode,
        nonce,
        provider: 'facebook',
      },
      config.JWT_SECRET,
      { expiresIn: '10m' },
    );

    const params = new URLSearchParams({
      client_id: config.FACEBOOK_CLIENT_ID,
      redirect_uri: `${config.API_PUBLIC_URL}/api/auth/facebook/callback`,
      response_type: 'code',
      scope: 'email,public_profile',
      state,
    });

    const url = `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`;
    reply.redirect(url);
  }

  // Facebook OAuth - callback
  async facebookCallback(request: FastifyRequest, reply: FastifyReply) {
    const { code, state } = request.query as { code?: string; state?: string };

    if (!code || !state) {
      return reply.redirect(`${config.FRONTEND_ORIGIN}/social-callback?success=false&provider=facebook&message=${encodeURIComponent('Thiếu mã xác thực từ Facebook')}`);
    }

    let decoded: any;
    try {
      decoded = jwt.verify(state, config.JWT_SECRET) as any;
    } catch {
      return reply.redirect(`${config.FRONTEND_ORIGIN}/social-callback?success=false&provider=facebook&message=${encodeURIComponent('Trạng thái đăng nhập không hợp lệ hoặc đã hết hạn')}`);
    }

    if (decoded.provider !== 'facebook') {
      return reply.redirect(`${config.FRONTEND_ORIGIN}/social-callback?success=false&provider=facebook&message=${encodeURIComponent('Trạng thái đăng nhập không hợp lệ')}`);
    }

    const httpFetch: any = (globalThis as any).fetch;

    try {
      // Construct URL with query params and request access token
      const url = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
      url.searchParams.set('client_id', config.FACEBOOK_CLIENT_ID!);
      url.searchParams.set('client_secret', config.FACEBOOK_CLIENT_SECRET!);
      url.searchParams.set('redirect_uri', `${config.API_PUBLIC_URL}/api/auth/facebook/callback`);
      url.searchParams.set('code', code);

      const finalRes = await httpFetch(url.toString(), { method: 'GET' });
      const tokenJson: any = await finalRes.json();
      if (!finalRes.ok) {
        throw new Error(tokenJson.error?.message || 'Không thể xác thực với Facebook');
      }

      const accessToken = tokenJson.access_token as string;

      // Lấy profile
      const profileRes = await httpFetch(
        `https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(accessToken)}`,
      );
      const profile: any = await profileRes.json();
      if (!profileRes.ok) {
        throw new Error(profile.error?.message || 'Không thể lấy thông tin người dùng từ Facebook');
      }

      const providerId: string = profile.id;
      const name: string | null = profile.name ?? null;
      const emailFromProvider: string | undefined = profile.email;

      if (emailFromProvider) {
        // Có email từ Facebook -> dùng luôn, cho phép gộp account theo email
        const result = await this.authService.loginOrRegisterSocialUser({
          provider: 'facebook',
          providerId,
          email: emailFromProvider,
          emailVerified: false,
          name,
          emailFromProvider: true,
        });

        reply.setCookie('refreshToken', result.tokens.refreshToken, {
          httpOnly: true,
          secure: process.env['NODE_ENV'] === 'production',
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60 * 1000,
          path: '/',
        });

        return reply.redirect(`${config.FRONTEND_ORIGIN}/social-callback?success=true&provider=facebook`);
      }

      // Không có email -> render form yêu cầu nhập email
      // GIỮ NGUYÊN HTML FORM
      const tokenForComplete = jwt.sign(
        {
          provider: 'facebook',
          providerId,
          name,
        },
        config.JWT_SECRET,
        { expiresIn: '10m' },
      );

      const html = `
<!DOCTYPE html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <title>Nhập email</title>
    <style>
      body { font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif; background: #f9fafb; padding: 24px; }
      .card { max-width: 360px; margin: 40px auto; background: white; border-radius: 12px; padding: 20px; box-shadow: 0 10px 40px rgba(15,23,42,.12); border: 1px solid #e5e7eb; }
      .title { font-size: 18px; font-weight: 600; margin-bottom: 8px; color: #111827; }
      .desc { font-size: 13px; color: #6b7280; margin-bottom: 16px; }
      label { display: block; font-size: 13px; font-weight: 500; margin-bottom: 4px; color: #111827; }
      input[type="email"] { width: 100%; padding: 8px 10px; border-radius: 8px; border: 1px solid #d1d5db; font-size: 14px; box-sizing: border-box; }
      button { margin-top: 14px; width: 100%; padding: 8px 10px; border-radius: 8px; border: none; background: #2563eb; color: white; font-size: 14px; font-weight: 500; cursor: pointer; }
      button:hover { background: #1d4ed8; }
      .error { margin-top: 8px; font-size: 12px; color: #b91c1c; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="title">Nhập email của bạn</div>
      <p class="desc">Facebook không cung cấp email. Vui lòng nhập email để tạo tài khoản JoyWork.</p>
      <form method="POST" action="${config.API_PUBLIC_URL}/api/auth/facebook/complete">
        <input type="hidden" name="token" value="${tokenForComplete}" />
        <label for="email">Email</label>
        <input id="email" name="email" type="email" required placeholder="you@example.com" />
        <button type="submit">Tiếp tục</button>
      </form>
    </div>
  </body>
</html>`;

      reply.type('text/html').send(html);
    } catch (err: any) {
      return reply.redirect(`${config.FRONTEND_ORIGIN}/social-callback?success=false&provider=facebook&message=${encodeURIComponent(err?.message || 'Đăng nhập Facebook thất bại')}`);
    }
  }

  // Facebook - complete when user typed email manually
  async facebookComplete(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as any;
    const token = body?.token as string | undefined;
    const email = (body?.email as string | undefined)?.trim().toLowerCase();

    if (!token || !email) {
      return reply.redirect(`${config.FRONTEND_ORIGIN}/social-callback?success=false&provider=facebook&message=${encodeURIComponent('Thiếu thông tin email hoặc token')}`);
    }

    let payload: any;
    try {
      payload = jwt.verify(token, config.JWT_SECRET) as any;
    } catch {
      return reply.redirect(`${config.FRONTEND_ORIGIN}/social-callback?success=false&provider=facebook&message=${encodeURIComponent('Phiên đăng nhập đã hết hạn. Vui lòng thử lại.')}`);
    }

    if (payload.provider !== 'facebook' || !payload.providerId) {
      return reply.redirect(`${config.FRONTEND_ORIGIN}/social-callback?success=false&provider=facebook&message=${encodeURIComponent('Phiên đăng nhập không hợp lệ.')}`);
    }

    try {
      const result = await this.authService.loginOrRegisterSocialUser({
        provider: 'facebook',
        providerId: payload.providerId as string,
        email,
        emailVerified: false,
        name: (payload.name as string) || null,
        emailFromProvider: false, // email do user tự nhập -> không cho gộp nếu đã tồn tại
      });

      reply.setCookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env['NODE_ENV'] === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
      });

      return reply.redirect(`${config.FRONTEND_ORIGIN}/social-callback?success=true&provider=facebook`);
    } catch (err: any) {
      return reply.redirect(`${config.FRONTEND_ORIGIN}/social-callback?success=false&provider=facebook&message=${encodeURIComponent(err?.message || 'Không thể hoàn tất đăng nhập Facebook')}`);
    }
  }

  // Get current user
  async getMe(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    
    const user = await this.authService.getUserById(userId);
    
    if (!user) {
      return reply.status(404).send({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'Không tìm thấy người dùng',
        },
      });
    }

    return reply.send({
      data: { user },
    });
  }

  // Verify email
  async verifyEmail(request: FastifyRequest, reply: FastifyReply) {
    const { token } = request.query as { token: string };
    
    if (!token) {
      return reply.status(400).send({
        error: {
          code: 'TOKEN_REQUIRED',
          message: 'Mã xác thực là bắt buộc',
        },
      });
    }

    await this.authService.verifyEmail(token);

    return reply.send({
      data: {
        message: 'Email đã được xác thực thành công',
      },
    });
  }

  // Resend verification email
  async resendVerificationEmail(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    
    await this.authService.resendVerificationEmail(userId);

    return reply.send({
      data: {
        message: 'Email xác thực đã được gửi lại',
      },
    });
  }

  // Forgot password
  async forgotPassword(request: FastifyRequest, reply: FastifyReply) {
    const data = forgotPasswordSchema.parse(request.body);
    
    await this.authService.forgotPassword(data);

    // Always return success to prevent email enumeration
    return reply.send({
      data: {
        message: 'Nếu email tồn tại, chúng tôi đã gửi link đặt lại mật khẩu đến email của bạn.',
      },
    });
  }

  // Reset password
  async resetPassword(request: FastifyRequest, reply: FastifyReply) {
    const data = resetPasswordSchema.parse(request.body);
    
    const result = await this.authService.resetPassword(data);
    
    // Set refresh token as HTTP-only cookie
    reply.setCookie('refreshToken', result.tokens.refreshToken, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });

    return reply.send({
      data: {
        message: 'Mật khẩu đã được đặt lại thành công',
        user: result.user,
        accessToken: result.tokens.accessToken,
      },
    });
  }

  // Google One Tap Login
  async googleOneTap(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as { credential?: string };
    const { credential } = body;

    if (!credential) {
      throw new AppError('Thiếu thông tin xác thực từ Google', 400, 'MISSING_CREDENTIAL');
    }

    try {
      // Verify ID Token với Google
      const httpFetch: any = (globalThis as any).fetch;
      const verifyRes = await httpFetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
      const payload = await verifyRes.json();

      if (!verifyRes.ok) {
        throw new Error(payload.error_description || 'Token không hợp lệ');
      }

      // Security check
      if (payload.aud !== config.GOOGLE_CLIENT_ID) {
        throw new Error('Token không được cấp cho ứng dụng này');
      }

      if (!payload.email_verified) {
        throw new Error('Email chưa được xác thực');
      }

      // Login/Register logic (tái sử dụng)
      const result = await this.authService.loginOrRegisterSocialUser({
        provider: 'google',
        providerId: payload.sub,
        email: payload.email,
        emailVerified: true,
        name: payload.name || null,
        emailFromProvider: true,
      });

      // Set cookie
      reply.setCookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env['NODE_ENV'] === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
      });

      return reply.send({
        data: {
          user: result.user,
          accessToken: result.tokens.accessToken,
        },
      });

    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(error.message || 'Đăng nhập Google One Tap thất bại', 401, 'INVALID_TOKEN');
    }
  }

  // Get linked social accounts
  async getLinkedSocialAccounts(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const accounts = await this.authService.getLinkedSocialAccounts(userId);
    
    return reply.send({
      data: { accounts },
    });
  }
}
