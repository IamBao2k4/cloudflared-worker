import { Relationship } from "./mainRelationship";
import { EmbedRequest, JoinCondition, JunctionConfig, RelationshipDefinition } from "./types";

/**
 * Many-to-Many Relationship through junction table
 * Example: Product -> Categories (through product_categories)
 */
export class ManyToManyRelationship extends Relationship {
  private junctionConfig: JunctionConfig | undefined;
  
  constructor(definition: RelationshipDefinition) {
    super(definition);
    // if (!definition.junction) {
    //   throw new Error('Many-to-many relationship requires junction configuration');
    // }
    this.junctionConfig = definition.junction;
  }

  generateJoinCondition(): JoinCondition {
    return {
      localField: this.localField,
      foreignField: this.junctionConfig?.localKey || this.foreignField,
      joinType: 'left'
    };
  }

  generateLookupStage(embedRequest: EmbedRequest): any {
    if (!this.junctionConfig) {
      const pipeline = this.generateBasePipeline(embedRequest);
      return {
      $lookup: {
        from: this.targetTable,
        localField: this.localField,
        foreignField: this.foreignField,
        as: embedRequest.alias || this.name,
        ...(pipeline.length > 0 && { pipeline })
      }
    };
    }
    // First lookup: join with junction table
    const junctionLookup = {
      $lookup: {
        from: this.junctionConfig?.table,
        localField: this.localField,
        foreignField: this.junctionConfig?.localKey,
        as: '_junction'
      }
    };

    // Second lookup: join junction with target table
    const targetLookup = {
      $lookup: {
        from: this.targetTable,
        localField: '_junction.' + this.junctionConfig?.foreignKey,
        foreignField: this.foreignField,
        as: embedRequest.alias || this.name,
        ...(this.generateBasePipeline(embedRequest).length > 0 && { 
          pipeline: this.generateBasePipeline(embedRequest) 
        })
      }
    };

    // Clean up junction field
    const cleanup = {
      $unset: '_junction'
    };

    return [junctionLookup, targetLookup, cleanup];
  }

  isMultiResult(): boolean {
    return true;
  }
}