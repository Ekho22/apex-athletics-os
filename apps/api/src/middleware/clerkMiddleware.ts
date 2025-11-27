import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';

interface ClerkUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

declare module 'hono' {
  interface ContextVariableMap {
    user: ClerkUser;
  }
}

type ClerkBindings = {
  CLERK_SECRET_KEY: string;
  CLERK_PUBLISHABLE_KEY?: string;
};

/**
 * Verifies a Clerk JWT token by calling the Clerk API.
 * This ensures the token was issued by Clerk and is valid.
 */
async function verifyClerkToken(
  token: string,
  secretKey: string
): Promise<{ sub: string; email: string; first_name?: string; last_name?: string }> {
  // Call Clerk's session verification endpoint
  const response = await fetch('https://api.clerk.dev/v1/sessions/verify', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token }),
  });

  if (!response.ok) {
    throw new Error('Token verification failed');
  }

  const session = await response.json();
  
  // Get user details from Clerk
  const userResponse = await fetch(`https://api.clerk.dev/v1/users/${session.user_id}`, {
    headers: {
      'Authorization': `Bearer ${secretKey}`,
    },
  });

  if (!userResponse.ok) {
    throw new Error('Failed to fetch user details');
  }

  const user = await userResponse.json();
  
  return {
    sub: user.id,
    email: user.email_addresses?.[0]?.email_address || '',
    first_name: user.first_name,
    last_name: user.last_name,
  };
}

export const clerkMiddleware = () => {
  return createMiddleware<{ Bindings: ClerkBindings }>(async (c, next) => {
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new HTTPException(401, { message: 'Unauthorized: Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7);
    const secretKey = c.env.CLERK_SECRET_KEY;

    if (!secretKey) {
      console.error('CLERK_SECRET_KEY is not configured');
      throw new HTTPException(500, { message: 'Server configuration error' });
    }
    
    try {
      // Verify token with Clerk's API for secure authentication
      const payload = await verifyClerkToken(token, secretKey);
      
      const user: ClerkUser = {
        id: payload.sub,
        email: payload.email,
        firstName: payload.first_name,
        lastName: payload.last_name,
      };

      c.set('user', user);
      await next();
    } catch (error) {
      console.error('Token verification error:', error);
      throw new HTTPException(401, { message: 'Unauthorized: Invalid token' });
    }
  });
};
