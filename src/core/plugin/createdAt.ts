import { DateValidate } from "./dateFormatValidate/dateValidate";

export function createdAt(data: any, date: string = new Date(Date.now()).toISOString()): any {
    const dateValidator = new DateValidate(date);
    if(dateValidator.isValidDateFormat()) {
        throw new Error('Invalid date format.');
    }
    
    const dateValue = new Date(eval(date));
    
    date = dateValue.toISOString();

    if (data && typeof data === 'object') {
        if (Array.isArray(data)) {
            return data.map(item => createdAt(item, date));
        } else {
            return {
                ...data,
                createdAt: date,
            };
        }
    }
    return data;
}