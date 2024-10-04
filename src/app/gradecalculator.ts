export interface IGradeCalculator {
  getGrade(score: number): number;
}

export class GradeCalculator implements IGradeCalculator {
    private bp: number;
    private ppfh: number;
    private ppfl: number;
  
    constructor(private maxScore: number, private passGrade: number, private passScoreGoal: number, private linear = true) {
      this.bp = (passScoreGoal / 100) * maxScore;
      this.ppfh = (10-passGrade) / (maxScore-this.bp);
      this.ppfl = (passGrade-1) / this.bp;
    }
  
    getGrade(score: number): number {
      if (this.linear || score >= this.bp)
        return Math.max(10 - (this.ppfh*(this.maxScore-score)), 1);
      else
        return 1 + this.ppfl*score;
    }
  }

export class NTermCalculator implements IGradeCalculator {
    constructor(private maxScore: number, private nterm: number) {
  
    }
  
    getGrade(score: number): number {
      if (this.nterm == 1)
        return this.getMainRelation(score);
      else if (this.nterm > 1) {
        return Math.min(this.getMainRelation(score), this.getBorderRelation1(score), this.getBorderRelation4(score))
      } else {
        return Math.max(this.getMainRelation(score), this.getBorderRelation2(score), this.getBorderRelation3(score))
      }
    }
  
    private getMainRelation(score: number): number {
      return 9 * (score / this.maxScore) + this.nterm;
    }
  
    private getBorderRelation1(score: number): number {
      return 1 + score * (9 / this.maxScore) * 2;
    }
  
    private getBorderRelation2(score: number): number {
      return 1 + score * (9 / this.maxScore) * 0.5;
    }
  
    private getBorderRelation3(score: number): number {
      return 10 - (this.maxScore - score) * (9 / this.maxScore) * 2;
    }
  
    private getBorderRelation4(score: number): number {
      return 10 - (this.maxScore - score) * (9 / this.maxScore) * 0.5;
    }
  }