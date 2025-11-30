import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, ActivatedRoute, Router } from '@angular/router';
import { FormsModule, ValueChangeEvent } from '@angular/forms';
import { BehaviorSubject, Observable, pipe, Subject } from 'rxjs';
import { debounceTime, tap, map } from 'rxjs/operators';
import { IGradeCalculator, GradeCalculator, NTermCalculator } from '../gradecalculator';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, FormsModule],
  templateUrl: './grades.component.html',
  styleUrl: './grades.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GradesComponent {
  maxScore = 50;
  standardization = "nterm";
  nterm = 1;
  passGrade = 6;
  passScoreGoal = 60;
  showCorrect = true;
  showErrors = false;
  halves = false;
  copyButtonText = "Kopieer naar klembord";

  private settings$ = new Subject<GradeSettings>();
  grades$: Observable<Grade[][]>;
  private flatGrades: Grade[] = [];
  private _isLoading = new BehaviorSubject(false);
  isLoading$ = this._isLoading.asObservable();

  constructor(private router: Router, private activatedRoute: ActivatedRoute, private cdr: ChangeDetectorRef) {
    this.grades$ = this.settings$.pipe(
      tap(x => { this._isLoading.next(true) }),
      debounceTime(500),
      map(GradesComponent.calculateGrades),
      tap(grades => { this.flatGrades = grades; }),
      map(g => GradesComponent.sliceArray(g, 4)),
      tap(x => { this._isLoading.next(false); }),
    );
  }

  ngOnInit() {
    this.standardization = this.activatedRoute.snapshot.queryParamMap.get("standardization") ?? "nterm";
    
    var maxScore = parseInt(this.activatedRoute.snapshot.queryParamMap.get("maxScore") ?? "");
    if (!isNaN(maxScore))
      this.maxScore = maxScore;

    var nterm = parseFloat(this.activatedRoute.snapshot.queryParamMap.get("nterm") ?? "");
    if (!isNaN(nterm))
      this.nterm = nterm;

    var passGrade = parseFloat(this.activatedRoute.snapshot.queryParamMap.get("passGrade") ?? "");
    if (!isNaN(passGrade))
      this.nterm = passGrade;

    var passScoreGoal = parseFloat(this.activatedRoute.snapshot.queryParamMap.get("passScoreGoal") ?? "");
    if (!isNaN(passScoreGoal))
      this.nterm = passScoreGoal;

    var halves = this.activatedRoute.snapshot.queryParamMap.get("halves") ?? "";
    if (halves)
      this.halves = true;

    var show = this.activatedRoute.snapshot.queryParamMap.get("show");
    switch (show) {
      case "errors":
        this.showErrors = true;
        this.showCorrect = false;
        break;
      case "both":
        this.showErrors = true;
        this.showCorrect = true;
        break;
      default:
        this.showErrors = false;
        this.showCorrect = true;
    }
  }

  ngAfterViewInit() {
    this.settings$.next({
      standardization: this.standardization,
      maxScore: this.maxScore,
      nterm: this.nterm,
      passGrade: this.passGrade,
      passScoreGoal: this.passScoreGoal,
      step: this.halves ? 0.5 : 1
    });
  }

  onChanges() {
    this.settings$.next({
      standardization: this.standardization,
      maxScore: this.maxScore,
      nterm: this.nterm,
      passGrade: this.passGrade,
      passScoreGoal: this.passScoreGoal,
      step: this.halves ? 0.5 : 1
    });

    this.router.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams: {
        standardization: this.standardization,
        maxScore: this.maxScore,
        nterm: this.standardization == "nterm" ? this.nterm : null,
        passGrade: this.standardization != "nterm" ? this.passGrade : null,
        passScoreGoal: this.standardization != "nterm" ? this.passScoreGoal : null,
        show: this.showErrors ? (this.showCorrect ? "both" : "errors") : null,
        halves: this.halves ? this.halves : null
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
    var calculator = GradesComponent.getCalculator(settings);
    
    var s = [];

    for (var i = settings.maxScore; i >= 0; i -= settings.step) {
      s.push({ 
        score: i, 
        errors: settings.maxScore - i,
        grade: calculator.getGrade(i)
      })
    };

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

  async copyToClipboard() {
    if (this.flatGrades.length === 0) {
      console.warn('No grades to copy');
      return;
    }

    const html = this.generateHtmlTable();
    const plainText = this.generatePlainText();

    try {
      // Use modern Clipboard API with explicit MIME types
      const htmlBlob = new Blob([html], { type: 'text/html' });
      const textBlob = new Blob([plainText], { type: 'text/plain' });

      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': htmlBlob,
          'text/plain': textBlob
        })
      ]);
      this.copyButtonText = "Gekopieerd!";
      this.cdr.markForCheck();
    } catch (err) {
      console.error('Clipboard API failed, trying fallback:', err);
      // Fallback using execCommand
      const container = document.createElement('div');
      container.innerHTML = html;
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      document.body.appendChild(container);

      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(container);
      selection?.removeAllRanges();
      selection?.addRange(range);

      try {
        document.execCommand('copy');
        this.copyButtonText = "Gekopieerd!";
      } catch (err2) {
        console.error('Copy failed:', err2);
        await navigator.clipboard.writeText(plainText);
        this.copyButtonText = "Gekopieerd!";
      }

      selection?.removeAllRanges();
      document.body.removeChild(container);
    }

    setTimeout(() => {
      this.copyButtonText = "Kopieer naar klembord";
      this.cdr.markForCheck();
    }, 5000);
  }

  private generateHtmlTable(): string {
    const columns = GradesComponent.sliceArray(this.flatGrades, 4);
    const maxRows = Math.max(...columns.map(c => c.length));
    const borderStyle = 'border-bottom:1px solid #dee2e6;';
    const cellStyleRight = `${borderStyle}padding:4px 8px;text-align:right;`;
    const cellStyleLeft = `${borderStyle}padding:4px 8px;text-align:left;`;
    const separatorStyle = 'width:16px;';

    // Use Word-compatible HTML with proper namespace
    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
      <head><style>td,th{mso-number-format:"\\@";}</style></head><body>`;

    // Add summary
    html += '<p>';
    html += `Aantal punten: ${this.maxScore}, `;
    if (this.standardization === 'nterm') {
      html += `N-Term: ${this.formatGrade(this.nterm)}`;
    } else {
      html += `voldoende: ${this.formatGrade(this.passGrade)}, percentage voor voldoende: ${this.passScoreGoal}%`;
    }
    html += '</p>';
    html += '<table style="border-collapse:collapse;">';

    // Header row - repeat for each column
    html += '<tr>';
    for (let col = 0; col < 4; col++) {
      if (col > 0) html += `<th style="${separatorStyle}"></th>`; // separator
      if (this.showCorrect) html += `<th style="${cellStyleRight}" align="right">#Goed</th>`;
      if (this.showErrors) html += `<th style="${cellStyleRight}" align="right">#Fout</th>`;
      html += `<th style="${cellStyleLeft}" align="left">Cijfer</th>`;
    }
    html += '</tr>';

    // Data rows
    for (let row = 0; row < maxRows; row++) {
      html += '<tr>';
      for (let col = 0; col < 4; col++) {
        if (col > 0) html += `<td style="${separatorStyle}"></td>`; // separator
        const grade = columns[col]?.[row];
        if (grade) {
          const isBold = this.showCorrect ? grade.score % 10 === 0 : grade.errors % 10 === 0;
          const boldStart = isBold ? '<b>' : '';
          const boldEnd = isBold ? '</b>' : '';
          if (this.showCorrect) html += `<td style="${cellStyleRight}" align="right">${boldStart}${grade.score}${boldEnd}</td>`;
          if (this.showErrors) html += `<td style="${cellStyleRight}" align="right">${boldStart}${grade.errors}${boldEnd}</td>`;
          html += `<td style="${cellStyleLeft}" align="left">${boldStart}${this.formatGrade(grade.grade)}${boldEnd}</td>`;
        } else {
          // Empty cells for uneven columns
          if (this.showCorrect) html += '<td></td>';
          if (this.showErrors) html += '<td></td>';
          html += '<td></td>';
        }
      }
      html += '</tr>';
    }

    html += '</table></body></html>';
    return html;
  }

  private generatePlainText(): string {
    const columns = GradesComponent.sliceArray(this.flatGrades, 4);
    const maxRows = Math.max(...columns.map(c => c.length));
    let lines: string[] = [];

    // Add summary
    let summary = `Aantal punten: ${this.maxScore}, `;
    if (this.standardization === 'nterm') {
      summary += `N-Term: ${this.formatGrade(this.nterm)}`;
    } else {
      summary += `voldoende: ${this.formatGrade(this.passGrade)}, percentage voor voldoende: ${this.passScoreGoal}%`;
    }
    lines.push(summary);
    lines.push(''); // empty line before table

    // Calculate column widths
    const scoreWidth = Math.max(5, this.maxScore.toString().length); // min 5 for "#Goed"
    const errorWidth = Math.max(5, this.maxScore.toString().length); // min 5 for "#Fout"
    const gradeWidth = 6; // "Cijfer" or "10,0"

    const padLeft = (str: string, width: number) => str.padStart(width);
    const padRight = (str: string, width: number) => str.padEnd(width);

    // Header row - repeat for each column
    let header: string[] = [];
    for (let col = 0; col < 4; col++) {
      if (col > 0) header.push('  '); // separator between column groups
      if (this.showCorrect) header.push(padLeft('#Goed', scoreWidth));
      if (this.showErrors) header.push(padLeft('#Fout', errorWidth));
      header.push(padRight('Cijfer', gradeWidth));
    }
    lines.push(header.join(' '));

    // Data rows
    for (let row = 0; row < maxRows; row++) {
      let rowData: string[] = [];
      for (let col = 0; col < 4; col++) {
        if (col > 0) rowData.push('  '); // separator between column groups
        const grade = columns[col]?.[row];
        if (grade) {
          if (this.showCorrect) rowData.push(padLeft(grade.score.toString(), scoreWidth));
          if (this.showErrors) rowData.push(padLeft(grade.errors.toString(), errorWidth));
          rowData.push(padRight(this.formatGrade(grade.grade), gradeWidth));
        } else {
          if (this.showCorrect) rowData.push(padLeft('', scoreWidth));
          if (this.showErrors) rowData.push(padLeft('', errorWidth));
          rowData.push(padRight('', gradeWidth));
        }
      }
      lines.push(rowData.join(' '));
    }

    return lines.join('\n');
  }

  private formatGrade(grade: number): string {
    return grade.toFixed(1).replace('.', ',');
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
  step: number;
}