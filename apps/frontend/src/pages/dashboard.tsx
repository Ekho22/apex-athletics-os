import React from 'react';
import ScorePanel from '../components/ScorePanel';

interface DashboardProps {
  userId: string;
}

interface Score {
  category: string;
  value: number;
  trend: 'up' | 'down' | 'stable';
  lastUpdated: string;
}

const Dashboard: React.FC<DashboardProps> = ({ userId }) => {
  const [scores, setScores] = React.useState<Score[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchScores = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/users/${userId}/scores`);
        if (!response.ok) {
          throw new Error('Failed to fetch scores');
        }
        const data = await response.json();
        setScores(data.scores);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchScores();
  }, [userId]);

  if (loading) {
    return (
      <div className="dashboard dashboard--loading">
        <div className="dashboard__spinner" aria-label="Loading dashboard..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard dashboard--error">
        <p className="dashboard__error-message">{error}</p>
        <button 
          className="dashboard__retry-button"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <h1 className="dashboard__title">Athlete Dashboard</h1>
        <p className="dashboard__subtitle">Track your performance and progress</p>
      </header>

      <main className="dashboard__content">
        <section className="dashboard__scores">
          <h2 className="dashboard__section-title">Performance Scores</h2>
          <div className="dashboard__scores-grid">
            {scores.map((score) => (
              <ScorePanel
                key={score.category}
                category={score.category}
                value={score.value}
                trend={score.trend}
                lastUpdated={score.lastUpdated}
              />
            ))}
          </div>
        </section>

        {scores.length === 0 && (
          <div className="dashboard__empty">
            <p>No scores available yet. Complete some assessments to see your progress!</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
