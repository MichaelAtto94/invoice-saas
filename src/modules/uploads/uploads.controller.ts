import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Roles } from '../../common/decorators/roles.decorator';
import type { Express } from 'express';

function editFileName(
  req: any,
  file: Express.Multer.File,
  callback: (error: Error | null, filename: string) => void,
) {
  const name = file.originalname.split('.')[0].replace(/[^a-zA-Z0-9_-]/g, '');
  const fileExtName = extname(file.originalname);
  const randomName = Array.from({ length: 8 }, () =>
    Math.floor(Math.random() * 10).toString(),
  ).join('');

  callback(null, `${name}-${randomName}${fileExtName}`);
}

function imageFileFilter(
  req: any,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) {
  if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
    return callback(
      new BadRequestException('Only image files are allowed') as any,
      false,
    );
  }
  callback(null, true);
}

@Controller('uploads')
export class UploadsController {
  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/images',
        filename: editFileName,
      }),
      fileFilter: imageFileFilter,
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  )
  uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    return {
      ok: true,
      filename: file.filename,
      path: `uploads/images/${file.filename}`,
      mimetype: file.mimetype,
      size: file.size,
    };
  }
}