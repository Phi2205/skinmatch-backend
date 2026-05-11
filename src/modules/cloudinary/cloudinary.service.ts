import { Injectable, BadRequestException } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  /**
   * Upload a file buffer to Cloudinary.
   * @param file - Multer file object
   * @param folder - Optional folder name in Cloudinary (e.g. 'products', 'banners')
   */
  async uploadImage(
    file: Express.Multer.File,
    folder = 'skinmatch',
  ): Promise<UploadApiResponse> {
    if (!file || !file.buffer) {
      throw new BadRequestException('No file provided');
    }

    return new Promise<UploadApiResponse>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
        },
        (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
          if (error) {
            return reject(new BadRequestException(`Upload failed: ${error.message}`));
          }
          if (!result) {
            return reject(new BadRequestException('Upload failed: No result returned'));
          }
          resolve(result);
        },
      );

      uploadStream.end(file.buffer);
    });
  }

  /**
   * Upload multiple file buffers to Cloudinary.
   */
  async uploadImages(
    files: Express.Multer.File[],
    folder = 'skinmatch',
  ): Promise<UploadApiResponse[]> {
    return Promise.all(files.map((file) => this.uploadImage(file, folder)));
  }

  /**
   * Delete an image from Cloudinary by its public_id.
   * @param publicId - The public_id of the image (e.g. 'skinmatch/abc123')
   */
  async deleteImage(publicId: string): Promise<{ result: string }> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader.destroy(publicId, (error, result) => {
        if (error) {
          return reject(new BadRequestException(`Delete failed: ${error.message}`));
        }
        resolve(result);
      });
    });
  }

  /**
   * Extract the public_id from a Cloudinary URL.
   * e.g. https://res.cloudinary.com/xxx/image/upload/v123/skinmatch/abc.jpg -> skinmatch/abc
   */
  extractPublicId(url: string): string {
    const parts = url.split('/upload/');
    if (parts.length < 2) {
      throw new BadRequestException('Invalid Cloudinary URL');
    }
    // Remove version prefix (v1234567890/) and file extension
    const pathAfterUpload = parts[1];
    const withoutVersion = pathAfterUpload.replace(/^v\d+\//, '');
    const publicId = withoutVersion.replace(/\.[^/.]+$/, '');
    return publicId;
  }
}
