const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit-table');
const ExcelJS = require('exceljs');
const { createCanvas } = require('canvas');
const Chart = require('chart.js/auto');
const ApiError = require('../error/ApiError');
const { Report, HealthRecord, Symptom, Medication, User } = require('../models/models');
const { Op } = require('sequelize');

class ReportController {
  async createSymptomReport(req, res, next) {
    try {
      const userId = req.user.id; // Берем userId из токена
      const { startDate, endDate } = req.body;

      if (!startDate || !endDate) {
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

      if (doc.y > doc.page.height - 350) {
        doc.addPage();
      }

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

      if (doc.y > doc.page.height - 500) {
        doc.addPage();
      }

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

      doc.moveDown(3);
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




  async createSymptomReportExcel(req, res, next) {
    try {
      const userId = req.user.id;
      const { startDate, endDate } = req.body;
  
      if (!startDate || !endDate) {
        return next(ApiError.badRequest('Missing required fields'));
      }
  
      const reportsFolder = path.join(__dirname, '..', 'reports');
      if (!fs.existsSync(reportsFolder)) {
        fs.mkdirSync(reportsFolder, { recursive: true });
      }
  
      const fileName = `symptom_report_${userId}_${Date.now()}.xlsx`;
      const filePath = path.join(reportsFolder, fileName);
  
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Symptom Report');
  
      const titleStyle = { font: { size: 20, bold: true }, alignment: { horizontal: 'center' } };
      const sectionStyle = { font: { size: 16, bold: true, underline: true } };
      const textStyle = { font: { size: 12 } };
      const tableHeaderStyle = { font: { size: 12, bold: true }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } }, alignment: { horizontal: 'center' } };
      const tableRowStyle = { font: { size: 10 } };
  
      worksheet.mergeCells('A1:C1');
      worksheet.getCell('A1').value = 'Отчет о симптомах';
      worksheet.getCell('A1').style = titleStyle;
      worksheet.getRow(1).height = 30;
  
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      worksheet.getCell('A3').value = `Здравствуйте, ${user.username}!`;
      worksheet.getCell('A3').style = textStyle;
  
      worksheet.getCell('A4').value = 'Общая информация';
      worksheet.getCell('A4').style = sectionStyle;
      worksheet.getCell('A5').value = `Возраст: ${user.age}`;
      worksheet.getCell('A6').value = `Дата начала отчета: ${startDate}`;
      worksheet.getCell('A7').value = `Дата конца отчета: ${endDate}`;
      worksheet.getCell('A5').style = textStyle;
      worksheet.getCell('A6').style = textStyle;
      worksheet.getCell('A7').style = textStyle;
  
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
  
      worksheet.getCell('A9').value = 'Аналитика';
      worksheet.getCell('A9').style = sectionStyle;
      worksheet.getCell('A10').value = `Общее количество записей: ${totalRecords}`;
      worksheet.getCell('A11').value = `Средняя тяжесть симптомов: ${averageWeight}`;
      worksheet.getCell('A10').style = textStyle;
      worksheet.getCell('A11').style = textStyle;
  
      worksheet.getCell('A12').value = 'Самые частые симптомы:';
      worksheet.getCell('A12').style = { font: { size: 14, bold: true } };
      let rowIndex = 13;
      symptomFrequency.forEach(([symptomName, count]) => {
        worksheet.getCell(`A${rowIndex}`).value = `${symptomName}: ${count} раз`;
        worksheet.getCell(`A${rowIndex}`).style = textStyle;
        rowIndex++;
      });
  
      worksheet.getCell(`A${rowIndex + 1}`).value = 'Подробные записи';
      worksheet.getCell(`A${rowIndex + 1}`).style = sectionStyle;
      rowIndex += 2;
  
      const tableStartRow = rowIndex;
      worksheet.getCell(`A${rowIndex}`).value = 'Дата';
      worksheet.getCell(`B${rowIndex}`).value = 'Симптом';
      worksheet.getCell(`C${rowIndex}`).value = 'Тяжесть (0-5)';
      worksheet.getCell(`A${rowIndex}`).style = tableHeaderStyle;
      worksheet.getCell(`B${rowIndex}`).style = tableHeaderStyle;
      worksheet.getCell(`C${rowIndex}`).style = tableHeaderStyle;
      worksheet.getRow(rowIndex).height = 20;
  
      rowIndex++;
      healthRecords.forEach(record => {
        const formattedDate = new Date(record.recordDate).toLocaleString('ru-RU', {
          year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        worksheet.getCell(`A${rowIndex}`).value = formattedDate;
        worksheet.getCell(`B${rowIndex}`).value = record.symptom ? record.symptom.name : 'N/A';
        worksheet.getCell(`C${rowIndex}`).value = record.weight;
        worksheet.getCell(`A${rowIndex}`).style = tableRowStyle;
        worksheet.getCell(`B${rowIndex}`).style = tableRowStyle;
        worksheet.getCell(`C${rowIndex}`).style = tableRowStyle;
        rowIndex++;
      });
  
      worksheet.getColumn('A').width = 30;
      worksheet.getColumn('B').width = 20;
      worksheet.getColumn('C').width = 15;
  
      worksheet.autoFilter = {
        from: { row: tableStartRow, column: 1 },
        to: { row: rowIndex - 1, column: 3 }
      };
  
      worksheet.getCell(`A${rowIndex + 1}`).value = 'Рекомендации';
      worksheet.getCell(`A${rowIndex + 1}`).style = sectionStyle;
      rowIndex += 2;
      const mostFrequentSymptom = symptomFrequency[0];
      if (mostFrequentSymptom && mostFrequentSymptom[1] / totalRecords > 0.5) {
        const [symptomName] = mostFrequentSymptom;
        worksheet.getCell(`A${rowIndex}`).value = `Вы часто отмечали "${symptomName}". Рекомендуем обратиться к врачу для консультации.`;
      } else {
        worksheet.getCell(`A${rowIndex}`).value = 'Симптомы разнообразны. Следите за своим состоянием и при необходимости обратитесь к врачу.';
      }
      worksheet.getCell(`A${rowIndex}`).style = textStyle;
      rowIndex += 2;
  
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
      await new Promise((resolve, reject) => {
        outPie.on('finish', () => {
          resolve();
        });
        outPie.on('error', (err) => {
          console.error('Error creating pie chart:', err);
          reject(err);
        });
      });
  
      if (!fs.existsSync(pieChartImagePath)) {
        throw new Error(`Pie chart file not found: ${pieChartImagePath}`);
      }
  
      worksheet.getCell(`A${rowIndex}`).value = 'Распределение симптомов:';
      worksheet.getCell(`A${rowIndex}`).style = { font: { size: 14, bold: true } };
      rowIndex++;
  
      const pieImageId = workbook.addImage({
        filename: pieChartImagePath,
        extension: 'png',
      });
      worksheet.addImage(pieImageId, {
        tl: { col: 0, row: rowIndex },
        ext: { width: 400, height: 400 }
      });
      rowIndex += 15;
  
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
  
      worksheet.getCell(`A${rowIndex + 8}`).value = 'Динамика тяжести симптомов:';
      worksheet.getCell(`A${rowIndex + 8}`).style = { font: { size: 14, bold: true } };
      rowIndex += 8;
  
      const lineImageId = workbook.addImage({
        filename: lineChartImagePath,
        extension: 'png',
      });
      worksheet.addImage(lineImageId, {
        tl: { col: 0, row: rowIndex },
        ext: { width: 500, height: 300 }
      });
      rowIndex += 12;
  
    await workbook.xlsx.writeFile(filePath);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Excel file not created at: ${filePath}`);
    }

    fs.unlinkSync(pieChartImagePath);
    fs.unlinkSync(lineChartImagePath);

    const report = await Report.create({
      userId,
      type: 'symptoms_excel',
      startDate,
      endDate,
      filePath: filePath
    });

    // Устанавливаем заголовок перед res.download
    res.set('X-Report-Id', report.id.toString());

    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error('Download error:', err);
        next(ApiError.internal(err.message));
      } else {
      }
    });

  } catch (error) {
    console.error('Error in createSymptomReportExcel:', error);
    next(ApiError.badRequest(error.message));
  }
}


  

  async createMedicationReport(req, res, next) {
    try {
      const userId = req.user.id; // Берем userId из токена
      const { startDate, endDate } = req.body;

      if (!startDate || !endDate) {
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

      if (doc.y > doc.page.height - 350) {
        doc.addPage();
      }

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

  async createMedicationReportExcel(req, res, next) {
  try {
    const userId = req.user.id; // Берем userId из токена
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return next(ApiError.badRequest('Missing required fields'));
    }

    const reportsFolder = path.join(__dirname, '..', 'reports');
    if (!fs.existsSync(reportsFolder)) {
      fs.mkdirSync(reportsFolder, { recursive: true });
    }
    const fileName = `medication_report_${userId}_${Date.now()}.xlsx`;
    const filePath = path.join(reportsFolder, fileName);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Medication Report');

    const titleStyle = { font: { size: 20, bold: true }, alignment: { horizontal: 'center' } };
    const sectionStyle = { font: { size: 16, bold: true, underline: true } };
    const textStyle = { font: { size: 12 } };
    const tableHeaderStyle = { font: { size: 12, bold: true }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } }, alignment: { horizontal: 'center' } };
    const tableRowStyle = { font: { size: 10 } };

    worksheet.mergeCells('A1:D1');
    worksheet.getCell('A1').value = 'Отчет о лекарствах';
    worksheet.getCell('A1').style = titleStyle;
    worksheet.getRow(1).height = 30;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    worksheet.getCell('A3').value = `Здравствуйте, ${user.username}!`;
    worksheet.getCell('A3').style = textStyle;

    worksheet.getCell('A4').value = 'Общая информация';
    worksheet.getCell('A4').style = sectionStyle;
    worksheet.getCell('A5').value = `Возраст: ${user.age}`;
    worksheet.getCell('A6').value = `Дата начала отчета: ${startDate}`;
    worksheet.getCell('A7').value = `Дата конца отчета: ${endDate}`;
    worksheet.getCell('A5').style = textStyle;
    worksheet.getCell('A6').style = textStyle;
    worksheet.getCell('A7').style = textStyle;

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

    worksheet.getCell('A9').value = 'Аналитика';
    worksheet.getCell('A9').style = sectionStyle;
    worksheet.getCell('A10').value = `Общее количество записей: ${totalRecords}`;
    worksheet.getCell('A10').style = textStyle;

    worksheet.getCell('A11').value = 'Самые частые лекарства:';
    worksheet.getCell('A11').style = { font: { size: 14, bold: true } };
    let rowIndex = 12;
    medicationFrequency.forEach(([medicationName, count]) => {
      worksheet.getCell(`A${rowIndex}`).value = `${medicationName}: ${count} раз`;
      worksheet.getCell(`A${rowIndex}`).style = textStyle;
      rowIndex++;
    });

    worksheet.getCell(`A${rowIndex + 1}`).value = 'Подробные записи';
    worksheet.getCell(`A${rowIndex + 1}`).style = sectionStyle;
    rowIndex += 2;

    const tableStartRow = rowIndex;
    worksheet.getCell(`A${rowIndex}`).value = 'Дата';
    worksheet.getCell(`B${rowIndex}`).value = 'Лекарство';
    worksheet.getCell(`C${rowIndex}`).value = 'Дозировка (мг)';
    worksheet.getCell(`D${rowIndex}`).value = 'Количество (шт)';
    worksheet.getCell(`A${rowIndex}`).style = tableHeaderStyle;
    worksheet.getCell(`B${rowIndex}`).style = tableHeaderStyle;
    worksheet.getCell(`C${rowIndex}`).style = tableHeaderStyle;
    worksheet.getCell(`D${rowIndex}`).style = tableHeaderStyle;
    worksheet.getRow(rowIndex).height = 20;

    rowIndex++;
    healthRecords.forEach(record => {
      const formattedDate = new Date(record.recordDate).toLocaleString('ru-RU', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      worksheet.getCell(`A${rowIndex}`).value = formattedDate;
      worksheet.getCell(`B${rowIndex}`).value = record.medication ? record.medication.name : 'N/A';
      worksheet.getCell(`C${rowIndex}`).value = record.dosage || 'Не указано';
      worksheet.getCell(`D${rowIndex}`).value = record.notes || 'Не указано';
      worksheet.getCell(`A${rowIndex}`).style = tableRowStyle;
      worksheet.getCell(`B${rowIndex}`).style = tableRowStyle;
      worksheet.getCell(`C${rowIndex}`).style = tableRowStyle;
      worksheet.getCell(`D${rowIndex}`).style = tableRowStyle;
      rowIndex++;
    });

    worksheet.getColumn('A').width = 30;
    worksheet.getColumn('B').width = 20;
    worksheet.getColumn('C').width = 15;
    worksheet.getColumn('D').width = 15;

    worksheet.autoFilter = {
      from: { row: tableStartRow, column: 1 },
      to: { row: rowIndex - 1, column: 4 }
    };

    worksheet.getCell(`A${rowIndex + 1}`).value = 'Рекомендации';
    worksheet.getCell(`A${rowIndex + 1}`).style = sectionStyle;
    rowIndex += 2;
    const mostFrequentMedication = medicationFrequency[0];
    if (mostFrequentMedication && mostFrequentMedication[1] / totalRecords > 0.5) {
      const [medicationName] = mostFrequentMedication;
      worksheet.getCell(`A${rowIndex}`).value = `Вы часто принимаете "${medicationName}". Убедитесь, что дозировка соответствует рекомендациям врача.`;
    } else {
      worksheet.getCell(`A${rowIndex}`).value = 'Приём лекарств сбалансирован. Продолжайте следовать рекомендациям врача.';
    }
    worksheet.getCell(`A${rowIndex}`).style = textStyle;
    rowIndex += 2;

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
    await new Promise((resolve, reject) => {
      outPie.on('finish', () => {
        resolve();
      });
      outPie.on('error', (err) => {
        console.error('Error creating pie chart:', err);
        reject(err);
      });
    });

    if (!fs.existsSync(pieChartImagePath)) {
      throw new Error(`Pie chart file not found: ${pieChartImagePath}`);
    }

    worksheet.getCell(`A${rowIndex}`).value = 'Распределение лекарств:';
    worksheet.getCell(`A${rowIndex}`).style = { font: { size: 14, bold: true } };
    rowIndex++;

    const pieImageId = workbook.addImage({
      filename: pieChartImagePath,
      extension: 'png',
    });
    worksheet.addImage(pieImageId, {
      tl: { col: 0, row: rowIndex },
      ext: { width: 400, height: 400 }
    });
    rowIndex += 15;

    await workbook.xlsx.writeFile(filePath);

    fs.unlinkSync(pieChartImagePath);

    const report = await Report.create({
      userId,
      type: 'medications_excel',
      startDate,
      endDate,
      filePath: filePath
    });

    // Отправляем только файл, убираем res.status(201).json
    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error('Download error:', err);
        next(ApiError.internal(err.message));
      } else {
      }
    });

    // Передаем reportId через заголовок (опционально)
    res.set('X-Report-Id', report.id);

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