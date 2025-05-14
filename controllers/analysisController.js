const fs = require('fs');
const path = require('path');
const multer = require('multer');
const ApiError = require('../error/ApiError');
const { Analysis, User } = require('../models/models');

// Настройка multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsFolder = path.join(__dirname, '..', 'uploads', 'analyses');
    if (!fs.existsSync(uploadsFolder)) {
      fs.mkdirSync(uploadsFolder, { recursive: true });
    }
    cb(null, uploadsFolder);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});

const fileFilter = (req, file, cb) => {
  console.log('Проверка типа файла:', file ? file.mimetype : 'Файл отсутствует');
  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
  if (!file) {
    return cb(new Error('Файл не был отправлен'), false);
  }
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Недопустимый тип файла. Разрешены только JPEG, PNG и PDF.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
});

class AnalysisController {
  async uploadAnalysis(req, res, next) {
    try {
      console.log('Начало обработки запроса uploadAnalysis');
      console.log('Заголовки запроса:', req.headers);
      console.log('Тело запроса (до multer):', req.body);
      console.log('Файл (до multer):', req.file);

      const uploadSingle = upload.single('file');
      uploadSingle(req, res, async (err) => {
        if (err) {
          console.error('Ошибка multer:', err.message, err.stack);
          return next(ApiError.badRequest(err.message));
        }

        console.log('После обработки multer - тело:', req.body);
        console.log('После обработки multer - файл:', req.file);

        const userId = req.user.id;
        const { title, recordDate } = req.body;

        if (!title || !recordDate) {
          return next(ApiError.badRequest('Не указаны название анализа или дата'));
        }

        if (!req.file) {
          return next(ApiError.badRequest('Файл не загружен'));
        }

        const filePath = path.join('uploads', 'analyses', req.file.filename);

        const analysis = await Analysis.create({
          userId,
          title,
          filePath,
          recordDate: new Date(recordDate)
        });

        return res.status(201).json({ message: 'Анализ успешно загружен', analysis });
      });
    } catch (error) {
      console.error('Общая ошибка в uploadAnalysis:', error.stack);
      next(ApiError.badRequest(error.message));
    }
  }

  async getUserAnalyses(req, res, next) {
    try {
      const { userId } = req.params;
      if (!userId) {
        return next(ApiError.badRequest('Не указан userId'));
      }

      const analyses = await Analysis.findAll({
        where: { userId },
        order: [['recordDate', 'ASC']]
      });

      return res.status(200).json(analyses);
    } catch (error) {
      next(ApiError.badRequest(error.message));
    }
  }

  async deleteAnalysis(req, res, next) {
    try {
      const { analysisId } = req.params;
      const userId = req.user.id;

      const analysis = await Analysis.findOne({
        where: { id: analysisId, userId }
      });

      if (!analysis) {
        return res.status(404).json({ message: 'Анализ не найден или доступ запрещён' });
      }

      const filePath = path.join(__dirname, '..', analysis.filePath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      await analysis.destroy();
      return res.status(200).json({ message: 'Анализ успешно удалён' });
    } catch (error) {
      next(ApiError.badRequest(error.message));
    }
  }

  async getAnalysisFile(req, res, next) {
    try {
      const { analysisId } = req.params;
      const userId = req.user.id;

      const analysis = await Analysis.findOne({
        where: { id: analysisId, userId }
      });

      if (!analysis) {
        return res.status(404).json({ message: 'Анализ не найден или доступ запрещён' });
      }

      const filePath = path.join(__dirname, '..', analysis.filePath);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: 'Файл не найден' });
      }

      // Определяем Content-Type на основе расширения файла
      const fileExtension = path.extname(filePath).toLowerCase();
      let contentType = 'application/octet-stream';
      if (fileExtension === '.jpg' || fileExtension === '.jpeg') {
        contentType = 'image/jpeg';
      } else if (fileExtension === '.png') {
        contentType = 'image/png';
      } else if (fileExtension === '.pdf') {
        contentType = 'application/pdf';
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', 'inline'); // Отображение в браузере
      res.sendFile(filePath, (err) => {
        if (err) {
          next(ApiError.internal(err.message));
        }
      });
    } catch (error) {
      next(ApiError.badRequest(error.message));
    }
  }
}

module.exports = new AnalysisController();