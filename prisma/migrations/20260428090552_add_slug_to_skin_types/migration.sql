/*
  Warnings:

  - The primary key for the `product_skin_types` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `skin_type` on the `product_skin_types` table. All the data in the column will be lost.
  - You are about to drop the column `skin_type` on the `skin_profiles` table. All the data in the column will be lost.
  - Added the required column `skin_type_id` to the `product_skin_types` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "product_skin_types" DROP CONSTRAINT "product_skin_types_pkey",
DROP COLUMN "skin_type",
ADD COLUMN     "skin_type_id" INTEGER NOT NULL,
ADD CONSTRAINT "product_skin_types_pkey" PRIMARY KEY ("product_id", "skin_type_id");

-- AlterTable
ALTER TABLE "skin_profiles" DROP COLUMN "skin_type",
ADD COLUMN     "skin_type_id" INTEGER;

-- CreateTable
CREATE TABLE "skin_types" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "slug" VARCHAR(50) NOT NULL,
    "description" TEXT,

    CONSTRAINT "skin_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "skin_types_name_key" ON "skin_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "skin_types_slug_key" ON "skin_types"("slug");

-- AddForeignKey
ALTER TABLE "product_skin_types" ADD CONSTRAINT "product_skin_types_skin_type_id_fkey" FOREIGN KEY ("skin_type_id") REFERENCES "skin_types"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "skin_profiles" ADD CONSTRAINT "skin_profiles_skin_type_id_fkey" FOREIGN KEY ("skin_type_id") REFERENCES "skin_types"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
