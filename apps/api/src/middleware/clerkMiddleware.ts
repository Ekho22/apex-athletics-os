import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';

interface ClerkUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

interface JWK {
  kty: string;
  use?: string;
  kid: string;
  alg?: string;
  n: string;
  e: string;
}

interface JWKS {
  keys: JWK[];
}

interface JWTPayload {
  sub: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  exp?: number;
  iat?: number;
  iss?: string;
  azp?: string;
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

// Cache for JWKS to avoid fetching on every request
let jwksCache: { keys: JWKS; fetchedAt: number } | null = null;
const JWKS_CACHE_TTL = 3600000; // 1 hour

/**
 * Fetches the JWKS (JSON Web Key Set) from Clerk.
 * Uses caching to avoid excessive API calls.
 */
async function getJWKS(issuer: string): Promise<JWKS> {
  const now = Date.now();
  
  if (jwksCache && now - jwksCache.fetchedAt < JWKS_CACHE_TTL) {
    return jwksCache.keys;
  }

  const jwksUrl = `${issuer}/.well-known/jwks.json`;
  const response = await fetch(jwksUrl);
  
  if (!response.ok) {
    throw new Error('Failed to fetch JWKS');
  }

  const jwks = await response.json() as JWKS;
  jwksCache = { keys: jwks, fetchedAt: now };
  
  return jwks;
}

/**
 * Converts a base64url string to an ArrayBuffer.
 */
function base64urlToArrayBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const binaryString = atob(base64 + padding);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Imports an RSA public key from JWK format for verification.
 */
async function importPublicKey(jwk: JWK): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    'jwk',
    {
      kty: jwk.kty,
      n: jwk.n,
      e: jwk.e,
      alg: 'RS256',
      use: 'sig',
    },
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['verify']
  );
}

/**
 * Verifies a Clerk JWT token using the JWKS endpoint.
 * This ensures the token was issued by Clerk and hasn't been tampered with.
 */
async function verifyClerkToken(token: string): Promise<JWTPayload> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  
  // Decode header to get key ID
  const header = JSON.parse(atob(headerB64.replace(/-/g, '+').replace(/_/g, '/')));
  const kid = header.kid;
  
  if (!kid) {
    throw new Error('JWT header missing kid');
  }

  // Decode payload to get issuer
  const payload: JWTPayload = JSON.parse(
    atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))
  );
  
  // Validate expiration
  if (payload.exp && Date.now() >= payload.exp * 1000) {
    throw new Error('Token has expired');
  }

  // Validate issuer - must be a Clerk issuer
  if (!payload.iss || !payload.iss.includes('clerk')) {
    throw new Error('Invalid token issuer');
  }

  // Fetch JWKS and find the matching key
  const jwks = await getJWKS(payload.iss);
  const jwk = jwks.keys.find((k) => k.kid === kid);
  
  if (!jwk) {
    throw new Error('Signing key not found in JWKS');
  }

  // Import the public key and verify the signature
  const publicKey = await importPublicKey(jwk);
  const signatureBytes = base64urlToArrayBuffer(signatureB64);
  const dataBytes = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  
  const isValid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    publicKey,
    signatureBytes,
    dataBytes
  );

  if (!isValid) {
    throw new Error('Invalid token signature');
  }

  return payload;
}

export const clerkMiddleware = () => {
  return createMiddleware<{ Bindings: ClerkBindings }>(async (c, next) => {
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new HTTPException(401, { message: 'Unauthorized: Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7);
    
    try {
      // Verify JWT using Clerk's JWKS endpoint
      const payload = await verifyClerkToken(token);
      
      const user: ClerkUser = {
        id: payload.sub,
        email: payload.email || '',
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
