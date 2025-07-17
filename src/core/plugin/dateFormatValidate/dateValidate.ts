import { DateFormatValidateBase } from "./base";
import { DateStringValidate, DateTimeStringValidate, ISOStringValidate, DateNowValidate } from "./dateFormatValidate";

export class DateValidate {
    private dateValidates: DateFormatValidateBase[];

    constructor(date: string) {
        this.dateValidates = [
            new DateStringValidate(date),
            new DateTimeStringValidate(date),
            new ISOStringValidate(date),
            new DateNowValidate(date)
        ];
    }

    public getDateValidates(): DateFormatValidateBase[] {
        return this.dateValidates;
    }

    public addDateValidate(date: DateFormatValidateBase): void {
        this.dateValidates.push(date);
    }

    public isValidDateFormat(): boolean {
        return this.dateValidates.some(validate => validate.isValid());
    }
}