import React from 'react';

interface ScorePanelProps {
  category: string;
  value: number;
  trend: 'up' | 'down' | 'stable';
  lastUpdated: string;
}

const ScorePanel: React.FC<ScorePanelProps> = ({
  category,
  value,
  trend,
  lastUpdated,
}) => {
  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return '↑';
      case 'down':
        return '↓';
      case 'stable':
        return '→';
      default:
        return '';
    }
  };

  const getTrendClass = () => {
    switch (trend) {
      case 'up':
        return 'score-panel__trend--up';
      case 'down':
        return 'score-panel__trend--down';
      case 'stable':
        return 'score-panel__trend--stable';
      default:
        return '';
    }
  };

  const getScoreClass = () => {
    if (value >= 80) return 'score-panel__value--excellent';
    if (value >= 60) return 'score-panel__value--good';
    if (value >= 40) return 'score-panel__value--fair';
    return 'score-panel__value--needs-improvement';
  };

  return (
    <div className="score-panel" data-testid="score-panel">
      <div className="score-panel__header">
        <h3 className="score-panel__category">{category}</h3>
        <span 
          className={`score-panel__trend ${getTrendClass()}`}
          aria-label={`Trend: ${trend}`}
        >
          {getTrendIcon()}
        </span>
      </div>
      
      <div className="score-panel__body">
        <span className={`score-panel__value ${getScoreClass()}`}>
          {value}
        </span>
        <span className="score-panel__unit">/ 100</span>
      </div>

      <div className="score-panel__footer">
        <span className="score-panel__updated">
          Last updated: {lastUpdated}
        </span>
      </div>

      <div 
        className="score-panel__progress"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div 
          className="score-panel__progress-bar"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
};

export default ScorePanel;
