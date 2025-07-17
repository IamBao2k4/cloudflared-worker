import { DateFormatValidateBase } from './base';
import { DateRegexPatterns } from './dateRegexPatterns';

export class ISOStringValidate extends DateFormatValidateBase {
  constructor(date: string) {
    super(date);
  }

  public isValid(): boolean {
    return DateRegexPatterns.isISOStringFormat(this.date);
  }
}

export class DateStringValidate extends DateFormatValidateBase {
  constructor(date: string) {
    super(date);
  }

  public isValid(): boolean {
    return DateRegexPatterns.isDateStringFormat(this.date);
  }
}

export class DateTimeStringValidate extends DateFormatValidateBase {
  constructor(date: string) {
    super(date);
  }

  public isValid(): boolean {
    return DateRegexPatterns.isDateTimeStringFormat(this.date);
  }
}

export class DateNowValidate extends DateFormatValidateBase {
  constructor(date: string) {
    super(date);
  }

  public isValid(): boolean {
    const isValidDateNowPlus = DateRegexPatterns.isDateNowPlusExpression(this.date);
    const isValidDateNowMinus = DateRegexPatterns.isDateNowMinusExpression(this.date);
    return isValidDateNowPlus || isValidDateNowMinus;
  }
}