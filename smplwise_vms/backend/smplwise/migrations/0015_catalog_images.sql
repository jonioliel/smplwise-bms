-- A photo per site and per building (R1 from the owner's test round): stored under /data/catalog_images, JPEG.
ALTER TABLE sites ADD COLUMN image_path TEXT;
ALTER TABLE buildings ADD COLUMN image_path TEXT;
