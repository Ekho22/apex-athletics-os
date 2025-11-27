import { Hono } from 'hono';

type Bindings = {
  DB: D1Database;
};

interface Job {
  id: string;
  title: string;
  description: string;
  location?: string;
  salaryMin?: number;
  salaryMax?: number;
  postedBy: string;
  status: 'active' | 'closed' | 'draft';
}

interface CreateJobInput {
  title: string;
  description: string;
  location?: string;
  salaryMin?: number;
  salaryMax?: number;
}

const jobBoardRoutes = new Hono<{ Bindings: Bindings }>();

// Get all active jobs
jobBoardRoutes.get('/', async (c) => {
  try {
    const status = c.req.query('status') || 'active';
    
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM jobs WHERE status = ? ORDER BY created_at DESC'
    ).bind(status).all();

    return c.json({ jobs: results });
  } catch (error) {
    return c.json({ error: 'Failed to fetch jobs' }, 500);
  }
});

// Get job by ID
jobBoardRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');

  try {
    const job = await c.env.DB.prepare(
      'SELECT * FROM jobs WHERE id = ?'
    ).bind(id).first();

    if (!job) {
      return c.json({ error: 'Job not found' }, 404);
    }

    return c.json({ job });
  } catch (error) {
    return c.json({ error: 'Failed to fetch job' }, 500);
  }
});

// Create a new job posting
jobBoardRoutes.post('/', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json<CreateJobInput>();
    const id = crypto.randomUUID();

    await c.env.DB.prepare(
      `INSERT INTO jobs (id, title, description, location, salary_min, salary_max, posted_by, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`
    ).bind(
      id,
      body.title,
      body.description,
      body.location || null,
      body.salaryMin || null,
      body.salaryMax || null,
      user.id
    ).run();

    const job = await c.env.DB.prepare(
      'SELECT * FROM jobs WHERE id = ?'
    ).bind(id).first();

    return c.json({ job }, 201);
  } catch (error) {
    return c.json({ error: 'Failed to create job' }, 500);
  }
});

// Update job
jobBoardRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id');

  try {
    const body = await c.req.json<Partial<CreateJobInput> & { status?: string }>();
    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (body.title !== undefined) {
      updates.push('title = ?');
      values.push(body.title);
    }
    if (body.description !== undefined) {
      updates.push('description = ?');
      values.push(body.description);
    }
    if (body.location !== undefined) {
      updates.push('location = ?');
      values.push(body.location);
    }
    if (body.salaryMin !== undefined) {
      updates.push('salary_min = ?');
      values.push(body.salaryMin);
    }
    if (body.salaryMax !== undefined) {
      updates.push('salary_max = ?');
      values.push(body.salaryMax);
    }
    if (body.status !== undefined) {
      updates.push('status = ?');
      values.push(body.status);
    }

    if (updates.length === 0) {
      return c.json({ error: 'No fields to update' }, 400);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    await c.env.DB.prepare(
      `UPDATE jobs SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...values).run();

    const job = await c.env.DB.prepare(
      'SELECT * FROM jobs WHERE id = ?'
    ).bind(id).first();

    return c.json({ job });
  } catch (error) {
    return c.json({ error: 'Failed to update job' }, 500);
  }
});

// Delete job
jobBoardRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');

  try {
    await c.env.DB.prepare('DELETE FROM jobs WHERE id = ?').bind(id).run();
    return c.json({ message: 'Job deleted successfully' });
  } catch (error) {
    return c.json({ error: 'Failed to delete job' }, 500);
  }
});

export default jobBoardRoutes;
