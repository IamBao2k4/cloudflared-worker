export function Slug(data: any, title: string): any {
    let slug = title.toLowerCase(); 
    slug = slug.replace(/[^a-z0-9\s-]/g, '');
    slug = slug.replace(/\s+|-/g, '-');
    slug = slug.replace(/^-|-$/g, '');
    return {
        ...data,
        slug: slug
    };
}