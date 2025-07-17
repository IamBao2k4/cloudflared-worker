export abstract class DateFormatValidateBase {
    protected date: string;

    constructor(date: string) {
        this.date = date;
    }

    public abstract isValid(): boolean;
}