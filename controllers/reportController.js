const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit-table');
const { createCanvas } = require('canvas');
const Chart = require('chart.js/auto');
const ApiError = require('../error/ApiError');
const { Report, HealthRecord, Symptom, Medication, User } = require('../models/models');
const { Op } = require('sequelize');

class ReportController {
  async createSymptomReport(req, res, next) {
    try {
      const { userId, startDate, endDate } = req.body;

      if (!userId || !startDate || !endDate) {
        return next(ApiError.badRequest('Missing required fields'));
      }

      const reportsFolder = path.join(__dirname, '..', 'reports');
      if (!fs.existsSync(reportsFolder)) {
        fs.mkdirSync(reportsFolder, { recursive: true });
      }
      const fileName = `symptom_report_${userId}_${Date.now()}.pdf`;
      const filePath = path.join(reportsFolder, fileName);

      let fontPath;
      if (process.platform === 'darwin') {
        fontPath = '/Library/Fonts/Arial Unicode.ttf';
      } else if (process.platform === 'win32') {
        fontPath = 'C:\\Windows\\Fonts\\Arial.ttf';
      } else {
        fontPath = '/usr/share/fonts/arial.ttf';
      }

      const doc = new PDFDocument();
      doc.pipe(fs.createWriteStream(filePath));
      doc.font(fontPath);

      doc.fontSize(20).text('Отчет о симптомах', { align: 'center' });
      doc.moveDown();

      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      doc.fontSize(16).text(`Здравствуйте, ${user.username}!`, { align: 'left' });
      doc.moveDown();

      doc.fontSize(16).text('Общая информация', { align: 'left', underline: true });
      doc.fontSize(12).text(`Возраст: ${user.age}`, { align: 'left' });
      doc.text(`Дата начала отчета: ${startDate}`);
      doc.text(`Дата конца отчета: ${endDate}`);
      doc.moveDown();

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

      const totalRecords = healthRecords.length;
      const totalWeight = healthRecords.reduce((sum, record) => sum + record.weight, 0);
      const averageWeight = totalRecords > 0 ? (totalWeight / totalRecords).toFixed(2) : 'N/A';

      const symptomCountMap = {};
      healthRecords.forEach(record => {
        const symptomName = record.symptom ? record.symptom.name : 'N/A';
        symptomCountMap[symptomName] = (symptomCountMap[symptomName] || 0) + 1;
      });

      const symptomFrequency = Object.entries(symptomCountMap)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3);

      doc.fontSize(16).text('Аналитика', { align: 'left', underline: true });
      doc.fontSize(12).text(`Общее количество записей: ${totalRecords}`, { align: 'left' });
      doc.text(`Средняя тяжесть симптомов: ${averageWeight}`);
      doc.moveDown();
      doc.fontSize(14).text('Самые частые симптомы:', { align: 'left' });
      symptomFrequency.forEach(([symptomName, count]) => {
        doc.fontSize(12).text(`${symptomName}: ${count} раз`, { align: 'left' });
      });
      doc.moveDown();

      doc.fontSize(16).text('Подробные записи', { align: 'left', underline: true });
      doc.moveDown();

      const tableData = {
        headers: ['Дата', 'Симптом', 'Тяжесть (0-5)'],
        rows: healthRecords.map(record => {
          const formattedDate = new Date(record.recordDate).toLocaleString('ru-RU', {
            year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
          });
          return [
            formattedDate,
            record.symptom ? record.symptom.name : 'N/A',
            record.weight.toString()
          ];
        })
      };

      await doc.table(tableData, {
        columnsSize: [200, 200, 100],
        padding: 5,
        header: {
          fontSize: 12,
          font: fontPath
        },
        row: {
          fontSize: 10,
          font: fontPath
        },
        prepareHeader: () => doc.font(fontPath).fontSize(12),
        prepareRow: () => doc.font(fontPath).fontSize(10)
      });

      doc.moveDown();

      doc.fontSize(16).text('Рекомендации', { align: 'left', underline: true });
      doc.moveDown();
      const mostFrequentSymptom = symptomFrequency[0];
      if (mostFrequentSymptom && mostFrequentSymptom[1] / totalRecords > 0.5) {
        const [symptomName] = mostFrequentSymptom;
        doc.fontSize(12).text(`Вы часто отмечали "${symptomName}". Рекомендуем обратиться к врачу для консультации.`, { align: 'left' });
      } else {
        doc.fontSize(12).text('Симптомы разнообразны. Следите за своим состоянием и при необходимости обратитесь к врачу.', { align: 'left' });
      }
      doc.moveDown();

      // Проверяем, достаточно ли места для круговой диаграммы (высота 300px + отступы ~350px)
      if (doc.y > doc.page.height - 350) {
        doc.addPage();
      }

      // Создаём круговую диаграмму для симптомов
      const labels = Object.keys(symptomCountMap);
      const data = Object.values(symptomCountMap);
      const canvasPie = createCanvas(400, 400);
      const ctxPie = canvasPie.getContext('2d');

      new Chart(ctxPie, {
        type: 'pie',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: [
              'rgba(255, 99, 132, 0.7)',
              'rgba(54, 162, 235, 0.7)',
              'rgba(255, 206, 86, 0.7)',
              'rgba(75, 192, 192, 0.7)',
              'rgba(153, 102, 255, 0.7)',
            ],
            borderColor: [
              'rgba(255, 99, 132, 1)',
              'rgba(54, 162, 235, 1)',
              'rgba(255, 206, 86, 1)',
              'rgba(75, 192, 192, 1)',
              'rgba(153, 102, 255, 1)',
            ],
            borderWidth: 1
          }]
        },
        options: {
          plugins: {
            legend: {
              position: 'top',
              labels: {
                font: {
                  size: 12
                }
              }
            },
            title: {
              display: true,
              text: 'Распределение симптомов',
              font: {
                size: 16
              }
            }
          }
        }
      });

      const pieChartImagePath = path.join(reportsFolder, `pie_chart_symptoms_${userId}_${Date.now()}.png`);
      const outPie = fs.createWriteStream(pieChartImagePath);
      const streamPie = canvasPie.createPNGStream();
      streamPie.pipe(outPie);
      await new Promise((resolve) => outPie.on('finish', resolve));

      doc.fontSize(14).text('Распределение симптомов:', { align: 'left' });
      doc.moveDown();
      doc.image(pieChartImagePath, {
        fit: [300, 400],
        align: 'center'
      });

      fs.unlinkSync(pieChartImagePath);

      // Проверяем, достаточно ли места для линейного графика (высота 200px + отступы ~250px)
      if (doc.y > doc.page.height - 500) {
        doc.addPage();
      }

      // Создаём линейный график для динамики тяжести симптомов
      const dates = healthRecords.map(record => new Date(record.recordDate).toLocaleDateString('ru-RU'));
      const weights = healthRecords.map(record => record.weight);
      const canvasLine = createCanvas(500, 300);
      const ctxLine = canvasLine.getContext('2d');

      new Chart(ctxLine, {
        type: 'line',
        data: {
          labels: dates,
          datasets: [{
            label: 'Тяжесть симптомов',
            data: weights,
            borderColor: 'rgba(54, 162, 235, 1)',
            backgroundColor: 'rgba(54, 162, 235, 0.2)',
            fill: true,
            tension: 0.3
          }]
        },
        options: {
          scales: {
            y: {
              beginAtZero: true,
              max: 5,
              title: {
                display: true,
                text: 'Тяжесть (0-5)'
              }
            },
            x: {
              title: {
                display: true,
                text: 'Дата'
              }
            }
          },
          plugins: {
            legend: {
              position: 'top'
            },
            title: {
              display: true,
              text: 'Динамика тяжести симптомов',
              font: {
                size: 16
              }
            }
          }
        }
      });

      const lineChartImagePath = path.join(reportsFolder, `line_chart_symptoms_${userId}_${Date.now()}.png`);
      const outLine = fs.createWriteStream(lineChartImagePath);
      const streamLine = canvasLine.createPNGStream();
      streamLine.pipe(outLine);
      await new Promise((resolve) => outLine.on('finish', resolve));

      doc.moveDown(3); // Увеличиваем отступ между диаграммами
      doc.fontSize(14).text('Динамика тяжести симптомов:', { align: 'left' });
      doc.moveDown();
      doc.image(lineChartImagePath, {
        fit: [400, 300],
        align: 'center'
      });
      doc.moveDown();

      fs.unlinkSync(lineChartImagePath);

      doc.end();

      const report = await Report.create({
        userId,
        type: 'symptoms',
        startDate,
        endDate,
        filePath: filePath
      });

      return res.status(201).json({ reportId: report.id });

    } catch (error) {
      next(ApiError.badRequest(error.message));
    }
  }

  async createMedicationReport(req, res, next) {
    try {
      const { userId, startDate, endDate } = req.body;

      if (!userId || !startDate || !endDate) {
        return next(ApiError.badRequest('Missing required fields'));
      }

      const reportsFolder = path.join(__dirname, '..', 'reports');
      if (!fs.existsSync(reportsFolder)) {
        fs.mkdirSync(reportsFolder, { recursive: true });
      }
      const fileName = `medication_report_${userId}_${Date.now()}.pdf`;
      const filePath = path.join(reportsFolder, fileName);

      let fontPath;
      if (process.platform === 'darwin') {
        fontPath = '/Library/Fonts/Arial Unicode.ttf';
      } else if (process.platform === 'win32') {
        fontPath = 'C:\\Windows\\Fonts\\Arial.ttf';
      } else {
        fontPath = '/usr/share/fonts/arial.ttf';
      }

      const doc = new PDFDocument();
      doc.pipe(fs.createWriteStream(filePath));
      doc.font(fontPath);

      doc.fontSize(20).text('Отчет о лекарствах', { align: 'center' });
      doc.moveDown();

      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      doc.fontSize(16).text(`Здравствуйте, ${user.username}!`, { align: 'left' });
      doc.moveDown();

      doc.fontSize(16).text('Общая информация', { align: 'left', underline: true });
      doc.fontSize(12).text(`Возраст: ${user.age}`, { align: 'left' });
      doc.text(`Дата начала отчета: ${startDate}`);
      doc.text(`Дата конца отчета: ${endDate}`);
      doc.moveDown();

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

      const totalRecords = healthRecords.length;

      const medicationCountMap = {};
      healthRecords.forEach(record => {
        const medicationName = record.medication ? record.medication.name : 'N/A';
        medicationCountMap[medicationName] = (medicationCountMap[medicationName] || 0) + 1;
      });

      const medicationFrequency = Object.entries(medicationCountMap)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3);

      doc.fontSize(16).text('Аналитика', { align: 'left', underline: true });
      doc.fontSize(12).text(`Общее количество записей: ${totalRecords}`, { align: 'left' });
      doc.moveDown();
      doc.fontSize(14).text('Самые частые лекарства:', { align: 'left' });
      medicationFrequency.forEach(([medicationName, count]) => {
        doc.fontSize(12).text(`${medicationName}: ${count} раз`, { align: 'left' });
      });
      doc.moveDown();

      doc.fontSize(16).text('Подробные записи', { align: 'left', underline: true });
      doc.moveDown();

      const tableData = {
        headers: ['Дата', 'Лекарство', 'Дозировка (мг)', 'Количество (шт)'],
        rows: healthRecords.map(record => {
          const formattedDate = new Date(record.recordDate).toLocaleString('ru-RU', {
            year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
          });
          return [
            formattedDate,
            record.medication ? record.medication.name : 'N/A',
            record.dosage || 'Не указано',
            record.notes || 'Не указано'
          ];
        })
      };

      await doc.table(tableData, {
        columnsSize: [150, 150, 100, 100],
        padding: 5,
        header: {
          fontSize: 12,
          font: fontPath
        },
        row: {
          fontSize: 10,
          font: fontPath
        },
        prepareHeader: () => doc.font(fontPath).fontSize(12),
        prepareRow: () => doc.font(fontPath).fontSize(10)
      });

      doc.moveDown();

      doc.fontSize(16).text('Рекомендации', { align: 'left', underline: true });
      doc.moveDown();
      const mostFrequentMedication = medicationFrequency[0];
      if (mostFrequentMedication && mostFrequentMedication[1] / totalRecords > 0.5) {
        const [medicationName] = mostFrequentMedication;
        doc.fontSize(12).text(`Вы часто принимаете "${medicationName}". Убедитесь, что дозировка соответствует рекомендациям врача.`, { align: 'left' });
      } else {
        doc.fontSize(12).text('Приём лекарств сбалансирован. Продолжайте следовать рекомендациям врача.', { align: 'left' });
      }
      doc.moveDown();

      // Проверяем, достаточно ли места для круговой диаграммы (высота 300px + отступы ~350px)
      if (doc.y > doc.page.height - 350) {
        doc.addPage();
      }

      // Создаём круговую диаграмму для лекарств
      const labels = Object.keys(medicationCountMap);
      const data = Object.values(medicationCountMap);
      const canvasPie = createCanvas(400, 400);
      const ctxPie = canvasPie.getContext('2d');

      new Chart(ctxPie, {
        type: 'pie',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: [
              'rgba(255, 99, 132, 0.7)',
              'rgba(54, 162, 235, 0.7)',
              'rgba(255, 206, 86, 0.7)',
              'rgba(75, 192, 192, 0.7)',
              'rgba(153, 102, 255, 0.7)',
            ],
            borderColor: [
              'rgba(255, 99, 132, 1)',
              'rgba(54, 162, 235, 1)',
              'rgba(255, 206, 86, 1)',
              'rgba(75, 192, 192, 1)',
              'rgba(153, 102, 255, 1)',
            ],
            borderWidth: 1
          }]
        },
        options: {
          plugins: {
            legend: {
              position: 'top',
              labels: {
                font: {
                  size: 12
                }
              }
            },
            title: {
              display: true,
              text: 'Распределение лекарств',
              font: {
                size: 16
              }
            }
          }
        }
      });

      const pieChartImagePath = path.join(reportsFolder, `pie_chart_medications_${userId}_${Date.now()}.png`);
      const outPie = fs.createWriteStream(pieChartImagePath);
      const streamPie = canvasPie.createPNGStream();
      streamPie.pipe(outPie);
      await new Promise((resolve) => outPie.on('finish', resolve));

      doc.fontSize(14).text('Распределение лекарств:', { align: 'left' });
      doc.moveDown();
      doc.image(pieChartImagePath, {
        fit: [300, 300],
        align: 'center'
      });
      doc.moveDown();

      fs.unlinkSync(pieChartImagePath);

      doc.end();

      const report = await Report.create({
        userId,
        type: 'medications',
        startDate,
        endDate,
        filePath: filePath
      });

      return res.status(201).json({ reportId: report.id });

    } catch (error) {
      next(ApiError.badRequest(error.message));
    }
  }

  async getUserReports(req, res, next) {
    try {
      const { userId } = req.params;
      if (!userId) {
        return next(ApiError.badRequest('Missing userId'));
      }
      const reports = await Report.findAll({
        where: { userId },
        order: [['createdAt', 'DESC']]
      });
      return res.status(200).json(reports);
    } catch (error) {
      next(ApiError.badRequest(error.message));
    }
  }

  async getReportFile(req, res, next) {
    try {
      const { reportId } = req.params;
      const userId = req.user.id;

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

      res.download(filePath, path.basename(filePath), (err) => {
        if (err) {
          next(ApiError.internal(err.message));
        }
      });
    } catch (error) {
      next(ApiError.badRequest(error.message));
    }
  }

  async deleteReport(req, res, next) {
    try {
      const { reportId } = req.params;
      if (!req.user || !req.user.id) {
        return next(ApiError.unauthorized('User not authenticated'));
      }

      const userId = parseInt(req.user.id, 10);
      const reportIdNum = parseInt(reportId, 10);

      const report = await Report.findOne({
        where: { id: reportIdNum, userId }
      });

      if (!report) {
        return res.status(404).json({ message: 'Report not found or access denied' });
      }

      const filePath = report.filePath;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      await report.destroy();
      return res.status(200).json({ message: 'Report deleted successfully' });
    } catch (error) {
      next(ApiError.badRequest(error.message));
    }
  }
}

module.exports = new ReportController();