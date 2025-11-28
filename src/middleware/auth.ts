import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'truenorth-secret-key-2024';

// Extend Express Request to include user info
export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
  };
}

/**
 * Middleware to require authentication
 * Extracts user info from JWT token and adds to request
 */
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Autenticação necessária. Faça login para continuar.' });
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
      req.user = decoded;
      next();
    } catch (jwtError) {
      return res.status(401).json({ error: 'Token inválido ou expirado. Faça login novamente.' });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Erro ao verificar autenticação' });
  }
}

/**
 * Optional auth middleware - extracts user if token present, but doesn't require it
 */
export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
        req.user = decoded;
      } catch {
        // Token invalid, but we don't fail - just proceed without user
      }
    }
    next();
  } catch (error) {
    next();
  }
}
