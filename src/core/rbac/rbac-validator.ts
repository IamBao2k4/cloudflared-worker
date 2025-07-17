import {
    CollectionSchema,
    RbacPermission,
    RbacActionPattern,
    EntitiesSchema,
    RbacCustomField,
    JsonSchema,
} from './rbac-interface'
import * as fs from 'fs';
import * as path from 'path';
import { RbacErrors } from '../errors/errorFactories';
import { error } from 'console';
import Ajv from 'ajv';
import { customKeywords, cleanJsonSchema } from './ajv-custom-keyword';

export class RbacValidator {
    private entitiesSchema: EntitiesSchema | undefined;
    private collectionSchema: CollectionSchema | undefined;
    private rootPath: string = path.join(__dirname, '../../../json/entities/');

    constructor() {
        this.loadConfig();
    }

    public loadConfig(schemaName: string = '_entities'): void {
        const raw = fs.readFileSync(this.rootPath + schemaName + '.json', 'utf-8');
        this.entitiesSchema = JSON.parse(raw);
    }

    public updateConfig(config: EntitiesSchema) {
        this.entitiesSchema = config;
    }

    public hasAccess(
        collectionName: string,
        method: string,
        roles: string[]
    ) {

    }

    private hasPermission(role: RbacPermission, userRoles: string[]): boolean {
        return userRoles.some(r => role[r] !== undefined);
    }

    private getPermission(collectionName: string, userRoles: string[]): RbacPermission | undefined {
        this.getCollectionSchema(collectionName);
        if (!this.collectionSchema) {
            return undefined; // Collection schema not found
        }

        const permission = this.collectionSchema.permission;
        if (!permission) {
            return undefined; // Permission not defined for this collection
        }

        if (!this.hasPermission(permission, userRoles)) {
            return undefined; // User roles do not have permission for this collection
        }

        return permission; // User has permission for this collection
    }

    public getCollectionSchema(collectionName: string): CollectionSchema {
        let collectionSchema: CollectionSchema = {} as CollectionSchema;
        for (const doc of this.entitiesSchema?.documents || []) {
            if (doc.mongodb_collection_name === collectionName) {
                collectionSchema = doc;
                break;
            }
        }

        // Check if collectionSchema was found
        if (!collectionSchema) {
            throw error(`Collection ${collectionName} not found in RBAC configuration.`);
        }

        this.collectionSchema = collectionSchema;
        return this.collectionSchema;
    }

    private convertToFlatSchema(schema: CollectionSchema): string[] {
        const flatFields: string[] = [];

        const flattenProperties = (properties: Record<string, any>, prefix: string = ''): void => {
            for (const [key, value] of Object.entries(properties)) {
                const currentPath = prefix ? `${prefix}.${key}` : key;

                // If this field has type object and properties, then recurse
                if (value.type === 'object' && value.properties) {
                    flattenProperties(value.properties, currentPath);
                } else {
                    // Handle case where array has items as object
                    if (value.type === 'array' && value.items && value.items.type === 'object' && value.items.properties) {
                        flattenProperties(value.items.properties, currentPath);
                    } else {
                        // Add current field to array
                        flatFields.push(currentPath);
                    }
                }
            }
        };

        // Start flattening from root properties
        if (schema.json_schema && schema.json_schema.properties) {
            flattenProperties(schema.json_schema.properties);
        }

        return flatFields;
    }

    // Exclude fields that start with '!' and return the rest
    private filterProjectionFields(fields: string[]): string[] {
        const all_fields = this.convertToFlatSchema(this.collectionSchema!);

        const hasFieldStartWith = (all_fields: string[], fileName: string): boolean => {
            return all_fields.some(field => field.startsWith(fileName));
        }

        const excludeFields: string[] = [];
        fields.forEach(field => {
            if (field.startsWith('!')) {
                const fieldName = field.slice(1);
                if (all_fields.includes(fieldName) || hasFieldStartWith(all_fields, fieldName)) {
                    excludeFields.push(fieldName);
                } else {
                    throw error(`Field ${fieldName} does not exist in the collection schema.`);
                }
            }
        });

        // Function to check if field should be excluded
        const shouldExcludeField = (fieldPath: string, excludeList: string[]): boolean => {

            return excludeList.some(excludePattern => {
                // Remove ! prefix
                const cleanPattern = excludePattern.startsWith('!') ? excludePattern.slice(1) : excludePattern;

                // Check exact match or wildcard match
                return fieldPath === cleanPattern || fieldPath.startsWith(cleanPattern);
            });
        };

        return all_fields.filter(field => {
            return !excludeFields.includes(field) && !fields.includes('!' + field) && !shouldExcludeField(field, excludeFields);
        });
    }

    public getAllowedFields(collectionName: string, userRoles: string[], method: string, parentField?: string, deep: number = 0): string[] {
        if (deep > 1) {
            return []; // Maximum depth exceeded
        }

        const permission = this.getPermission(collectionName, userRoles);

        if (!permission) {
            throw error(`User roles ${userRoles} do not have access to collection ${collectionName}.`);
        }

        const actionPatterns: Array<RbacActionPattern[]> = [];

        userRoles.forEach(r => {
            if (permission[r] !== undefined) actionPatterns.push(permission[r]!)
        })

        if (!actionPatterns) {
            throw error('Acction not found!')
        }

        const METHOD: Set<RbacActionPattern[]> = new Set();

        actionPatterns.forEach(a => {
            METHOD.add(a.filter(ap => ap.action === method))
        })

        // console.log('METHOD', METHOD)

        if (!METHOD) {
            throw error(`No ${method} action defined for user roles ${userRoles} in collection ${collectionName}.`);
        }

        let projectionFields: Set<string> = new Set();

        for(const met of METHOD) {
            for (const m of met){
                if (!m.list_field) {
                    continue;
                }

                m.list_field.split(',').forEach(f => {
                    projectionFields.add(f);
                });
                if (projectionFields.has("*")) {
                    this.convertToFlatSchema(this.collectionSchema!).forEach(f => {
                        projectionFields.add(f);
                    }); // get all

                    // console.log([...projectionFields])
                }

                const hasExclude: boolean = [...projectionFields].some(field => field.startsWith('!'));

                if (hasExclude) {
                    this.filterProjectionFields([...projectionFields]).forEach(f => {
                        projectionFields.add(f);
                    });
                }

                const custom_fields: RbacCustomField[] = m.custom_field || [];
                custom_fields.forEach(customField => {
                    if (customField.relation) {
                        parentField = customField.field
                        this.getAllowedFields(
                            customField.relation,
                            userRoles,
                            method,
                            customField.field,
                            deep + 1
                        ).forEach(field => {
                            if (parentField) {
                                projectionFields.add(`${parentField}.${field}`);
                                // Remove parentField from projectionFields if it was added
                                [...projectionFields].filter(f => f !== parentField).forEach(f => {
                                    projectionFields.add(f);
                                });
                            }
                            else {
                                projectionFields.add(field);
                            }
                        });
                        this.getCollectionSchema(collectionName); // return back to current collection schema
                    }
                });
            }
            
        }
        return [...projectionFields].sort((a, b) => a.localeCompare(b)); // Sort fields alphabetically
    }

    private validateByAJV(schema: JsonSchema, data: any): boolean {
        // Validate data based on this.entitiesSchema.json_schema using AJV
        const ajv = new Ajv({ strict: false, validateFormats: false });

        // Add custom keywords to AJV
        customKeywords.forEach(keyword => {
            ajv.addKeyword(keyword);
        });

        // Clean the schema from custom keywords for standard JSON Schema validation
        const cleanedSchema = cleanJsonSchema(schema);

        const validate = ajv.compile(cleanedSchema);
        const isValid = validate(data);
        if (!isValid) {
            return false;
        }

        return true;
    }

    public filterBodyData(data: any, allowedFields: string[]): any {
        if (!data || typeof data !== 'object') {
            return data;
        }

        const filteredData: any = {};

        // Helper function to set nested property
        const setNestedProperty = (obj: any, path: string, value: any) => {
            const keys = path.split('.');
            let current = obj;

            for (let i = 0; i < keys.length - 1; i++) {
                const key = keys[i];
                if (!(key in current)) {
                    current[key] = {};
                }
                current = current[key];
            }

            current[keys[keys.length - 1]] = value;
        };

        // Helper function to get nested property
        const getNestedProperty = (obj: any, path: string): any => {
            const keys = path.split('.');
            let current = obj;

            for (const key of keys) {
                if (
                    current === null || 
                    current === undefined || 
                    typeof current !== 'object' ||
                    !(key in current) 
                ) {
                    return undefined;
                }
                current = current[key];
            }

            return current;
        };

        // Process each allowed field
        allowedFields.forEach(field => {
            const value = getNestedProperty(data, field);
            if (value !== undefined) {
                setNestedProperty(filteredData, field, value);
            }
        });

        return filteredData;
    }

    private isExecutableJavaScript(functionString: string): boolean {
        // Basic check for JavaScript code patterns
        const jsPatterns = [
            /^console\./,           // console.log, console.error, etc.
            /^function\s*\(/,       // function declarations
            /^[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(/,  // function calls
            /^return\s/,            // return statements
            /^var\s|^let\s|^const\s/, // variable declarations
            /^\{.*\}$/s,            // object literals or code blocks
            /^\(.*\)\s*=>/,         // arrow functions
        ];

        return jsPatterns.some(pattern => pattern.test(functionString.trim()));
    }

    private executeCustomFunction(functionString: string, data: any, fieldName: string): any {
        try {
            const context = {
                data: data,
                field: fieldName,
                fieldValue: data[fieldName],
                console: {
                    log: console.log,
                    warn: console.warn,
                    error: console.error
                },
                Math: Math,
                Date: Date,
                JSON: JSON
            };

            const func = new Function('context', `
                with (context) {
                    ${functionString}
                }
            `);

            return func(context);
        } catch (error) {
            throw new Error(`Custom function execution failed: ${error}`);
        }
    }

    public validateData(collectionName: string, userRoles: string[], data: any, method: 'PUT' | 'POST' | 'PATCH'): any {
        const permission = this.getPermission(collectionName, userRoles);

        if (!permission) {
            throw error(`User roles ${userRoles} do not have access to collection ${collectionName}.`);
        }

        const actionPatterns: Array<RbacActionPattern[]> = [];

        userRoles.forEach(r => {
            if (permission[r] !== undefined) actionPatterns.push(permission[r]!)
        })

        if(!actionPatterns){
            throw error('Acction not found!')
        }

        const METHOD: Set<RbacActionPattern[]> = new Set();

        actionPatterns.forEach(a => {
            METHOD.add(a.filter(ap => ap.action === method))
        })

        if (!METHOD) {
            throw error(`No ${method} action defined for user roles ${userRoles} in collection ${collectionName}.`);
        }

        if (!this.validateByAJV(this.collectionSchema!.json_schema, data)) {
            throw error(`Data validation failed for ${method} ${collectionName}.`);
        }

        const allowedFields: string[] = this.getAllowedFields(collectionName, userRoles, method);

        // Filter data to only include allowed fields
        const filteredData = this.filterBodyData(data, allowedFields);

        METHOD.forEach (method => {
            method.forEach(m => {
                if (m.custom_field && m.custom_field.length > 0) {
                    for (const customField of m.custom_field) {
                        if (customField.pattern) {
                            const regex = new RegExp(customField.pattern);
                            if (!regex.test(filteredData[customField.field])) {
                                throw error(`Data validation failed for ${method} ${collectionName}. Field ${customField.field} does not match pattern ${customField.pattern}.`);
                            }
                            continue;
                        }

                        if (customField.enum) {
                            let fieldValue = filteredData[customField.field];

                            // Convert boolean values to strings for enum comparison
                            if (typeof fieldValue === 'boolean') {
                                fieldValue = fieldValue.toString();
                            }

                            if (!customField.enum.includes(fieldValue)) {
                                throw error(`Data validation failed for ${method} ${collectionName}. Field ${customField.field} must be one of ${customField.enum.join(', ')}.`);
                            }
                            continue;
                        }

                        if (customField.function) {
                            if (this.isExecutableJavaScript(customField.function)) {
                                try {
                                    this.executeCustomFunction(customField.function, data, customField.field);
                                } catch (functionError) {
                                    console.warn('Custom function execution failed:', functionError);
                                }
                            } else {
                            }
                            continue;
                        }
                    }
                }
            })  
        })
        
        return filteredData;
    }

    public hasDeletePermission(collectionName: string, userRoles: string[]): boolean {
        const permission = this.getPermission(collectionName, userRoles);
        if (!permission) {
            return false; // User roles do not have access to this collection
        }

        const actionPatterns: Array<RbacActionPattern[]> = [];

        userRoles.forEach(r => {
            if (permission[r] !== undefined) actionPatterns.push(permission[r]!)
        })

        if (!actionPatterns) {
            throw error('Acction not found!')
        }

        const DELETE: Set<RbacActionPattern[]> = new Set();

        actionPatterns.forEach(a => {
            DELETE.add(a.filter(ap => ap.action === 'DELETE'))
        })

        if (!DELETE) {
            return false;
        }
        return true;
    }
}