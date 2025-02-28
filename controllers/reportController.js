//const { Report } = require('../models/models');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const ApiError = require('../error/ApiError');
const { HealthRecord, Symptom, Medication, User } = require('../models/models');
const { Op } = require('sequelize');

class ReportController {
  // Создать отчет о симптомах за определенный период
async createSymptomReport(req, res, next) {
  try {
    const { userId, startDate, endDate } = req.body;

    if (!userId || !startDate || !endDate) {
      return next(ApiError.badRequest('Missing required fields'));
    }

    // Путь для файла отчета (название файла генерируется на сервере)
    const downloadFolder = path.join(process.env.HOME || process.env.USERPROFILE, 'Downloads'); // Папка Загрузок
    const fileName = `symptom_report_${userId}_${Date.now()}.pdf`;
    const filePath = path.join(downloadFolder, fileName);

    // Определяем путь к шрифту в зависимости от операционной системы
    let fontPath;
    if (process.platform === 'darwin') {
      fontPath = '/Library/Fonts/Arial Unicode.ttf';  // Путь к шрифту Arial на macOS
    } else if (process.platform === 'win32') {
      fontPath = 'C:\\Windows\\Fonts\\Arial.ttf';  // Путь к шрифту Arial на Windows
    } else {
      fontPath = '/usr/share/fonts/arial.ttf';  // Путь для Linux
    }

    // Создаем новый PDF документ
    const doc = new PDFDocument();
    doc.pipe(fs.createWriteStream(filePath));

    // Используем шрифт с поддержкой кириллицы
    doc.font(fontPath);

    doc.fontSize(20).text('Отчет о симптомах', { align: 'center' });

    // Получаем username пользователя по его userId
    const user = await User.findByPk(userId);  
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Добавляем информацию о пользователе
    doc.fontSize(12).text(`Имя пользователя: ${user.username}`, { align: 'left' });
    doc.text(`Дата начала отчета: ${startDate}`);
    doc.text(`Дата конца отчета: ${endDate}`);
    doc.moveDown();

    // Получаем записи о симптомах за указанный период
    const healthRecords = await HealthRecord.findAll({
      where: {
        userId,
        recordDate: {
          [Op.between]: [startDate, endDate]
        }
      },
      include: [{
        model: Symptom,
        as: 'symptom',
        where: { id: { [Op.ne]: null } }
      }]
    });

    if (healthRecords.length === 0) {
      return res.status(404).json({ message: 'No symptom records found for this user in the given period' });
    }

    // Добавляем данные о симптомах в PDF
    healthRecords.forEach(record => {
      const formattedDate = new Date(record.recordDate).toLocaleString('ru-RU', { 
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });

      doc.text(`Дата: ${formattedDate}`);
      doc.text(`Симптом: ${record.symptom ? record.symptom.name : 'N/A'}`);
      doc.text(`Тяжесть симптома(0-5): ${record.weight}`);
      doc.moveDown();
    });

    // Завершаем создание PDF
    doc.end();
    
    // Устанавливаем заголовки для открытия и скачивания
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', 'application/pdf');

    // Возвращаем путь к файлу в ответе
    return res.status(201).json({ filePath: filePath });

  } catch (error) {
    next(ApiError.badRequest(error.message));
  }
}


  // Создать отчет о лекарствах за определенный период
  async createMedicationReport(req, res, next) {
    try {
      const { userId, startDate, endDate } = req.body;

      if (!userId || !startDate || !endDate) {
        return next(ApiError.badRequest('Missing required fields'));
      }

      // Путь для файла отчета (название файла генерируется на сервере)
      const downloadFolder = path.join(process.env.HOME || process.env.USERPROFILE, 'Downloads'); // Папка Загрузок
      const fileName = `symptom_report_${userId}_${Date.now()}.pdf`;
      const filePath = path.join(downloadFolder, fileName);

      // Определяем путь к шрифту в зависимости от операционной системы
      let fontPath;
      if (process.platform === 'darwin') {
        fontPath = '/Library/Fonts/Arial Unicode.ttf';  // Путь к шрифту Arial на macOS
      } else if (process.platform === 'win32') {
        fontPath = 'C:\\Windows\\Fonts\\Arial.ttf';  // Путь к шрифту Arial на Windows
      } else {
        fontPath = '/usr/share/fonts/arial.ttf';  // Путь для Linux
      }

      // Создаем новый PDF документ
      const doc = new PDFDocument();
      doc.pipe(fs.createWriteStream(filePath));

      // Используем шрифт с поддержкой кириллицы
      doc.font(fontPath);

      doc.fontSize(20).text('Отчет о лекарствах', { align: 'center' });

      // Получаем username пользователя по его userId
      const user = await User.findByPk(userId);  
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Добавляем информацию о пользователе
      doc.fontSize(12).text(`Имя пользователя: ${user.username}`, { align: 'left' });
      doc.text(`Дата начала отчёта: ${startDate}`);
      doc.text(`Дата конца отчёта: ${endDate}`);
      doc.moveDown();

      // Получаем записи о лекарствах за указанный период
      const healthRecords = await HealthRecord.findAll({
        where: {
          userId,
          recordDate: {
            [Op.between]: [startDate, endDate]
          }
        },
        include: [{
          model: Medication,
          as: 'medication',
          where: { id: { [Op.ne]: null } }
        }]
      });

      if (healthRecords.length === 0) {
        return res.status(404).json({ message: 'No medication records found for this user in the given period' });
      }

      // Добавляем данные о лекарствах в PDF
      healthRecords.forEach(record => {
        const formattedDate = new Date(record.recordDate).toLocaleString('ru-RU', { 
          year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        doc.text(`Дата: ${formattedDate}`);
        doc.text(`Лекарство: ${record.medication ? record.medication.name : 'N/A'}`);
        doc.text(`Дозировка: ${record.dosage}`);
        doc.text(`Количество: ${record.notes}`);
        doc.moveDown();
      });

      // Завершаем создание PDF
      doc.end();
      
      // Устанавливаем заголовки, чтобы файл был автоматически загружен
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Type', 'application/pdf');

    // Возвращаем путь к файлу в ответе
    return res.status(201).json({ filePath: filePath });
    } catch (error) {
      next(ApiError.badRequest(error.message));
      }
  }


  // Получить отчет по ID (если нужно)  НЕ РАБОТАЕТ
  async getOne(req, res, next) {
    try {
      const { id } = req.params;
      let report = await Report.findOne({ where: { id } });

      if (!report) {
        return res.status(404).json({ message: 'Report not found' });
      }

      return res.json(report);
    } catch (error) {
      next(ApiError.badRequest(error.message));
    }
  }

  // Получить все отчеты пользователя
  async getAll(req, res, next) {
    try {
      const { userId } = req.params;
      let reports = await Report.findAll({ where: { userId } });

      if (reports.length === 0) {
        return res.status(404).json({ message: 'No reports found for this user' });
      }

      return res.json(reports);
    } catch (error) {
      next(ApiError.badRequest(error.message));
    }
  }
  
  // Удалить отчет
  async delete(req, res, next) {
    try {
      const { id } = req.params;
      let report = await Report.findOne({ where: { id } });

      if (!report) {
        return res.status(404).json({ message: 'Report not found' });
      }

      await report.destroy();
      return res.json({ message: 'Report deleted successfully' });
    } catch (error) {
      next(ApiError.badRequest(error.message));
    }
  }
}

module.exports = new ReportController();
