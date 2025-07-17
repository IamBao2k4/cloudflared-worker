export class DateRegexPatterns {
    static readonly ISO_STRING = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

    static readonly DATE_STRING = /^\d{4}-\d{2}-\d{2}$/;

    static readonly DATE_TIME_STRING = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?$/;

    static readonly DATE_NOW_PLUS = /^Date\.now\(\)\s*\+\s*(\d+(?:\s*[\*\/\+\-]\s*\d+)*)$/;
    static readonly DATE_NOW_MINUS = /^Date\.now\(\)\s*\-\s*(\d+(?:\s*[\*\/\+\-]\s*\d+)*)$/;
    static readonly DATE_NOW_MATH = /^Date\.now\(\)\s*[\+\-]\s*(\d+(?:\s*[\*\/\+\-]\s*\d+)*)$/;

    static isISOStringFormat(input: string): boolean {
        return this.ISO_STRING.test(input);
    }

    static isDateStringFormat(input: string): boolean {
        return this.DATE_STRING.test(input);
    }

    static isDateTimeStringFormat(input: string): boolean {
        return this.DATE_TIME_STRING.test(input);
    }

    static isDateNowPlusExpression(input: string): boolean {
        return this.DATE_NOW_PLUS.test(input);
    }

    static isDateNowMinusExpression(input: string): boolean {
        return this.DATE_NOW_MINUS.test(input);
    }

    static isDateNowMathExpression(input: string): boolean {
        return this.DATE_NOW_MATH.test(input);
    }

    static extractMathExpression(input: string): string | null {
        const match = input.match(this.DATE_NOW_MATH);
        return match ? match[1] : null;
    }

    static getAllPatterns() {
        return {
            ISO_STRING: this.ISO_STRING,
            DATE_STRING: this.DATE_STRING,
            DATE_TIME_STRING: this.DATE_TIME_STRING,
            DATE_NOW_PLUS: this.DATE_NOW_PLUS,
            DATE_NOW_MINUS: this.DATE_NOW_MINUS,
            DATE_NOW_MATH: this.DATE_NOW_MATH
        };
    }

    static evaluateSafeDateExpression(expr: string): number {
        const now = Date.now();
        const safeExpr = expr.replace(/Date\.now\(\)/g, now.toString());

        try {
            return new Function('return ' + safeExpr)();
        } catch (error) {
            throw new Error('Invalid date expression');
        }
    }
}