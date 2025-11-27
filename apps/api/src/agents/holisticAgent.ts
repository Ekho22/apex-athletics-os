/**
 * Holistic Agent for Apex Athletics OS
 * 
 * This agent provides holistic analysis and recommendations for athletes
 * based on their performance data, training history, and wellness metrics.
 */

interface AthleteData {
  userId: string;
  scores: ScoreData[];
  trainingHistory: TrainingSession[];
  wellnessMetrics: WellnessMetric[];
}

interface ScoreData {
  category: string;
  score: number;
  recordedAt: Date;
}

interface TrainingSession {
  id: string;
  type: string;
  duration: number;
  intensity: 'low' | 'medium' | 'high';
  date: Date;
}

interface WellnessMetric {
  type: 'sleep' | 'nutrition' | 'recovery' | 'stress';
  value: number;
  date: Date;
}

interface HolisticAnalysis {
  overallScore: number;
  strengths: string[];
  areasForImprovement: string[];
  recommendations: Recommendation[];
}

interface Recommendation {
  category: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
}

export class HolisticAgent {
  /**
   * Analyze athlete data and provide holistic recommendations
   */
  async analyze(data: AthleteData): Promise<HolisticAnalysis> {
    const categoryScores = this.calculateCategoryScores(data);
    const overallScore = this.calculateOverallScore(categoryScores);
    const strengths = this.identifyStrengths(categoryScores);
    const areasForImprovement = this.identifyWeaknesses(categoryScores);
    const recommendations = this.generateRecommendations(data, categoryScores);

    return {
      overallScore,
      strengths,
      areasForImprovement,
      recommendations,
    };
  }

  private calculateCategoryScores(data: AthleteData): Record<string, number> {
    const scores: Record<string, number[]> = {};

    // Group scores by category
    for (const score of data.scores) {
      if (!scores[score.category]) {
        scores[score.category] = [];
      }
      scores[score.category].push(score.score);
    }

    // Calculate average for each category
    const categoryScores: Record<string, number> = {};
    for (const [category, categoryScoreList] of Object.entries(scores)) {
      const avg = categoryScoreList.reduce((a, b) => a + b, 0) / categoryScoreList.length;
      categoryScores[category] = Math.round(avg * 10) / 10;
    }

    return categoryScores;
  }

  private calculateOverallScore(categoryScores: Record<string, number>): number {
    const scores = Object.values(categoryScores);
    if (scores.length === 0) return 0;
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    return Math.round(avg * 10) / 10;
  }

  private identifyStrengths(categoryScores: Record<string, number>): string[] {
    const threshold = 80;
    return Object.entries(categoryScores)
      .filter(([, score]) => score >= threshold)
      .map(([category]) => category)
      .sort((a, b) => categoryScores[b] - categoryScores[a]);
  }

  private identifyWeaknesses(categoryScores: Record<string, number>): string[] {
    const threshold = 60;
    return Object.entries(categoryScores)
      .filter(([, score]) => score < threshold)
      .map(([category]) => category)
      .sort((a, b) => categoryScores[a] - categoryScores[b]);
  }

  private generateRecommendations(
    data: AthleteData,
    categoryScores: Record<string, number>
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Check for low scores and generate recommendations
    for (const [category, score] of Object.entries(categoryScores)) {
      if (score < 60) {
        recommendations.push({
          category,
          priority: 'high',
          title: `Improve ${category}`,
          description: `Your ${category} score is ${score}. Focus on targeted training to improve this area.`,
        });
      } else if (score < 75) {
        recommendations.push({
          category,
          priority: 'medium',
          title: `Enhance ${category}`,
          description: `Your ${category} score is ${score}. Consistent practice will help you reach the next level.`,
        });
      }
    }

    // Check training consistency
    const recentSessions = data.trainingHistory.filter((session) => {
      const daysSince = (Date.now() - session.date.getTime()) / (1000 * 60 * 60 * 24);
      return daysSince <= 7;
    });

    if (recentSessions.length < 3) {
      recommendations.push({
        category: 'training',
        priority: 'high',
        title: 'Increase Training Frequency',
        description: 'You have had fewer than 3 training sessions this week. Aim for at least 4-5 sessions.',
      });
    }

    // Check wellness metrics
    const recentWellness = data.wellnessMetrics.filter((metric) => {
      const daysSince = (Date.now() - metric.date.getTime()) / (1000 * 60 * 60 * 24);
      return daysSince <= 7;
    });

    const sleepMetrics = recentWellness.filter((m) => m.type === 'sleep');
    if (sleepMetrics.length > 0) {
      const avgSleep = sleepMetrics.reduce((a, b) => a + b.value, 0) / sleepMetrics.length;
      if (avgSleep < 7) {
        recommendations.push({
          category: 'wellness',
          priority: 'high',
          title: 'Improve Sleep Quality',
          description: `Your average sleep is ${avgSleep.toFixed(1)} hours. Aim for 7-9 hours for optimal recovery.`,
        });
      }
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }
}

export default HolisticAgent;
