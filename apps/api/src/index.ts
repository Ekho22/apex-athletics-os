import { Hono } from 'hono';
import { clerkMiddleware } from './middleware/clerkMiddleware';
import userRoutes from './routes/user';
import jobBoardRoutes from './routes/jobBoard';
import billingWebhookRoutes from './routes/billingWebhook';

type Bindings = {
  DB: D1Database;
  CLERK_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Apply Clerk middleware to protected routes
app.use('/api/*', clerkMiddleware());

// Mount routes
app.route('/api/users', userRoutes);
app.route('/api/jobs', jobBoardRoutes);
app.route('/webhooks/billing', billingWebhookRoutes);

export default app;
