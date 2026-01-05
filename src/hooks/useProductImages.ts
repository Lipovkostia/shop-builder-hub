import { supabase } from "@/integrations/supabase/client";

export interface ImageUploadResult {
  url: string;
  path: string;
}

/**
 * Upload a base64 image to Supabase Storage and return the public URL
 */
export const uploadImageToStorage = async (
  base64Data: string,
  productId: string,
  imageIndex: number
): Promise<ImageUploadResult | null> => {
  try {
    // Extract the actual base64 data and content type
    const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      console.warn("Invalid base64 format");
      return null;
    }

    const contentType = matches[1];
    const base64Content = matches[2];
    
    // Convert base64 to Uint8Array
    const binaryString = atob(base64Content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Determine file extension
    const ext = contentType.split("/")[1] || "jpg";
    const fileName = `${productId}/${imageIndex}.${ext}`;

    // Upload to storage
    const { data, error } = await supabase.storage
      .from("product-images")
      .upload(fileName, bytes, {
        contentType,
        upsert: true,
      });

    if (error) {
      console.error("Error uploading image:", error);
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("product-images")
      .getPublicUrl(fileName);

    return {
      url: urlData.publicUrl,
      path: fileName,
    };
  } catch (err) {
    console.error("Error in uploadImageToStorage:", err);
    return null;
  }
};

/**
 * Upload multiple base64 images and return their public URLs
 */
export const uploadProductImages = async (
  base64Images: string[],
  productId: string
): Promise<string[]> => {
  const uploadPromises = base64Images.map((base64, index) =>
    uploadImageToStorage(base64, productId, index)
  );

  const results = await Promise.all(uploadPromises);
  return results.filter((r): r is ImageUploadResult => r !== null).map((r) => r.url);
};

/**
 * Delete all images for a product from storage
 */
export const deleteProductImages = async (productId: string): Promise<void> => {
  try {
    const { data: files } = await supabase.storage
      .from("product-images")
      .list(productId);

    if (files && files.length > 0) {
      const filePaths = files.map((f) => `${productId}/${f.name}`);
      await supabase.storage.from("product-images").remove(filePaths);
    }
  } catch (err) {
    console.error("Error deleting product images:", err);
  }
};

/**
 * Delete a single image from storage by its URL
 */
export const deleteSingleImage = async (imageUrl: string): Promise<boolean> => {
  try {
    // Extract the path from the URL
    // URL format: https://xxx.supabase.co/storage/v1/object/public/product-images/productId/index.ext
    const urlParts = imageUrl.split('/product-images/');
    if (urlParts.length < 2) {
      console.warn("Could not extract path from image URL:", imageUrl);
      return false;
    }
    
    const filePath = urlParts[1];
    const { error } = await supabase.storage
      .from("product-images")
      .remove([filePath]);

    if (error) {
      console.error("Error deleting image:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Error in deleteSingleImage:", err);
    return false;
  }
};

/**
 * Upload a File object to Supabase Storage and return the public URL
 */
export const uploadFileToStorage = async (
  file: File,
  productId: string,
  imageIndex: number
): Promise<ImageUploadResult | null> => {
  try {
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `${productId}/${Date.now()}_${imageIndex}.${ext}`;

    const { data, error } = await supabase.storage
      .from("product-images")
      .upload(fileName, file, {
        contentType: file.type,
        upsert: true,
      });

    if (error) {
      console.error("Error uploading file:", error);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from("product-images")
      .getPublicUrl(fileName);

    return {
      url: urlData.publicUrl,
      path: fileName,
    };
  } catch (err) {
    console.error("Error in uploadFileToStorage:", err);
    return null;
  }
};

/**
 * Upload multiple File objects and return their public URLs
 */
export const uploadFilesToStorage = async (
  files: File[],
  productId: string,
  startIndex: number = 0
): Promise<string[]> => {
  const uploadPromises = files.map((file, index) =>
    uploadFileToStorage(file, productId, startIndex + index)
  );

  const results = await Promise.all(uploadPromises);
  return results.filter((r): r is ImageUploadResult => r !== null).map((r) => r.url);
};
