import { createdAt } from './createdAt';
import { updatedAt } from './updatedAt';

export function timestamp(data: any, date: string = new Date(Date.now()).toISOString()): any {
    const createdData = createdAt(data, date);
    const updatedData = updatedAt(createdData, date);
    return updatedData;
}