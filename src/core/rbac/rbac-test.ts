import { RbacValidator } from "./rbac-validator";

const rbacValidator = new RbacValidator();

const validCategoryData = {
    title: "Test Category",
    slug: "test-category",
    featured_image: "https://example.com/image.jpg",
    is_landing_page: "active",
    short_description: "This is a test category.",
    long_description: "This is a longer description of the test category.",
    parent: "emc-parent-category",
    session_tags: {
        session_tag_hot: "emc-hot-tag"
    },
    is_root: true,
    bao: "vip pro"
};

console.log('Testing POST validation with valid data:');
console.log(rbacValidator.validateData('emc-category', ["user", "admin"], validCategoryData, 'POST'));

// console.log('\nTesting filterBodyData method:');
// const allowedFields = rbacValidator.getAllowedFields('emc-category', ["admin"], 'POST');
// const filteredData = rbacValidator.validateData('emc-category', ["admin"], validCategoryData, 'POST');

// console.log('\nTesting GET projection schema for emc-category:');
// console.log(rbacValidator.getProjectionSchema('emc-category', ["admin"]));

// const invalidCategoryData = {
//     title: "Invalid Category",
//     slug: "invalid-category",
//     featured_image: "invalid-url",
//     is_landing_page: "inactive", // Invalid value, should be "active"
//     short_description: "This is an invalid category.",
//     long_description: "This is a longer description of the invalid category.",
//     parent: "emc-parent-category",
//     session_tags: {
//         session_tag_hot: "emc-hot-tag"
//     },
//     is_root: true,
//     bao: "vip pro"
// };

// console.log('\nTesting POST validation with invalid data:');
// console.log(rbacValidator.validateData('emc-category', ["admin"], invalidCategoryData, 'POST'));

// // Test delete permission
// console.log('\nTesting DELETE permission:');
// console.log(rbacValidator.hasDeletePermission('emc-category', ["user"]));