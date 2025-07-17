const fs = require("fs");
const path = require("path");
const handlebars = require("handlebars");

// === TỰ VIẾT CÁC HÀM CHUYỂN ĐỔI ===

function camelCase(str: string) {
  return str
    .replace(/[-_ ]+./g, (match) => match.charAt(match.length - 1).toUpperCase())
    .replace(/^[A-Z]/, (m) => m.toLowerCase());
}

function kebabCase(str: string) {
  return str
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/\s+/g, "-")
    .toLowerCase();
}

function lowerCase(str: string) {
  return str.toLowerCase();
}

// === ĐĂNG KÝ VÀO HANDLEBARS ===
handlebars.registerHelper("camelCase", camelCase);
handlebars.registerHelper("kebabCase", kebabCase);
handlebars.registerHelper("lowerCase", lowerCase);

// === DANH SÁCH TEMPLATE ===
const templates = ["route", "controller", "service"];

function generateForEntity(name: string) {
  const context = { name };
  const outputDir = path.join(__dirname, "generated", kebabCase(name));

  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  for (const template of templates) {
    const sourcePath = path.join(__dirname, "templates", `${template}.hbs`);
    const targetPath = path.join(outputDir, `${kebabCase(name)}.${template}.ts`);

    const templateContent = fs.readFileSync(sourcePath, "utf8");
    const compiled = handlebars.compile(templateContent);
    const result = compiled(context);

    fs.writeFileSync(targetPath, result);
    console.log(`✅ Generated: ${targetPath}`);
  }
}

// === GỌI TẠO FILE CHO CÁC ENTITY ===
const collections = ["User", "Product", "Review"];
collections.forEach(generateForEntity);
