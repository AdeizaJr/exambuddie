import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  // A silent fallback here would sign every admin token with a value sitting in this
  // repo — fail loudly at boot instead of quietly issuing forgeable tokens.
  throw new Error('JWT_SECRET must be set in production');
}
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signToken(payload: { id: number; username: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
}

export function verifyToken(token: string): { id: number; username: string } {
  return jwt.verify(token, JWT_SECRET) as { id: number; username: string };
}
