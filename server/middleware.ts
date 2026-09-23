import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const SESSION_SECRET = process.env.SESSION_SECRET || 'aevy_luxury_secure_session_secret_2026';

// Rate limiting maps
const loginAttempts = new Map<string, { count: number; firstAttempt: number }>();
const scanRateLimits = new Map<string, { count: number; resetTime: number }>();

export function createSessionToken(userId: string, username: string): string {
  const payload = {
    userId,
    username,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  };
  const json = JSON.stringify(payload);
  const base64 = Buffer.from(json).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(base64)
    .digest('base64url');
  return `${base64}.${signature}`;
}

export function verifySessionToken(token: string): { userId: string; username: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [base64, signature] = parts;

    const expectedSignature = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(base64)
      .digest('base64url');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(base64, 'base64url').toString('utf-8'));
    if (payload.expiresAt < Date.now()) {
      return null;
    }

    return { userId: payload.userId, username: payload.username };
  } catch {
    return null;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  let token = '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.cookies && req.cookies.aevy_session) {
    token = req.cookies.aevy_session;
  }

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const user = verifySessionToken(token);
  if (!user) {
    res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
    return;
  }

  (req as any).user = user;
  next();
}

export function rateLimitLogin(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 mins
  const maxAttempts = 5;

  const record = loginAttempts.get(ip);
  if (record) {
    if (now - record.firstAttempt > windowMs) {
      loginAttempts.delete(ip);
    } else if (record.count >= maxAttempts) {
      const waitMinutes = Math.ceil((windowMs - (now - record.firstAttempt)) / 60000);
      res.status(429).json({
        error: `Too many login attempts. Please try again in ${waitMinutes} minutes.`,
      });
      return;
    }
  }
  next();
}

export function recordFailedLogin(ip: string) {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now });
  } else {
    record.count += 1;
  }
}

export function resetFailedLogin(ip: string) {
  loginAttempts.delete(ip);
}

export function rateLimitScans(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxScansPerMinute = 120;

  const record = scanRateLimits.get(ip);
  if (!record || now > record.resetTime) {
    scanRateLimits.set(ip, { count: 1, resetTime: now + windowMs });
    return next();
  }

  if (record.count > maxScansPerMinute) {
    res.status(429).send('Too many requests. Please slow down.');
    return;
  }

  record.count += 1;
  next();
}

export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
}
