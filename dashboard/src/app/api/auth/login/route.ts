import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const ADMIN_USERNAME = 'admin';
// Use the password from the environment, fallback to a default secure password
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'adminpassword';
const JWT_SECRET = process.env.JWT_SECRET || 'your-analytics-jwt-secret-key-change-in-production';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Missing username or password' }, { status: 400 });
    }

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      // Create JWT token valid for 7 days
      const token = jwt.sign(
        { role: 'admin', user: username },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return NextResponse.json({ token, username });
    }

    return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error during login' }, { status: 500 });
  }
}
