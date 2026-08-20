import { BadRequestException } from '@nestjs/common';

import { memoryStorage } from 'multer';

const ALLOWED_MIME_TYPES = [
  'application/pdf',

  'image/jpeg',
  'image/png',

  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export const clientApplicationUploadOptions = {
  storage: memoryStorage(),

  limits: {
    fileSize: 10 * 1024 * 1024,
  },

  fileFilter: (
    _req: Express.Request,
    file: Express.Multer.File,
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return callback(
        new BadRequestException(
          'Only PDF, JPG, PNG, DOC, and DOCX files are allowed.',
        ),
        false,
      );
    }

    callback(null, true);
  },
};
