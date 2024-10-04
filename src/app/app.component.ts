import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Observable, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, map } from 'rxjs/operators';
import { IGradeCalculator, GradeCalculator, NTermCalculator } from './gradecalculator';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  maxScore = 50;
  standardization = "nterm";
  nterm = 1;
  passGrade = 6;
  passScoreGoal = 60;
  showCorrect = true;

  settings$ = new Subject<GradeSettings>();
  grades$: Observable<Grade[][]>;

  constructor(private router: Router, private activatedRoute: ActivatedRoute) {
    this.grades$ = this.settings$.pipe(
      debounceTime(300),
      map(AppComponent.calculateGrades),
      map(g => AppComponent.sliceArray(g, 4))
    );
  }

  ngOnInit() {
    
  }

  ngAfterViewInit() {
    this.standardization = this.activatedRoute.snapshot.queryParamMap.get("standardization") ?? "nterm";
    
    var maxScore = parseInt(this.activatedRoute.snapshot.queryParamMap.get("maxScore") ?? "");
    if (!isNaN(maxScore))
      this.maxScore = maxScore;

    console.log(this.activatedRoute.snapshot.queryParamMap.get("maxScore"));

    var nterm = parseFloat(this.activatedRoute.snapshot.queryParamMap.get("nterm") ?? "");
    if (!isNaN(nterm))
      this.nterm = nterm;

    var passGrade = parseFloat(this.activatedRoute.snapshot.queryParamMap.get("passGrade") ?? "");
    if (!isNaN(passGrade))
      this.nterm = passGrade;

    var passScoreGoal = parseFloat(this.activatedRoute.snapshot.queryParamMap.get("passScoreGoal") ?? "");
    if (!isNaN(passScoreGoal))
      this.nterm = passScoreGoal;

    this.settings$.next({
      standardization: this.standardization,
      maxScore: this.maxScore,
      nterm: this.nterm,
      passGrade: this.passGrade,
      passScoreGoal: this.passScoreGoal
    });
  }

  onChanges() {
    this.settings$.next({
      standardization: this.standardization,
      maxScore: this.maxScore,
      nterm: this.nterm,
      passGrade: this.passGrade,
      passScoreGoal: this.passScoreGoal
    });

    this.router.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams: {
        standardization: this.standardization,
        maxScore: this.maxScore,
        nterm: this.standardization == "nterm" ? this.nterm : null,
        passGrade: this.standardization != "nterm" ? this.passGrade : null,
        passScoreGoal: this.standardization != "nterm" ? this.passScoreGoal : null,       
      },
      replaceUrl: true      
    });
  }

  private static getCalculator(settings: GradeSettings) : IGradeCalculator {
    if (settings.standardization == "nterm")
      return new NTermCalculator(settings.maxScore, settings.nterm);
    if (settings.standardization == "linear")
      return new GradeCalculator(settings.maxScore, settings.passGrade, settings.passScoreGoal, true);
    if (settings.standardization == "nonlinear")
      return new GradeCalculator(settings.maxScore, settings.passGrade, settings.passScoreGoal, false);

    throw new Error("Unknown standardization");
  }

  private static calculateGrades(settings: GradeSettings): Grade[] {
    var calculator = AppComponent.getCalculator(settings);
    
    var s = [... Array(settings.maxScore+1).keys()]
      .reverse()
      .map((i: number) => {
        return { 
          score: i, 
          errors: settings.maxScore - i,
          grade: calculator.getGrade(i)
        }
    });

    return s;
  }

  private static sliceArray(grades: Grade[], cols: number): Grade[][] {
    var chunckSize = Math.ceil(grades.length / cols);
    var resultArray: Grade[][] = [];

    for (var i = 0; i < grades.length; i++) {
      const chunkIndex = Math.floor(i/chunckSize);

      if(!resultArray[chunkIndex]) {
        resultArray[chunkIndex] = [] // start a new chunk
      }

      resultArray[chunkIndex].push(grades[i]);
    }
    
    return resultArray;;
  }
}

type Grade = {
  score: number;
  errors: number;
  grade: number;
}

type GradeSettings = {
  maxScore: number;
  standardization: string;
  nterm: number;
  passGrade: number;
  passScoreGoal: number;
}