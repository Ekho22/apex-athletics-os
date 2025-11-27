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

const billingWebhookRoutes = new Hono<{ Bindings: Bindings }>();

// Stripe webhook handler
billingWebhookRoutes.post('/', async (c) => {
  try {
    const signature = c.req.header('stripe-signature');
    
    if (!signature) {
      return c.json({ error: 'Missing Stripe signature' }, 400);
    }

    // In production, verify the webhook signature with Stripe
    // const event = stripe.webhooks.constructEvent(body, signature, c.env.STRIPE_WEBHOOK_SECRET);
    
    const event = await c.req.json<StripeEvent>();

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
