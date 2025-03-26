const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const ApiError = require('../error/ApiError');
const { Report, HealthRecord, Symptom, Medication, User } = require('../models/models');
const { Op } = require('sequelize');

class ReportController {
  // Создать отчет о симптомах за определенный период
  async createSymptomReport(req, res, next) {
    try {
      const { userId, startDate, endDate } = req.body;

      if (!userId || !startDate || !endDate) {
        return next(ApiError.badRequest('Missing required fields'));
      }

      // Путь для файла отчета на сервере
      const reportsFolder = path.join(__dirname, '..', 'reports');
      if (!fs.existsSync(reportsFolder)) {
        fs.mkdirSync(reportsFolder, { recursive: true });
      }
      const fileName = `symptom_report_${userId}_${Date.now()}.pdf`;
      const filePath = path.join(reportsFolder, fileName);

      // Определяем путь к шрифту
      let fontPath;
      if (process.platform === 'darwin') {
        fontPath = '/Library/Fonts/Arial Unicode.ttf';
      } else if (process.platform === 'win32') {
        fontPath = 'C:\\Windows\\Fonts\\Arial.ttf';
      } else {
        fontPath = '/usr/share/fonts/arial.ttf';
      }

      // Создаем PDF документ
      const doc = new PDFDocument();
      doc.pipe(fs.createWriteStream(filePath));
      doc.font(fontPath);
      doc.fontSize(20).text('Отчет о симптомах', { align: 'center' });

      // Получаем username пользователя
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      doc.fontSize(12).text(`Имя пользователя: ${user.username}`, { align: 'left' });
      doc.text(`Дата начала отчета: ${startDate}`);
      doc.text(`Дата конца отчета: ${endDate}`);
      doc.moveDown();

      // Получаем записи о симптомах
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

      // Добавляем данные в PDF
      healthRecords.forEach(record => {
        const formattedDate = new Date(record.recordDate).toLocaleString('ru-RU', {
          year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        doc.text(`Дата: ${formattedDate}`);
        doc.text(`Симптом: ${record.symptom ? record.symptom.name : 'N/A'}`);
        doc.text(`Тяжесть симптома(0-5): ${record.weight}`);
        doc.moveDown();
      });

      doc.end();

      // Сохраняем информацию о отчете в базе данных
      const report = await Report.create({
        userId,
        type: 'symptoms',
        startDate,
        endDate,
        filePath: filePath
      });

      // Возвращаем ID отчета
      return res.status(201).json({ reportId: report.id });

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

      // Путь для файла отчета на сервере
      const reportsFolder = path.join(__dirname, '..', 'reports');
      if (!fs.existsSync(reportsFolder)) {
        fs.mkdirSync(reportsFolder, { recursive: true });
      }
      const fileName = `medication_report_${userId}_${Date.now()}.pdf`;
      const filePath = path.join(reportsFolder, fileName);

      // Определяем путь к шрифту
      let fontPath;
      if (process.platform === 'darwin') {
        fontPath = '/Library/Fonts/Arial Unicode.ttf';
      } else if (process.platform === 'win32') {
        fontPath = 'C:\\Windows\\Fonts\\Arial.ttf';
      } else {
        fontPath = '/usr/share/fonts/arial.ttf';
      }

      // Создаем PDF документ
      const doc = new PDFDocument();
      doc.pipe(fs.createWriteStream(filePath));
      doc.font(fontPath);
      doc.fontSize(20).text('Отчет о лекарствах', { align: 'center' });

      // Получаем username пользователя
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      doc.fontSize(12).text(`Имя пользователя: ${user.username}`, { align: 'left' });
      doc.text(`Дата начала отчета: ${startDate}`);
      doc.text(`Дата конца отчета: ${endDate}`);
      doc.moveDown();

      // Получаем записи о лекарствах
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
        doc.text(`Дозировка(мг): ${record.dosage || 'Не указано'}`);
        doc.text(`Количество(шт): ${record.notes || 'Не указано'}`);
        doc.moveDown();
      });

      doc.end();

      // Сохраняем информацию о отчете в базе данных
      const report = await Report.create({
        userId,
        type: 'medications',
        startDate,
        endDate,
        filePath: filePath
      });

      // Возвращаем ID отчета
      return res.status(201).json({ reportId: report.id });

    } catch (error) {
      next(ApiError.badRequest(error.message));
    }
  }


  // Получение списка отчетов пользователя
  async getUserReports(req, res, next) {
    try {
      const { userId } = req.params;
  
      if (!userId) {
        return next(ApiError.badRequest('Missing userId'));
      }
  
      const reports = await Report.findAll({
        where: { userId },
        order: [['createdAt', 'DESC']] // Сортировка по дате создания (последние сверху)
      });
  
      return res.status(200).json(reports);
    } catch (error) {
      next(ApiError.badRequest(error.message));
    }
  }

  // Открытие отчетов на сайте
  async getReportFile(req, res, next) {
    try {
      const { reportId } = req.params;
      const userId = req.user.id; // Предполагается, что middleware аутентификации добавляет req.user
  
      const report = await Report.findOne({
        where: { id: reportId, userId }
      });
  
      if (!report) {
        return res.status(404).json({ message: 'Report not found or access denied' });
      }
  
      const filePath = report.filePath;
  
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: 'File not found' });
      }
  
      // Отдаем файл для скачивания или просмотра
      res.download(filePath, path.basename(filePath), (err) => {
        if (err) {
          next(ApiError.internal(err.message));
        }
      });
    } catch (error) {
      next(ApiError.badRequest(error.message));
    }
  }
  
  // Удаление отчета
async deleteReport(req, res, next) {
  try {
    const { reportId } = req.params;

    if (!req.user || !req.user.id) {
      return next(ApiError.unauthorized('User not authenticated'));
    }

    const userId = parseInt(req.user.id, 10); // ID пользователя из токена
    const reportIdNum = parseInt(reportId, 10); // ID отчета

    // Проверяем, существует ли отчет и принадлежит ли он пользователю
    const report = await Report.findOne({
      where: { id: reportIdNum, userId }
    });

    if (!report) {
      return res.status(404).json({ message: 'Report not found or access denied' });
    }

    // Удаляем файл отчета с сервера
    const filePath = report.filePath;
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Удаляем запись об отчете из базы данных
    await report.destroy();

    return res.status(200).json({ message: 'Report deleted successfully' });
  } catch (error) {
    next(ApiError.badRequest(error.message));
  }
}
}

module.exports = new ReportController();
