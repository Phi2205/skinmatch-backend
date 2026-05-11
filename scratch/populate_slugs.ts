import { PrismaClient } from '../src/generated/prisma/index.js';

const prisma = new PrismaClient();

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/([^0-9a-z-\s])/g, '')
    .replace(/(\s+)/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

async function main() {
  const products = await prisma.products.findMany({
    where: { slug: null },
  });

  console.log(`Found ${products.length} products without slug.`);

  for (const product of products) {
    const slug = slugify(product.name);
    await prisma.products.update({
      where: { id: product.id },
      data: { slug },
    });
    console.log(`Updated product ${product.id} with slug: ${slug}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
