import { SchemaValidateFunction, ValidateFunction } from 'ajv/dist/types';
import { KeywordDefinition } from 'ajv';

export const customKeywords: KeywordDefinition[] = [
    // Widget keyword - defines UI component type
    {
        keyword: 'widget',
        type: 'string',
        schemaType: 'string',
        compile: () => {
            return function validate() {
                return true; // Always valid, used for UI rendering only
            };
        }
    },

    // TypeRelation keyword - defines relationship to other collections
    {
        keyword: 'typeRelation',
        type: 'string',
        schemaType: 'object',
        compile: () => {
            return function validate() {
                return true; // Always valid, used for relationship definition
            };
        }
    },

    // CustomRole keyword - defines custom UI behavior
    {
        keyword: 'customRole',
        type: 'string',
        schemaType: 'string',
        compile: () => {
            return function validate() {
                return true; // Always valid, used for UI customization
            };
        }
    },

    // Depend_field keyword - defines field dependencies
    {
        keyword: 'depend_field',
        type: 'string',
        schemaType: 'string',
        compile: () => {
            return function validate() {
                return true; // Always valid, used for field dependencies
            };
        }
    },

    // Filter keyword - defines if field is filterable
    {
        keyword: 'filter',
        type: ['string', 'number', 'boolean', 'object'],
        schemaType: ['boolean', 'object'],
        compile: () => {
            return function validate() {
                return true; // Always valid, used for filter configuration
            };
        }
    },

    // TypeSelect keyword - defines selection type (single/multiple)
    {
        keyword: 'typeSelect',
        type: 'string',
        schemaType: 'string',
        compile: () => {
            return function validate() {
                return true; // Always valid, used for selection type
            };
        }
    },

    // ReturnValue keyword - defines return value format
    {
        keyword: 'returnValue',
        type: ['string', 'number'],
        schemaType: 'number',
        compile: () => {
            return function validate() {
                return true; // Always valid, used for value formatting
            };
        }
    },

    // Choices keyword - defines available choices for select fields
    {
        keyword: 'choices',
        type: ['string', 'number', 'boolean', 'object'],
        schemaType: 'array',
        compile: () => {
            return function validate() {
                return true; // Always valid, used for choice definitions
            };
        }
    },

    // AllowNull keyword - defines if null values are allowed
    {
        keyword: 'allowNull',
        type: ['string', 'number', 'boolean', 'object'],
        schemaType: 'boolean',
        compile: () => {
            return function validate() {
                return true; // Always valid, used for null validation
            };
        }
    },

    // IsMultiple keyword - defines if multiple values are allowed
    {
        keyword: 'isMultiple',
        type: ['string', 'number', 'boolean', 'object'],
        schemaType: 'boolean',
        compile: () => {
            return function validate() {
                return true; // Always valid, used for multiple value handling
            };
        }
    },

    // Placeholder keyword - defines UI placeholder text
    {
        keyword: 'placeholder',
        type: 'string',
        schemaType: 'string',
        compile: () => {
            return function validate() {
                return true; // Always valid, used for UI placeholders
            };
        }
    },

    // Label keyword - defines field labels
    {
        keyword: 'label',
        type: 'string',
        schemaType: 'string',
        compile: () => {
            return function validate() {
                return true; // Always valid, used for field labels
            };
        }
    },

    // Readonly keyword - defines if field is read-only
    {
        keyword: 'readonly',
        type: ['string', 'number', 'boolean', 'object'],
        schemaType: 'boolean',
        compile: () => {
            return function validate() {
                return true; // Always valid, used for read-only fields
            };
        }
    },

    // Required_when keyword - conditional required validation
    {
        keyword: 'required_when',
        type: ['string', 'number', 'boolean', 'object'],
        schemaType: 'object',
        compile: () => {
            return function validate() {
                return true; // Always valid, used for conditional requirements
            };
        }
    },

    // DefaultValue keyword - alternative default value syntax
    {
        keyword: 'defaultValue',
        type: ['string', 'number', 'boolean', 'object', 'array'],
        schemaType: ['string', 'number', 'boolean', 'object', 'array'],
        compile: () => {
            return function validate() {
                return true; // Always valid, used for default values
            };
        }
    },

    // Enum_options keyword - defines enumeration options
    {
        keyword: 'enum_options',
        type: ['string', 'number', 'boolean', 'object'],
        schemaType: 'array',
        compile: () => {
            return function validate() {
                return true; // Always valid, used for enum definitions
            };
        }
    }
];

export function cleanJsonSchema(schema: any): any {
    if (!schema || typeof schema !== 'object') {
        return schema;
    }

    if (Array.isArray(schema)) {
        return schema.map(cleanJsonSchema);
    }

    const cleaned = { ...schema };
    
    // Define the list of custom keyword names to remove
    const keywordsToRemove = [
        'widget', 'typeRelation', 'customRole', 'depend_field', 'filter',
        'typeSelect', 'returnValue', 'choices', 'allowNull',
        'isMultiple', 'placeholder', 'label', 'readonly', 'required_when',
        'defaultValue', 'enum_options'
    ];

    // Remove custom keywords
    keywordsToRemove.forEach(keywordName => {
        if (keywordName in cleaned) {
            delete (cleaned as any)[keywordName];
        }
    });

    // Recursively clean nested objects
    Object.keys(cleaned).forEach(key => {
        if (typeof cleaned[key] === 'object') {
            cleaned[key] = cleanJsonSchema(cleaned[key]);
        }
    });

    return cleaned;
}
