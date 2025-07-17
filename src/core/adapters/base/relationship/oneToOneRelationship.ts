import { Relationship } from "./mainRelationship";
import { EmbedRequest, JoinCondition } from "./types";

/**
 * One-to-One Relationship
 * Example: User -> Profile
 */
export class OneToOneRelationship extends Relationship {
  generateJoinCondition(): JoinCondition {
    return {
      localField: this.localField,
      foreignField: this.foreignField,
      joinType: 'left' // Default for one-to-one
    };
  }

  generateLookupStage(embedRequest: EmbedRequest): any {
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

  isMultiResult(): boolean {
    return false;
  }
}