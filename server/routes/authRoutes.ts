import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { JsonDatabase } from '../services/jsonDatabase.js';
import {
  createSessionToken,
  rateLimitLogin,
  recordFailedLogin,
  resetFailedLogin,
  requireAuth,
} from '../middleware.js';

export const authRouter = Router();
const db = JsonDatabase.getInstance();

// Status check (returns if admin is initialized)
authRouter.get('/status', async (req: Request, res: Response) => {
  try {
    const admins = await db.getAdmins();
    res.json({
      hasAdmin: admins.length > 0,
      adminCount: admins.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Login
authRouter.post('/login', rateLimitLogin, async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    const clientIp = req.ip || 'unknown';

    if (!username || !password) {
      res.status(400).json({ error: 'Username/email and password are required' });
      return;
    }

    const admins = await db.getAdmins();
    const cleanIdentifier = String(username).trim().toLowerCase();

    const admin = admins.find(
      (a) =>
        a.username.toLowerCase() === cleanIdentifier ||
        a.email.toLowerCase() === cleanIdentifier
    );

    if (!admin) {
      recordFailedLogin(clientIp);
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const isMatch = await bcrypt.compare(password, admin.password_hash);
    if (!isMatch) {
      recordFailedLogin(clientIp);
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    resetFailedLogin(clientIp);

    // Update last login
    admin.last_login = new Date().toISOString();
    await db.saveAdmins(admins);

    const token = createSessionToken(admin.id, admin.username);

    // Set cookie
    res.cookie('aevy_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      token,
      user: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        last_login: admin.last_login,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Logout
authRouter.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('aevy_session');
  res.json({ success: true });
});

// Me
authRouter.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const admins = await db.getAdmins();
    const admin = admins.find((a) => a.id === user.userId);

    if (!admin) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      user: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        last_login: admin.last_login,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update Password
authRouter.post('/update-password', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Both current and new password are required' });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters long' });
      return;
    }

    const admins = await db.getAdmins();
    const admin = admins.find((a) => a.id === user.userId);

    if (!admin) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const isMatch = await bcrypt.compare(currentPassword, admin.password_hash);
    if (!isMatch) {
      res.status(400).json({ error: 'Current password is incorrect' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    admin.password_hash = await bcrypt.hash(newPassword, salt);
    await db.saveAdmins(admins);

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
