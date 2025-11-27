import { Hono } from 'hono';

type Bindings = {
  DB: D1Database;
  STRIPE_WEBHOOK_SECRET: string;
};

interface StripeEvent {
  id: string;
  type: string;
  data: {
    object: {
      id: string;
      amount: number;
      currency: string;
      customer: string;
      status: string;
      metadata?: {
        userId?: string;
      };
    };
  };
}

/**
 * Verifies the Stripe webhook signature using HMAC-SHA256.
 * This ensures the webhook was sent by Stripe and hasn't been tampered with.
 */
async function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  // Parse the signature header
  const elements = signature.split(',');
  const signatureMap: Record<string, string> = {};
  
  for (const element of elements) {
    const [key, value] = element.split('=');
    signatureMap[key] = value;
  }

  const timestamp = signatureMap['t'];
  const v1Signature = signatureMap['v1'];

  if (!timestamp || !v1Signature) {
    return false;
  }

  // Check timestamp to prevent replay attacks (5 minute tolerance)
  const timestampAge = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
  if (timestampAge > 300) {
    return false;
  }

  // Compute expected signature
  const signedPayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(signedPayload);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Use timing-safe comparison
  return expectedSignature === v1Signature;
}

const billingWebhookRoutes = new Hono<{ Bindings: Bindings }>();

// Stripe webhook handler
billingWebhookRoutes.post('/', async (c) => {
  try {
    const signature = c.req.header('stripe-signature');
    
    if (!signature) {
      return c.json({ error: 'Missing Stripe signature' }, 400);
    }

    const rawBody = await c.req.text();
    
    // Verify the webhook signature
    const isValid = await verifyStripeSignature(
      rawBody,
      signature,
      c.env.STRIPE_WEBHOOK_SECRET
    );

    if (!isValid) {
      console.error('Invalid Stripe webhook signature');
      return c.json({ error: 'Invalid signature' }, 401);
    }
    
    const event: StripeEvent = JSON.parse(rawBody);

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        const userId = paymentIntent.metadata?.userId;

        if (userId) {
          const id = crypto.randomUUID();
          await c.env.DB.prepare(
            `INSERT INTO billing_records (id, user_id, amount, currency, status, stripe_payment_id) 
             VALUES (?, ?, ?, ?, 'completed', ?)`
          ).bind(
            id,
            userId,
            paymentIntent.amount,
            paymentIntent.currency,
            paymentIntent.id
          ).run();
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        const userId = paymentIntent.metadata?.userId;

        if (userId) {
          const id = crypto.randomUUID();
          await c.env.DB.prepare(
            `INSERT INTO billing_records (id, user_id, amount, currency, status, stripe_payment_id) 
             VALUES (?, ?, ?, ?, 'failed', ?)`
          ).bind(
            id,
            userId,
            paymentIntent.amount,
            paymentIntent.currency,
            paymentIntent.id
          ).run();
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        // Handle subscription events
        console.log(`Subscription event: ${event.type}`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return c.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return c.json({ error: 'Webhook processing failed' }, 500);
  }
});

// Get billing history for a user
billingWebhookRoutes.get('/history/:userId', async (c) => {
  const userId = c.req.param('userId');

  try {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM billing_records WHERE user_id = ? ORDER BY created_at DESC'
    ).bind(userId).all();

    return c.json({ billingRecords: results });
  } catch (error) {
    return c.json({ error: 'Failed to fetch billing history' }, 500);
  }
});

export default billingWebhookRoutes;
