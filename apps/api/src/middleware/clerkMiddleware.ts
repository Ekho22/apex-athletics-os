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

export const clerkMiddleware = () => {
  return createMiddleware(async (c, next) => {
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new HTTPException(401, { message: 'Unauthorized: Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7);
    
    try {
      // In production, verify the token with Clerk's API
      // For now, decode the JWT payload (simplified for development)
      const payload = JSON.parse(atob(token.split('.')[1]));
      
      const user: ClerkUser = {
        id: payload.sub,
        email: payload.email,
        firstName: payload.first_name,
        lastName: payload.last_name,
      };

      c.set('user', user);
      await next();
    } catch (error) {
      throw new HTTPException(401, { message: 'Unauthorized: Invalid token' });
    }
  });
};
