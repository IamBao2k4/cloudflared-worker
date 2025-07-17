import { appSettings } from "../configs/app-settings";

interface DynamicLookupConfigDTO {
    _index: string; 
    [fieldPath: string]: string | DynamicLookupConfigDTO;
}

export class QueryHelper {

    async buildLookupPipeline(lookupConfig: DynamicLookupConfigDTO) {

        const pipeline: any[] = [];

        // Track fields that have been processed to avoid duplicate operations
        const processedFields = new Set();

        function processField(fieldPath: string, collectionOrObject: any, parentPath = "") {
            const fullPath = parentPath ? `${parentPath}.${fieldPath}` : fieldPath;

            // Skip if this exact path has already been processed
            if (processedFields.has(fullPath)) {
                return;
            }

            // Handle special case for _index fields
            if (fieldPath === "_index") {
                // Mark this path as processed
                processedFields.add(parentPath);

                const collection = collectionOrObject;

                // Check if field exists first and handle arrays
                pipeline.push({
                    $set: {
                        [parentPath]: {
                            $cond: {
                                if: { $eq: [{ $type: `$${parentPath}` }, "missing"] },
                                then: [],
                                else: `$${parentPath}`
                            }
                        }
                    }
                });

                // Handle array vs single value properly
                pipeline.push({
                    $set: {
                        [parentPath]: {
                            $cond: {
                                if: { $eq: [{ $type: `$${parentPath}` }, "array"] },
                                then: {
                                    $map: {
                                        input: `$${parentPath}`,
                                        as: "item",
                                        in: {
                                            $cond: {
                                                if: { $eq: [{ $type: "$$item" }, "string"] },
                                                then: { $toObjectId: "$$item" },
                                                else: "$$item"
                                            }
                                        }
                                    }
                                },
                                else: {
                                    $cond: {
                                        if: { $eq: [{ $type: `$${parentPath}` }, "string"] },
                                        then: { $toObjectId: `$${parentPath}` },
                                        else: `$${parentPath}`
                                    }
                                }
                            }
                        }
                    }
                });

                // Lookup the reference
                const tempField = `${parentPath.replace(/\./g, '_')}_lookup`;
                pipeline.push({
                    $lookup: {
                        from: collection,
                        localField: parentPath,
                        foreignField: "_id",
                        as: tempField
                    }
                });

                // Replace the reference with the looked up document
                pipeline.push({
                    $set: {
                        [parentPath]: {
                            $cond: {
                                if: { $eq: [{ $type: `$${parentPath}` }, "array"] },
                                then: {
                                    $cond: {
                                        if: { $eq: [{ $size: `$${tempField}` }, 0] },
                                        then: [], // If no lookup results, return empty array
                                        else: `$${tempField}` // Otherwise return the lookup results
                                    }
                                },
                                else: { $arrayElemAt: [`$${tempField}`, 0] }
                            }
                        }
                    }
                });

                // Clean up temp field
                pipeline.push({
                    $unset: tempField
                });

                // Process nested fields if they exist in collectionOrObject
                if (typeof collectionOrObject === "object" && !Array.isArray(collectionOrObject)) {
                    // Get all keys that aren't the _index key itself
                    const nestedFields = Object.entries(collectionOrObject)
                        .filter(([key]) => key !== "_index");

                    // Process each nested field
                    if (nestedFields.length > 0) {
                        nestedFields.forEach(([nestedField, nestedValue]) => {
                            processField(nestedField, nestedValue, parentPath);
                        });
                    }
                }

                return;
            }

            // Handle special case for fields with specific _index marker
            const indexPattern = new RegExp("^_index@(.+)$");
            const indexMatch = typeof fieldPath === "string" ? fieldPath.match(indexPattern) : null;

            if (indexMatch) {
                const targetField = indexMatch[1];
                const fullTargetPath = parentPath ? `${parentPath}.${targetField}` : targetField;

                // Mark this path as processed
                processedFields.add(fullTargetPath);

                const collection = typeof collectionOrObject === 'string'
                    ? collectionOrObject
                    : collectionOrObject._index;

                // First check if parent path exists
                if (parentPath) {
                    pipeline.push({
                        $set: {
                            [parentPath]: {
                                $cond: {
                                    if: { $eq: [{ $type: `$${parentPath}` }, "missing"] },
                                    then: { [targetField]: [] },
                                    else: `$${parentPath}`
                                }
                            }
                        }
                    });
                }

                // Check if field exists, if not, initialize it
                // Properly handle the case where the parent field is an array
                if (parentPath) {
                    pipeline.push({
                        $set: {
                            [parentPath]: {
                                $cond: {
                                    if: { $eq: [{ $type: `$${parentPath}` }, "array"] },
                                    then: {
                                        $map: {
                                            input: `$${parentPath}`,
                                            as: "parentItem",
                                            in: {
                                                $cond: {
                                                    // First check if parentItem is an object before using $mergeObjects
                                                    if: { $eq: [{ $type: "$$parentItem" }, "object"] },
                                                    then: {
                                                        $mergeObjects: [
                                                            "$$parentItem",
                                                            {
                                                                [targetField]: {
                                                                    $cond: {
                                                                        if: { $eq: [{ $type: `$$parentItem.${targetField}` }, "missing"] },
                                                                        then: [],
                                                                        else: `$$parentItem.${targetField}`
                                                                    }
                                                                }
                                                            }
                                                        ]
                                                    },
                                                    else: "$$parentItem" // Return as is if not an object
                                                }
                                            }
                                        }
                                    },
                                    else: {
                                        $cond: {
                                            // Check if parentPath is an object before merging
                                            if: { $eq: [{ $type: `$${parentPath}` }, "object"] },
                                            then: {
                                                $mergeObjects: [
                                                    `$${parentPath}`,
                                                    {
                                                        [targetField]: {
                                                            $cond: {
                                                                if: { $eq: [{ $type: `$${fullTargetPath}` }, "missing"] },
                                                                then: [],
                                                                else: `$${fullTargetPath}`
                                                            }
                                                        }
                                                    }
                                                ]
                                            },
                                            else: `$${parentPath}` // Return as is if not an object
                                        }
                                    }
                                }
                            }
                        }
                    });

                    // Convert any string IDs to ObjectIDs for lookup
                    pipeline.push({
                        $set: {
                            [parentPath]: {
                                $cond: {
                                    if: { $eq: [{ $type: `$${parentPath}` }, "array"] },
                                    then: {
                                        $map: {
                                            input: `$${parentPath}`,
                                            as: "parentItem",
                                            in: {
                                                $cond: {
                                                    if: { $eq: [{ $type: "$$parentItem" }, "object"] },
                                                    then: {
                                                        $mergeObjects: [
                                                            "$$parentItem",
                                                            {
                                                                [targetField]: {
                                                                    $cond: {
                                                                        if: { $eq: [{ $type: `$$parentItem.${targetField}` }, "array"] },
                                                                        then: {
                                                                            $map: {
                                                                                input: `$$parentItem.${targetField}`,
                                                                                as: "item",
                                                                                in: {
                                                                                    $cond: {
                                                                                        if: { $eq: [{ $type: "$$item" }, "string"] },
                                                                                        then: { $toObjectId: "$$item" },
                                                                                        else: "$$item"
                                                                                    }
                                                                                }
                                                                            }
                                                                        },
                                                                        else: {
                                                                            $cond: {
                                                                                if: { $eq: [{ $type: `$$parentItem.${targetField}` }, "string"] },
                                                                                then: { $toObjectId: `$$parentItem.${targetField}` },
                                                                                else: `$$parentItem.${targetField}`
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                        ]
                                                    },
                                                    else: "$$parentItem" // Keep as is if not an object
                                                }
                                            }
                                        }
                                    },
                                    else: {
                                        $cond: {
                                            if: { $eq: [{ $type: `$${parentPath}` }, "object"] },
                                            then: {
                                                $mergeObjects: [
                                                    `$${parentPath}`,
                                                    {
                                                        [targetField]: {
                                                            $cond: {
                                                                if: { $eq: [{ $type: `$${fullTargetPath}` }, "array"] },
                                                                then: {
                                                                    $map: {
                                                                        input: `$${fullTargetPath}`,
                                                                        as: "item",
                                                                        in: {
                                                                            $cond: {
                                                                                if: { $eq: [{ $type: "$$item" }, "string"] },
                                                                                then: { $toObjectId: "$$item" },
                                                                                else: "$$item"
                                                                            }
                                                                        }
                                                                    }
                                                                },
                                                                else: {
                                                                    $cond: {
                                                                        if: { $eq: [{ $type: `$${fullTargetPath}` }, "string"] },
                                                                        then: { $toObjectId: `$${fullTargetPath}` },
                                                                        else: `$${fullTargetPath}`
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                ]
                                            },
                                            else: `$${parentPath}` // Keep as is if not an object
                                        }
                                    }
                                }
                            }
                        }
                    });

                    // Do lookups for each item in array
                    const tempField = `${fullTargetPath.replace(/\./g, '_')}_lookup`;
                    pipeline.push({
                        $lookup: {
                            from: collection,
                            localField: fullTargetPath,
                            foreignField: "_id",
                            as: tempField
                        }
                    });

                    // Update each array item with its lookup results
                    pipeline.push({
                        $set: {
                            [parentPath]: {
                                $cond: {
                                    if: { $eq: [{ $type: `$${parentPath}` }, "array"] },
                                    then: {
                                        $map: {
                                            input: `$${parentPath}`,
                                            as: "parentItem",
                                            in: {
                                                $cond: {
                                                    // Check if parentItem is an object before using $mergeObjects
                                                    if: { $eq: [{ $type: "$$parentItem" }, "object"] },
                                                    then: {
                                                        $mergeObjects: [
                                                            "$$parentItem",
                                                            {
                                                                [targetField]: {
                                                                    $cond: {
                                                                        if: { $eq: [{ $type: `$$parentItem.${targetField}` }, "array"] },
                                                                        then: {
                                                                            $map: {
                                                                                input: `$$parentItem.${targetField}`,
                                                                                as: "targetId",
                                                                                in: {
                                                                                    $arrayElemAt: [
                                                                                        {
                                                                                            $filter: {
                                                                                                input: `$${tempField}`,
                                                                                                as: "lookupDoc",
                                                                                                cond: { $eq: ["$$lookupDoc._id", "$$targetId"] }
                                                                                            }
                                                                                        },
                                                                                        0
                                                                                    ]
                                                                                }
                                                                            }
                                                                        },
                                                                        else: {
                                                                            $arrayElemAt: [
                                                                                {
                                                                                    $filter: {
                                                                                        input: `$${tempField}`,
                                                                                        as: "lookupDoc",
                                                                                        cond: { $eq: ["$$lookupDoc._id", `$$parentItem.${targetField}`] }
                                                                                    }
                                                                                },
                                                                                0
                                                                            ]
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                        ]
                                                    },
                                                    else: "$$parentItem" // Return as is if not an object
                                                }
                                            }
                                        }
                                    },
                                    else: {
                                        $cond: {
                                            if: { $eq: [{ $type: `$${parentPath}` }, "object"] },
                                            then: {
                                                $mergeObjects: [
                                                    `$${parentPath}`,
                                                    {
                                                        [targetField]: {
                                                            $cond: {
                                                                if: { $eq: [{ $type: `$${fullTargetPath}` }, "array"] },
                                                                then: `$${tempField}`,
                                                                else: { $arrayElemAt: [`$${tempField}`, 0] }
                                                            }
                                                        }
                                                    }
                                                ]
                                            },
                                            else: `$${parentPath}` // Return as is if not an object
                                        }
                                    }
                                }
                            }
                        }
                    });

                    // Clean up
                    pipeline.push({
                        $unset: tempField
                    });
                } else {
                    // Original code for non-array parent case
                    // Check if field exists, if not, initialize it as empty array
                    pipeline.push({
                        $set: {
                            [fullTargetPath]: {
                                $cond: {
                                    if: { $eq: [{ $type: `$${fullTargetPath}` }, "missing"] },
                                    then: [],
                                    else: `$${fullTargetPath}`
                                }
                            }
                        }
                    });

                    // Handle both array and single value cases for the field
                    pipeline.push({
                        $set: {
                            [fullTargetPath]: {
                                $cond: {
                                    if: { $eq: [{ $type: `$${fullTargetPath}` }, "array"] },
                                    then: {
                                        $map: {
                                            input: `$${fullTargetPath}`,
                                            as: "item",
                                            in: {
                                                $cond: {
                                                    if: { $eq: [{ $type: "$$item" }, "string"] },
                                                    then: { $toObjectId: "$$item" },
                                                    else: "$$item"
                                                }
                                            }
                                        }
                                    },
                                    else: {
                                        $cond: {
                                            if: { $eq: [{ $type: `$${fullTargetPath}` }, "string"] },
                                            then: { $toObjectId: `$${fullTargetPath}` },
                                            else: `$${fullTargetPath}`
                                        }
                                    }
                                }
                            }
                        }
                    });

                    // Lookup the reference
                    const tempField = `${fullTargetPath.replace(/\./g, '_')}_lookup`;
                    pipeline.push({
                        $lookup: {
                            from: collection,
                            localField: fullTargetPath,
                            foreignField: "_id",
                            as: tempField
                        }
                    });

                    // Replace the reference with the looked up document
                    pipeline.push({
                        $set: {
                            [fullTargetPath]: {
                                $cond: {
                                    if: { $eq: [{ $type: `$${fullTargetPath}` }, "array"] },
                                    then: `$${tempField}`,
                                    else: { $arrayElemAt: [`$${tempField}`, 0] }
                                }
                            }
                        }
                    });

                    // Clean up temp field
                    pipeline.push({
                        $unset: tempField
                    });
                }

                // Process nested fields if they exist in collectionOrObject
                if (typeof collectionOrObject === "object" && !Array.isArray(collectionOrObject)) {
                    // Get all keys that are not _index related
                    const nestedFields = Object.entries(collectionOrObject)
                        .filter(([key]) => !key.startsWith("_index"));

                    // Process each nested field
                    if (nestedFields.length > 0) {
                        nestedFields.forEach(([nestedField, nestedValue]) => {
                            processField(nestedField, nestedValue, fullTargetPath);
                        });
                    }

                    // Also process any _index related keys if they exist
                    // This supports nested _index@field patterns
                    const nestedIndexFields = Object.entries(collectionOrObject)
                        .filter(([key]) => key.startsWith("_index") && key !== "_index");

                    if (nestedIndexFields.length > 0) {
                        nestedIndexFields.forEach(([nestedField, nestedValue]) => {
                            processField(nestedField, nestedValue, fullTargetPath);
                        });
                    }
                }

                return;
            }

            // Handle regular fields - direct string values (collection names)
            if (typeof collectionOrObject === "string") {
                // Mark this path as processed
                processedFields.add(fullPath);

                const collection = collectionOrObject;

                if (fullPath.includes('.')) {
                    const pathParts = fullPath.split('.');
                    const parentField = pathParts[0];
                    const childField = pathParts.slice(1).join('.');

                    // First, ensure that parent field exists
                    pipeline.push({
                        $set: {
                            [parentField]: {
                                $cond: {
                                    if: { $eq: [{ $type: `$${parentField}` }, "missing"] },
                                    then: {},
                                    else: `$${parentField}`
                                }
                            }
                        }
                    });

                    // Handle dot-notation for nested objects inside objects
                    pipeline.push({
                        $set: {
                            [parentField]: {
                                $cond: {
                                    if: { $eq: [{ $type: `$${parentField}` }, "array"] },
                                    then: {
                                        $map: {
                                            input: `$${parentField}`,
                                            as: "item",
                                            in: {
                                                $mergeObjects: [
                                                    "$$item",
                                                    {
                                                        [childField]: {
                                                            $cond: {
                                                                if: { $eq: [{ $type: `$$item.${childField}` }, "string"] },
                                                                then: { $toObjectId: `$$item.${childField}` },
                                                                else: {
                                                                    $cond: {
                                                                        if: { $eq: [{ $type: `$$item.${childField}` }, "missing"] },
                                                                        then: [],
                                                                        else: `$$item.${childField}`
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                ]
                                            }
                                        }
                                    },
                                    else: {
                                        $mergeObjects: [
                                            `$${parentField}`,
                                            {
                                                [childField]: {
                                                    $cond: {
                                                        if: { $eq: [{ $type: `$${parentField}.${childField}` }, "string"] },
                                                        then: { $toObjectId: `$${parentField}.${childField}` },
                                                        else: {
                                                            $cond: {
                                                                if: { $eq: [{ $type: `$${parentField}.${childField}` }, "missing"] },
                                                                then: [],
                                                                else: `$${parentField}.${childField}`
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        ]
                                    }
                                }
                            }
                        }
                    });

                    // Handle arrays inside the child field
                    pipeline.push({
                        $set: {
                            [parentField]: {
                                $cond: {
                                    if: { $eq: [{ $type: `$${parentField}` }, "array"] },
                                    then: {
                                        $map: {
                                            input: `$${parentField}`,
                                            as: "item",
                                            in: {
                                                $mergeObjects: [
                                                    "$$item",
                                                    {
                                                        [childField]: {
                                                            $cond: {
                                                                if: { $eq: [{ $type: `$$item.${childField}` }, "array"] },
                                                                then: {
                                                                    $map: {
                                                                        input: `$$item.${childField}`,
                                                                        as: "subitem",
                                                                        in: {
                                                                            $cond: {
                                                                                if: { $eq: [{ $type: "$$subitem" }, "string"] },
                                                                                then: { $toObjectId: "$$subitem" },
                                                                                else: "$$subitem"
                                                                            }
                                                                        }
                                                                    }
                                                                },
                                                                else: `$$item.${childField}`
                                                            }
                                                        }
                                                    }
                                                ]
                                            }
                                        }
                                    },
                                    else: {
                                        $mergeObjects: [
                                            `$${parentField}`,
                                            {
                                                [childField]: {
                                                    $cond: {
                                                        if: { $eq: [{ $type: `$${parentField}.${childField}` }, "array"] },
                                                        then: {
                                                            $map: {
                                                                input: `$${parentField}.${childField}`,
                                                                as: "subitem",
                                                                in: {
                                                                    $cond: {
                                                                        if: { $eq: [{ $type: "$$subitem" }, "string"] },
                                                                        then: { $toObjectId: "$$subitem" },
                                                                        else: "$$subitem"
                                                                    }
                                                                }
                                                            }
                                                        },
                                                        else: `$${parentField}.${childField}`
                                                    }
                                                }
                                            }
                                        ]
                                    }
                                }
                            }
                        }
                    });

                    // Perform lookup
                    const tempField = `${parentField}_${childField.replace(/\./g, '_')}_lookup`;
                    pipeline.push({
                        $lookup: {
                            from: collection,
                            localField: `${parentField}.${childField}`,
                            foreignField: "_id",
                            as: tempField
                        }
                    });

                    // Set the looked up values back
                    pipeline.push({
                        $set: {
                            [parentField]: {
                                $cond: {
                                    if: { $eq: [{ $type: `$${parentField}` }, "array"] },
                                    then: {
                                        $map: {
                                            input: `$${parentField}`,
                                            as: "item",
                                            in: {
                                                $mergeObjects: [
                                                    "$$item",
                                                    {
                                                        [childField]: {
                                                            $cond: {
                                                                if: { $eq: [{ $type: `$$item.${childField}` }, "array"] },
                                                                then: {
                                                                    $filter: {
                                                                        input: `$${tempField}`,
                                                                        as: "lookupItem",
                                                                        cond: {
                                                                            $in: ["$$lookupItem._id", `$$item.${childField}`]
                                                                        }
                                                                    }
                                                                },
                                                                else: {
                                                                    $arrayElemAt: [
                                                                        {
                                                                            $filter: {
                                                                                input: `$${tempField}`,
                                                                                as: "lookupItem",
                                                                                cond: {
                                                                                    $eq: ["$$lookupItem._id", `$$item.${childField}`]
                                                                                }
                                                                            }
                                                                        },
                                                                        0
                                                                    ]
                                                                }
                                                            }
                                                        }
                                                    }
                                                ]
                                            }
                                        }
                                    },
                                    else: {
                                        $mergeObjects: [
                                            `$${parentField}`,
                                            {
                                                [childField]: {
                                                    $cond: {
                                                        if: { $eq: [{ $type: `$${parentField}.${childField}` }, "array"] },
                                                        then: `$${tempField}`,
                                                        else: { $arrayElemAt: [`$${tempField}`, 0] }
                                                    }
                                                }
                                            }
                                        ]
                                    }
                                }
                            }
                        }
                    });

                    // Clean up
                    pipeline.push({
                        $unset: tempField
                    });
                } else {
                    // Direct field lookup (not nested with dots)
                    // Check if field exists first
                    pipeline.push({
                        $set: {
                            [fullPath]: {
                                $cond: {
                                    if: { $eq: [{ $type: `$${fullPath}` }, "missing"] },
                                    then: [],
                                    else: `$${fullPath}`
                                }
                            }
                        }
                    });

                    pipeline.push({
                        $set: {
                            [fullPath]: {
                                $cond: {
                                    if: { $eq: [{ $type: `$${fullPath}` }, "array"] },
                                    then: {
                                        $map: {
                                            input: `$${fullPath}`,
                                            as: "item",
                                            in: {
                                                $cond: {
                                                    if: { $eq: [{ $type: "$$item" }, "string"] },
                                                    then: { $toObjectId: "$$item" },
                                                    else: "$$item"
                                                }
                                            }
                                        }
                                    },
                                    else: {
                                        $cond: {
                                            if: { $eq: [{ $type: `$${fullPath}` }, "string"] },
                                            then: { $toObjectId: `$${fullPath}` },
                                            else: `$${fullPath}`
                                        }
                                    }
                                }
                            }
                        }
                    });

                    const tempField = `${fullPath.replace(/\./g, '_')}_lookup`;
                    pipeline.push({
                        $lookup: {
                            from: collection,
                            localField: fullPath,
                            foreignField: "_id",
                            as: tempField
                        }
                    });

                    pipeline.push({
                        $unset: tempField
                    });
                }
            } else if (typeof collectionOrObject === "object" && collectionOrObject !== null) {
                // For nested object lookup configurations

                // First, initialize the field path as an object if it doesn't exist
                pipeline.push({
                    $set: {
                        [fullPath]: {
                            $cond: {
                                if: { $eq: [{ $type: `$${fullPath}` }, "missing"] },
                                then: {},
                                else: `$${fullPath}`
                            }
                        }
                    }
                });

                // Process each field inside the object
                Object.entries(collectionOrObject).forEach(([nestedField, nestedValue]) => {
                    processField(nestedField, nestedValue, fullPath);
                });
            }
        }

        // Start processing from the top level
        Object.entries(lookupConfig).forEach(([field, collectionOrObject]) => {
            processField(field, collectionOrObject);
        });

        // Deduplicate and optimize the pipeline
        const optimizedPipeline = [];
        const seenOperations = new Set();

        // Filter out duplicate operations based on string representation
        for (const operation of pipeline) {
            const opString = JSON.stringify(operation);
            if (!seenOperations.has(opString)) {
                optimizedPipeline.push(operation);
                seenOperations.add(opString);
            }
        }

        return optimizedPipeline;
    }

    private async handleReplaceValueInQueryMongodb(query: any, request: any, result_pipeline: any[]) {
        if (!request.jwt) {
            request.jwt = {};
        }
        request.jwt.user = request.headers.user;
        const replaceValue = (value: any) => {
            if (typeof value !== 'string') return value;
            if (!value.startsWith('@')) return value;
            // @header:token
            if (value.startsWith('@header:')) {
                const key = value.substring('@header:'.length);
                return request.headers[key] || undefined;
            }
            // @param:tenant_level
            if (value.startsWith('@param:')) {
                const key = value.substring('@param:'.length);
                return request.query[key] || request.params?.[key] || undefined;
            }
            // @param_boolean:is_active
            if (value.startsWith('@param_boolean:')) {
                const key = value.substring('@param_boolean:'.length);
                const paramValue = request.query[key] || request.params?.[key];
                if (paramValue === 'true' || paramValue === 'false') {
                    return paramValue === 'true';
                } else {
                    return undefined;
                }
            }
            // @param_number:age
            if (value.startsWith('@param_number:')) {
                const key = value.substring('@param_number:'.length);
                const paramValue = request.query[key] || request.params?.[key];
                if (typeof paramValue === 'string') {
                    const numberValue = Number(paramValue);
                    if (isNaN(numberValue)) {
                        throw new Error(`Invalid number format for parameter: ${key}`);
                    }
                    return numberValue;
                } else if (typeof paramValue === 'number') {
                    return paramValue;
                } else {
                    return undefined;
                }
            }
            // @param_array:ids
            if (value.startsWith('@param_array:')) {
                const key = value.substring('@param_array:'.length);
                const paramValue = request.query[key] || request.params?.[key];
                if (typeof paramValue === 'string') {
                    return paramValue.split(',').map((item: string) => item.trim());
                } else if (Array.isArray(paramValue)) {
                    return paramValue;
                } else {
                    return [];
                }
            }
            // @param_array_number:ids
            if (value.startsWith('@param_array_number:')) {
                const key = value.substring('@param_array_number:'.length);
                const paramValue = request.query[key] || request.params?.[key];
                if (typeof paramValue === 'string') {
                    const arr = paramValue.split(',').map((item: string) => Number(item.trim()));
                    if (arr.some(isNaN)) {
                        throw new Error(`Invalid number format for parameter: ${key}`);
                    }
                    return arr;
                } else if (Array.isArray(paramValue)) {
                    const arr = paramValue.map((item: any) => Number(item));
                    if (arr.some(isNaN)) {
                        throw new Error(`Invalid number format for parameter: ${key}`);
                    }
                    return arr;
                } else {
                    return [];
                }
            }
            //@param_array_boolean:list_true_false
            if (value.startsWith('@param_array_boolean:')) {
                const key = value.substring('@param_array_boolean:'.length);
                const paramValue = request.query[key] || request.params?.[key];
                if (typeof paramValue === 'string') {
                    return paramValue.split(',').map((item: string) => item.trim() === 'true');
                } else if (Array.isArray(paramValue)) {
                    return paramValue.map((item: any) => item === true);
                } else {
                    return [];
                }
            }
            // @body:user_id, @body:post.id, @body:post[0].id
            if (value.startsWith('@body:')) {
                const keyPath = value.substring('@body:'.length);
                // Xử lý truy cập đường dẫn lồng nhau (nested paths)
                if (keyPath.includes('.') || keyPath.includes('[')) {
                    return getNestedValue(request.body, keyPath);
                } else {
                    return request.body[keyPath] || undefined;
                }
                // Hàm hỗ trợ lấy giá trị lồng nhau từ object
                function getNestedValue(obj: any, path: string): any {
                    // Chuyển đổi ký hiệu mảng [index] thành .index để dễ xử lý
                    const normalizedPath = path.replace(/\[(\w+)\]/g, '.$1');
                    const parts = normalizedPath.split('.');
                    let value = obj;
                    for (const part of parts) {
                        if (part === '') continue;
                        if (value === null || value === undefined) {
                            return undefined;
                        }
                        // Kiểm tra nếu là số thì xử lý như index của mảng
                        if (/^\d+$/.test(part) && Array.isArray(value)) {
                            const index = parseInt(part, 10);
                            value = value[index];
                        } else {
                            value = value[part];
                        }
                    }

                    return value;
                }
            }
            // @jwt:user@id
            if (value.startsWith('@jwt:')) {
                const key = value.substring('@jwt:'.length);
                // Xử lý trường hợp đặc biệt @jwt:user@id
                if (key.includes('@')) {
                    const parts = key.split('@');
                    if (request.jwt) {
                        return request.jwt[parts[0]]?.[parts[1]] || undefined;
                    }
                    return null;
                }
                return request.jwt ? request.jwt[key] || undefined : undefined;
            }
            // @result_pipeline[0][2]:user[0]._id or @result_pipeline[0][2]:_id
            if (value.startsWith('@result_pipeline')) {
                const key = value.substring('@result_pipeline'.length);
                const parts = key.split(':');
                const arrayPath = parts[0]; // Ví dụ: "[0][2]"
                const indices = [];
                const regex = /\[(\d+)\]/g;
                let match;
                while ((match = regex.exec(arrayPath)) !== null) {
                    indices.push(parseInt(match[1], 10));
                }
                let currentValue = result_pipeline;
                for (const index of indices) {
                    if (currentValue && currentValue[index] !== undefined) {
                        currentValue = currentValue[index];
                    } else {
                        return null; // Không tìm thấy đường dẫn
                    }
                }
                if (parts.length > 1) {
                    const fieldPath = parts[1] as any; // Ví dụ: "user[0]._id" hoặc "_id"
                    if (!fieldPath.includes('[') && !fieldPath.includes('.')) {
                        return currentValue[fieldPath];
                    }
                    return getNestedValue(currentValue, fieldPath);
                }
                return currentValue;
            }
            function getNestedValue(obj: any, path: any) {
                const parts = path.replace(/\[(\w+)\]/g, '.$1').split('.');
                let value = obj;
                for (const part of parts) {
                    if (part === '') continue;
                    if (value === null || value === undefined) return null;
                    value = value[part];
                }
                return value;
            }
            // @app_settings:storage_type
            if (value.startsWith('@app_settings:')) {
                const key = value.substring('@app_settings:'.length);
                const parts = key.split('.');
                let current = appSettings;

                for (const part of parts) {
                    if (current === undefined || current === null || !(part in current)) {
                        return null;
                    }
                    current = current[part as keyof typeof current] as any;
                }
                return current;
            }
            return value;
        };
        const processObject = (obj: any): any => {
            if (obj === null || obj === undefined) return obj;
            if (Array.isArray(obj)) {
                return obj.map(item => processObject(item));
            }
            if (typeof obj === 'object') {
                const result: { [key: string]: any } = {};
                for (const key in obj) {
                    if (Object.prototype.hasOwnProperty.call(obj, key)) {
                        let processedKey = key;
                        if (typeof key === 'string' && key.startsWith('@')) {
                            const replacedKey = replaceValue(key);
                            if (replacedKey !== null && replacedKey !== undefined) {
                                processedKey = replacedKey;
                            }
                        }
                        result[processedKey] = processObject(obj[key]);
                    }
                }
                return result;
            }
            if (typeof obj === 'string' && obj.startsWith('@')) {
                return replaceValue(obj);
            }
            return obj;
        };
        const clonedQuery = JSON.parse(JSON.stringify(query));
        return processObject(clonedQuery);
    }

    private async handleReplaceValueInFacet(request: any) {
        let page = parseInt(request.query['page'] || request.query['skip']) || 1;
        let limit = parseInt(request.query['limit']) || 10;
        request.query.skip = (page - 1) * limit < 0 ? 0 : (page - 1) * limit;
        let template = [
            {
                "$facet": {
                    "meta_data": [
                        {
                            "$count": "count"
                        },
                        {
                            "$addFields": {
                                "skip": request.query.skip + 1,
                                "limit": limit
                            }
                        }
                    ],
                    "data": [
                        {
                            "$skip": request.query.skip
                        },
                        {
                            "$limit": limit
                        }
                    ]
                },
            },
            {
                "$project": {
                    "meta_data": { "$arrayElemAt": ["$meta_data", 0] },
                    "data": 1
                }
            }
        ];
        return template;
    }

    private async removeUndefinedKeyInSort(query: any) {
        // [
        //     { '$match': { '$expr': [Object] } },
        //     {
        //         '$sort': {
        //             created_at: undefined,
        //             updated_at: 1,
        //             title: undefined,
        //             price: undefined, 
        //             session_number: undefined
        //         }
        //     }
        // ]
        // remove field undefined in $sort
        for (const stage of query) {
            if (stage.$sort) {
                // Find all keys with undefined values
                Object.keys(stage.$sort).forEach(key => {
                    if (stage.$sort[key] === undefined) {
                        delete stage.$sort[key];
                    }
                });
            }
        }
        return query;
    }

    async buildQuery(
        query_mongodb_pre_lookup: any,
        query_mongodb_post_lookup: any,
        lookup: any,
        result_pipeline: any[],
        request: any,
        is_use_facet: boolean = false,
    ) {
        query_mongodb_pre_lookup = await this.handleReplaceValueInQueryMongodb(query_mongodb_pre_lookup, request, result_pipeline);
        query_mongodb_post_lookup = await this.handleReplaceValueInQueryMongodb(query_mongodb_post_lookup, request, result_pipeline);
        let query = [...query_mongodb_pre_lookup, ...(await this.buildLookupPipeline(lookup)), ...query_mongodb_post_lookup];
        query = await this.removeUndefinedKeyInSort(query);
        if (is_use_facet) {
            query.push(...(await this.handleReplaceValueInFacet(request)))
        }
        return query;
    }

}