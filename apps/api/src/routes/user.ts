import { Hono } from 'hono';
import { User, CreateUserInput, UpdateUserInput } from '../../../packages/types/user';

type Bindings = {
  DB: D1Database;
};

const userRoutes = new Hono<{ Bindings: Bindings }>();

// Get all users
userRoutes.get('/', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM users ORDER BY created_at DESC'
    ).all();

    return c.json({ users: results });
  } catch (error) {
    return c.json({ error: 'Failed to fetch users' }, 500);
  }
});

// Get user by ID
userRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');

  try {
    const user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).bind(id).first();

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({ user });
  } catch (error) {
    return c.json({ error: 'Failed to fetch user' }, 500);
  }
});

// Create a new user
userRoutes.post('/', async (c) => {
  try {
    const body = await c.req.json<CreateUserInput>();
    const id = crypto.randomUUID();

    await c.env.DB.prepare(
      `INSERT INTO users (id, email, first_name, last_name, role) 
       VALUES (?, ?, ?, ?, ?)`
    ).bind(id, body.email, body.firstName, body.lastName, body.role || 'athlete').run();

    const user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).bind(id).first();

    return c.json({ user }, 201);
  } catch (error) {
    return c.json({ error: 'Failed to create user' }, 500);
  }
});

// Update user
userRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id');

  try {
    const body = await c.req.json<UpdateUserInput>();
    const updates: string[] = [];
    const values: (string | undefined)[] = [];

    if (body.firstName !== undefined) {
      updates.push('first_name = ?');
      values.push(body.firstName);
    }
    if (body.lastName !== undefined) {
      updates.push('last_name = ?');
      values.push(body.lastName);
    }
    if (body.role !== undefined) {
      updates.push('role = ?');
      values.push(body.role);
    }
    if (body.avatar !== undefined) {
      updates.push('avatar = ?');
      values.push(body.avatar);
    }
    if (body.bio !== undefined) {
      updates.push('bio = ?');
      values.push(body.bio);
    }
    if (body.phone !== undefined) {
      updates.push('phone = ?');
      values.push(body.phone);
    }

    if (updates.length === 0) {
      return c.json({ error: 'No fields to update' }, 400);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    await c.env.DB.prepare(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...values).run();

    const user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).bind(id).first();

    return c.json({ user });
  } catch (error) {
    return c.json({ error: 'Failed to update user' }, 500);
  }
});

// Delete user
userRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');

  try {
    await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
    return c.json({ message: 'User deleted successfully' });
  } catch (error) {
    return c.json({ error: 'Failed to delete user' }, 500);
  }
});

// Get user scores
userRoutes.get('/:id/scores', async (c) => {
  const id = c.req.param('id');

  try {
    const { results } = await c.env.DB.prepare(
      `SELECT category, score as value, recorded_at as recordedAt 
       FROM athlete_scores 
       WHERE user_id = ? 
       ORDER BY recorded_at DESC`
    ).bind(id).all();

    // Group scores by category and calculate trends
    const categoryScores: Record<string, { values: number[]; latestDate: string }> = {};
    
    for (const row of results as { category: string; value: number; recordedAt: string }[]) {
      if (!categoryScores[row.category]) {
        categoryScores[row.category] = { values: [], latestDate: row.recordedAt };
      }
      categoryScores[row.category].values.push(row.value);
    }

    const scores = Object.entries(categoryScores).map(([category, data]) => {
      const values = data.values;
      let trend: 'up' | 'down' | 'stable' = 'stable';
      
      if (values.length >= 2) {
        const diff = values[0] - values[1];
        if (diff > 0) trend = 'up';
        else if (diff < 0) trend = 'down';
      }

      return {
        category,
        value: values[0],
        trend,
        lastUpdated: data.latestDate,
      };
    });

    return c.json({ scores });
  } catch (error) {
    return c.json({ error: 'Failed to fetch user scores' }, 500);
  }
});

export default userRoutes;
